import React, { useEffect, useRef, useState, useCallback } from 'react'

type GameState = 'menu' | 'settings' | 'levelSelect' | 'playing' | 'paused' | 'victory' | 'gameOver'

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
interface Campfire { x: number; y: number; life: number }

const WORLD_WIDTH = 30000
const WORLD_HEIGHT = 3000
const PLAYER_SIZE = 12
const ENEMY_SIZE = 16
const STONE_SIZE = 14
const PORTAL_SIZE = 30

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const VIRTUAL_WIDTH = 800
  const VIRTUAL_HEIGHT = 600
  const [canvasSize, setCanvasSize] = useState<{width:number;height:number}>({ width: VIRTUAL_WIDTH, height: VIRTUAL_HEIGHT })
  const pausedBySystemRef = useRef(false)
  const [gameState, setGameState] = useState<GameState>('menu')
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
  const [keys, setKeys] = useState<Set<string>>(new Set())
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [camera, setCamera] = useState({ x: 0, y: 0 })
  const [showMinimap, setShowMinimap] = useState(true)
  const [gameTime, setGameTime] = useState(0)
  const [bgPattern, setBgPattern] = useState<CanvasPattern | null>(null)
  const [stepPhase, setStepPhase] = useState(0) // for running animation
  const [sprintHeldTouch, setSprintHeldTouch] = useState(false)
  const lastHitTimeRef = useRef(0)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const ensureAudio = useCallback(() => {
    if (!audioCtxRef.current) {
      try { audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)() } catch {}
    }
  }, [])
  const playSound = useCallback((type: 'pickup' | 'hit' | 'chop' | 'victory' | 'portal' | 'shoot') => {
    const ctx = audioCtxRef.current; if (!ctx) return
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
    g.gain.exponentialRampToValueAtTime(0.1, now + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18)
    o.start(now); o.stop(now + 0.2)
  }, [])

  const [levels, setLevels] = useState<Level[]>([
    { id: 1, name: 'Haunted Forest', environment: 'forest', unlocked: true, completed: false, enemyCount: 6, stoneCount: 3, weather: 'fog', timeOfDay: 'night' },
    { id: 2, name: 'Frozen Wasteland', environment: 'winter', unlocked: false, completed: false, enemyCount: 8, stoneCount: 4, weather: 'snow', timeOfDay: 'night' },
    { id: 3, name: 'Desert of Souls', environment: 'desert', unlocked: false, completed: false, enemyCount: 10, stoneCount: 5, weather: 'clear', timeOfDay: 'day' },
    { id: 4, name: 'Cursed Island', environment: 'island', unlocked: false, completed: false, enemyCount: 12, stoneCount: 6, weather: 'rain', timeOfDay: 'night' }
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

    setPlayer({ x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2, health: 100, stones: 0, speed: 2, stamina: 100, attackCooldown: 0, lives: 3, hasAxe: false })

    // Per-level seeded RNG so maps differ
    const rng = createRNG(1337 + level.id * 1009)

    const newTrees: Tree[] = []
    const treeCount = level.environment === 'desert' ? 800 : 2500
    for (let i = 0; i < treeCount; i++) {
      let treeType: Tree['type'] = 'pine'
      switch (level.environment) {
        case 'winter': treeType = rng() > 0.7 ? 'dead' : 'pine'; break
        case 'desert': treeType = rng() > 0.8 ? 'dead' : 'palm'; break
        case 'island': treeType = 'palm'; break
        default: treeType = rng() > 0.3 ? 'pine' : 'oak'
      }
      newTrees.push({ x: rng() * WORLD_WIDTH, y: rng() * WORLD_HEIGHT, size: 15 + rng() * 35, type: treeType })
    }
    setTrees(newTrees)

    // Procedural grass carpet (lighter in winter)
    const grassBlades: Grass[] = []
    const grassDensity = level.environment === 'desert' ? 0.0002 : 0.0012
    const count = Math.floor(WORLD_WIDTH * WORLD_HEIGHT * grassDensity)
    for (let i = 0; i < count; i++) grassBlades.push({ x: rng() * WORLD_WIDTH, y: rng() * WORLD_HEIGHT, h: 6 + rng() * 10 })
    setGrass(grassBlades)

    const newEnemies: Enemy[] = []
    for (let i = 0; i < level.enemyCount; i++) {
      const enemyType = i < level.enemyCount - 2 ? 'chaser' : i === level.enemyCount - 1 ? 'boss' : 'wanderer'
      newEnemies.push({ id: i, x: rng() * WORLD_WIDTH, y: rng() * WORLD_HEIGHT, speed: enemyType === 'boss' ? 1.5 : enemyType === 'chaser' ? 2 : 1, type: enemyType, health: enemyType === 'boss' ? 3 : 1, size: enemyType === 'boss' ? 25 : ENEMY_SIZE, direction: rng() * Math.PI * 2 })
    }
    setEnemies(newEnemies)

    const newStones: Stone[] = []
    for (let i = 0; i < level.stoneCount; i++) newStones.push({ id: i, x: 100 + rng() * (WORLD_WIDTH - 200), y: 100 + rng() * (WORLD_HEIGHT - 200), collected: false, glowing: true })
    setStones(newStones)

    // Generate health pickups
    const newHealthPickups: HealthPickup[] = []
    for (let i = 0; i < Math.min(5, Math.floor(level.enemyCount / 2)); i++) {
      newHealthPickups.push({ id: i, x: 50 + rng() * (WORLD_WIDTH - 100), y: 50 + rng() * (WORLD_HEIGHT - 100), collected: false, healing: 25 })
    }
    setHealthPickups(newHealthPickups)

    // Generate axe pickups (only in first level for now)
    const newAxePickups: AxePickup[] = []
    if (level.id === 1) {
      newAxePickups.push({ id: 0, x: rng() * WORLD_WIDTH, y: rng() * WORLD_HEIGHT, collected: false })
    }
    setAxePickups(newAxePickups)
    // Generate gun pickups on later levels
    const newGunPickups: GunPickup[] = []
    if (level.id >= 2) {
      const countG = Math.min(2, Math.floor(level.id / 2))
      for (let i = 0; i < countG; i++) newGunPickups.push({ id: i, x: rng() * WORLD_WIDTH, y: rng() * WORLD_HEIGHT, collected: false })
    }
    setGunPickups(newGunPickups)
    setParticles([])
    // Decorative flowers
    const flowerColors = level.environment === 'desert' ? ['#fbbf24','#eab308','#f59e0b'] : level.environment === 'winter' ? ['#93c5fd','#e5e7eb','#bfdbfe'] : ['#ef4444','#22c55e','#a78bfa','#f472b6']
    const newFlowers: Flower[] = []
    for (let i = 0; i < 600; i++) newFlowers.push({ x: rng() * WORLD_WIDTH, y: rng() * WORLD_HEIGHT, c: flowerColors[Math.floor(rng()*flowerColors.length)] })
    setFlowers(newFlowers)
  }, [levels, createRNG])

  const createParticle = useCallback((x: number, y: number, color: string, count: number = 5) => {
    const newParticles: Particle[] = []
    for (let i = 0; i < count; i++) newParticles.push({ x: x + (Math.random() - 0.5) * 20, y: y + (Math.random() - 0.5) * 20, vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4, life: 60, maxLife: 60, color, size: 2 + Math.random() * 4 })
    setParticles(prev => [...prev, ...newParticles])
  }, [])

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
    // Responsive canvas: maintain 4:3 aspect and fit within viewport
    const updateCanvasSize = () => {
      const padding = 24
      const availW = Math.max(320, window.innerWidth - padding * 2)
      const availH = Math.max(240, window.innerHeight - 160) // leave space for HUD
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

  useEffect(() => {
    if (gameState !== 'playing') return
    const gameLoop = setInterval(() => {
      setGameTime(prev => prev + 1)
      setParticles(prev => prev.map(p => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, life: p.life - 1 })).filter(p => p.life > 0))
      if (gameTime % 10 === 0) updateWeather()

      setPlayer(prev => {
        let newX = prev.x, newY = prev.y
        let speed = prev.speed
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
        const wantsSprint = (keys.has('shift') || sprintHeldTouch) && prev.stamina > 0
        const sprintMultiplier = wantsSprint ? 1.8 : 1
        const staminaDrain = wantsSprint ? 0.7 : -0.35 // negative = regen

        if (keys.has('w')) newY -= speed * sprintMultiplier
        if (keys.has('s')) newY += speed * sprintMultiplier
        if (keys.has('a')) newX -= speed * sprintMultiplier
        if (keys.has('d')) newX += speed * sprintMultiplier
        const movingKeyboard = keys.has('w') || keys.has('a') || keys.has('s') || keys.has('d')
        if (analogDx !== 0 || analogDy !== 0) { newX += analogDx * speed * 2 * sprintMultiplier; newY += analogDy * speed * 2 * sprintMultiplier }
        const isMoving = movingKeyboard || analogDx !== 0 || analogDy !== 0
        newX = Math.max(PLAYER_SIZE, Math.min(WORLD_WIDTH - PLAYER_SIZE, newX))
        newY = Math.max(PLAYER_SIZE, Math.min(WORLD_HEIGHT - PLAYER_SIZE, newY))
        // advance running phase faster when sprinting
        if (isMoving) setStepPhase(p => (p + (wantsSprint ? 0.35 : 0.2)) % (Math.PI * 2))
        // update stamina
        let newStamina = Math.max(0, Math.min(100, prev.stamina - (isMoving ? staminaDrain : -0.5)))
        const newAttackCooldown = Math.max(0, prev.attackCooldown - 1)
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

      setEnemies(prev => prev.map(enemy => {
        let newX = enemy.x, newY = enemy.y
        if (enemy.type === 'chaser' || enemy.type === 'boss') {
          const dx = player.x - enemy.x, dy = player.y - enemy.y
          const d = Math.hypot(dx, dy)
          if (d > 0) { newX += (dx / d) * enemy.speed; newY += (dy / d) * enemy.speed }
        } else {
          const newDir = (enemy.direction ?? 0) + (Math.random() - 0.5) * 0.2
          newX += Math.cos(newDir) * enemy.speed
          newY += Math.sin(newDir) * enemy.speed
          newX = Math.max(enemy.size, Math.min(WORLD_WIDTH - enemy.size, newX))
          newY = Math.max(enemy.size, Math.min(WORLD_HEIGHT - enemy.size, newY))
          return { ...enemy, x: newX, y: newY, direction: newDir }
        }
        newX = Math.max(enemy.size, Math.min(WORLD_WIDTH - enemy.size, newX))
        newY = Math.max(enemy.size, Math.min(WORLD_HEIGHT - enemy.size, newY))
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

      // Check health pickup collection
      setHealthPickups(prev => prev.map(pickup => {
        if (!pickup.collected) {
          const dx = player.x - pickup.x, dy = player.y - pickup.y
          const d = Math.hypot(dx, dy)
          if (d < PLAYER_SIZE + 12) { 
            setPlayer(p => ({ ...p, health: Math.min(100, p.health + pickup.healing) })); 
            createParticle(pickup.x, pickup.y, '#10b981', 8); 
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

      // Tree collision logic
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
          }
        }
        // Distraction: enemies near campfire drift towards it
        const nearCf = campfires.find(cf => Math.hypot(cf.x - enemy.x, cf.y - enemy.y) < 160)
        if (nearCf) {
          const adx = nearCf.x - enemy.x, ady = nearCf.y - enemy.y
          const ad = Math.hypot(adx, ady) || 1
          enemy.x += (adx / ad) * 0.5
          enemy.y += (ady / ad) * 0.5
        }
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
          setGameState('victory')
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
    if (bgPattern) { ctx.fillStyle = bgPattern; ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT) } else { ctx.fillStyle = bgColor; ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT) }

    // Day/Night overlay and sun/moon
    const dayLength = 6000 // ~100 seconds at 60fps
    const cycle = (gameTime % dayLength) / dayLength
    const isNight = cycle > 0.6 && cycle < 0.95
    const skyAlpha = isNight ? 0.35 : Math.max(0, 0.25 - cycle * 0.25)
    ctx.fillStyle = `rgba(0,0,0,${skyAlpha})`
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT)
    const sunX = (cycle) * VIRTUAL_WIDTH
    const sunY = 100 + Math.sin(cycle * Math.PI) * 60
    ctx.fillStyle = isNight ? '#cbd5e1' : '#fde68a'
    ctx.beginPath(); ctx.arc(sunX, sunY, 14, 0, Math.PI * 2); ctx.fill()
    // Vignette
    const grad = ctx.createRadialGradient(VIRTUAL_WIDTH/2, VIRTUAL_HEIGHT/2, 100, VIRTUAL_WIDTH/2, VIRTUAL_HEIGHT/2, 400)
    grad.addColorStop(0, 'rgba(0,0,0,0)')
    grad.addColorStop(1, 'rgba(0,0,0,0.25)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT)
    ctx.save(); ctx.translate(-camera.x, -camera.y)

    if (level.environment === 'island') { ctx.fillStyle = '#1e40af'; ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT); ctx.fillStyle = '#22c55e'; ctx.beginPath(); ctx.ellipse(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, WORLD_WIDTH / 2 - 100, WORLD_HEIGHT / 2 - 100, 0, 0, Math.PI * 2); ctx.fill() }

    // Grass field (culled)
    const grassPrimary = level.environment === 'winter' ? '#e5e7eb' : '#16a34a'
    const grassSecondary = level.environment === 'winter' ? '#f8fafc' : '#22c55e'
    ctx.lineWidth = 1
    grass.forEach(g => {
      if (g.x < camera.x - 40 || g.x > camera.x + 840 || g.y < camera.y - 40 || g.y > camera.y + 640) return
      const sway = Math.sin(gameTime * 0.1 + g.x * 0.02) * 3
      // tuft: 3-4 blades curved
      for (let b = -1; b <= 2; b++) {
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

    // Flowers
    flowers.forEach(f => {
      if (f.x < camera.x - 20 || f.x > camera.x + 820 || f.y < camera.y - 20 || f.y > camera.y + 620) return
      ctx.fillStyle = f.c
      ctx.beginPath(); ctx.arc(f.x, f.y, 2, 0, Math.PI * 2); ctx.fill()
    })

    // Campfire render (attract light, distract enemies)
    campfires.forEach(cf => {
      const flicker = 0.6 + Math.sin(gameTime * 0.5 + cf.x) * 0.1
      ctx.fillStyle = `rgba(251, 146, 60, ${0.6 * flicker})`
      ctx.beginPath(); ctx.arc(cf.x, cf.y, 10, 0, Math.PI * 2); ctx.fill()
      // glow
      ctx.fillStyle = `rgba(251, 191, 36, ${0.25 * flicker})`
      ctx.beginPath(); ctx.arc(cf.x, cf.y, 28, 0, Math.PI * 2); ctx.fill()
    })

    trees.forEach(tree => {
      if (tree.x < camera.x - 60 || tree.x > camera.x + 860 || tree.y < camera.y - 60 || tree.y > camera.y + 660) return
      let treeColor = '#22c55e'; if (tree.type === 'dead') treeColor = '#92400e'; else if (tree.type === 'palm') treeColor = '#16a34a'; else if (level.environment === 'winter') treeColor = '#065f46'
      const sway = Math.sin(gameTime * 0.05 + tree.x * 0.01) * 3
      ctx.fillStyle = treeColor; ctx.beginPath(); ctx.arc(tree.x + sway, tree.y, tree.size, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = tree.type === 'dead' ? '#451a03' : '#92400e'; ctx.fillRect(tree.x - 4, tree.y + tree.size - 15, 8, 20)
    })

    const portalX = WORLD_WIDTH / 2, portalY = WORLD_HEIGHT / 2
    const portalGlow = Math.sin(gameTime * 0.1) * 0.3 + 0.7
    ctx.fillStyle = player.stones >= levels[currentLevel].stoneCount ? `rgba(139, 92, 246, ${portalGlow})` : 'rgba(107, 114, 128, 0.5)'
    ctx.beginPath(); ctx.arc(portalX, portalY, PORTAL_SIZE, 0, Math.PI * 2); ctx.fill(); if (player.stones >= levels[currentLevel].stoneCount) { ctx.strokeStyle = `rgba(167, 139, 250, ${portalGlow})`; ctx.lineWidth = 4; ctx.stroke() }

    stones.forEach(stone => {
      if (stone.x < camera.x - 60 || stone.x > camera.x + 860 || stone.y < camera.y - 60 || stone.y > camera.y + 660) return
      if (!stone.collected) { const glowSize = Math.sin(gameTime * 0.2 + stone.id) * 3 + STONE_SIZE; ctx.fillStyle = 'rgba(251, 191, 36, 0.3)'; ctx.beginPath(); ctx.arc(stone.x, stone.y, glowSize + 5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(stone.x, stone.y, STONE_SIZE, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 2; ctx.stroke() }
    })

    // Draw health pickups
    healthPickups.forEach(pickup => {
      if (pickup.x < camera.x - 60 || pickup.x > camera.x + 860 || pickup.y < camera.y - 60 || pickup.y > camera.y + 660) return
      if (!pickup.collected) {
        const pulse = Math.sin(gameTime * 0.3 + pickup.id) * 2 + 12
        ctx.fillStyle = 'rgba(16, 185, 129, 0.4)'
        ctx.beginPath()
        ctx.arc(pickup.x, pickup.y, pulse + 3, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#10b981'
        ctx.beginPath()
        ctx.arc(pickup.x, pickup.y, 12, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#059669'
        ctx.lineWidth = 2
        ctx.stroke()
      }
    })

    // Draw axe pickups
    axePickups.forEach(axe => {
      if (axe.x < camera.x - 60 || axe.x > camera.x + 860 || axe.y < camera.y - 60 || axe.y > camera.y + 660) return
      if (!axe.collected) {
        const pulse = Math.sin(gameTime * 0.3 + axe.id) * 2 + 12
        ctx.fillStyle = 'rgba(255, 215, 0, 0.4)' // Gold glow
        ctx.beginPath()
        ctx.arc(axe.x, axe.y, pulse + 3, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#FFD700' // Gold
        ctx.beginPath()
        ctx.moveTo(axe.x, axe.y - 10)
        ctx.lineTo(axe.x + 8, axe.y - 5)
        ctx.lineTo(axe.x + 5, axe.y + 10)
        ctx.lineTo(axe.x - 5, axe.y + 10)
        ctx.lineTo(axe.x - 8, axe.y - 5)
        ctx.closePath()
        ctx.fill()
        ctx.strokeStyle = '#B8860B' // Darker gold
        ctx.lineWidth = 2
        ctx.stroke()
      }
    })

    enemies.forEach(enemy => {
      if (enemy.x < camera.x - 80 || enemy.x > camera.x + 880 || enemy.y < camera.y - 80 || enemy.y > camera.y + 680) return
      const bob = Math.sin(gameTime * 0.15 + enemy.id) * 2
      const bodyColor = enemy.type === 'boss' ? '#4c0519' : '#111827'
      const skin = enemy.type === 'boss' ? '#ef4444' : '#f87171'
      // Body (monster blob)
      ctx.fillStyle = skin
      ctx.beginPath()
      ctx.ellipse(enemy.x, enemy.y + bob, enemy.size + 2, enemy.size, 0, 0, Math.PI * 2)
      ctx.fill()
      // Horns
      ctx.fillStyle = bodyColor
      ctx.beginPath()
      ctx.moveTo(enemy.x - enemy.size * 0.6, enemy.y + bob - enemy.size)
      ctx.lineTo(enemy.x - enemy.size * 0.2, enemy.y + bob - enemy.size * 0.4)
      ctx.lineTo(enemy.x - enemy.size * 0.9, enemy.y + bob - enemy.size * 0.3)
      ctx.closePath(); ctx.fill()
      ctx.beginPath()
      ctx.moveTo(enemy.x + enemy.size * 0.6, enemy.y + bob - enemy.size)
      ctx.lineTo(enemy.x + enemy.size * 0.2, enemy.y + bob - enemy.size * 0.4)
      ctx.lineTo(enemy.x + enemy.size * 0.9, enemy.y + bob - enemy.size * 0.3)
      ctx.closePath(); ctx.fill()
      // Eyes
      ctx.fillStyle = '#ffffff'
      const eyes = enemy.type === 'boss' ? 3 : 2
      for (let i = 0; i < eyes; i++) {
        const ex = enemy.x + (i - (eyes - 1) / 2) * (enemy.type === 'boss' ? 8 : 6)
        const ey = enemy.y + bob - enemy.size * 0.2
        ctx.beginPath(); ctx.arc(ex, ey, enemy.type === 'boss' ? 4 : 3, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = '#111827'; ctx.beginPath(); ctx.arc(ex + 1, ey, enemy.type === 'boss' ? 2 : 1.5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#ffffff'
      }
      // Mouth with teeth
      ctx.fillStyle = bodyColor
      ctx.beginPath(); ctx.ellipse(enemy.x, enemy.y + bob + enemy.size * 0.2, enemy.size * 0.6, enemy.size * 0.3, 0, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#ffffff'
      for (let t = -3; t <= 3; t++) {
        ctx.beginPath(); ctx.moveTo(enemy.x + t * 4, enemy.y + bob + enemy.size * 0.1)
        ctx.lineTo(enemy.x + t * 4 + 2, enemy.y + bob + enemy.size * 0.22)
        ctx.lineTo(enemy.x + t * 4 - 2, enemy.y + bob + enemy.size * 0.22)
        ctx.closePath(); ctx.fill()
      }
    })

    // Draw gun pickups
    gunPickups.forEach(g => {
      if (g.x < camera.x - 60 || g.x > camera.x + 860 || g.y < camera.y - 60 || g.y > camera.y + 660) return
      if (!g.collected) {
        ctx.fillStyle = 'rgba(96,165,250,0.35)'
        ctx.beginPath(); ctx.arc(g.x, g.y, 14, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = '#3b82f6'
        ctx.fillRect(g.x - 8, g.y - 3, 16, 6)
        ctx.fillStyle = '#1e40af'
        ctx.fillRect(g.x + 4, g.y - 6, 8, 3)
      }
    })

    // Draw bullets
    ctx.fillStyle = '#93c5fd'
    bullets.forEach(b => {
      ctx.beginPath(); ctx.arc(b.x, b.y, 2, 0, Math.PI * 2); ctx.fill()
    })

    // Stickman player with running animation
    const angle = Math.atan2(mousePos.y - VIRTUAL_HEIGHT/2, mousePos.x - VIRTUAL_WIDTH/2)
    const headRadius = 8, bodyLen = 20
    const baseLimb = 14
    const swing = Math.sin(stepPhase) * 6
    const limbLenFront = baseLimb + swing
    const limbLenBack = baseLimb - swing
    const cx = player.x, cy = player.y
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

    ctx.restore()
  }, [gameState, player, enemies, stones, trees, particles, camera, mousePos, gameTime, currentLevel, levels, bgPattern, healthPickups, axePickups])

  if (gameState === 'menu') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(to bottom, #4c1d95, #111827, #000)' }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ color: 'white', fontWeight: 800, fontSize: 56, marginBottom: 16 }}>HORROR ISLANDS</h1>
          <p style={{ color: '#d1d5db', marginBottom: 24 }}>Survive the nightmare. Collect the stones. Escape.</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button onClick={() => setGameState('levelSelect')} style={{ padding: '12px 24px', fontSize: 18 }}>PLAY</button>
            <button onClick={() => setGameState('settings')} style={{ padding: '12px 24px', fontSize: 18 }}>SETTINGS</button>
          </div>
        </div>
      </div>
    )
  }

  if (gameState === 'settings') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(to bottom, #4c1d95, #111827, #000)' }}>
        <div style={{ width: 400, background: '#1f2937', color: 'white', padding: 16, borderRadius: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Settings</span>
            <button onClick={() => setGameState('menu')}>X</button>
          </div>
          <div style={{ marginTop: 16 }}>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 8 }}>Graphics Quality</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {(['low','medium','high'] as const).map(q => (
                  <button key={q} onClick={() => setGraphicsQuality(q)} style={{ padding: 8, background: graphicsQuality === q ? '#374151' : '#111827', color: 'white' }}>{q}</button>
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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(to bottom, #4c1d95, #111827, #000)' }}>
        <div style={{ width: '100%', maxWidth: 900 }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <h2 style={{ fontSize: 32, color: 'white', fontWeight: 800 }}>Choose Your Nightmare</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
            {levels.map((level, index) => {
              const isUnlocked = level.unlocked || index === 0
              return (
                <div key={level.id} onClick={() => { if (isUnlocked) { setCurrentLevel(index); initializeLevel(index); setGameState('playing') } }} style={{ padding: 12, borderRadius: 8, background: isUnlocked ? '#1f2937' : '#0f172a', color: 'white', cursor: isUnlocked ? 'pointer' : 'not-allowed' }}>
                  <div style={{ textAlign: 'center', fontSize: 14 }}>{isUnlocked ? level.name : 'Locked'}</div>
                  {isUnlocked && (
                    <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>
                      {level.enemyCount} Enemies • {level.stoneCount} Stones • {level.weather} • {level.timeOfDay}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button onClick={() => setGameState('menu')}>Back to Menu</button>
          </div>
        </div>
      </div>
    )
  }

  if (gameState === 'victory') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(to bottom, #065f46, #111827, #000)' }}>
        <div style={{ background: '#1f2937', color: 'white', padding: 16, borderRadius: 8 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Level Complete!</div>
          <div style={{ marginBottom: 12 }}>You survived {levels[currentLevel].name}!</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {currentLevel < levels.length - 1 ? (
              <button onClick={() => { setCurrentLevel(prev => prev + 1); initializeLevel(currentLevel + 1); setGameState('playing') }}>Next Level</button>
            ) : (
              <button onClick={() => setGameState('levelSelect')}>Level Select</button>
            )}
            <button onClick={() => setGameState('levelSelect')}>Back to Levels</button>
          </div>
        </div>
      </div>
    )
  }

  if (gameState === 'gameOver') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(to bottom, #7f1d1d, #111827, #000)' }}>
        <div style={{ background: '#1f2937', color: 'white', padding: 16, borderRadius: 8 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Game Over</div>
          <div style={{ marginBottom: 12 }}>The {levels[currentLevel].name} claimed another victim...</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { initializeLevel(currentLevel); setGameState('playing') }}>Try Again</button>
            <button onClick={() => setGameState('levelSelect')}>Level Select</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#111827' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: 12, background: '#1f2937', color: 'white' }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ background: '#78350f', padding: '4px 8px', borderRadius: 6 }}>Stones: {player.stones}/{levels[currentLevel].stoneCount}</div>
          <div style={{ background: '#111827', padding: '4px 8px', borderRadius: 6 }}>
            Stamina: <span style={{ color: player.stamina > 30 ? '#22c55e' : player.stamina > 10 ? '#f59e0b' : '#ef4444' }}>{Math.round(player.stamina)}%</span>
          </div>
          <div style={{ background: '#1d4ed8', padding: '4px 8px', borderRadius: 6 }}>Lives: {player.lives}</div>
          {player.hasAxe && (
            <div style={{ background: '#6b7280', padding: '4px 8px', borderRadius: 6 }}>Axe Owned</div>
          )}
          <div>{levels[currentLevel].name}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowMinimap(v => !v)}>Map</button>
          <button onClick={() => setGameState('paused')}>Pause</button>
          <button onClick={() => {
            // Place campfire if enough wood and cooldown elapsed
            const now = gameTime
            if (wood >= 3 && now - lastCampfireTimeRef.current > 60) {
              lastCampfireTimeRef.current = now
              setWood(w => w - 3)
              setCampfires(prev => [...prev, { x: player.x, y: player.y, life: 1800 }])
              ensureAudio(); playSound('portal')
            }
          }}>Campfire (3 wood)</button>
        </div>
      </div>

      <div style={{ position: 'relative' }}>
        <canvas ref={canvasRef} width={canvasSize.width} height={canvasSize.height} onMouseMove={handleMouseMove} onMouseDown={() => {
          const hasGun = gunPickups.some(g => g.collected)
          if (!hasGun) return
          ensureAudio(); playSound('shoot')
          const angle = Math.atan2(mousePos.y - VIRTUAL_HEIGHT/2, mousePos.x - VIRTUAL_WIDTH/2)
          const speed = 12
          const id = Math.floor(Math.random() * 1e9)
          setBullets(prev => [...prev, { id, x: player.x, y: player.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 90 }])
        }} style={{ display: 'block', margin: '0 auto', background: 'black', border: '2px solid #374151', cursor: 'crosshair' }} />

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
              <button onClick={() => setGameState('paused')} style={{ width: 48, height: 48, borderRadius: 9999 }}>II</button>
              <button onClick={() => setShowMinimap(v => !v)} style={{ width: 48, height: 48, borderRadius: 9999 }}>M</button>
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
              <div style={{ position: 'absolute', width: 8, height: 8, borderRadius: 9999, background: '#3b82f6', left: `${(player.x / WORLD_WIDTH) * 128 - 4}px`, top: `${(player.y / WORLD_HEIGHT) * 128 - 4}px` }} />
              <div style={{ position: 'absolute', width: 12, height: 12, borderRadius: 9999, background: '#a855f7', left: `${(WORLD_WIDTH / 2 / WORLD_WIDTH) * 128 - 6}px`, top: `${(WORLD_HEIGHT / 2 / WORLD_HEIGHT) * 128 - 6}px` }} />
              {stones.map(stone => !stone.collected && (
                <div key={stone.id} style={{ position: 'absolute', width: 8, height: 8, borderRadius: 9999, background: '#eab308', left: `${(stone.x / WORLD_WIDTH) * 128 - 4}px`, top: `${(stone.y / WORLD_HEIGHT) * 128 - 4}px` }} />
              ))}
              {enemies.map(enemy => (
                <div key={enemy.id} style={{ position: 'absolute', width: 8, height: 8, borderRadius: 9999, background: '#ef4444', left: `${(enemy.x / WORLD_WIDTH) * 128 - 4}px`, top: `${(enemy.y / WORLD_HEIGHT) * 128 - 4}px` }} />
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ textAlign: 'center', padding: 12, color: '#9ca3af', background: '#1f2937' }}>Use WASD to move • Shift to sprint • Mouse to look • Space to chop (axe) • Click to shoot (if gun) • Campfire button places distraction (costs 3 wood)</div>
    </div>
  )
}


