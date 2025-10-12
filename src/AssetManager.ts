// Asset Manager for loading and managing game sprites and sounds
export class AssetManager {
  private static instance: AssetManager
  private images: Map<string, HTMLImageElement> = new Map()
  private sounds: Map<string, HTMLAudioElement> = new Map()
  private loadPromises: Map<string, Promise<void>> = new Map()

  static getInstance(): AssetManager {
    if (!AssetManager.instance) {
      AssetManager.instance = new AssetManager()
    }
    return AssetManager.instance
  }

  // Load an image asset
  async loadImage(key: string, path: string): Promise<HTMLImageElement> {
    if (this.images.has(key)) {
      return this.images.get(key)!
    }

    if (this.loadPromises.has(key)) {
      await this.loadPromises.get(key)
      return this.images.get(key)!
    }

    const promise = new Promise<void>((resolve) => {
      const img = new Image()
      img.onload = () => {
        this.images.set(key, img)
        resolve()
      }
      img.onerror = () => {
        console.warn(`Failed to load image: ${path}`)
        
        // Special fallback for player animations - use idle player instead of red square
        if (key.includes('player-') && key !== 'player-idle') {
          const idleImg = this.images.get('player-idle')
          if (idleImg) {
            this.images.set(key, idleImg)
            resolve()
            return
          }
        }
        
        // Create a fallback colored rectangle for other assets
        const canvas = document.createElement('canvas')
        canvas.width = 32
        canvas.height = 32
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = key.includes('player') ? '#4ade80' : '#ef4444' // Green for player, red for others
        ctx.fillRect(0, 0, 32, 32)
        const fallbackImg = new Image()
        fallbackImg.src = canvas.toDataURL()
        this.images.set(key, fallbackImg)
        resolve()
      }
      img.src = path
    })

    this.loadPromises.set(key, promise)
    await promise
    return this.images.get(key)!
  }

  // Load a sound asset
  async loadSound(key: string, path: string): Promise<HTMLAudioElement> {
    if (this.sounds.has(key)) {
      return this.sounds.get(key)!
    }

    const audio = new Audio()
    audio.preload = 'auto'
    audio.src = path
    
    // Handle loading errors gracefully
    audio.onerror = () => {
      console.warn(`Failed to load sound: ${path}`)
    }

    this.sounds.set(key, audio)
    return audio
  }

  // Get loaded image
  getImage(key: string): HTMLImageElement | null {
    return this.images.get(key) || null
  }

  // Get loaded sound
  getSound(key: string): HTMLAudioElement | null {
    return this.sounds.get(key) || null
  }

  // Play sound with error handling
  playSound(key: string, volume: number = 1, loop: boolean = false): void {
    const sound = this.sounds.get(key)
    if (sound) {
      try {
        sound.volume = Math.max(0, Math.min(1, volume))
        sound.loop = loop
        sound.currentTime = 0
        const playPromise = sound.play()
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            // Silently handle play failures (autoplay restrictions, etc.)
          })
        }
      } catch (error) {
        // Silently handle any other errors
      }
    }
  }

  // Stop sound
  stopSound(key: string): void {
    const sound = this.sounds.get(key)
    if (sound) {
      try {
        sound.pause()
        sound.currentTime = 0
      } catch (error) {
        // Silently handle any other errors
      }
    }
  }

  // Check if sound is playing
  isSoundPlaying(key: string): boolean {
    const sound = this.sounds.get(key)
    return sound ? !sound.paused : false
  }
  // Load all game assets
  async loadAllAssets(): Promise<void> {
    const loadPromises: Promise<void>[] = []

    // Player assets
    loadPromises.push(this.loadImage('player-idle', 'assets/player/player.png').then(() => {}))
    loadPromises.push(this.loadImage('player-walk1', 'assets/player/player-walk1.png').then(() => {}))
    loadPromises.push(this.loadImage('player-walk2', 'assets/player/player-walk2.png').then(() => {}))
    loadPromises.push(this.loadImage('player-walk3', 'assets/player/player-walk3.png').then(() => {}))
    loadPromises.push(this.loadImage('player-walk4', 'assets/player/player-walk4.png').then(() => {}))
    loadPromises.push(this.loadImage('player-sprint1', 'assets/player/player-sprint1.png').then(() => {}))
    loadPromises.push(this.loadImage('player-sprint2', 'assets/player/player-sprint2.png').then(() => {}))
    loadPromises.push(this.loadImage('player-sprint3', 'assets/player/player-sprint3.png').then(() => {}))
    loadPromises.push(this.loadImage('player-sprint4', 'assets/player/player-sprint4.png').then(() => {}))
    loadPromises.push(this.loadImage('player-taking-damage', 'assets/player/player-taking-damage.png').then(() => {}))
    loadPromises.push(this.loadImage('player-outofstamina', 'assets/player/player-outofstamina.png').then(() => {}))

    // Enemy assets (fallback)
    loadPromises.push(this.loadImage('enemy-chasing1', 'assets/enemy/enemy-chasing1.png').then(() => {}))
    loadPromises.push(this.loadImage('enemy-chasing2', 'assets/enemy/enemy-chasing2.png').then(() => {}))

    // Level-specific monster assets (2 frames each)
    for (let level = 1; level <= 4; level++) {
      for (let frame = 1; frame <= 2; frame++) {
        loadPromises.push(this.loadImage(`monster${level}-${frame}`, `assets/monsters/level${level}/monster${level}-${frame}.png`).then(() => {}))
      }
    }

    // Background assets
    loadPromises.push(this.loadImage('ui-background', 'assets/background/ui-background.png').then(() => {}))

    // Sun and Moon assets
    loadPromises.push(this.loadImage('sun', 'assets/sun/sun.png').then(() => {}))
    loadPromises.push(this.loadImage('moon', 'assets/moon/moon.png').then(() => {}))

    // Effect assets
    loadPromises.push(this.loadImage('damage-effect', 'assets/effects/getting-damage.png').then(() => {}))
    loadPromises.push(this.loadImage('stone-pickup', 'assets/effects/stone-pickup.png').then(() => {}))
    loadPromises.push(this.loadImage('health-pickup', 'assets/effects/health-pickup.png').then(() => {}))

    // Portal assets
    loadPromises.push(this.loadImage('portal1', 'assets/portal/portal1.png').then(() => {}))
    loadPromises.push(this.loadImage('portal2', 'assets/portal/portal2.png').then(() => {}))
    loadPromises.push(this.loadImage('portal3', 'assets/portal/portal3.png').then(() => {}))
    loadPromises.push(this.loadImage('portal4', 'assets/portal/portal4.png').then(() => {}))

    // Sound assets
    loadPromises.push(this.loadSound('player-walk', './assets/sounds/player-walk.mp3').then(() => {}))
    loadPromises.push(this.loadSound('player-damage', './assets/sounds/player-damage.mp3').then(() => {}))
    loadPromises.push(this.loadSound('enemy-chase', './assets/sounds/enemy-chase.mp3').then(() => {}))
    loadPromises.push(this.loadSound('pickup-stone', './assets/sounds/pickup-stone.mp3').then(() => {}))
    loadPromises.push(this.loadSound('pickup-health', './assets/sounds/pickup-health.mp3').then(() => {}))
    loadPromises.push(this.loadSound('tree-chop', './assets/sounds/tree-chop.mp3').then(() => {}))
    loadPromises.push(this.loadSound('button-click', './assets/sounds/button-click.mp3').then(() => {}))
    loadPromises.push(this.loadSound('victory', './assets/sounds/victory.mp3').then(() => {}))

    await Promise.all(loadPromises)
  }
}
export class SpriteAnimation {
  private frames: string[]
  private currentFrame: number = 0
  private frameTime: number = 0
  private frameDuration: number

  constructor(frames: string[], fps: number = 8) {
    this.frames = frames
    this.frameDuration = 1000 / fps // Convert FPS to milliseconds
  }

  update(deltaTime: number): void {
    this.frameTime += deltaTime
    if (this.frameTime >= this.frameDuration) {
      this.frameTime = 0
      this.currentFrame = (this.currentFrame + 1) % this.frames.length
    }
  }

  getCurrentFrame(): string {
    return this.frames[this.currentFrame]
  }

  reset(): void {
    this.currentFrame = 0
    this.frameTime = 0
  }

  setFrame(index: number): void {
    this.currentFrame = Math.max(0, Math.min(index, this.frames.length - 1))
  }
}

// Animation states for different entities
export const PLAYER_ANIMATIONS = {
  IDLE: ['player-idle'],
  WALK: ['player-walk1', 'player-walk2', 'player-walk3', 'player-walk4'],
  SPRINT: ['player-sprint1', 'player-sprint2', 'player-sprint3', 'player-sprint4'],
  DAMAGE: ['player-taking-damage'],
  OUT_OF_STAMINA: ['player-outofstamina']
}

export const ENEMY_ANIMATIONS = {
  CHASE: ['enemy-chase1', 'enemy-chase2'],
  IDLE: ['enemy-chase1'] // Fallback to first chase frame
}

export const MONSTER_ANIMATIONS = {
  LEVEL1: ['monster1-1', 'monster1-2'],
  LEVEL2: ['monster2-1', 'monster2-2'],
  LEVEL3: ['monster3-1', 'monster3-2'],
  LEVEL4: ['monster4-1', 'monster4-2']
}

export const PORTAL_ANIMATIONS = {
  ACTIVE: ['portal1', 'portal2', 'portal3', 'portal4']
}
