import React, { useEffect, useRef, useState, useCallback } from 'react'
import { AssetManager, SpriteAnimation, PLAYER_ANIMATIONS, ENEMY_ANIMATIONS, MONSTER_ANIMATIONS, PORTAL_ANIMATIONS } from './AssetManager'
interface Player { x: number; y: number; health: number; stones: number; speed: number; stamina: number; attackCooldown: number; lives: number; hasAxe: boolean }
interface Enemy { id: number; x: number; y: number; speed: number; type: 'chaser' | 'wanderer' | 'boss'; health: number; size: number; direction?: number }
interface Stone { id: number; x: number; y: number; collected: boolean; glowing: boolean }
interface HealthPickup { id: number; x: number; y: number; collected: boolean; healing: number }
interface AxePickup { id: number; x: number; y: number; collected: boolean }
interface Tree { x: number; y: number; size: number; type: 'pine' | 'oak' | 'dead' | 'palm' }
interface Grass { x: number; y: number; h: number }
interface Bullet { id: number; x: number; y: number; vx: number; vy: number; life: number }
interface GunPickup { id: number; x: number; y: number; collected: boolean }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; size: number }
interface Level { id: number; name: string; environment: 'forest' | 'winter' | 'desert' | 'island'; unlocked: boolean; completed: boolean; enemyCount: number; stoneCount: number; weather: 'clear' | 'rain' | 'snow' | 'fog'; timeOfDay: 'day' | 'night' }
interface Flower { x: number; y: number; c: string }
interface Campfire { x: number; y: number; timeRemaining: number; active: boolean }
interface ManualIcon { x: number; y: number; size: number }
interface BulletPickup { id: number; x: number; y: number; collected: boolean; ammo: number }
interface SpeedBoost { id: number; x: number; y: number; collected: boolean }
interface Lake { x: number; y: number; radius: number; used: boolean }
interface SacrificeAltar { x: number; y: number; size: number; active: boolean }

const WORLD_WIDTH = 30000
const WORLD_HEIGHT = 3000
const PLAYER_SIZE = 12
const ENEMY_SIZE = 16
const STONE_SIZE = 14
const PORTAL_SIZE = 30
const MANUAL_ICON_SIZE = 20

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const VIRTUAL_WIDTH = 800
  const VIRTUAL_HEIGHT = 600
  const [canvasSize, setCanvasSize] = useState<{width:number;height:number}>({ width: VIRTUAL_WIDTH, height: VIRTUAL_HEIGHT })
  const pausedBySystemRef = useRef(false)
  const [gameState, setGameState] = useState<'loading' | 'menu' | 'levelSelect' | 'playing' | 'paused' | 'gameOver' | 'victory' | 'settings' | 'introVideo' | 'victoryVideo'>('loading')
  const [isFirstTime, setIsFirstTime] = useState(() => {
    return !localStorage.getItem('monsland-played-before')
  })
  const [currentLevel, setCurrentLevel] = useState(0)
  const [graphicsQuality, setGraphicsQuality] = useState<'low' | 'medium' | 'high'>('medium')
  const [player, setPlayer] = useState<Player>({ x: 400, y: 300, health: 100, stones: 0, speed: 2, stamina: 100, attackCooldown: 0, lives: 3, hasAxe: false })
  const [enemies, setEnemies] = useState<Enemy[]>([])
  const [stones, setStones] = useState<Stone[]>([])
  const [healthPickups, setHealthPickups] = useState<HealthPickup[]>([])
  const [axePickups, setAxePickups] = useState<AxePickup[]>([])
  const [gunPickups, setGunPickups] = useState<GunPickup[]>([])
  const [trees, setTrees] = useState<Tree[]>([])
  const [grass, setGrass] = useState<Grass[]>([])
  const [particles, setParticles] = useState<Particle[]>([])
  const [bullets, setBullets] = useState<Bullet[]>([])
  const [flowers, setFlowers] = useState<Flower[]>([])
  const [wood, setWood] = useState(0)
  const [campfires, setCampfires] = useState<Campfire[]>([])
  const lastCampfireTimeRef = useRef(0)
  const [showManual, setShowManual] = useState(false)
  const [hasSeenManual, setHasSeenManual] = useState(() => {
    return localStorage.getItem('monsland-manual-seen') === 'true'
  })
  const [manualIcon, setManualIcon] = useState<ManualIcon | null>(null)
  const [wasNearManualIcon, setWasNearManualIcon] = useState(false)
  const [bulletPickups, setBulletPickups] = useState<BulletPickup[]>([])
  const [ammo, setAmmo] = useState(0)
  const [speedBoosts, setSpeedBoosts] = useState<SpeedBoost[]>([])
  const [speedBoostActive, setSpeedBoostActive] = useState(false)
  const [speedBoostTimeLeft, setSpeedBoostTimeLeft] = useState(0)
  const [lakes, setLakes] = useState<Lake[]>([])
  const [invisibilityActive, setInvisibilityActive] = useState(false)
  const [invisibilityTimeLeft, setInvisibilityTimeLeft] = useState(0)
  const [sacrificeAltar, setSacrificeAltar] = useState<SacrificeAltar | null>(null)
  const [showSacrificeMenu, setShowSacrificeMenu] = useState(false)
  const [sacrificesMade, setSacrificesMade] = useState(0)
  const [screenShake, setScreenShake] = useState({ x: 0, y: 0, intensity: 0 })
  const [damageFlash, setDamageFlash] = useState(0)
  const [keys, setKeys] = useState<Set<string>>(new Set())
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [camera, setCamera] = useState({ x: 0, y: 0 })
  const [showMinimap, setShowMinimap] = useState(true)
  const [gameTime, setGameTime] = useState(0)
  const [bgPattern, setBgPattern] = useState<CanvasPattern | null>(null)
  const [stepPhase, setStepPhase] = useState(0) // for running animation
  const [sprintHeldTouch, setSprintHeldTouch] = useState(false)
  const lastHitTimeRef = useRef(0)
  const zeroStaminaTimeRef = useRef(0)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const backgroundMusicRef = useRef<HTMLAudioElement | null>(null)
  const backgroundGainRef = useRef<GainNode | null>(null)
  
  // Asset Manager and Animation System
  const assetManager = AssetManager.getInstance()
  const [assetsLoaded, setAssetsLoaded] = useState(false)
  const playerAnimationRef = useRef<SpriteAnimation>(new SpriteAnimation(PLAYER_ANIMATIONS.IDLE))
  const enemyAnimationsRef = useRef<Map<number, SpriteAnimation>>(new Map())
  const portalAnimationRef = useRef<SpriteAnimation>(new SpriteAnimation(PORTAL_ANIMATIONS.ACTIVE))
  const [playerAnimationState, setPlayerAnimationState] = useState<'idle' | 'walk' | 'sprint' | 'damage' | 'stamina'>('idle')
  const [playerDirection, setPlayerDirection] = useState<'left' | 'right'>('right')
  const [isWalkingSoundPlaying, setIsWalkingSoundPlaying] = useState(false)
  const walkingSoundIntervalRef = useRef<number | null>(null)
  const lastFrameTimeRef = useRef(Date.now())
  const ensureAudio = useCallback(() => {
    if (!audioCtxRef.current) {
      try { 
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      } catch (e) {
        console.warn('Audio context creation failed:', e)
        return
      }
    }
    
    // Resume audio context if suspended (required for user interaction)
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(e => {
        console.warn('Audio context resume failed:', e)
      })
    }
  }, [])
  const playSound = useCallback((type: 'pickup' | 'hit' | 'chop' | 'victory' | 'portal' | 'shoot') => {
    ensureAudio()
    
    // Try to play loaded sound first
    let soundKey = ''
    switch (type) {
      case 'pickup': soundKey = 'pickup-stone'; break
      case 'hit': soundKey = 'player-damage'; break
      case 'chop': soundKey = 'tree-chop'; break
      case 'victory': soundKey = 'victory'; break
      case 'portal': soundKey = 'victory'; break // Use victory sound for portal
      case 'shoot': soundKey = 'pickup-stone'; break // Fallback to pickup sound
    }
    
    if (soundKey && assetManager.getSound(soundKey)) {
      assetManager.playSound(soundKey, 0.3)
      return
    }
    
    // Fallback to synthesized sound if no audio file loaded
    const ctx = audioCtxRef.current
    if (!ctx) {
      console.warn('Audio context not available for', type)
      return
    }
    
    try {
      const o = ctx.createOscillator(); const g = ctx.createGain()
      o.connect(g); g.connect(ctx.destination)
      const now = ctx.currentTime
      let f = 440
      if (type === 'pickup') f = 880
      if (type === 'hit') f = 220
      if (type === 'chop') f = 330
      if (type === 'victory') f = 660
      if (type === 'portal') f = 520
      if (type === 'shoot') f = 700
      o.frequency.setValueAtTime(f, now)
      g.gain.setValueAtTime(0.0001, now)
      g.gain.exponentialRampToValueAtTime(0.05, now + 0.02) // Lower volume for fallback
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18)
      o.start(now); o.stop(now + 0.2)
    } catch (e) {
      console.warn('Synthesized sound failed for', type, ':', e)
    }
  }, [assetManager, ensureAudio])

  // Synthesized footstep sound with stamina variations
  const playFootstepSound = useCallback((isSprint: boolean = false, staminaLevel: number = 100) => {
    ensureAudio()
    const ctx = audioCtxRef.current
    if (!ctx) {
      console.warn('Audio context not available for footstep')
      return
    }
    
    try {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.connect(g)
      g.connect(ctx.destination)
      
      const now = ctx.currentTime
      
      // Different sounds based on movement type and stamina
      let baseFreq = 400
      let endFreq = 150
      let volume = 0.06
      let duration = 0.08
      
      if (staminaLevel <= 10) {
        // Exhausted - very slow, heavy breathing-like sound
        baseFreq = 200
        endFreq = 80
        volume = 0.04
        duration = 0.12
      } else if (staminaLevel <= 30) {
        // Low stamina - slower, heavier steps
        baseFreq = 300
        endFreq = 100
        volume = 0.05
        duration = 0.1
      } else if (isSprint) {
        // Sprinting - fast, light, high-pitched
        baseFreq = 800
        endFreq = 250
        volume = 0.08
        duration = 0.06
      } else {
        // Normal walking - medium pace
        baseFreq = 500
        endFreq = 150
        volume = 0.06
        duration = 0.08
      }
      
      o.frequency.setValueAtTime(baseFreq, now)
      o.frequency.exponentialRampToValueAtTime(endFreq, now + 0.02)
      
      g.gain.setValueAtTime(0.0001, now)
      g.gain.exponentialRampToValueAtTime(volume, now + 0.005)
      g.gain.exponentialRampToValueAtTime(0.0001, now + duration)
      
      o.start(now)
      o.stop(now + duration + 0.02)
    } catch (e) {
      console.warn('Footstep sound failed:', e)
    }
  }, [ensureAudio])

  // Start/stop footstep loop synced with animation frames
  const startFootstepLoop = useCallback((isSprint: boolean = false, staminaLevel: number = 100) => {
    if (walkingSoundIntervalRef.current) return // Already playing
    
    ensureAudio() // Make sure audio context is ready
    
    // Dynamic interval based on sprint and stamina
    let interval = 500 // Default walking
    
    if (staminaLevel <= 10) {
      interval = 1000 // Very slow when exhausted
    } else if (staminaLevel <= 30) {
      interval = 750 // Slower when low stamina
    } else if (isSprint) {
      interval = 250 // Fast sprint footsteps!
    } else {
      interval = 400 // Normal walking
    }
    
    playFootstepSound(isSprint, staminaLevel)
    
    walkingSoundIntervalRef.current = window.setInterval(() => {
      playFootstepSound(isSprint, staminaLevel)
    }, interval)
    
    setIsWalkingSoundPlaying(true)
  }, [playFootstepSound, ensureAudio])

  const stopFootstepLoop = useCallback(() => {
    if (walkingSoundIntervalRef.current) {
      clearInterval(walkingSoundIntervalRef.current)
      walkingSoundIntervalRef.current = null
    }
    setIsWalkingSoundPlaying(false)
  }, [])

  // Button click sound handler
  const handleButtonClick = useCallback(() => {
    ensureAudio()
    // Synthesized button click sound
    const ctx = audioCtxRef.current
    if (!ctx) {
      console.warn('Audio context not available for button click')
      return
    }
    
    try {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.connect(g)
      g.connect(ctx.destination)
      
      const now = ctx.currentTime
      o.frequency.setValueAtTime(1000, now)
      o.frequency.exponentialRampToValueAtTime(800, now + 0.05)
      
      g.gain.setValueAtTime(0.0001, now)
      g.gain.exponentialRampToValueAtTime(0.2, now + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.1)
      
      o.start(now)
      o.stop(now + 0.12)
    } catch (e) {
      console.warn('Button click sound failed:', e)
    }
  }, [ensureAudio])

  const [levels, setLevels] = useState<Level[]>([
    { id: 1, name: 'Haunted Forest', environment: 'forest', unlocked: true, completed: false, enemyCount: 12, stoneCount: 3, weather: 'fog', timeOfDay: 'night' },
    { id: 2, name: 'Frozen Wasteland', environment: 'winter', unlocked: false, completed: false, enemyCount: 18, stoneCount: 4, weather: 'snow', timeOfDay: 'night' },
    { id: 3, name: 'Desert of Souls', environment: 'desert', unlocked: false, completed: false, enemyCount: 25, stoneCount: 5, weather: 'clear', timeOfDay: 'day' },
    { id: 4, name: 'Cursed Island', environment: 'island', unlocked: false, completed: false, enemyCount: 35, stoneCount: 6, weather: 'rain', timeOfDay: 'night' }
  ])

  // Seeded RNG (mulberry32)
  const createRNG = useCallback((seed: number) => {
    let t = seed >>> 0
    return () => {
      t += 0x6D2B79F5
      let x = Math.imul(t ^ (t >>> 15), 1 | t)
      x ^= x + Math.imul(x ^ (x >>> 7), 61 | x)
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296
    }
  }, [])

  const createProceduralLevel = useCallback((id: number): Level => {
    // Randomized environment per id using deterministic seed
    let seed = 1337 + id * 1009
    const rng = () => { seed += 0x6D2B79F5; let x = Math.imul(seed ^ (seed >>> 15), 1 | seed); x ^= x + Math.imul(x ^ (x >>> 7), 61 | x); return ((x ^ (x >>> 14)) >>> 0) / 4294967296 }
    const environments: Level['environment'][] = ['forest', 'winter', 'desert', 'island']
    const weathers: Level['weather'][] = ['clear', 'rain', 'snow', 'fog']
    const times: Level['timeOfDay'][] = ['day', 'night']
    const env = environments[Math.floor(rng() * environments.length)]
    const difficulty = Math.max(1, id)
    const enemyCount = Math.min(80, 6 + Math.floor(difficulty * (1.2 + rng() * 1.0)))
    const stoneCount = Math.min(24, 3 + Math.floor(difficulty * (0.4 + rng() * 0.6)))
    return { id, name: `Procedural ${id}`, environment: env, unlocked: true, completed: false, enemyCount, stoneCount, weather: weathers[Math.floor(rng() * weathers.length)], timeOfDay: times[Math.floor(rng() * times.length)] }
  }, [])

  const initializeLevel = useCallback((levelIndex: number) => {
    const level = levels[levelIndex]
    if (!level) return

    // Clear existing enemy animations to force reload with new level sprites
    enemyAnimationsRef.current.clear()

    setPlayer({ x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2, health: 100, stones: 0, speed: 2, stamina: 100, attackCooldown: 0, lives: 3, hasAxe: false })

    // Per-level seeded RNG so maps differ
    const rng = createRNG(1337 + level.id * 1009)

    // Generate lake (1 per level) - invisibility power (circular)
    const newLakes: Lake[] = []
    const lakeX = 1000 + rng() * (WORLD_WIDTH - 2000)
    const lakeY = 500 + rng() * (WORLD_HEIGHT - 1000)
    const lakeRadius = 100 + rng() * 100 // Radius 100-200
    newLakes.push({ x: lakeX, y: lakeY, radius: lakeRadius, used: false })
    setLakes(newLakes)
    setInvisibilityActive(false)
    setInvisibilityTimeLeft(0)

    // Helper function to check if position is in water (for island level)
    const isInWater = (x: number, y: number) => {
      if (level.environment !== 'island') return false
      // Island has water on edges
      const margin = 400
      return x < margin || x > WORLD_WIDTH - margin || y < margin || y > WORLD_HEIGHT - margin
    }

    // Helper function to check if position is in lake (circular)
    const isInLake = (x: number, y: number) => {
      return newLakes.some(lake => {
        const dist = Math.hypot(x - lake.x, y - lake.y)
        return dist <= lake.radius
      })
    }

    const newTrees: Tree[] = []
    const treeCount = level.environment === 'desert' ? 800 : 2500
    for (let i = 0; i < treeCount; i++) {
      let treeType: Tree['type'] = 'pine'
      let tx = rng() * WORLD_WIDTH
      let ty = rng() * WORLD_HEIGHT
      
      // Don't place trees in water or lakes
      if (isInWater(tx, ty) || isInLake(tx, ty)) continue
      
      switch (level.environment) {
        case 'winter': treeType = rng() > 0.7 ? 'dead' : 'pine'; break
        case 'desert': treeType = rng() > 0.8 ? 'dead' : 'palm'; break
        case 'island': treeType = 'palm'; break
        default: treeType = rng() > 0.3 ? 'pine' : 'oak'
      }
      newTrees.push({ x: tx, y: ty, size: 15 + rng() * 35, type: treeType })
    }
    setTrees(newTrees)

    // Procedural grass carpet (lighter in winter, sand-colored in desert)
    const grassBlades: Grass[] = []
    const grassDensity = level.environment === 'desert' ? 0.0002 : 0.0012
    const count = Math.floor(WORLD_WIDTH * WORLD_HEIGHT * grassDensity)
    for (let i = 0; i < count; i++) {
      let gx = rng() * WORLD_WIDTH
      let gy = rng() * WORLD_HEIGHT
      
      // Don't place grass in water or lakes
      if (isInWater(gx, gy) || isInLake(gx, gy)) continue
      
      grassBlades.push({ x: gx, y: gy, h: 6 + rng() * 10 })
    }
    setGrass(grassBlades)

    const newEnemies: Enemy[] = []
    // Level-based difficulty scaling
    const baseSpeed = 1.2 + (levelIndex * 0.4) // Faster each level
    const baseHealth = 1 + Math.floor(levelIndex / 2) // More health every 2 levels
    
    // Ensure minimum enemies (more at night), add 1 boss dragon
    const isNight = level.timeOfDay === 'night'
    const minEnemies = Math.max(isNight ? 8 : 5, level.enemyCount)
    
    for (let i = 0; i < minEnemies; i++) {
      const isBoss = i === minEnemies - 1 // Last enemy is boss dragon
      const enemyType = isBoss ? 'boss' : (i < minEnemies - 3 ? 'chaser' : 'wanderer')
      const nightSpeedBoost = isNight ? 1.3 : 1.0 // 30% faster at night
      const speed = (enemyType === 'boss' ? baseSpeed * 1.5 : enemyType === 'chaser' ? baseSpeed : baseSpeed * 0.8) * nightSpeedBoost
      const health = enemyType === 'boss' ? baseHealth + 5 : baseHealth
      const size = enemyType === 'boss' ? 35 + (levelIndex * 4) : ENEMY_SIZE + levelIndex
      
      // Spawn away from player
      let ex, ey
      do {
        ex = rng() * WORLD_WIDTH
        ey = rng() * WORLD_HEIGHT
      } while (Math.hypot(ex - WORLD_WIDTH / 2, ey - WORLD_HEIGHT / 2) < 500) // At least 500px from spawn
      
      newEnemies.push({ 
        id: i, 
        x: ex, 
        y: ey, 
        speed: speed, 
        type: enemyType, 
        health: health, 
        size: size, 
        direction: rng() * Math.PI * 2 
      })
    }
    setEnemies(newEnemies)

    const newStones: Stone[] = []
    for (let i = 0; i < level.stoneCount; i++) newStones.push({ id: i, x: 100 + rng() * (WORLD_WIDTH - 200), y: 100 + rng() * (WORLD_HEIGHT - 200), collected: false, glowing: true })
    setStones(newStones)

    // Generate health pickups (restore 1 life each)
    const newHealthPickups: HealthPickup[] = []
    for (let i = 0; i < Math.min(5, Math.floor(level.enemyCount / 2)); i++) {
      newHealthPickups.push({ id: i, x: 50 + rng() * (WORLD_WIDTH - 100), y: 50 + rng() * (WORLD_HEIGHT - 100), collected: false, healing: 1 }) // Healing = 1 life
    }
    setHealthPickups(newHealthPickups)

    // Generate axe pickups (2 per level)
    const newAxePickups: AxePickup[] = []
    for (let i = 0; i < 2; i++) {
      newAxePickups.push({ id: i, x: 100 + rng() * (WORLD_WIDTH - 200), y: 100 + rng() * (WORLD_HEIGHT - 200), collected: false })
    }
    setAxePickups(newAxePickups)
    // Generate gun pickups on all levels (2-3 guns per level)
    const newGunPickups: GunPickup[] = []
    const gunCount = 2 + Math.floor(rng() * 2) // 2-3 guns
    for (let i = 0; i < gunCount; i++) {
      newGunPickups.push({ 
        id: i, 
        x: 100 + rng() * (WORLD_WIDTH - 200), 
        y: 100 + rng() * (WORLD_HEIGHT - 200), 
        collected: false 
      })
    }
    setGunPickups(newGunPickups)
    
    // Generate bullet pickups (ammo refills) - 3-5 per level
    const newBulletPickups: BulletPickup[] = []
    const bulletPickupCount = 3 + Math.floor(rng() * 3) // 3-5 bullet pickups
    for (let i = 0; i < bulletPickupCount; i++) {
      newBulletPickups.push({
        id: i,
        x: 100 + rng() * (WORLD_WIDTH - 200),
        y: 100 + rng() * (WORLD_HEIGHT - 200),
        collected: false,
        ammo: 30
      })
    }
    setBulletPickups(newBulletPickups)
    setAmmo(0) // Reset ammo on new level
    
    // Generate speed boost pickups - 2-3 per level
    const newSpeedBoosts: SpeedBoost[] = []
    const speedBoostCount = 2 + Math.floor(rng() * 2) // 2-3 speed boosts
    for (let i = 0; i < speedBoostCount; i++) {
      newSpeedBoosts.push({
        id: i,
        x: 100 + rng() * (WORLD_WIDTH - 200),
        y: 100 + rng() * (WORLD_HEIGHT - 200),
        collected: false
      })
    }
    setSpeedBoosts(newSpeedBoosts)
    setSpeedBoostActive(false)
    setSpeedBoostTimeLeft(0)
    
    // Generate Sacrifice Altar (1 per level) - Theme: "Sacrifices Must be Made"
    const altarX = 2000 + rng() * (WORLD_WIDTH - 4000)
    const altarY = 800 + rng() * (WORLD_HEIGHT - 1600)
    setSacrificeAltar({ x: altarX, y: altarY, size: 40, active: true })
    
    setParticles([])
    // Decorative flowers
    const flowerColors = level.environment === 'desert' ? ['#fbbf24','#eab308','#f59e0b'] : level.environment === 'winter' ? ['#93c5fd','#e5e7eb','#bfdbfe'] : ['#ef4444','#22c55e','#a78bfa','#f472b6']
    const newFlowers: Flower[] = []
    for (let i = 0; i < 600; i++) newFlowers.push({ x: rng() * WORLD_WIDTH, y: rng() * WORLD_HEIGHT, c: flowerColors[Math.floor(rng()*flowerColors.length)] })
    setFlowers(newFlowers)
    
    // Create manual icon near portal (offset to the right)
    setManualIcon({ x: WORLD_WIDTH / 2 + 80, y: WORLD_HEIGHT / 2, size: MANUAL_ICON_SIZE })
    
    // Show manual automatically on first level if not seen before
    if (levelIndex === 0 && !hasSeenManual) {
      setTimeout(() => {
        setShowManual(true)
      }, 1000) // Show after 1 second delay
    }
  }, [levels, createRNG, hasSeenManual])

  const createParticle = useCallback((x: number, y: number, color: string, count: number = 5) => {
    // Graphics quality affects particle count
    const qualityMultiplier = graphicsQuality === 'low' ? 0.3 : graphicsQuality === 'medium' ? 0.6 : 1
    const adjustedCount = Math.max(1, Math.floor(count * qualityMultiplier))
    const newParticles: Particle[] = []
    for (let i = 0; i < adjustedCount; i++) newParticles.push({ x: x + (Math.random() - 0.5) * 20, y: y + (Math.random() - 0.5) * 20, vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4, life: 60, maxLife: 60, color, size: 2 + Math.random() * 4 })
    setParticles(prev => [...prev, ...newParticles])
  }, [graphicsQuality])

  const updateWeather = useCallback(() => {
    const level = levels[currentLevel]
    if (!level || graphicsQuality === 'low') return
    if (level.weather === 'rain' || level.weather === 'snow') {
      const weatherParticles = level.weather === 'rain' ? 3 : 2
      for (let i = 0; i < weatherParticles; i++) createParticle(Math.random() * WORLD_WIDTH, 0, level.weather === 'rain' ? '#60a5fa' : '#ffffff', 1)
    }
  }, [currentLevel, levels, createParticle, graphicsQuality])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && gameState === 'playing') { setGameState('paused'); return }
      setKeys(prev => new Set(prev).add(e.key.toLowerCase()))
    }
    const handleKeyUp = (e: KeyboardEvent) => { setKeys(prev => { const n = new Set(prev); n.delete(e.key.toLowerCase()); return n }) }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp) }
  }, [gameState])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const normX = ((e.clientX - rect.left) / rect.width) * VIRTUAL_WIDTH
    const normY = ((e.clientY - rect.top) / rect.height) * VIRTUAL_HEIGHT
    setMousePos({ x: normX, y: normY })
  }, [])

  // Touch controls
  const [isTouchMode, setIsTouchMode] = useState(false)
  const [joystickActive, setJoystickActive] = useState(false)
  const [joystickStart, setJoystickStart] = useState<{ x: number; y: number } | null>(null)
  const [joystickPos, setJoystickPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  useEffect(() => { const mq = window.matchMedia('(pointer: coarse)'); setIsTouchMode(mq.matches) }, [])

  useEffect(() => {
    // Responsive canvas: use full viewport with proper aspect ratio
    const updateCanvasSize = () => {
      const availW = window.innerWidth
      const availH = window.innerHeight - 60 // leave space for HUD
      let targetW = availW
      let targetH = Math.floor(targetW * (VIRTUAL_HEIGHT / VIRTUAL_WIDTH))
      if (targetH > availH) {
        targetH = availH
        targetW = Math.floor(targetH * (VIRTUAL_WIDTH / VIRTUAL_HEIGHT))
      }
      setCanvasSize({ width: targetW, height: targetH })
      const c = canvasRef.current
      if (c) { c.width = targetW; c.height = targetH }
    }
    updateCanvasSize()
    window.addEventListener('resize', updateCanvasSize)
    return () => window.removeEventListener('resize', updateCanvasSize)
  }, [])

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && gameState === 'playing') { setGameState('paused'); pausedBySystemRef.current = true }
    }
    document.addEventListener('visibilitychange', onVisibility)
    const onFocus = () => { if (pausedBySystemRef.current && gameState === 'paused') { setGameState('playing'); pausedBySystemRef.current = false } }
    window.addEventListener('focus', onFocus)
    return () => { document.removeEventListener('visibilitychange', onVisibility); window.removeEventListener('focus', onFocus) }
  }, [gameState])

  // Asset loading effect
  // Initialize audio on first user interaction
  useEffect(() => {
    const handleFirstInteraction = () => {
      ensureAudio()
      console.log('Audio initialized on user interaction')
      document.removeEventListener('click', handleFirstInteraction)
      document.removeEventListener('keydown', handleFirstInteraction)
      document.removeEventListener('touchstart', handleFirstInteraction)
    }
    
    document.addEventListener('click', handleFirstInteraction)
    document.addEventListener('keydown', handleFirstInteraction)
    document.addEventListener('touchstart', handleFirstInteraction)
    
    return () => {
      document.removeEventListener('click', handleFirstInteraction)
      document.removeEventListener('keydown', handleFirstInteraction)
      document.removeEventListener('touchstart', handleFirstInteraction)
    }
  }, [ensureAudio])

  useEffect(() => {
    if (gameState === 'loading' && !assetsLoaded) {
      assetManager.loadAllAssets().then(() => {
        setAssetsLoaded(true)
        setTimeout(() => {
          setGameState('menu')
        }, 1000) // Show loaded state briefly before transitioning
      }).catch((error) => {
        console.warn('Some assets failed to load:', error)
        setAssetsLoaded(true)
        setTimeout(() => {
          setGameState('menu')
        }, 1000)
      })
    }
  }, [gameState, assetsLoaded, assetManager])

  // Background music system
  useEffect(() => {
    if (gameState !== 'playing') {
      // Stop music when not playing
      if (backgroundMusicRef.current) {
        backgroundMusicRef.current.pause()
      }
      return
    }

    // Initialize background music (optional - only if file exists)
    if (!backgroundMusicRef.current) {
      ensureAudio()
      const ctx = audioCtxRef.current
      if (ctx) {
        const audio = new Audio('assets/sounds/background_sound.mp3')
        audio.loop = true
        audio.volume = 0.3 // Base volume (low)
        
        // Handle load error gracefully
        audio.addEventListener('error', () => {
          console.log('Background music file not found - add background_sound.mp3 to /sounds/ folder')
        })
        
        // Only set up if audio loads successfully
        audio.addEventListener('canplaythrough', () => {
          // Create gain node for dynamic volume control
          const source = ctx.createMediaElementSource(audio)
          const gainNode = ctx.createGain()
          gainNode.gain.value = 1.0
          source.connect(gainNode)
          gainNode.connect(ctx.destination)
          
          backgroundMusicRef.current = audio
          backgroundGainRef.current = gainNode
          
          // Start playing
          audio.play().catch(() => console.log('Background music autoplay blocked - click to start'))
        }, { once: true })
        
        // Try to load
        audio.load()
      }
    } else {
      // Resume if paused
      backgroundMusicRef.current.play().catch(() => console.log('Background music play failed'))
    }

    return () => {
      // Pause when component unmounts or game stops
      if (backgroundMusicRef.current) {
        backgroundMusicRef.current.pause()
      }
    }
  }, [gameState, ensureAudio])

  useEffect(() => {
    // Stop walking sound when not playing, manual is open, or sacrifice menu is open
    if (gameState !== 'playing' || showManual || showSacrificeMenu) {
      if (isWalkingSoundPlaying) {
        stopFootstepLoop()
      }
      return
    }
    const gameLoop = setInterval(() => {
      setGameTime(prev => prev + 1)
      setParticles(prev => prev.map(p => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, life: p.life - 1 })).filter(p => p.life > 0))
      if (gameTime % 10 === 0) updateWeather()
      
      // Update screen shake (decay over time)
      setScreenShake(prev => {
        if (prev.intensity > 0) {
          return {
            x: (Math.random() - 0.5) * prev.intensity,
            y: (Math.random() - 0.5) * prev.intensity,
            intensity: prev.intensity * 0.85 // Decay
          }
        }
        return { x: 0, y: 0, intensity: 0 }
      })
      
      // Update damage flash (fade out)
      setDamageFlash(prev => Math.max(0, prev - 0.05))
      
      // Dynamic background music volume based on enemy proximity
      if (backgroundGainRef.current && enemies.length > 0) {
        const closestEnemy = enemies.reduce((closest, enemy) => {
          const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y)
          return dist < closest ? dist : closest
        }, Infinity)
        
        // Volume increases as enemies get closer
        // Far (>800): 1.0x (low volume)
        // Medium (400-800): 1.5x
        // Close (<400): 2.5x (high volume - tension!)
        let volumeMultiplier = 1.0
        if (closestEnemy < 400) {
          volumeMultiplier = 2.5 // Very close - high tension!
        } else if (closestEnemy < 800) {
          volumeMultiplier = 1.5 // Medium distance
        }
        
        // Smooth transition
        const currentGain = backgroundGainRef.current.gain.value
        const targetGain = volumeMultiplier
        backgroundGainRef.current.gain.value = currentGain + (targetGain - currentGain) * 0.1
      }

      // Update animations
      const now = Date.now()
      const deltaTime = now - lastFrameTimeRef.current
      lastFrameTimeRef.current = now
      
      // Update portal animation
      portalAnimationRef.current.update(deltaTime)
      
      // Update player animation
      playerAnimationRef.current.update(deltaTime)
      
      // Update campfire timers
      setCampfires(prev => prev.map(cf => ({
        ...cf,
        timeRemaining: Math.max(0, cf.timeRemaining - 1),
        active: cf.timeRemaining > 0
      })).filter(cf => cf.timeRemaining > 0)) // Remove expired campfires

      setPlayer(prev => {
        let newX = prev.x, newY = prev.y
        let analogDx = 0, analogDy = 0
        if (joystickActive && joystickStart) {
          const dx = joystickPos.x - joystickStart.x
          const dy = joystickPos.y - joystickStart.y
          const mag = Math.max(1, Math.hypot(dx, dy))
          const clamped = Math.min(1, mag / 40)
          analogDx = (dx / mag) * clamped
          analogDy = (dy / mag) * clamped
        }
        // Sprint check (Shift or touch sprint button) with stamina gating
        // During speed boost: unlimited stamina!
        const canSprint = speedBoostActive || player.stamina > 0
        const isSprinting = keys.has('shift') && canSprint
        const baseSpeed = 2 // Base walking speed
        const sprintMultiplier = isSprinting ? 2.2 : 1.0 // Sprint = 2.2x faster (increased from 1.8)
        const speedBoostMultiplier = speedBoostActive ? 1.8 : 1.0 // Speed boost = 1.8x faster (increased from 1.5)
        const moveSpeed = baseSpeed * sprintMultiplier * speedBoostMultiplier
        // No stamina drain during speed boost!
        const staminaDrain = speedBoostActive ? -0.5 : (isSprinting ? 0.7 : -0.35)

        if (keys.has('w')) newY -= moveSpeed
        if (keys.has('s')) newY += moveSpeed
        if (keys.has('a')) newX -= moveSpeed
        if (keys.has('d')) newX += moveSpeed
        const movingKeyboard = keys.has('w') || keys.has('a') || keys.has('s') || keys.has('d')
        if (analogDx !== 0 || analogDy !== 0) { newX += analogDx * moveSpeed * 1.5; newY += analogDy * moveSpeed * 1.5 }
        const isMoving = movingKeyboard || analogDx !== 0 || analogDy !== 0
        newX = Math.max(PLAYER_SIZE, Math.min(WORLD_WIDTH - PLAYER_SIZE, newX))
        newY = Math.max(PLAYER_SIZE, Math.min(WORLD_HEIGHT - PLAYER_SIZE, newY))
        // advance running phase faster when sprinting
        const wantsSprint = keys.has('shift') && player.stamina > 0
        if (isMoving) setStepPhase(p => (p + (wantsSprint ? 0.35 : 0.2)) % (Math.PI * 2))
        // update stamina
        let newStamina = Math.max(0, Math.min(100, prev.stamina - (isMoving ? staminaDrain : -0.5)))
        const newAttackCooldown = Math.max(0, prev.attackCooldown - 1)
        
        // Track zero stamina time for exhaustion damage
        if (newStamina <= 0 && isMoving) {
          if (zeroStaminaTimeRef.current === 0) {
            zeroStaminaTimeRef.current = gameTime
          } else if (gameTime - zeroStaminaTimeRef.current >= 360) { // 6 seconds @ 60fps
            // Player has been moving with 0 stamina for 6 seconds - take damage!
            zeroStaminaTimeRef.current = gameTime // Reset timer
            ensureAudio(); playSound('hit')
            createParticle(prev.x, prev.y, '#ef4444', 8)
            setScreenShake({ x: 0, y: 0, intensity: 10 })
            setDamageFlash(0.4)
            return { ...prev, lives: prev.lives - 1, x: newX, y: newY, stamina: newStamina, attackCooldown: newAttackCooldown }
          }
        } else {
          zeroStaminaTimeRef.current = 0 // Reset timer when stamina recovers or player stops
        }
        
        // Update player animation state and direction
        const currentTime = Date.now()
        
        // Determine player direction based on movement
        if (keys.has('a') || analogDx < 0) {
          setPlayerDirection('left')
        } else if (keys.has('d') || analogDx > 0) {
          setPlayerDirection('right')
        }
        
        if (currentTime - lastHitTimeRef.current < 2000) {
          // Player is taking damage (extended to 2 seconds)
          if (playerAnimationState !== 'damage') {
            setPlayerAnimationState('damage')
            playerAnimationRef.current = new SpriteAnimation(PLAYER_ANIMATIONS.DAMAGE, 4)
          }
        } else if (newStamina <= 0) {
          // Player is out of stamina
          if (playerAnimationState !== 'stamina') {
            setPlayerAnimationState('stamina')
            playerAnimationRef.current = new SpriteAnimation(PLAYER_ANIMATIONS.OUT_OF_STAMINA, 4)
          }
        } else if (isMoving && wantsSprint) {
          // Player is sprinting
          if (playerAnimationState !== 'sprint') {
            setPlayerAnimationState('sprint')
            playerAnimationRef.current = new SpriteAnimation(PLAYER_ANIMATIONS.SPRINT, 12) // Faster animation for sprint
            // Restart footstep sound with sprint timing
            stopFootstepLoop()
            startFootstepLoop(true, player.stamina)
          }
          // Start sprint footstep sounds
          if (!isWalkingSoundPlaying) {
            startFootstepLoop(true, player.stamina) // Sprint with stamina level
          }
        } else if (isMoving) {
          // Player is walking
          if (playerAnimationState !== 'walk') {
            setPlayerAnimationState('walk')
            playerAnimationRef.current = new SpriteAnimation(PLAYER_ANIMATIONS.WALK, 8)
            // Restart footstep sound with walk timing
            stopFootstepLoop()
            startFootstepLoop(false, player.stamina)
          }
          // Start normal walking footstep sounds
          if (!isWalkingSoundPlaying) {
            startFootstepLoop(false, player.stamina) // Normal walk with stamina level
          }
        } else {
          // Player is idle
          if (playerAnimationState !== 'idle') {
            setPlayerAnimationState('idle')
            playerAnimationRef.current = new SpriteAnimation(PLAYER_ANIMATIONS.IDLE, 2)
          }
          // Stop footstep sounds immediately
          if (isWalkingSoundPlaying) {
            stopFootstepLoop()
          }
        }
        
        return { ...prev, x: newX, y: newY, stamina: newStamina, attackCooldown: newAttackCooldown }
      })

      setCamera({ x: Math.max(0, Math.min(WORLD_WIDTH - 800, player.x - 400)), y: Math.max(0, Math.min(WORLD_HEIGHT - 600, player.y - 300)) })

      // Bullets update
      setBullets(prev => prev.map(b => ({ ...b, x: b.x + b.vx, y: b.y + b.vy, life: b.life - 1 })).filter(b => b.life > 0 && b.x > 0 && b.x < WORLD_WIDTH && b.y > 0 && b.y < WORLD_HEIGHT))

      // Bullet-enemy collisions
      if (bullets.length && enemies.length) {
        const toRemove: Set<number> = new Set()
        const updatedEnemies = enemies.map(e => {
          let health = e.health
          bullets.forEach(b => {
            if (toRemove.has(b.id)) return
            const d = Math.hypot(b.x - e.x, b.y - e.y)
            if (d < e.size + 2) { health -= 1; toRemove.add(b.id); createParticle(e.x, e.y, '#ef4444', 6) }
          })
          return { ...e, health }
        }).filter(e => e.health > 0)
        setEnemies(updatedEnemies)
        if (toRemove.size) setBullets(prev => prev.filter(b => !toRemove.has(b.id)))
      }

      // Update speed boost timer
      if (speedBoostActive && speedBoostTimeLeft > 0) {
        setSpeedBoostTimeLeft(prev => prev - 1)
        if (speedBoostTimeLeft <= 1) {
          setSpeedBoostActive(false)
        }
      }
      
      // Procedural enemy spawning - more aggressive at night
      const isNight = levels[currentLevel].timeOfDay === 'night'
      const minEnemies = isNight ? 8 : 5 // More enemies at night
      
      setEnemies(prev => {
        if (prev.length < minEnemies) {
          const speedMultiplier = isNight ? 1.3 : 1.0 // Faster at night
          const newEnemy: Enemy = {
            id: Math.max(...prev.map(e => e.id), 0) + 1,
            x: player.x + (Math.random() - 0.5) * 2000 + (Math.random() > 0.5 ? 800 : -800),
            y: player.y + (Math.random() - 0.5) * 2000 + (Math.random() > 0.5 ? 800 : -800),
            speed: (1.2 + (currentLevel * 0.4)) * speedMultiplier,
            type: 'chaser',
            health: 1 + Math.floor(currentLevel / 2),
            size: ENEMY_SIZE + currentLevel,
            direction: Math.random() * Math.PI * 2
          }
          return [...prev, newEnemy]
        }
        return prev
      })
      
      setEnemies(prev => prev.map(enemy => {
        let newX = enemy.x, newY = enemy.y
        
        // Check if it's night for enemy speed boost (only apply at night)
        const currentIsNight = levels[currentLevel].timeOfDay === 'night'
        const speedMultiplier = currentIsNight ? 1.0 : (1.0 / 1.3) // Reduce speed during day
        
        // Check if enemy is near an active campfire (distraction)
        const nearCampfire = campfires.find(cf => cf.active && Math.hypot(cf.x - enemy.x, cf.y - enemy.y) < 200)
        
        if (nearCampfire) {
          // Enemy is distracted by campfire - move towards it instead of player
          const dx = nearCampfire.x - enemy.x, dy = nearCampfire.y - enemy.y
          const d = Math.hypot(dx, dy)
          if (d > 0) { 
            newX += (dx / d) * enemy.speed * speedMultiplier * 0.5 // Slower movement towards campfire
            newY += (dy / d) * enemy.speed * speedMultiplier * 0.5
          }
        } else if (enemy.type === 'chaser' || enemy.type === 'boss') {
          // Normal behavior - chase player (unless player is invisible!)
          if (!invisibilityActive) {
            const dx = player.x - enemy.x, dy = player.y - enemy.y
            const d = Math.hypot(dx, dy)
            if (d > 0) { 
              newX += (dx / d) * enemy.speed * speedMultiplier
              newY += (dy / d) * enemy.speed * speedMultiplier
            }
          }
          // If invisible, enemies just wander randomly
          else {
            const newDir = (enemy.direction ?? 0) + (Math.random() - 0.5) * 0.3
            newX += Math.cos(newDir) * enemy.speed * speedMultiplier * 0.5
            newY += Math.sin(newDir) * enemy.speed * speedMultiplier * 0.5
            enemy.direction = newDir
          }
        } else {
          // Wanderer behavior
          const newDir = (enemy.direction ?? 0) + (Math.random() - 0.5) * 0.2
          newX += Math.cos(newDir) * enemy.speed * speedMultiplier
          newY += Math.sin(newDir) * enemy.speed * speedMultiplier
          newX = Math.max(enemy.size, Math.min(WORLD_WIDTH - enemy.size, newX))
          newY = Math.max(enemy.size, Math.min(WORLD_HEIGHT - enemy.size, newY))
          return { ...enemy, x: newX, y: newY, direction: newDir }
        }
        newX = Math.max(enemy.size, Math.min(WORLD_WIDTH - enemy.size, newX))
        newY = Math.max(enemy.size, Math.min(WORLD_HEIGHT - enemy.size, newY))
        
        // Update enemy animations with level-specific monsters
        if (!enemyAnimationsRef.current.has(enemy.id)) {
          let monsterFrames = ENEMY_ANIMATIONS.CHASE // Fallback
          // Check if level-specific monster sprites are loaded
          const levelKey = `monster${currentLevel + 1}-1` // Check first frame of current level
          const hasLevelSprites = assetManager.getImage(levelKey) !== null
          
          if (hasLevelSprites) {
            switch (currentLevel) {
              case 0: monsterFrames = MONSTER_ANIMATIONS.LEVEL1; break
              case 1: monsterFrames = MONSTER_ANIMATIONS.LEVEL2; break
              case 2: monsterFrames = MONSTER_ANIMATIONS.LEVEL3; break
              case 3: monsterFrames = MONSTER_ANIMATIONS.LEVEL4; break
              default: monsterFrames = ENEMY_ANIMATIONS.CHASE; break
            }
            console.log(`Using level ${currentLevel + 1} monster sprites:`, monsterFrames)
          } else {
            console.log(`Level ${currentLevel + 1} monster sprites not found, using fallback`)
          }
          enemyAnimationsRef.current.set(enemy.id, new SpriteAnimation(monsterFrames, 6))
        }
        const enemyAnim = enemyAnimationsRef.current.get(enemy.id)!
        enemyAnim.update(deltaTime)
        
        return { ...enemy, x: newX, y: newY }
      }))

      setStones(prev => prev.map(stone => {
        if (!stone.collected) {
          const dx = player.x - stone.x, dy = player.y - stone.y
          const d = Math.hypot(dx, dy)
          if (d < PLAYER_SIZE + STONE_SIZE) { ensureAudio(); playSound('pickup'); setPlayer(p => ({ ...p, stones: p.stones + 1 })); createParticle(stone.x, stone.y, '#fbbf24', 10); return { ...stone, collected: true } }
        }
        return stone
      }))

      // Check health pickup collection (restores 1 life, max 3)
      setHealthPickups(prev => prev.map(pickup => {
        if (!pickup.collected) {
          const dx = player.x - pickup.x, dy = player.y - pickup.y
          const d = Math.hypot(dx, dy)
          if (d < PLAYER_SIZE + 12) {
            ensureAudio(); playSound('pickup')
            setPlayer(p => ({ ...p, lives: Math.min(3, p.lives + 1) })) // Add 1 life, max 3
            createParticle(pickup.x, pickup.y, '#22c55e', 10)
            return { ...pickup, collected: true }
          }
        }
        return pickup
      }))

      // Check axe pickup collection
      setAxePickups(prev => prev.map(axe => {
        if (!axe.collected) {
          const dx = player.x - axe.x, dy = player.y - axe.y
          const d = Math.hypot(dx, dy)
          if (d < PLAYER_SIZE + 12) {
            ensureAudio(); playSound('pickup')
            setPlayer(p => ({ ...p, hasAxe: true }))
            createParticle(axe.x, axe.y, '#FFD700', 10)
            return { ...axe, collected: true }
          }
        }
        return axe
      }))
      
      // Check gun pickup collection
      setGunPickups(prev => prev.map(gun => {
        if (!gun.collected) {
          const dx = player.x - gun.x, dy = player.y - gun.y
          const d = Math.hypot(dx, dy)
          if (d < PLAYER_SIZE + 14) {
            ensureAudio(); playSound('pickup')
            createParticle(gun.x, gun.y, '#60a5fa', 10)
            setAmmo(a => a + 30) // Add 30 bullets when picking up gun (not 50)
            return { ...gun, collected: true }
          }
        }
        return gun
      }))
      
      // Check bullet pickup collection
      setBulletPickups(prev => prev.map(bullet => {
        if (!bullet.collected) {
          const dx = player.x - bullet.x, dy = player.y - bullet.y
          const d = Math.hypot(dx, dy)
          if (d < PLAYER_SIZE + 12) {
            ensureAudio(); playSound('pickup')
            createParticle(bullet.x, bullet.y, '#fbbf24', 10)
            setAmmo(a => a + bullet.ammo) // Add 30 bullets
            return { ...bullet, collected: true }
          }
        }
        return bullet
      }))
      
      // Check speed boost pickup collection
      setSpeedBoosts(prev => prev.map(boost => {
        if (!boost.collected) {
          const dx = player.x - boost.x, dy = player.y - boost.y
          const d = Math.hypot(dx, dy)
          if (d < PLAYER_SIZE + 12) {
            ensureAudio(); playSound('pickup')
            createParticle(boost.x, boost.y, '#06b6d4', 15)
            setSpeedBoostActive(true)
            setSpeedBoostTimeLeft(420) // 7 seconds (60 frames per second)
            return { ...boost, collected: true }
          }
        }
        return boost
      }))
      
      // Check lake collision (invisibility power) - circular
      setLakes(prev => prev.map(lake => {
        const dist = Math.hypot(player.x - lake.x, player.y - lake.y)
        const inLake = dist <= lake.radius
        
        if (inLake) {
          if (!lake.used) {
            // First touch - grant invisibility
            ensureAudio(); playSound('pickup')
            createParticle(player.x, player.y, '#3b82f6', 20)
            setInvisibilityActive(true)
            setInvisibilityTimeLeft(1800) // 30 seconds @ 60fps
            return { ...lake, used: true }
          } else if (!invisibilityActive) {
            // Already used - damage player (but not if invisible!)
            const now = gameTime
            if (now - lastHitTimeRef.current > 60) {
              setPlayer(p => ({ ...p, lives: p.lives - 1 }))
              lastHitTimeRef.current = now
              ensureAudio(); playSound('hit')
              createParticle(player.x, player.y, '#ef4444', 8)
            }
          }
        }
        return lake
      }))
      
      // Check if player is in poisonous water (island level only)
      if (levels[currentLevel].environment === 'island') {
        const margin = 400
        const inWater = player.x < margin || player.x > WORLD_WIDTH - margin || 
                        player.y < margin || player.y > WORLD_HEIGHT - margin
        
        if (inWater) {
          // Player dies in poisonous water
          const now = gameTime
          if (now - lastHitTimeRef.current > 30) { // Faster damage in water
            setPlayer(p => ({ ...p, lives: p.lives - 1 }))
            lastHitTimeRef.current = now
            ensureAudio(); playSound('hit')
            createParticle(player.x, player.y, '#8b5cf6', 10)
          }
        }
      }
      
      // Update invisibility timer
      if (invisibilityActive && invisibilityTimeLeft > 0) {
        setInvisibilityTimeLeft(prev => prev - 1)
        if (invisibilityTimeLeft <= 1) {
          setInvisibilityActive(false)
        }
      }
      
      // Check Sacrifice Altar interaction
      if (sacrificeAltar && sacrificeAltar.active) {
        const dx = player.x - sacrificeAltar.x
        const dy = player.y - sacrificeAltar.y
        const d = Math.hypot(dx, dy)
        const isNear = d < PLAYER_SIZE + sacrificeAltar.size
        
        if (isNear && keys.has('e')) {
          // Player pressed E near altar - show sacrifice menu
          setShowSacrificeMenu(true)
        }
      }
      
      // Check manual icon interaction
      if (manualIcon) {
        const dx = player.x - manualIcon.x
        const dy = player.y - manualIcon.y
        const d = Math.hypot(dx, dy)
        const isNear = d < PLAYER_SIZE + manualIcon.size + 10
        
        if (isNear && !wasNearManualIcon && !showManual) {
          // Player just entered range - show manual
          setShowManual(true)
          setWasNearManualIcon(true)
        } else if (!isNear && wasNearManualIcon) {
          // Player left range - reset flag
          setWasNearManualIcon(false)
        }
      }

      // Tree collision logic (invisible players can pass through!)
      if (!invisibilityActive) {
        trees.forEach(tree => {
          const dx = player.x - tree.x
          const dy = player.y - tree.y
          const distance = Math.sqrt(dx * dx + dy * dy)
          if (distance < PLAYER_SIZE + tree.size / 2) { // Collision with tree
            if (!player.hasAxe) { // Only take damage if no axe
            setPlayer(prev => {
              if (prev.lives > 0 && gameTime % 30 === 0) { // Damage every 0.5s
                ensureAudio(); playSound('hit'); createParticle(player.x, player.y, '#ef4444', 5)
                // Apply knockback
                const knockbackForce = 15
                const angleToTree = Math.atan2(dy, dx)
                const knockbackX = player.x + Math.cos(angleToTree) * knockbackForce
                const knockbackY = player.y + Math.sin(angleToTree) * knockbackForce
                return { ...prev, lives: prev.lives - 1, x: knockbackX, y: knockbackY }
              }
              return prev
            })
          }
        }
        })
      }

      enemies.forEach(enemy => {
        const dx = player.x - enemy.x, dy = player.y - enemy.y
        const d = Math.hypot(dx, dy)
        if (d < PLAYER_SIZE + enemy.size) {
          // Invulnerability window (0.6s)
          if (gameTime - lastHitTimeRef.current > 36) {
            lastHitTimeRef.current = gameTime
            ensureAudio(); playSound('hit'); createParticle(player.x, player.y, '#ef4444', 8)
            const knockbackForce = 20
            const ang = Math.atan2(dy, dx)
            const kx = player.x + Math.cos(ang) * knockbackForce
            const ky = player.y + Math.sin(ang) * knockbackForce
            setPlayer(prev => ({ ...prev, lives: prev.lives - 1, x: kx, y: ky }))
            // Screen shake and damage flash!
            setScreenShake({ x: 0, y: 0, intensity: 15 })
            setDamageFlash(0.6)
          }
        }
        // Campfire distraction is now handled in the enemy movement logic above
      })

      // Attack logic (spacebar to chop trees with axe)
      if (keys.has(' ') && player.attackCooldown === 0 && player.hasAxe) {
        setPlayer(prev => ({ ...prev, attackCooldown: 30 })) // 0.5s cooldown
        const attackRange = PLAYER_SIZE + 20
        const attackAngle = Math.atan2(mousePos.y - 300, mousePos.x - 400)
        const attackX = player.x + Math.cos(attackAngle) * attackRange
        const attackY = player.y + Math.sin(attackAngle) * attackRange

        setTrees(prevTrees => prevTrees.filter(tree => {
          const dx = attackX - tree.x
          const dy = attackY - tree.y
          const distance = Math.sqrt(dx * dx + dy * dy)
          if (distance < tree.size) {
            ensureAudio(); playSound('chop'); createParticle(tree.x, tree.y, '#92400e', 15) // Wood particles
            setWood(w => w + 1)
            return false // Remove tree
          }
          return true
        }))
      }

      if (player.lives <= 0) { setGameState('gameOver'); return }

      if (player.stones >= levels[currentLevel].stoneCount) {
        const dx = player.x - WORLD_WIDTH / 2, dy = player.y - WORLD_HEIGHT / 2
        const d = Math.hypot(dx, dy)
        if (d < PLAYER_SIZE + PORTAL_SIZE) {
          ensureAudio(); playSound('victory');
          setLevels(prev => {
            const progressed = prev.map((lvl, idx) => idx === currentLevel ? { ...lvl, completed: true } : idx === currentLevel + 1 ? { ...lvl, unlocked: true } : lvl)
            const nextId = progressed.length + 1
            const appended = [...progressed, createProceduralLevel(nextId)]
            return appended
          })
          
          // Check if completed final level (level 4 = index 3)
          if (currentLevel === 3) {
            setGameState('victoryVideo')
          } else {
            setGameState('victory')
          }
        }
      }
    }, 16)
    return () => clearInterval(gameLoop)
  }, [gameState, keys, player, enemies, stones, levels, currentLevel, createParticle, updateWeather, gameTime, joystickActive, joystickStart, joystickPos, trees, axePickups])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || gameState !== 'playing') return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    // Scale drawing to fit canvas while using virtual 800x600 coordinates
    const scaleX = canvasSize.width / VIRTUAL_WIDTH
    const scaleY = canvasSize.height / VIRTUAL_HEIGHT
    ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0)
    const level = levels[currentLevel]
    const bgColor = level.environment === 'desert' ? '#d4a574' : level.environment === 'winter' ? '#e5e7eb' : level.environment === 'island' ? '#86efac' : '#0a0a0a'

    if (!bgPattern) {
      const off = document.createElement('canvas')
      off.width = 32; off.height = 32
      const octx = off.getContext('2d')
      if (octx) {
        octx.fillStyle = bgColor; octx.fillRect(0, 0, 32, 32)
        octx.fillStyle = 'rgba(0,0,0,0.05)'
        for (let i = 0; i < 16; i++) octx.fillRect(Math.random() * 32, Math.random() * 32, 1, 1)
        const pat = ctx.createPattern(off, 'repeat'); if (pat) setBgPattern(pat)
      }
    }
    // Draw background pattern/color (no game background image)
    if (bgPattern) { 
      ctx.fillStyle = bgPattern; ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT) 
    } else { 
      ctx.fillStyle = bgColor; ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT) 
    }

    // Day/Night overlay and sun/moon
    const dayLength = 6000 // ~100 seconds at 60fps
    const cycle = (gameTime % dayLength) / dayLength
    const isNight = cycle > 0.6 && cycle < 0.95
    const skyAlpha = isNight ? 0.35 : Math.max(0, 0.25 - cycle * 0.25)
    ctx.fillStyle = `rgba(0,0,0,${skyAlpha})`
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT)
    const sunX = (cycle) * VIRTUAL_WIDTH
    const sunY = 100 + Math.sin(cycle * Math.PI) * 60
    
    // Draw sun or moon sprite
    if (isNight) {
      const moonImg = assetManager.getImage('moon')
      if (moonImg) {
        ctx.drawImage(moonImg, sunX - 14, sunY - 14, 28, 28)
      } else {
        ctx.fillStyle = '#cbd5e1'
        ctx.beginPath(); ctx.arc(sunX, sunY, 14, 0, Math.PI * 2); ctx.fill()
      }
    } else {
      const sunImg = assetManager.getImage('sun')
      if (sunImg) {
        ctx.drawImage(sunImg, sunX - 14, sunY - 14, 28, 28)
      } else {
        ctx.fillStyle = '#fde68a'
        ctx.beginPath(); ctx.arc(sunX, sunY, 14, 0, Math.PI * 2); ctx.fill()
      }
    }
    // Vignette
    const grad = ctx.createRadialGradient(VIRTUAL_WIDTH/2, VIRTUAL_HEIGHT/2, 100, VIRTUAL_WIDTH/2, VIRTUAL_HEIGHT/2, 400)
    grad.addColorStop(0, 'rgba(0,0,0,0)')
    grad.addColorStop(1, 'rgba(0,0,0,0.25)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT)
    
    // Apply screen shake effect
    ctx.save()
    ctx.translate(-camera.x + screenShake.x, -camera.y + screenShake.y)

    // Island environment - water background with land island
    if (level.environment === 'island') { 
      // Poisonous water (purple-blue)
      ctx.fillStyle = '#5b21b6' 
      ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT) 
      // Land island in center
      ctx.fillStyle = '#22c55e' 
      ctx.beginPath() 
      ctx.ellipse(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, WORLD_WIDTH / 2 - 400, WORLD_HEIGHT / 2 - 400, 0, 0, Math.PI * 2) 
      ctx.fill() 
    }

    // Draw lakes (circular, blue → green after use)
    lakes.forEach(lake => {
      if (lake.x < camera.x - 200 || lake.x > camera.x + 1000) return
      
      // Water (blue before use, green after use)
      if (lake.used) {
        // Used - green water
        ctx.fillStyle = '#22c55e'
        ctx.beginPath()
        ctx.arc(lake.x, lake.y, lake.radius, 0, Math.PI * 2)
        ctx.fill()
        
        // Darker green border
        ctx.strokeStyle = '#16a34a'
        ctx.lineWidth = 4
        ctx.stroke()
      } else {
        // Unused - blue water with shimmer
        const shimmer = Math.sin(gameTime * 0.15) * 0.2 + 0.3
        
        // Base blue
        ctx.fillStyle = '#3b82f6'
        ctx.beginPath()
        ctx.arc(lake.x, lake.y, lake.radius, 0, Math.PI * 2)
        ctx.fill()
        
        // Shimmer overlay
        ctx.fillStyle = `rgba(147, 197, 253, ${shimmer})`
        ctx.beginPath()
        ctx.arc(lake.x, lake.y, lake.radius, 0, Math.PI * 2)
        ctx.fill()
        
        // Blue border
        ctx.strokeStyle = '#1e3a8a'
        ctx.lineWidth = 4
        ctx.stroke()
      }
    })

    // Grass field (culled) - sand-colored in desert
    // Graphics quality affects grass density
    const grassSkip = graphicsQuality === 'low' ? 3 : graphicsQuality === 'medium' ? 2 : 1
    let grassPrimary, grassSecondary
    if (level.environment === 'winter') {
      grassPrimary = '#e5e7eb'
      grassSecondary = '#f8fafc'
    } else if (level.environment === 'desert') {
      grassPrimary = '#d97706' // Sand/brown
      grassSecondary = '#f59e0b' // Light sand
    } else {
      grassPrimary = '#16a34a' // Green
      grassSecondary = '#22c55e' // Light green
    }
    ctx.lineWidth = 1
    grass.forEach((g, idx) => {
      if (idx % grassSkip !== 0) return // Skip based on quality
      if (g.x < camera.x - 40 || g.x > camera.x + 840 || g.y < camera.y - 40 || g.y > camera.y + 640) return
      const sway = graphicsQuality === 'low' ? 0 : Math.sin(gameTime * 0.1 + g.x * 0.02) * 3
      // tuft: 3-4 blades curved
      const bladeCount = graphicsQuality === 'low' ? 2 : 4
      for (let b = -1; b <= bladeCount - 2; b++) {
        const color = (b % 2 === 0) ? grassPrimary : grassSecondary
        ctx.strokeStyle = color
        ctx.beginPath()
        ctx.moveTo(g.x + b * 1.5, g.y)
        ctx.quadraticCurveTo(
          g.x + b * 1.5 + sway * 0.5,
          g.y - g.h * 0.5,
          g.x + b * 1.5 + sway,
          g.y - g.h
        )
        ctx.stroke()
      }
    })

    // Flowers (graphics quality affects density)
    const flowerSkip = graphicsQuality === 'low' ? 4 : graphicsQuality === 'medium' ? 2 : 1
    flowers.forEach((f, idx) => {
      if (idx % flowerSkip !== 0) return // Skip based on quality
      if (f.x < camera.x - 20 || f.x > camera.x + 820 || f.y < camera.y - 20 || f.y > camera.y + 620) return
      ctx.fillStyle = f.c
      ctx.beginPath(); ctx.arc(f.x, f.y, 2, 0, Math.PI * 2); ctx.fill()
    })

    // Campfire render (attract light, distract enemies)
    campfires.forEach(cf => {
      const flicker = cf.active ? 0.6 + Math.sin(gameTime * 0.5 + cf.x) * 0.1 : 0.3
      const intensity = cf.active ? 1 : 0.4 // Dimmer when inactive
      
      // Main fire
      ctx.fillStyle = `rgba(251, 146, 60, ${0.8 * flicker * intensity})`
      ctx.beginPath(); ctx.arc(cf.x, cf.y, 12, 0, Math.PI * 2); ctx.fill()
      
      // Inner glow
      ctx.fillStyle = `rgba(255, 100, 0, ${0.4 * flicker * intensity})`
      ctx.beginPath(); ctx.arc(cf.x, cf.y, 6, 0, Math.PI * 2); ctx.fill()
      
      // Outer glow (distraction radius) - only when active
      if (cf.active) {
        ctx.fillStyle = `rgba(251, 191, 36, ${0.15 * flicker})`
        ctx.beginPath(); ctx.arc(cf.x, cf.y, 200, 0, Math.PI * 2); ctx.fill()
      }
      
      // Particles - fewer when inactive
      const particleCount = cf.active ? 3 : 1
      for (let i = 0; i < particleCount; i++) {
        const angle = (gameTime * 0.1 + i * 2) % (Math.PI * 2)
        const radius = 8 + Math.sin(gameTime * 0.3 + i) * 4
        const px = cf.x + Math.cos(angle) * radius
        const py = cf.y + Math.sin(angle) * radius - 5
        ctx.fillStyle = `rgba(255, 200, 0, ${0.6 * flicker * intensity})`
        ctx.beginPath(); ctx.arc(px, py, 2, 0, Math.PI * 2); ctx.fill()
      }
      
      // Timer display
      if (cf.active) {
        const timeLeft = Math.ceil(cf.timeRemaining / 60) // Convert to seconds
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
        ctx.font = '12px Arial'
        ctx.textAlign = 'center'
        ctx.fillText(`${timeLeft}s`, cf.x, cf.y - 20)
      }
    })

    trees.forEach(tree => {
      if (tree.x < camera.x - 60 || tree.x > camera.x + 860 || tree.y < camera.y - 60 || tree.y > camera.y + 660) return
      
      // Tree foliage color based on environment
      let treeColor = '#22c55e' // Default green
      if (tree.type === 'dead') {
        treeColor = '#92400e' // Brown/dead
      } else if (tree.type === 'palm') {
        treeColor = level.environment === 'desert' ? '#a16207' : '#16a34a' // Sand-brown for desert palms
      } else if (level.environment === 'winter') {
        treeColor = '#065f46' // Dark green for winter
      } else if (level.environment === 'desert') {
        treeColor = '#92400e' // Brown for desert trees
      }
      
      const sway = Math.sin(gameTime * 0.05 + tree.x * 0.01) * 3
      ctx.fillStyle = treeColor
      ctx.beginPath()
      ctx.arc(tree.x + sway, tree.y, tree.size, 0, Math.PI * 2)
      ctx.fill()
      
      // Tree trunk
      ctx.fillStyle = tree.type === 'dead' ? '#451a03' : '#92400e'
      ctx.fillRect(tree.x - 4, tree.y + tree.size - 15, 8, 20)
    })

    const portalX = WORLD_WIDTH / 2, portalY = WORLD_HEIGHT / 2
    const portalGlow = Math.sin(gameTime * 0.1) * 0.3 + 0.7
    const isPortalActive = player.stones >= levels[currentLevel].stoneCount
    
    // Draw animated portal sprite
    const currentPortalFrame = portalAnimationRef.current.getCurrentFrame()
    const portalImg = assetManager.getImage(currentPortalFrame)
    if (portalImg) {
      ctx.save()
      ctx.globalAlpha = isPortalActive ? portalGlow : 0.5
      ctx.drawImage(portalImg, portalX - PORTAL_SIZE, portalY - PORTAL_SIZE, PORTAL_SIZE * 2, PORTAL_SIZE * 2)
      ctx.restore()
    } else {
      // Fallback to circle rendering
      ctx.fillStyle = isPortalActive ? `rgba(139, 92, 246, ${portalGlow})` : 'rgba(107, 114, 128, 0.5)'
      ctx.beginPath(); ctx.arc(portalX, portalY, PORTAL_SIZE, 0, Math.PI * 2); ctx.fill()
      if (isPortalActive) { 
        ctx.strokeStyle = `rgba(167, 139, 250, ${portalGlow})`; ctx.lineWidth = 4; ctx.stroke() 
      }
    }

    stones.forEach(stone => {
      if (stone.x < camera.x - 60 || stone.x > camera.x + 860 || stone.y < camera.y - 60 || stone.y > camera.y + 660) return
      if (!stone.collected) { const glowSize = Math.sin(gameTime * 0.2 + stone.id) * 3 + STONE_SIZE; ctx.fillStyle = 'rgba(251, 191, 36, 0.3)'; ctx.beginPath(); ctx.arc(stone.x, stone.y, glowSize + 5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(stone.x, stone.y, STONE_SIZE, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 2; ctx.stroke() }
    })

    // Draw health pickups
    healthPickups.forEach(pickup => {
      if (pickup.x < camera.x - 60 || pickup.x > camera.x + 860 || pickup.y < camera.y - 60 || pickup.y > camera.y + 660) return
      if (!pickup.collected) {
        const pulse = Math.sin(gameTime * 0.3 + pickup.id) * 2 + 12
        // Glow effect
        ctx.fillStyle = 'rgba(34, 197, 94, 0.4)'
        ctx.beginPath()
        ctx.arc(pickup.x, pickup.y, pulse + 3, 0, Math.PI * 2)
        ctx.fill()
        // Draw heart emoji
        ctx.font = '24px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('❤️', pickup.x, pickup.y)
      }
    })

    // Draw axe pickups
    axePickups.forEach(axe => {
      if (axe.x < camera.x - 60 || axe.x > camera.x + 860 || axe.y < camera.y - 60 || axe.y > camera.y + 660) return
      if (!axe.collected) {
        const pulse = Math.sin(gameTime * 0.3 + axe.id) * 2 + 12
        // Glow effect
        ctx.fillStyle = 'rgba(120, 113, 108, 0.4)'
        ctx.beginPath()
        ctx.arc(axe.x, axe.y, pulse + 3, 0, Math.PI * 2)
        ctx.fill()
        // Draw axe emoji
        ctx.font = '24px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('🪓', axe.x, axe.y)
      }
    })

    enemies.forEach(enemy => {
      if (enemy.x < camera.x - 80 || enemy.x > camera.x + 880 || enemy.y < camera.y - 80 || enemy.y > camera.y + 680) return
      const bob = Math.sin(gameTime * 0.15 + enemy.id) * 2
      
      // Draw animated enemy sprite
      const enemyAnim = enemyAnimationsRef.current.get(enemy.id)
      if (enemyAnim) {
        const currentFrame = enemyAnim.getCurrentFrame()
        const enemyImg = assetManager.getImage(currentFrame)
        if (enemyImg) {
          const spriteSize = enemy.size * 2
          ctx.drawImage(enemyImg, enemy.x - spriteSize/2, enemy.y + bob - spriteSize/2, spriteSize, spriteSize)
        } else {
          // Fallback rendering with environment-specific dragon colors
          if (enemy.type === 'boss') {
            // Boss Dragon - environment specific colors
            let dragonColor = '#ef4444' // Default red
            let dragonAccent = '#dc2626'
            
            switch (level.environment) {
              case 'forest': // Red Dragon
                dragonColor = '#ef4444'
                dragonAccent = '#dc2626'
                break
              case 'winter': // Snow/Ice Dragon
                dragonColor = '#93c5fd'
                dragonAccent = '#60a5fa'
                break
              case 'desert': // Sand Dragon
                dragonColor = '#f59e0b'
                dragonAccent = '#d97706'
                break
              case 'island': // Green Dragon
                dragonColor = '#22c55e'
                dragonAccent = '#16a34a'
                break
            }
            
            // Dragon body
            ctx.fillStyle = dragonColor
            ctx.beginPath()
            ctx.ellipse(enemy.x, enemy.y + bob, enemy.size * 1.2, enemy.size * 0.8, 0, 0, Math.PI * 2)
            ctx.fill()
            
            // Dragon head
            ctx.beginPath()
            ctx.ellipse(enemy.x + enemy.size * 0.8, enemy.y + bob - enemy.size * 0.3, enemy.size * 0.6, enemy.size * 0.5, 0, 0, Math.PI * 2)
            ctx.fill()
            
            // Dragon wings
            ctx.fillStyle = dragonAccent
            ctx.beginPath()
            ctx.ellipse(enemy.x - enemy.size * 0.5, enemy.y + bob - enemy.size * 0.5, enemy.size * 0.8, enemy.size * 0.4, -0.5, 0, Math.PI * 2)
            ctx.fill()
            ctx.beginPath()
            ctx.ellipse(enemy.x - enemy.size * 0.5, enemy.y + bob + enemy.size * 0.5, enemy.size * 0.8, enemy.size * 0.4, 0.5, 0, Math.PI * 2)
            ctx.fill()
            
            // Dragon eyes (glowing)
            ctx.fillStyle = '#ffff00'
            ctx.beginPath()
            ctx.arc(enemy.x + enemy.size * 0.9, enemy.y + bob - enemy.size * 0.4, 3, 0, Math.PI * 2)
            ctx.fill()
            ctx.beginPath()
            ctx.arc(enemy.x + enemy.size * 0.9, enemy.y + bob - enemy.size * 0.2, 3, 0, Math.PI * 2)
            ctx.fill()
            
            // Dragon horns
            ctx.strokeStyle = dragonAccent
            ctx.lineWidth = 3
            ctx.beginPath()
            ctx.moveTo(enemy.x + enemy.size * 1.1, enemy.y + bob - enemy.size * 0.6)
            ctx.lineTo(enemy.x + enemy.size * 1.3, enemy.y + bob - enemy.size * 0.9)
            ctx.stroke()
            ctx.beginPath()
            ctx.moveTo(enemy.x + enemy.size * 1.1, enemy.y + bob - enemy.size * 0.1)
            ctx.lineTo(enemy.x + enemy.size * 1.3, enemy.y + bob + enemy.size * 0.2)
            ctx.stroke()
          } else {
            // Regular monsters - Chasers (solid) and Wanderers (transparent ghosts)
            if (enemy.type === 'wanderer') {
              // Ghost - slightly transparent
              ctx.globalAlpha = 0.85
              ctx.fillStyle = '#e0e7ff'
              ctx.beginPath()
              ctx.ellipse(enemy.x, enemy.y + bob, enemy.size + 2, enemy.size, 0, 0, Math.PI * 2)
              ctx.fill()
              
              // Ghost tail
              ctx.fillStyle = '#c7d2fe'
              ctx.beginPath()
              ctx.moveTo(enemy.x - enemy.size, enemy.y + bob + enemy.size * 0.5)
              ctx.quadraticCurveTo(enemy.x - enemy.size * 0.5, enemy.y + bob + enemy.size * 1.2, enemy.x, enemy.y + bob + enemy.size * 0.8)
              ctx.quadraticCurveTo(enemy.x + enemy.size * 0.5, enemy.y + bob + enemy.size * 1.2, enemy.x + enemy.size, enemy.y + bob + enemy.size * 0.5)
              ctx.fill()
              
              // Ghost eyes
              ctx.fillStyle = '#1e1b4b'
              ctx.beginPath()
              ctx.arc(enemy.x - enemy.size * 0.3, enemy.y + bob - enemy.size * 0.2, 3, 0, Math.PI * 2)
              ctx.fill()
              ctx.beginPath()
              ctx.arc(enemy.x + enemy.size * 0.3, enemy.y + bob - enemy.size * 0.2, 3, 0, Math.PI * 2)
              ctx.fill()
              
              ctx.globalAlpha = 1.0
            } else {
              // Chaser - slightly transparent red monster
              ctx.globalAlpha = 0.9
              ctx.fillStyle = '#ef4444'
              ctx.beginPath()
              ctx.ellipse(enemy.x, enemy.y + bob, enemy.size + 2, enemy.size, 0, 0, Math.PI * 2)
              ctx.fill()
              
              // Chaser eyes
              ctx.fillStyle = '#ffffff'
              const eyes = 2
              for (let i = 0; i < eyes; i++) {
                const ex = enemy.x + (i - (eyes - 1) / 2) * 6
                const ey = enemy.y + bob - enemy.size * 0.2
                ctx.beginPath(); ctx.arc(ex, ey, 3, 0, Math.PI * 2); ctx.fill()
                ctx.fillStyle = '#111827'; ctx.beginPath(); ctx.arc(ex + 1, ey, 1.5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#ffffff'
              }
              ctx.globalAlpha = 1.0
            }
          }
        }
      }
    })

    // Draw gun pickups
    gunPickups.forEach(g => {
      if (g.x < camera.x - 60 || g.x > camera.x + 860 || g.y < camera.y - 60 || g.y > camera.y + 660) return
      if (!g.collected) {
        const pulse = Math.sin(gameTime * 0.3 + g.id) * 2 + 12
        // Glow effect
        ctx.fillStyle = 'rgba(139, 69, 19, 0.4)'
        ctx.beginPath()
        ctx.arc(g.x, g.y, pulse + 3, 0, Math.PI * 2)
        ctx.fill()
        // Draw gun emoji
        ctx.font = '24px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('🔫', g.x, g.y)
      }
    })
    
    // Draw speed boost pickups
    speedBoosts.forEach(boost => {
      if (boost.x < camera.x - 60 || boost.x > camera.x + 860 || boost.y < camera.y - 60 || boost.y > camera.y + 660) return
      if (!boost.collected) {
        const pulse = Math.sin(gameTime * 0.3 + boost.id) * 3 + 14
        // Glow effect
        ctx.fillStyle = 'rgba(6, 182, 212, 0.4)'
        ctx.beginPath()
        ctx.arc(boost.x, boost.y, pulse, 0, Math.PI * 2)
        ctx.fill()
        // Draw lightning emoji
        ctx.font = '24px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('⚡', boost.x, boost.y)
      }
    })
    
    // Draw bullet pickups (ammo)
    bulletPickups.forEach(b => {
      if (b.x < camera.x - 60 || b.x > camera.x + 860 || b.y < camera.y - 60 || b.y > camera.y + 660) return
      if (!b.collected) {
        const pulse = Math.sin(gameTime * 0.2 + b.id) * 2 + 12
        // Glow effect
        ctx.fillStyle = 'rgba(251, 191, 36, 0.4)'
        ctx.beginPath()
        ctx.arc(b.x, b.y, pulse + 3, 0, Math.PI * 2)
        ctx.fill()
        // Draw ammo box emoji
        ctx.font = '24px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('📦', b.x, b.y)
      }
    })
    
    // Draw Sacrifice Altar - Theme: "Sacrifices Must be Made"
    if (sacrificeAltar && sacrificeAltar.active) {
      const altarPulse = Math.sin(gameTime * 0.2) * 5
      const flameFlicker = Math.sin(gameTime * 0.5) * 0.3 + 0.7
      
      // Altar base (stone platform)
      ctx.fillStyle = '#4b5563'
      ctx.fillRect(sacrificeAltar.x - sacrificeAltar.size, sacrificeAltar.y - sacrificeAltar.size/2, sacrificeAltar.size * 2, sacrificeAltar.size)
      
      // Altar top (darker stone)
      ctx.fillStyle = '#374151'
      ctx.fillRect(sacrificeAltar.x - sacrificeAltar.size * 0.8, sacrificeAltar.y - sacrificeAltar.size/2 - 10, sacrificeAltar.size * 1.6, 10)
      
      // Flames (3 flames on altar)
      for (let i = -1; i <= 1; i++) {
        const flameX = sacrificeAltar.x + i * 20
        const flameY = sacrificeAltar.y - sacrificeAltar.size/2 - 15
        const flameHeight = 20 + altarPulse
        
        // Outer flame (orange)
        ctx.fillStyle = `rgba(251, 146, 60, ${flameFlicker})`
        ctx.beginPath()
        ctx.moveTo(flameX, flameY)
        ctx.lineTo(flameX - 8, flameY - flameHeight)
        ctx.lineTo(flameX + 8, flameY - flameHeight)
        ctx.closePath()
        ctx.fill()
        
        // Inner flame (yellow)
        ctx.fillStyle = `rgba(250, 204, 21, ${flameFlicker})`
        ctx.beginPath()
        ctx.moveTo(flameX, flameY)
        ctx.lineTo(flameX - 4, flameY - flameHeight * 0.7)
        ctx.lineTo(flameX + 4, flameY - flameHeight * 0.7)
        ctx.closePath()
        ctx.fill()
      }
      
      // Glow effect
      ctx.fillStyle = `rgba(251, 146, 60, 0.2)`
      ctx.beginPath()
      ctx.arc(sacrificeAltar.x, sacrificeAltar.y - 20, sacrificeAltar.size + altarPulse, 0, Math.PI * 2)
      ctx.fill()
      
      // "E to Sacrifice" prompt if player is near
      const dx = player.x - sacrificeAltar.x
      const dy = player.y - sacrificeAltar.y
      const d = Math.hypot(dx, dy)
      if (d < PLAYER_SIZE + sacrificeAltar.size + 30) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
        ctx.fillRect(sacrificeAltar.x - 50, sacrificeAltar.y - sacrificeAltar.size - 60, 100, 25)
        ctx.fillStyle = '#fbbf24'
        ctx.font = 'bold 14px Arial'
        ctx.textAlign = 'center'
        ctx.fillText('Press E', sacrificeAltar.x, sacrificeAltar.y - sacrificeAltar.size - 42)
      }
    }
    
    // Draw manual icon near portal
    if (manualIcon) {
      const pulse = Math.sin(gameTime * 0.15) * 3 + manualIcon.size
      // Glow effect
      ctx.fillStyle = 'rgba(59, 130, 246, 0.3)'
      ctx.beginPath()
      ctx.arc(manualIcon.x, manualIcon.y, pulse + 5, 0, Math.PI * 2)
      ctx.fill()
      
      // Book icon background
      ctx.fillStyle = '#3b82f6'
      ctx.fillRect(manualIcon.x - manualIcon.size/2, manualIcon.y - manualIcon.size/2, manualIcon.size, manualIcon.size * 1.2)
      
      // Book pages
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(manualIcon.x - manualIcon.size/2 + 3, manualIcon.y - manualIcon.size/2 + 3, manualIcon.size - 6, manualIcon.size * 1.2 - 6)
      
      // Book lines
      ctx.strokeStyle = '#3b82f6'
      ctx.lineWidth = 1
      for (let i = 0; i < 3; i++) {
        const lineY = manualIcon.y - manualIcon.size/2 + 6 + i * 4
        ctx.beginPath()
        ctx.moveTo(manualIcon.x - manualIcon.size/2 + 5, lineY)
        ctx.lineTo(manualIcon.x + manualIcon.size/2 - 5, lineY)
        ctx.stroke()
      }
      
      // "?" symbol
      ctx.fillStyle = '#1e40af'
      ctx.font = 'bold 16px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('?', manualIcon.x, manualIcon.y + 2)
    }

    // Draw bullets with trail effect
    bullets.forEach(b => {
      // Bullet trail
      ctx.fillStyle = 'rgba(147, 197, 253, 0.3)'
      ctx.beginPath()
      ctx.arc(b.x - b.vx * 2, b.y - b.vy * 2, 3, 0, Math.PI * 2)
      ctx.fill()
      
      // Main bullet
      ctx.fillStyle = '#60a5fa'
      ctx.beginPath()
      ctx.arc(b.x, b.y, 4, 0, Math.PI * 2)
      ctx.fill()
      
      // Bullet glow
      ctx.strokeStyle = '#93c5fd'
      ctx.lineWidth = 2
      ctx.stroke()
    })

    // Draw animated player sprite
    const cx = player.x, cy = player.y
    const currentPlayerFrame = playerAnimationRef.current.getCurrentFrame()
    const playerImg = assetManager.getImage(currentPlayerFrame)
    
    if (playerImg) {
      const spriteSize = PLAYER_SIZE * 3 // Make player sprite larger
      ctx.save()
      
      // Power-up glow effects
      if (speedBoostActive) {
        // Speed boost - cyan glow with trail
        const glowSize = 40 + Math.sin(gameTime * 0.3) * 5
        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowSize)
        gradient.addColorStop(0, 'rgba(6, 182, 212, 0.6)')
        gradient.addColorStop(0.5, 'rgba(6, 182, 212, 0.3)')
        gradient.addColorStop(1, 'rgba(6, 182, 212, 0)')
        ctx.fillStyle = gradient
        ctx.fillRect(cx - glowSize, cy - glowSize, glowSize * 2, glowSize * 2)
        
        // Speed trail effect
        for (let i = 1; i <= 3; i++) {
          ctx.globalAlpha = 0.3 / i
          ctx.drawImage(playerImg, cx - spriteSize/2 - i * 8, cy - spriteSize/2, spriteSize, spriteSize)
        }
        ctx.globalAlpha = 1.0
      }
      
      if (invisibilityActive) {
        // Invisibility - purple glow
        const glowSize = 35 + Math.sin(gameTime * 0.4) * 4
        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowSize)
        gradient.addColorStop(0, 'rgba(139, 92, 246, 0.5)')
        gradient.addColorStop(0.5, 'rgba(139, 92, 246, 0.25)')
        gradient.addColorStop(1, 'rgba(139, 92, 246, 0)')
        ctx.fillStyle = gradient
        ctx.fillRect(cx - glowSize, cy - glowSize, glowSize * 2, glowSize * 2)
        ctx.globalAlpha = 0.5 // Make player semi-transparent
      }
      
      // Handle sprite mirroring for left movement
      if (playerDirection === 'left') {
        ctx.scale(-1, 1) // Mirror horizontally
        ctx.translate(-cx * 2, 0) // Adjust position after mirroring
      }
      
      // Add visual effects based on player state
      if (playerAnimationState === 'damage') {
        // Flash red when taking damage
        ctx.globalCompositeOperation = 'multiply'
        ctx.fillStyle = 'rgba(255, 100, 100, 0.7)'
        ctx.fillRect(cx - spriteSize/2, cy - spriteSize/2, spriteSize, spriteSize)
        ctx.globalCompositeOperation = 'source-over'
      } else if (playerAnimationState === 'stamina') {
        // Dim when out of stamina
        ctx.globalAlpha = 0.7
      }
      
      ctx.drawImage(playerImg, cx - spriteSize/2, cy - spriteSize/2, spriteSize, spriteSize)
      ctx.restore()
    } else {
      // Fallback to stickman rendering
      const angle = Math.atan2(mousePos.y - VIRTUAL_HEIGHT/2, mousePos.x - VIRTUAL_WIDTH/2)
      const headRadius = 8, bodyLen = 20
      const baseLimb = 14
      const swing = Math.sin(stepPhase) * 6
      const limbLenFront = baseLimb + swing
      const limbLenBack = baseLimb - swing
      
      ctx.fillStyle = '#3b82f6'; ctx.beginPath(); ctx.arc(cx, cy - bodyLen / 1.5, headRadius, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = '#60a5fa'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx, cy - bodyLen / 2); ctx.lineTo(cx, cy + bodyLen / 2); ctx.stroke()
      // arms swing
      ctx.beginPath();
      ctx.moveTo(cx, cy - bodyLen / 4); ctx.lineTo(cx + Math.cos(angle + Math.PI / 2) * limbLenFront, cy - bodyLen / 4 + Math.sin(angle + Math.PI / 2) * limbLenFront);
      ctx.moveTo(cx, cy - bodyLen / 4); ctx.lineTo(cx + Math.cos(angle - Math.PI / 2) * limbLenBack,  cy - bodyLen / 4 + Math.sin(angle - Math.PI / 2) * limbLenBack);
      ctx.stroke()
      // legs swing
      ctx.beginPath();
      ctx.moveTo(cx, cy + bodyLen / 2); ctx.lineTo(cx - limbLenBack,  cy + bodyLen / 2 + limbLenBack);
      ctx.moveTo(cx, cy + bodyLen / 2); ctx.lineTo(cx + limbLenFront, cy + bodyLen / 2 + limbLenFront);
      ctx.stroke()
    }

    ctx.restore()
    
    // Damage flash overlay (full screen red flash)
    if (damageFlash > 0) {
      ctx.fillStyle = `rgba(255, 0, 0, ${damageFlash * 0.4})`
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT)
    }
  }, [gameState, player, enemies, stones, trees, particles, camera, mousePos, gameTime, currentLevel, levels, bgPattern, healthPickups, axePickups, speedBoostActive, invisibilityActive, screenShake, damageFlash])

  if (gameState === 'loading') {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        background: 'linear-gradient(135deg,rgb(10, 10, 10) 0%, #1a0b2e 25%,rgb(30, 99, ) 50%, #111827 75%, #000000 100%)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ 
          textAlign: 'center',
          zIndex: 1
        }}>
          <img 
            src="logoo.png" 
            alt="Horror Islands" 
            style={{ 
              width: 'min(400px, 80vw)', 
              height: 'auto',
              marginBottom: '2rem',
              filter: 'drop-shadow(0 0 20px rgba(255, 255, 255, 0.3))'
            }} 
          />
          <div style={{ 
            color: '#d1d5db', 
            fontSize: 'clamp(1rem, 3vw, 1.25rem)',
            marginBottom: '2rem'
          }}>
            {assetsLoaded ? 'Ready!' : 'Loading Assets...'}
          </div>
          <div style={{
            width: '200px',
            height: '4px',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '2px',
            margin: '0 auto',
            overflow: 'hidden'
          }}>
            <div 
              className="loading"
              style={{
                width: '100%',
                height: '100%',
                background: 'linear-gradient(90deg, #3b82f6, #a855f7)',
                borderRadius: '2px'
              }}
            />
          </div>
        </div>
      </div>
    )
  }

  if (gameState === 'introVideo') {
    return (
      <div style={{ 
        width: '100vw', 
        height: '100vh', 
        background: '#000000',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative'
      }}>
        <video 
          src="assets/videos/intro.mp4"
          autoPlay
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain'
          }}
          onEnded={() => {
            localStorage.setItem('monsland-played-before', 'true');
            setIsFirstTime(false);
            setGameState('levelSelect');
          }}
        />
        
        {/* Skip button */}
        <button 
          onClick={() => { 
            handleButtonClick(); 
            localStorage.setItem('monsland-played-before', 'true');
            setIsFirstTime(false);
            setGameState('levelSelect');
          }} 
          style={{ 
            position: 'absolute',
            top: '20px',
            right: '20px',
            padding: '0.75rem 1.5rem', 
            fontSize: '1rem',
            fontWeight: '600',
            background: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            border: '2px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            backdropFilter: 'blur(10px)'
          }}
        >
          Skip →
        </button>
      </div>
    )
  }

  if (gameState === 'victoryVideo') {
    return (
      <div style={{ 
        width: '100vw', 
        height: '100vh', 
        background: '#000000',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative'
      }}>
        <video 
          src="assets/videos/outro.mp4"
          autoPlay
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain'
          }}
          onEnded={() => {
            setGameState('menu');
          }}
        />
        
        {/* Skip button */}
        <button 
          onClick={() => { 
            handleButtonClick(); 
            setGameState('menu');
          }} 
          style={{ 
            position: 'absolute',
            top: '20px',
            right: '20px',
            padding: '0.75rem 1.5rem', 
            fontSize: '1rem',
            fontWeight: '600',
            background: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            border: '2px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            backdropFilter: 'blur(10px)'
          }}
        >
          Skip →
        </button>
        
        {/* Navigation buttons (appear after video or on hover) */}
        <div style={{ 
          position: 'absolute',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: '1rem'
        }}>
          <button 
            onClick={() => { 
              handleButtonClick(); 
              setGameState('levelSelect');
            }} 
            style={{ 
              padding: '0.75rem 1.5rem', 
              fontSize: '1rem',
              fontWeight: '600',
              background: 'rgba(59, 130, 246, 0.8)',
              color: 'white',
              border: '2px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              backdropFilter: 'blur(10px)'
            }}
          >
            🔄 Play Again
          </button>
        </div>
      </div>
    )
  }

  if (gameState === 'menu') {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        background: assetManager.getImage('ui-background') 
          ? `url(assets/background/ui-background.png) center/cover, linear-gradient(135deg, #1a0b2e 0%, #4c1d95 25%, #2d1b69 50%, #111827 75%, #000000 100%)`
          : 'linear-gradient(135deg, #1a0b2e 0%, #4c1d95 25%, #2d1b69 50%, #111827 75%, #000000 100%)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Animated background particles */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `
            radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(161, 161, 161, 0) 0%, transparent 50%),
            radial-gradient(circle at 40% 40%, rgba(120, 219, 255, 0.2) 0%, transparent 50%)
          `,
          animation: 'float 6s ease-in-out infinite'
        }} />
        
        <div style={{ 
          textAlign: 'center', 
          zIndex: 1,
          maxWidth: '90vw',
          padding: '2rem'
        }}>
          <h1 style={{ 
            color: 'white', 
            fontWeight: 900, 
            fontSize: 'clamp(2.5rem, 8vw, 4rem)', 
            marginBottom: '1rem',
            textShadow: '0 0 20px rgba(255, 255, 255, 0.5)',
            letterSpacing: '0.1em',
            background: 'linear-gradient(45deg, #ffffff,rgb(30, 99, 52), #ffffff)',
            backgroundSize: '200% 200%',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            animation: 'gradientShift 3s ease-in-out infinite'
          }}>
            HORROR ISLANDS
          </h1>
          <p style={{ 
            color: '#d1d5db', 
            marginBottom: '3rem',
            fontSize: 'clamp(1rem, 3vw, 1.25rem)',
            maxWidth: '600px',
            margin: '0 auto 3rem auto',
            lineHeight: '1.6'
          }}>
            Survive the nightmare. Collect the stones. Escape.
          </p>
          <div style={{ 
            display: 'flex', 
            gap: '1rem', 
            justifyContent: 'center',
            flexWrap: 'wrap'
          }}>
            <button 
              onClick={() => { 
                handleButtonClick(); 
                if (isFirstTime) {
                  setGameState('introVideo')
                } else {
                  setGameState('levelSelect')
                }
              }} 
              style={{ 
                padding: '1rem 2rem', 
                fontSize: '1.125rem',
                fontWeight: '600',
                background: 'linear-gradient(45deg,rgb(30, 99, 52), #059669)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)',
                minWidth: '140px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 15px rgba(16, 185, 129, 0.3)';
              }}
            >
              PLAY
            </button>
            <button 
              onClick={() => { handleButtonClick(); setGameState('settings') }} 
              style={{ 
                padding: '1rem 2rem', 
                fontSize: '1.125rem',
                fontWeight: '600',
                background: 'linear-gradient(45deg, #6b7280, #4b5563)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 15px rgba(107, 114, 128, 0.3)',
                minWidth: '140px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(107, 114, 128, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 15px rgba(107, 114, 128, 0.3)';
              }}
            >
              SETTINGS
            </button>
            <button 
              onClick={() => { 
                handleButtonClick(); 
                playSound('pickup'); 
                // Test different stamina levels with proper timing
                setTimeout(() => playFootstepSound(false, 100), 300); // Normal walk
                setTimeout(() => playFootstepSound(false, 100), 800); // Normal walk step 2
                setTimeout(() => playFootstepSound(true, 100), 1200);  // Sprint
                setTimeout(() => playFootstepSound(true, 100), 1533);  // Sprint step 2
                setTimeout(() => playFootstepSound(false, 20), 1900);  // Low stamina walk
                setTimeout(() => playFootstepSound(false, 5), 2400);   // Exhausted walk
                console.log('Test sounds: normal walk rhythm, sprint rhythm, low stamina, exhausted!');
              }} 
              style={{ 
                padding: '0.5rem 1rem', 
                fontSize: '0.875rem',
                fontWeight: '600',
                background: 'linear-gradient(45deg, #f59e0b, #d97706)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
            >
              🔊 Test Audio
            </button>
          </div>
        </div>
        
        <style>{`
          @keyframes float {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-20px) rotate(180deg); }
          }
          @keyframes gradientShift {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
          }
        `}</style>
      </div>
    )
  }

  if (gameState === 'settings') {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        background: 'linear-gradient(135deg, #1a0b2e 0%,rgb(30, 99, 52) 25%,rgb(0, 86, 28) 50%, #111827 75%, #000000 100%)',
        padding: '1rem'
      }}>
        <div style={{ 
          width: '100%', 
          maxWidth: '500px', 
          background: 'rgba(31, 41, 55, 0.95)', 
          color: 'white', 
          padding: '2rem', 
          borderRadius: '16px',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '2rem'
          }}>
            <h2 style={{ 
              fontSize: '1.5rem', 
              fontWeight: '700',
              margin: 0,
              background: 'linear-gradient(45deg, #ffffff, #a855f7)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              Settings
            </h2>
            <button 
              onClick={() => { handleButtonClick(); setGameState('menu') }} 
              style={{ 
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                padding: '0.5rem',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '1.25rem',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.3)';
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              ×
            </button>
          </div>
          <div>
            <div style={{ marginBottom: '2rem' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '1rem', 
                fontSize: '1.125rem',
                fontWeight: '600',
                color: '#e5e7eb'
              }}>
                Graphics Quality
              </label>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(3, 1fr)', 
                gap: '0.75rem' 
              }}>
                {(['low','medium','high'] as const).map(q => (
                  <button 
                    key={q} 
                    onClick={() => setGraphicsQuality(q)} 
                    style={{ 
                      padding: '0.75rem 1rem', 
                      background: graphicsQuality === q 
                        ? 'linear-gradient(45deg, #3b82f6, #1d4ed8)' 
                        : 'rgba(75, 85, 99, 0.3)',
                      color: 'white',
                      border: graphicsQuality === q 
                        ? '1px solid rgba(59, 130, 246, 0.5)' 
                        : '1px solid rgba(75, 85, 99, 0.3)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      textTransform: 'capitalize',
                      transition: 'all 0.3s ease',
                      boxShadow: graphicsQuality === q 
                        ? '0 4px 12px rgba(59, 130, 246, 0.3)' 
                        : '0 2px 4px rgba(0, 0, 0, 0.1)'
                    }}
                    onMouseEnter={(e) => {
                      if (graphicsQuality !== q) {
                        e.currentTarget.style.background = 'rgba(75, 85, 99, 0.5)';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (graphicsQuality !== q) {
                        e.currentTarget.style.background = 'rgba(75, 85, 99, 0.3)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (gameState === 'levelSelect') {
    return (
      <div style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        width: '100vw', 
        height: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        background: 'linear-gradient(to bottom,rgb(30, 99, 52), #111827, #000)',
        margin: 0,
        padding: '20px',
        overflow: 'auto',
        boxSizing: 'border-box'
      }}>
        <div style={{ width: '100%', maxWidth: 'min(900px, 95vw)' }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <h2 style={{ fontSize: 'clamp(24px, 6vw, 32px)', color: 'white', fontWeight: 800 }}>Choose Your Nightmare</h2>
          </div>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: 12,
            marginBottom: 20
          }}>
            {levels.map((level, index) => {
              const isUnlocked = level.unlocked || index === 0
              return (
                <div key={level.id} onClick={() => { if (isUnlocked) { handleButtonClick(); setCurrentLevel(index); initializeLevel(index); setGameState('playing') } }} style={{ 
                  padding: 12, 
                  borderRadius: 8, 
                  background: isUnlocked ? '#1f2937' : '#0f172a', 
                  color: 'white', 
                  cursor: isUnlocked ? 'pointer' : 'not-allowed',
                  border: isUnlocked ? '2px solid transparent' : '2px solid #374151',
                  transition: 'all 0.2s ease'
                }}>
                  <div style={{ textAlign: 'center', fontSize: 'clamp(12px, 3vw, 14px)', fontWeight: 600 }}>{isUnlocked ? level.name : 'Locked'}</div>
                  {isUnlocked && (
                    <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 'clamp(10px, 2.5vw, 12px)', marginTop: 4 }}>
                      {level.enemyCount} Enemies • {level.stoneCount} Stones • {level.weather} • {level.timeOfDay}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <div style={{ textAlign: 'center' }}>
            <button onClick={() => { handleButtonClick(); setGameState('menu') }} style={{ 
              padding: '12px 24px', 
              fontSize: 'clamp(14px, 3vw, 16px)', 
              background: '#374151', 
              border: 'none', 
              borderRadius: 8, 
              color: 'white', 
              cursor: 'pointer' 
            }}>Back to Menu</button>
          </div>
        </div>
      </div>
    )
  }

  if (gameState === 'victory') {
    return (
      <div style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        width: '100vw', 
        height: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        background: 'linear-gradient(to bottom,rgb(225, 255, 0), #111827, #000)',
        margin: 0,
        padding: 0,
        overflow: 'hidden'
      }}>
        <div style={{ 
          background: '#1f2937', 
          color: 'white', 
          padding: 16, 
          borderRadius: 8,
          maxWidth: '90vw',
          maxHeight: '90vh',
          overflow: 'auto'
        }}>
          <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 'clamp(24px, 5vw, 32px)', color: '#22c55e', textAlign: 'center' }}>🎉 Victory! 🎉</div>
          <div style={{ marginBottom: 12, fontSize: 'clamp(16px, 3.5vw, 20px)', textAlign: 'center' }}>You survived {levels[currentLevel].name}!</div>
          
          {/* Victory Stats */}
          <div style={{ 
            background: '#111827', 
            padding: '16px', 
            borderRadius: 8, 
            marginBottom: 16,
            border: '2px solid #dc2626'
          }}>
            <div style={{ fontSize: 'clamp(16px, 3vw, 18px)', fontWeight: 'bold', marginBottom: 12, color: '#fbbf24', textAlign: 'center' }}>
              "Sacrifices Must be Made"
            </div>
            <div style={{ display: 'grid', gap: 8, fontSize: 'clamp(14px, 2.5vw, 16px)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', background: '#1f2937', borderRadius: 4 }}>
                <span>🔥 Sacrifices Made:</span>
                <span style={{ color: '#ef4444', fontWeight: 'bold' }}>{sacrificesMade}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', background: '#1f2937', borderRadius: 4 }}>
                <span>💎 Stones Collected:</span>
                <span style={{ color: '#fbbf24', fontWeight: 'bold' }}>{player.stones}/{levels[currentLevel].stoneCount}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', background: '#1f2937', borderRadius: 4 }}>
                <span>❤️ Lives Remaining:</span>
                <span style={{ color: '#22c55e', fontWeight: 'bold' }}>{player.lives}/3</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', background: '#1f2937', borderRadius: 4 }}>
                <span>🔫 Ammo Left:</span>
                <span style={{ color: '#3b82f6', fontWeight: 'bold' }}>{ammo}</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {currentLevel < levels.length - 1 ? (
              <button onClick={() => { handleButtonClick(); setCurrentLevel(prev => prev + 1); initializeLevel(currentLevel + 1); setGameState('playing') }} style={{ 
                padding: '8px 16px', 
                fontSize: 'clamp(12px, 2.5vw, 14px)', 
                background: '#22c55e', 
                border: 'none', 
                borderRadius: 6, 
                color: 'white', 
                cursor: 'pointer' 
              }}>Next Level</button>
            ) : (
              <button onClick={() => { handleButtonClick(); setGameState('levelSelect') }} style={{ 
                padding: '8px 16px', 
                fontSize: 'clamp(12px, 2.5vw, 14px)', 
                background: '#374151', 
                border: 'none', 
                borderRadius: 6, 
                color: 'white', 
                cursor: 'pointer' 
              }}>Level Select</button>
            )}
            <button onClick={() => setGameState('levelSelect')} style={{ 
              padding: '8px 16px', 
              fontSize: 'clamp(12px, 2.5vw, 14px)', 
              background: '#374151', 
              border: 'none', 
              borderRadius: 6, 
              color: 'white', 
              cursor: 'pointer' 
            }}>Back to Levels</button>
          </div>
        </div>
      </div>
    )
  }

  if (gameState === 'paused') {
    return (
      <div style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        width: '100vw', 
        height: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        background: 'linear-gradient(to bottom,rgb(30, 99, 52), #111827, #000)',
        margin: 0,
        padding: 0,
        overflow: 'hidden'
      }}>
        <div style={{ 
          background: '#1f2937', 
          color: 'white', 
          padding: 24, 
          borderRadius: 12, 
          textAlign: 'center',
          maxWidth: '90vw',
          maxHeight: '90vh',
          overflow: 'auto'
        }}>
          <div style={{ fontWeight: 700, marginBottom: 16, fontSize: 'clamp(20px, 5vw, 24px)' }}>Game Paused</div>
          <div style={{ marginBottom: 20, color: '#9ca3af', fontSize: 'clamp(14px, 3vw, 16px)' }}>Take a break from the horror...</div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => { handleButtonClick(); setGameState('playing') }} style={{ 
              padding: '12px 24px', 
              fontSize: 'clamp(14px, 3vw, 16px)', 
              background: '#22c55e', 
              border: 'none', 
              borderRadius: 8, 
              color: 'white', 
              cursor: 'pointer' 
            }}>
              Resume Game
            </button>
            <button onClick={() => setGameState('levelSelect')} style={{ 
              padding: '12px 24px', 
              fontSize: 'clamp(14px, 3vw, 16px)', 
              background: '#374151', 
              border: 'none', 
              borderRadius: 8, 
              color: 'white', 
              cursor: 'pointer' 
            }}>
              Level Select
            </button>
            <button onClick={() => setGameState('menu')} style={{ 
              padding: '12px 24px', 
              fontSize: 'clamp(14px, 3vw, 16px)', 
              background: '#6b7280', 
              border: 'none', 
              borderRadius: 8, 
              color: 'white', 
              cursor: 'pointer' 
            }}>
              Main Menu
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (gameState === 'gameOver') {
    return (
      <div style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        width: '100vw', 
        height: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        background: 'linear-gradient(to bottom, #7f1d1d, #111827, #000)',
        margin: 0,
        padding: 0,
        overflow: 'hidden'
      }}>
        <div style={{ 
          background: '#1f2937', 
          color: 'white', 
          padding: 16, 
          borderRadius: 8,
          maxWidth: '90vw',
          maxHeight: '90vh',
          overflow: 'auto'
        }}>
          <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 'clamp(18px, 4vw, 20px)' }}>Game Over</div>
          <div style={{ marginBottom: 12, fontSize: 'clamp(14px, 3vw, 16px)' }}>The {levels[currentLevel].name} claimed another victim...</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button onClick={() => { handleButtonClick(); initializeLevel(currentLevel); setGameState('playing') }} style={{ 
              padding: '8px 16px', 
              fontSize: 'clamp(12px, 2.5vw, 14px)', 
              background: '#ef4444', 
              border: 'none', 
              borderRadius: 6, 
              color: 'white', 
              cursor: 'pointer' 
            }}>Try Again</button>
            <button onClick={() => { handleButtonClick(); setGameState('levelSelect') }} style={{ 
              padding: '8px 16px', 
              fontSize: 'clamp(12px, 2.5vw, 14px)', 
              background: '#374151', 
              border: 'none', 
              borderRadius: 6, 
              color: 'white', 
              cursor: 'pointer' 
            }}>Level Select</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ 
      position: 'fixed', 
      top: 0, 
      left: 0, 
      width: '100vw', 
      height: '100vh', 
      background: '#111827', 
      display: 'flex', 
      flexDirection: 'column',
      margin: 0,
      padding: 0,
      overflow: 'hidden'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        padding: '8px 12px', 
        background: '#1f2937', 
        color: 'white', 
        flexWrap: 'wrap', 
        gap: 8,
        minHeight: '60px',
        boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ background: '#78350f', padding: '4px 8px', borderRadius: 6, fontSize: '14px' }}>Stones: {player.stones}/{levels[currentLevel].stoneCount}</div>
          <div style={{ background: '#111827', padding: '4px 8px', borderRadius: 6, fontSize: '14px' }}>
            Stamina: <span style={{ color: player.stamina > 30 ? '#22c55e' : player.stamina > 10 ? '#f59e0b' : '#ef4444' }}>{Math.round(player.stamina)}%</span>
          </div>
          <div style={{ background: '#1d4ed8', padding: '4px 8px', borderRadius: 6, fontSize: '14px' }}>Lives: {player.lives}</div>
          <div style={{ background: '#dc2626', padding: '4px 8px', borderRadius: 6, fontSize: '14px', fontWeight: 'bold' }}>🔥 Sacrifices: {sacrificesMade}</div>
          {player.hasAxe && (
            <div style={{ background: '#6b7280', padding: '4px 8px', borderRadius: 6, fontSize: '14px' }}>🪓 Axe</div>
          )}
          {gunPickups.some(g => g.collected) && (
            <div style={{ background: '#3b82f6', padding: '4px 8px', borderRadius: 6, fontSize: '14px' }}>
              🔫 Gun ({ammo} bullets)
            </div>
          )}
          {speedBoostActive && (
            <div style={{ background: '#06b6d4', padding: '4px 8px', borderRadius: 6, fontSize: '14px', animation: 'pulse 0.5s infinite' }}>
              ⚡ Speed Boost ({Math.ceil(speedBoostTimeLeft / 60)}s)
            </div>
          )}
          {invisibilityActive && (
            <div style={{ background: '#8b5cf6', padding: '4px 8px', borderRadius: 6, fontSize: '14px', animation: 'pulse 0.5s infinite' }}>
              👻 Invisible ({Math.ceil(invisibilityTimeLeft / 60)}s)
            </div>
          )}
          <div style={{ fontSize: '14px', color: '#9ca3af' }}>{levels[currentLevel].name}</div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={() => { handleButtonClick(); setShowManual(true) }} style={{ padding: '6px 12px', fontSize: '12px', background: '#3b82f6', border: 'none', borderRadius: 6, color: 'white', cursor: 'pointer' }} title="Open Game Manual">
            📖 Manual
          </button>
          <button onClick={() => { handleButtonClick(); setShowMinimap(v => !v) }} style={{ padding: '6px 12px', fontSize: '12px', background: '#374151', border: 'none', borderRadius: 6, color: 'white', cursor: 'pointer' }}>Map</button>
          <button onClick={() => { handleButtonClick(); setGameState('paused') }} style={{ padding: '6px 12px', fontSize: '12px', background: '#374151', border: 'none', borderRadius: 6, color: 'white', cursor: 'pointer' }}>
            Pause
          </button>
          <button onClick={() => {
            handleButtonClick()
            // Place campfire if enough wood and cooldown elapsed
            const now = gameTime
            if (wood >= 3 && now - lastCampfireTimeRef.current > 60) {
              lastCampfireTimeRef.current = now
              setWood(w => w - 3)
              setCampfires(prev => [...prev, { x: player.x, y: player.y, timeRemaining: 600, active: true }])
              ensureAudio(); playSound('pickup') // Changed from 'portal' to 'pickup'
            }
          }} style={{ padding: '6px 12px', fontSize: '12px', background: '#7c2d12', border: 'none', borderRadius: 6, color: 'white', cursor: 'pointer' }}>
            Campfire ({wood}/3)
          </button>
        </div>
      </div>

      <div style={{ 
        position: 'relative', 
        flex: 1, 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: 0,
        width: '100%',
        height: 'calc(100vh - 60px)',
        overflow: 'hidden'
      }}>
        <canvas ref={canvasRef} width={canvasSize.width} height={canvasSize.height} onMouseMove={handleMouseMove} onMouseDown={() => {
          if (showManual) return // Don't shoot when manual is open
          const hasGun = gunPickups.some(g => g.collected)
          if (!hasGun || ammo <= 0) return // Need gun and ammo
          ensureAudio(); playSound('shoot')
          const angle = Math.atan2(mousePos.y - VIRTUAL_HEIGHT/2, mousePos.x - VIRTUAL_WIDTH/2)
          const speed = 12
          const id = Math.floor(Math.random() * 1e9)
          setBullets(prev => [...prev, { id, x: player.x, y: player.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 90 }])
          setAmmo(a => a - 1) // Use 1 bullet
        }} style={{ 
          display: 'block', 
          background: 'black', 
          border: '2px solid #374151', 
          cursor: 'crosshair',
          width: '100%',
          height: '100%',
          objectFit: 'contain'
        }} />

        {/* Touch joystick */}
        {isTouchMode && (
          <>
            <div
              style={{ position: 'absolute', left: 16, bottom: 24, width: 144, height: 144, borderRadius: 9999, border: '1px solid rgba(255,255,255,0.2)' }}
              onTouchStart={(e) => { const t = e.touches[0]; const rect = (e.target as HTMLElement).getBoundingClientRect(); const x = t.clientX - rect.left; const y = t.clientY - rect.top; setJoystickStart({ x, y }); setJoystickPos({ x, y }); setJoystickActive(true) }}
              onTouchMove={(e) => { const t = e.touches[0]; const rect = (e.target as HTMLElement).getBoundingClientRect(); const x = t.clientX - rect.left; const y = t.clientY - rect.top; setJoystickPos({ x, y }) }}
              onTouchEnd={() => { setJoystickActive(false); setJoystickStart(null) }}
            >
              {joystickStart && (
                <div style={{ position: 'absolute', left: joystickPos.x, top: joystickPos.y, width: 48, height: 48, transform: 'translate(-50%, -50%)', borderRadius: 9999, background: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.6)' }} />
              )}
            </div>

            <div style={{ position: 'absolute', right: 16, bottom: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={() => { handleButtonClick(); setShowManual(true) }} style={{ width: 48, height: 48, borderRadius: 9999, background: '#3b82f6', color: 'white', fontSize: '20px' }} title="Manual">
                📖
              </button>
              <button onClick={() => { handleButtonClick(); setGameState('paused') }} style={{ width: 48, height: 48, borderRadius: 9999 }}>
                II
              </button>
              <button onClick={() => { handleButtonClick(); setShowMinimap(v => !v) }} style={{ width: 48, height: 48, borderRadius: 9999 }}>M</button>
              <button 
                onTouchStart={() => setSprintHeldTouch(true)} 
                onTouchEnd={() => setSprintHeldTouch(false)}
                style={{ 
                  width: 48, 
                  height: 48, 
                  borderRadius: 9999, 
                  background: sprintHeldTouch ? '#22c55e' : '#374151',
                  color: 'white'
                }}
              >
                S
              </button>
            </div>
          </>
        )}

        {showMinimap && (
          <div style={{ position: 'absolute', right: 16, top: 16, background: '#1f2937', padding: 8, borderRadius: 8 }}>
            <div style={{ position: 'relative', width: 128, height: 128, background: '#111827', border: '1px solid #4b5563', borderRadius: 8 }}>
              <div style={{ position: 'absolute', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#3b82f6', borderRadius: 4, left: `${(player.x / WORLD_WIDTH) * 128 - 8}px`, top: `${(player.y / WORLD_HEIGHT) * 128 - 8}px`, fontSize: '10px', fontWeight: 'bold', color: 'white' }}>P</div>
              <div style={{ position: 'absolute', width: 12, height: 12, borderRadius: 9999, background: '#a855f7', left: `${(WORLD_WIDTH / 2 / WORLD_WIDTH) * 128 - 6}px`, top: `${(WORLD_HEIGHT / 2 / WORLD_HEIGHT) * 128 - 6}px` }} />
              {stones.map(stone => !stone.collected && (
                <div key={stone.id} style={{ position: 'absolute', width: 8, height: 8, borderRadius: 9999, background: '#eab308', left: `${(stone.x / WORLD_WIDTH) * 128 - 4}px`, top: `${(stone.y / WORLD_HEIGHT) * 128 - 4}px` }} />
              ))}
              {gunPickups.map(gun => !gun.collected && (
                <div key={gun.id} style={{ position: 'absolute', width: 8, height: 8, borderRadius: 9999, background: '#8b4513', left: `${(gun.x / WORLD_WIDTH) * 128 - 4}px`, top: `${(gun.y / WORLD_HEIGHT) * 128 - 4}px` }} />
              ))}
              {axePickups.map(axe => !axe.collected && (
                <div key={axe.id} style={{ position: 'absolute', width: 8, height: 8, borderRadius: 9999, background: '#78716c', left: `${(axe.x / WORLD_WIDTH) * 128 - 4}px`, top: `${(axe.y / WORLD_HEIGHT) * 128 - 4}px` }} />
              ))}
              {bulletPickups.map(bullet => !bullet.collected && (
                <div key={bullet.id} style={{ position: 'absolute', width: 8, height: 8, borderRadius: 9999, background: '#fbbf24', left: `${(bullet.x / WORLD_WIDTH) * 128 - 4}px`, top: `${(bullet.y / WORLD_HEIGHT) * 128 - 4}px` }} />
              ))}
              {healthPickups.map(health => !health.collected && (
                <div key={health.id} style={{ position: 'absolute', width: 8, height: 8, borderRadius: 9999, background: '#22c55e', left: `${(health.x / WORLD_WIDTH) * 128 - 4}px`, top: `${(health.y / WORLD_HEIGHT) * 128 - 4}px` }} />
              ))}
              {speedBoosts.map(boost => !boost.collected && (
                <div key={boost.id} style={{ position: 'absolute', width: 8, height: 8, borderRadius: 9999, background: '#06b6d4', left: `${(boost.x / WORLD_WIDTH) * 128 - 4}px`, top: `${(boost.y / WORLD_HEIGHT) * 128 - 4}px` }} />
              ))}
              {lakes.map((lake, idx) => (
                <div key={idx} style={{ position: 'absolute', width: 12, height: 12, borderRadius: 9999, background: lake.used ? '#22c55e' : '#3b82f6', left: `${(lake.x / WORLD_WIDTH) * 128 - 6}px`, top: `${(lake.y / WORLD_HEIGHT) * 128 - 6}px` }} />
              ))}
              {sacrificeAltar && sacrificeAltar.active && (
                <div style={{ position: 'absolute', width: 14, height: 14, background: '#ea580c', borderRadius: 4, left: `${(sacrificeAltar.x / WORLD_WIDTH) * 128 - 7}px`, top: `${(sacrificeAltar.y / WORLD_HEIGHT) * 128 - 7}px`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold', color: 'white' }}>🔥</div>
              )}
              {enemies.map(enemy => (
                <div key={enemy.id} style={{ position: 'absolute', width: enemy.type === 'boss' ? 10 : 8, height: enemy.type === 'boss' ? 10 : 8, borderRadius: 9999, background: enemy.type === 'boss' ? '#ff0000' : '#ef4444', left: `${(enemy.x / WORLD_WIDTH) * 128 - (enemy.type === 'boss' ? 5 : 4)}px`, top: `${(enemy.y / WORLD_HEIGHT) * 128 - (enemy.type === 'boss' ? 5 : 4)}px` }} />
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ textAlign: 'center', padding: 12, color: '#9ca3af', background: '#1f2937' }}>Use WASD to move • Shift to sprint • Mouse to look • Space to chop (axe) • Click to shoot (if gun) • Campfire button places distraction (costs 3 wood)</div>
      
      {/* Sacrifice Altar Menu - Theme: "Sacrifices Must be Made" */}
      {showSacrificeMenu && (
        <div 
          className="modal show d-block" 
          style={{ 
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            zIndex: 9999
          }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content bg-dark text-white border-warning" style={{ borderWidth: 3 }}>
              <div className="modal-header border-warning bg-gradient" style={{ background: 'linear-gradient(135deg, #dc2626 0%, #ea580c 100%)' }}>
                <h5 className="modal-title">
                  🔥 Sacrifice Altar 🔥
                </h5>
                <button 
                  type="button" 
                  className="btn-close btn-close-white" 
                  onClick={() => setShowSacrificeMenu(false)}
                ></button>
              </div>
              <div className="modal-body">
                <p className="text-center text-warning mb-4">
                  <strong>"Sacrifices Must be Made"</strong><br/>
                  <small>Choose your sacrifice wisely...</small>
                </p>
                
                <div className="d-grid gap-3">
                  {/* Sacrifice 1 Life for Power */}
                  <button 
                    className="btn btn-danger btn-lg"
                    disabled={player.lives <= 1}
                    onClick={() => {
                      if (player.lives > 1) {
                        setPlayer(p => ({ ...p, lives: p.lives - 1 }))
                        setSpeedBoostActive(true)
                        setSpeedBoostTimeLeft(600) // 10 seconds
                        setInvisibilityActive(true)
                        setInvisibilityTimeLeft(600) // 10 seconds
                        ensureAudio(); playSound('pickup')
                        createParticle(player.x, player.y, '#ef4444', 30)
                        setSacrificesMade(prev => prev + 1)
                        setShowSacrificeMenu(false)
                        setSacrificeAltar(prev => prev ? { ...prev, active: false } : null)
                      }
                    }}
                  >
                    ❤️ Sacrifice 1 Life<br/>
                    <small>→ Speed Boost + Invisibility (10s)</small>
                  </button>
                  
                  {/* Sacrifice All Ammo for Super Speed */}
                  <button 
                    className="btn btn-warning btn-lg"
                    disabled={ammo < 30}
                    onClick={() => {
                      if (ammo >= 30) {
                        setAmmo(0)
                        setSpeedBoostActive(true)
                        setSpeedBoostTimeLeft(1800) // 30 seconds!
                        ensureAudio(); playSound('pickup')
                        createParticle(player.x, player.y, '#fbbf24', 30)
                        setSacrificesMade(prev => prev + 1)
                        setShowSacrificeMenu(false)
                        setSacrificeAltar(prev => prev ? { ...prev, active: false } : null)
                      }
                    }}
                  >
                    🔫 Sacrifice All Ammo<br/>
                    <small>→ Super Speed Boost (30s)</small>
                  </button>
                  
                  {/* Sacrifice Health Pickups for Instant Portal */}
                  <button 
                    className="btn btn-success btn-lg"
                    disabled={player.stones < levels[currentLevel].stoneCount}
                    onClick={() => {
                      if (player.stones >= levels[currentLevel].stoneCount) {
                        // Sacrifice: Lose 1 life but instant win
                        setPlayer(p => ({ ...p, lives: p.lives - 1 }))
                        ensureAudio(); playSound('portal')
                        createParticle(player.x, player.y, '#22c55e', 50)
                        setSacrificesMade(prev => prev + 1)
                        setShowSacrificeMenu(false)
                        // Teleport to portal
                        setPlayer(p => ({ ...p, x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 }))
                      }
                    }}
                  >
                    💎 Sacrifice 1 Life for Victory<br/>
                    <small>→ Instant Teleport to Portal (if stones collected)</small>
                  </button>
                  
                  {/* NEW: Sacrifice Stamina for Full Health */}
                  <button 
                    className="btn btn-info btn-lg"
                    disabled={player.lives >= 3}
                    onClick={() => {
                      if (player.lives < 3) {
                        setPlayer(p => ({ ...p, lives: 3, stamina: 0 }))
                        ensureAudio(); playSound('pickup')
                        createParticle(player.x, player.y, '#06b6d4', 30)
                        setSacrificesMade(prev => prev + 1)
                        setShowSacrificeMenu(false)
                        setSacrificeAltar(prev => prev ? { ...prev, active: false } : null)
                      }
                    }}
                  >
                    ⚡ Sacrifice All Stamina<br/>
                    <small>→ Restore to Full Health (3 lives)</small>
                  </button>
                  
                  {/* NEW: Sacrifice Speed for Mega Damage */}
                  <button 
                    className="btn btn-purple btn-lg"
                    style={{ background: '#8b5cf6', color: 'white' }}
                    disabled={!speedBoostActive}
                    onClick={() => {
                      if (speedBoostActive) {
                        setSpeedBoostActive(false)
                        setSpeedBoostTimeLeft(0)
                        // Kill all enemies except boss
                        setEnemies(prev => prev.filter(e => e.type === 'boss'))
                        ensureAudio(); playSound('hit')
                        createParticle(player.x, player.y, '#8b5cf6', 50)
                        setSacrificesMade(prev => prev + 1)
                        setShowSacrificeMenu(false)
                        setSacrificeAltar(prev => prev ? { ...prev, active: false } : null)
                      }
                    }}
                  >
                    💨 Sacrifice Speed Boost<br/>
                    <small>→ Kill All Normal Enemies (boss survives)</small>
                  </button>
                  
                  {/* NEW: Sacrifice Invisibility for Stones */}
                  <button 
                    className="btn btn-primary btn-lg"
                    disabled={player.stones >= levels[currentLevel].stoneCount}
                    onClick={() => {
                      if (player.stones < levels[currentLevel].stoneCount) {
                        setPlayer(p => ({ ...p, stones: levels[currentLevel].stoneCount, stamina: 0 }))
                        setInvisibilityActive(false)
                        setInvisibilityTimeLeft(0)
                        ensureAudio(); playSound('pickup')
                        createParticle(player.x, player.y, '#3b82f6', 30)
                        setSacrificesMade(prev => prev + 1)
                        setShowSacrificeMenu(false)
                        setSacrificeAltar(prev => prev ? { ...prev, active: false } : null)
                      }
                    }}
                  >
                    💎 Sacrifice Stamina & Invisibility<br/>
                    <small>→ Collect All Remaining Stones</small>
                  </button>
                  
                  <button 
                    className="btn btn-secondary"
                    onClick={() => setShowSacrificeMenu(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Game Manual Modal */}
      {showManual && (
        <div 
          className="modal show d-block" 
          style={{ 
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            zIndex: 9999
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowManual(false)
              setHasSeenManual(true)
              localStorage.setItem('monsland-manual-seen', 'true')
            }
          }}
        >
          <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg">
            <div className="modal-content bg-dark text-white border-primary">
              <div className="modal-header border-primary">
                <h5 className="modal-title">
                  <i className="bi bi-book-fill me-2 text-primary"></i>
                  Horror Islands - Game Manual
                </h5>
                <button 
                  type="button" 
                  className="btn-close btn-close-white" 
                  onClick={() => {
                    handleButtonClick()
                    setShowManual(false)
                    setHasSeenManual(true)
                    localStorage.setItem('monsland-manual-seen', 'true')
                  }}
                ></button>
              </div>
              <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                <div className="mb-4">
                  <h6 className="text-primary mb-3">
                    <i className="bi bi-bullseye me-2"></i>
                    Objective
                  </h6>
                  <p className="text-light">
                    Collect all <span className="badge bg-warning text-dark">stones</span> in each level and reach the <span className="badge bg-primary">portal</span> to escape. Survive the terrifying enemies that hunt you!
                  </p>
                </div>

                <div className="mb-4">
                  <h6 className="text-primary mb-3">
                    <i className="bi bi-keyboard me-2"></i>
                    Controls
                  </h6>
                  <div className="row g-2">
                    <div className="col-md-6">
                      <div className="card bg-secondary border-0">
                        <div className="card-body py-2">
                          <strong className="text-warning">Desktop:</strong>
                          <ul className="mb-0 mt-2 small">
                            <li><kbd>W A S D</kbd> - Move</li>
                            <li><kbd>Shift</kbd> - Sprint (drains stamina)</li>
                            <li><kbd>Mouse</kbd> - Look around</li>
                            <li><kbd>Space</kbd> - Chop trees (with axe)</li>
                            <li><kbd>Click</kbd> - Shoot (with gun)</li>
                            <li><kbd>Escape</kbd> - Pause game</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="card bg-secondary border-0">
                        <div className="card-body py-2">
                          <strong className="text-info">Mobile:</strong>
                          <ul className="mb-0 mt-2 small">
                            <li>Virtual Joystick - Move</li>
                            <li>Sprint Button - Hold to sprint</li>
                            <li>Touch Screen - Look & shoot</li>
                            <li>UI Buttons - Pause, map, campfire</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  <h6 className="text-primary mb-3">
                    <i className="bi bi-gem me-2"></i>
                    Collectibles
                  </h6>
                  <div className="list-group list-group-flush bg-dark">
                    <div className="list-group-item bg-dark text-light border-secondary d-flex align-items-center">
                      <span className="badge bg-warning text-dark me-3" style={{ fontSize: '1.2rem' }}>💎</span>
                      <div>
                        <strong>Stones</strong> - Required to complete levels. Collect them all!
                      </div>
                    </div>
                    <div className="list-group-item bg-dark text-light border-secondary d-flex align-items-center">
                      <span className="badge bg-success me-3" style={{ fontSize: '1.5rem' }}>❤️</span>
                      <div>
                        <strong>Health Pickups</strong> - Restore 1 life (max 3 lives)
                      </div>
                    </div>
                    <div className="list-group-item bg-dark text-light border-secondary d-flex align-items-center">
                      <span className="badge me-3" style={{ fontSize: '1.2rem', backgroundColor: '#78716c' }}>🪓</span>
                      <div>
                        <strong>Axe</strong> - Chop trees safely without taking damage. Collect wood! Gray marker on minimap.
                      </div>
                    </div>
                    <div className="list-group-item bg-dark text-light border-secondary d-flex align-items-center">
                      <span className="badge me-3" style={{ fontSize: '1.5rem', backgroundColor: '#8b4513' }}>🔫</span>
                      <div>
                        <strong>Gun</strong> - Shoot enemies from a distance. Each gun comes with 30 bullets. Check minimap for brown markers!
                      </div>
                    </div>
                    <div className="list-group-item bg-dark text-light border-secondary d-flex align-items-center">
                      <span className="badge bg-warning text-dark me-3" style={{ fontSize: '1.5rem' }}>📦</span>
                      <div>
                        <strong>Ammo Box</strong> - Refills 30 bullets. Essential for long battles! Yellow markers on minimap.
                      </div>
                    </div>
                    <div className="list-group-item bg-dark text-light border-secondary d-flex align-items-center">
                      <span className="badge me-3" style={{ fontSize: '1.5rem', backgroundColor: '#06b6d4' }}>⚡</span>
                      <div>
                        <strong>Speed Boost</strong> - Increases your speed by 50% for 7 seconds! Cyan markers on minimap.
                      </div>
                    </div>
                    <div className="list-group-item bg-dark text-light border-secondary d-flex align-items-center">
                      <span className="badge bg-secondary me-3" style={{ fontSize: '1.2rem' }}>🪵</span>
                      <div>
                        <strong>Wood</strong> - Chop trees to get wood. Use 3 wood to build campfires
                      </div>
                    </div>
                    <div className="list-group-item bg-dark text-light border-secondary d-flex align-items-center">
                      <span className="badge me-3" style={{ fontSize: '1.5rem', backgroundColor: '#3b82f6' }}>💧</span>
                      <div>
                        <strong>Lake (Circular)</strong> - Blue water grants 30s invisibility! Turns GREEN after use. Touch again = damage! One per level.
                      </div>
                    </div>
                    <div className="list-group-item bg-danger text-light border-warning d-flex align-items-center" style={{ borderWidth: 2 }}>
                      <span className="badge me-3" style={{ fontSize: '1.5rem', backgroundColor: '#ea580c' }}>🔥</span>
                      <div>
                        <strong>Sacrifice Altar</strong> - Theme: "Sacrifices Must be Made"! Press E to make powerful sacrifices. One per level.
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="mb-4">
                  <h6 className="text-danger mb-3">
                    🔥 Sacrifice Altar - "Sacrifices Must be Made"
                  </h6>
                  <div className="alert alert-danger mb-0">
                    <strong>Make Strategic Sacrifices:</strong>
                    <ul className="mb-0 mt-2">
                      <li><strong>Sacrifice 1 Life</strong> → Speed Boost + Invisibility (10s)</li>
                      <li><strong>Sacrifice All Ammo</strong> → Super Speed Boost (30s)</li>
                      <li><strong>Sacrifice 1 Life for Victory</strong> → Instant teleport to portal (if stones collected)</li>
                    </ul>
                    <small className="text-warning d-block mt-2">⚠️ Each altar can only be used once! Choose wisely!</small>
                  </div>
                </div>

                <div className="mb-4">
                  <h6 className="text-primary mb-3">
                    <i className="bi bi-fire me-2"></i>
                    Campfire Mechanic
                  </h6>
                  <div className="alert alert-warning mb-0">
                    <strong>Strategic Distraction:</strong> Build campfires (costs 3 wood) to distract enemies. They will move towards the campfire instead of chasing you! Campfires last for 10 seconds.
                  </div>
                </div>

                <div className="mb-4">
                  <h6 className="text-primary mb-3">
                    <i className="bi bi-moon-stars-fill me-2"></i>
                    Day/Night Cycle
                  </h6>
                  <div className="row g-2">
                    <div className="col-md-6">
                      <div className="card bg-warning border-0 text-dark">
                        <div className="card-body py-2">
                          <div style={{ fontSize: '2rem' }}>☀️</div>
                          <strong>Day Levels</strong>
                          <ul className="small mb-0 mt-2 text-start">
                            <li>Normal enemy speed</li>
                            <li>Minimum 5 enemies</li>
                            <li>Standard difficulty</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="card bg-dark border-danger">
                        <div className="card-body py-2">
                          <div style={{ fontSize: '2rem' }}>🌙</div>
                          <strong className="text-danger">Night Levels</strong>
                          <ul className="small mb-0 mt-2 text-start text-light">
                            <li><strong>30% faster</strong> enemies!</li>
                            <li>Minimum <strong>8 enemies</strong></li>
                            <li><strong>More aggressive</strong> spawning</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  <h6 className="text-primary mb-3">
                    <i className="bi bi-exclamation-triangle-fill me-2"></i>
                    Enemies
                  </h6>
                  <div className="row g-2 mb-3">
                    <div className="col-md-6">
                      <div className="card bg-danger border-0 text-center">
                        <div className="card-body py-2">
                          <div style={{ fontSize: '2rem' }}>👹</div>
                          <strong>Chasers</strong>
                          <p className="small mb-0 mt-1">Red monsters that follow you relentlessly</p>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="card bg-secondary border-0 text-center">
                        <div className="card-body py-2">
                          <div style={{ fontSize: '2rem', opacity: 0.7 }}>👻</div>
                          <strong>Ghosts (Wanderers)</strong>
                          <p className="small mb-0 mt-1">Transparent spirits that move randomly</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="alert alert-danger mb-0">
                    <h6 className="mb-2"><strong>🐉 Boss Dragons</strong></h6>
                    <p className="small mb-2">Each level has a powerful dragon boss that hunts you down!</p>
                    <ul className="small mb-0">
                      <li><strong className="text-danger">Haunted Forest:</strong> Red Dragon - Fierce and aggressive</li>
                      <li><strong className="text-info">Frozen Wasteland:</strong> Ice Dragon - Cold and relentless</li>
                      <li><strong className="text-warning">Desert of Souls:</strong> Sand Dragon - Fast and deadly</li>
                      <li><strong className="text-success">Cursed Island:</strong> Green Dragon - Venomous and powerful</li>
                    </ul>
                    <p className="small mb-0 mt-2"><em>Dragons are larger, faster, and have more health than regular enemies!</em></p>
                  </div>
                </div>

                <div className="mb-4">
                  <h6 className="text-primary mb-3">
                    <i className="bi bi-lightning-charge-fill me-2"></i>
                    Stamina System
                  </h6>
                  <p className="text-light">
                    Sprinting drains your stamina. When stamina is low, you move slower and footsteps sound heavier. Rest to regenerate stamina!
                  </p>
                  <div className="progress" style={{ height: '25px' }}>
                    <div className="progress-bar bg-success" style={{ width: '100%' }}>Full Stamina</div>
                  </div>
                  <div className="progress mt-2" style={{ height: '25px' }}>
                    <div className="progress-bar bg-warning" style={{ width: '30%' }}>Low Stamina</div>
                  </div>
                  <div className="progress mt-2" style={{ height: '25px' }}>
                    <div className="progress-bar bg-danger" style={{ width: '10%' }}>Exhausted!</div>
                  </div>
                </div>

                <div className="mb-3">
                  <h6 className="text-primary mb-3">
                    <i className="bi bi-map me-2"></i>
                    Tips for Survival
                  </h6>
                  <ul className="text-light">
                    <li>Use the <strong>minimap</strong> to track: enemies (red), stones (yellow), guns (brown), ammo (yellow), axe (gray), health (green)</li>
                    <li>Find <strong>2 axes</strong> per level - you need them to chop trees safely!</li>
                    <li>Find <strong>guns</strong> early - each gun gives you 30 bullets!</li>
                    <li>Collect <strong>ammo boxes</strong> to refill bullets - you'll need them for the dragon!</li>
                    <li><strong className="text-warning">NIGHT WARNING:</strong> Enemies are 30% faster and more spawn at night! Be extra careful!</li>
                    <li><strong className="text-danger">ISLAND WARNING:</strong> Stay on land! Purple water is poisonous and will kill you!</li>
                    <li><strong className="text-info">LAKE POWER:</strong> Blue circular lake grants 30s invisibility! Turns GREEN after use. Touch again = damage!</li>
                    <li><strong className="text-info">MINIMAP:</strong> Lake shows as blue dot (unused) or green dot (used) on minimap!</li>
                    <li>Build <strong>campfires</strong> strategically to distract enemies and dragons</li>
                    <li>Manage your <strong>stamina</strong> - don't sprint constantly, especially near dragons!</li>
                    <li>Trees hurt you unless you have an <strong>axe</strong></li>
                    <li>The portal only activates when you collect all stones</li>
                    <li>Boss dragons appear larger on the minimap - avoid them until you have a gun!</li>
                    <li>Health pickups restore 1 life (max 3 lives total)</li>
                    <li>Day levels: 5 enemies minimum | Night levels: 8 enemies minimum (more aggressive!)</li>
                  </ul>
                </div>

                <div className="alert alert-info mb-0">
                  <i className="bi bi-info-circle-fill me-2"></i>
                  <strong>Find this manual anytime!</strong> Look for the blue book icon <span className="badge bg-primary">?</span> near the portal in each level.
                </div>
              </div>
              <div className="modal-footer border-primary">
                <button 
                  type="button" 
                  className="btn btn-primary"
                  onClick={() => {
                    handleButtonClick()
                    setShowManual(false)
                    setHasSeenManual(true)
                    localStorage.setItem('monsland-manual-seen', 'true')
                  }}
                >
                  <i className="bi bi-check-circle me-2"></i>
                  Got it! Let's Play
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


