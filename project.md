# Horror Islands – Project Documentation

## Story & Theme
You awaken on the Horror Islands, a cluster of cursed biomes that feed on fear. The ancient magic keeping the islands alive demands tribute: **"Sacrifices Must be Made."** Each zone is patrolled by relentless monsters and a dragon overlord. The only escape is to gather the scattered soul stones, survive the hunt, and reach the portal before the curse consumes you. Every decision—especially at the Sacrifice Altar—tests how much you are willing to give up for freedom.

## Core Objective
- Explore each island level, collect **all stones**, and enter the **portal** to advance.
- Survive waves of monsters and the roaming dragon boss unique to every level.
- Manage stamina, resources, and sacrifices to stay alive.

## Game Flow
1. **Spawn** with basic movement and melee capability.
2. **Scout the minimap** to locate stones, weapons, health, and other resources.
3. **Collect tools and power-ups** (axes, guns, ammo, speed boosts, etc.).
4. **Make strategic sacrifices** at the altar when necessary.
5. **Gather all stones** to activate the portal.
6. **Reach the portal** while evading or defeating enemies.
7. **Repeat** across four themed islands, each tougher than the last.

## Controls
### Desktop
- **W / A / S / D** – Move
- **Shift** – Sprint (drains stamina)
- **Mouse** – Aim / look
- **Space** – Chop trees (requires axe)
- **Left Click** – Shoot (requires gun + ammo)
- **E** – Interact (sacrifice altar, prompts)
- **M** – Toggle minimap
- **Escape** – Pause menu

### Mobile (Touch)
- **Virtual Joystick** – Movement
- **Sprint Button** – Hold to sprint
- **Tap / Drag Screen** – Aim and shoot
- **UI Buttons** – Pause, minimap, campfire placement, interaction

## HUD & Minimap Legend
- **Yellow dot** – Stones (`stone.id`)
- **Red dot** – Enemies (`enemy.id`)
- **Purple dot** – Portal (center of map)
- **Gray dot** – Axe pickups
- **Brown dot** – Gun pickups
- **Gold dot** – Ammo boxes
- **Green dot** – Health pickups
- **Cyan dot** – Speed boosts
- **Blue dot** – Lake (unused)
- **Green dot** – Lake (used)
- **🔥 icon** – Sacrifice Altar
- **“P” marker** – Player position

## Collectibles & Power-Ups
- **💎 Stones** – Mandatory objective item. Collect all to activate portal.
- **❤️ Health Pickups** – Restores 1 life (max 3 lives).
- **🪓 Axe** – Enables safe tree chopping for wood; trees deal damage without it.
- **🪵 Wood** – Gathered from trees (with axe). Spend 3 wood to place a campfire.
- **🔫 Gun** – Grants ranged attack with 30 bullets. Essential for bosses.
- **📦 Ammo Box** – Refills 30 bullets.
- **⚡ Speed Boost** – +50% movement speed for 7 seconds.
- **💧 Lake (Circular)** – Grants 30 seconds of invisibility on first touch (turns green). Second touch inflicts damage unless invisible.
- **🔥 Sacrifice Altar** – Central theme mechanic; see below.

## Sacrifice Altar – "Sacrifices Must be Made"
- **Location**: One altar per level, marked with 🔥 on the minimap.
- **Interaction**: Walk near and press **E** (desktop) or tap the altar (mobile).
- **Usage**: One-time use per level; choose carefully.
- **Sacrifice Options**:
  1. **❤️ Sacrifice 1 Life** → Gain Speed Boost + Invisibility for 10 seconds.
  2. **🔫 Sacrifice All Ammo** → Super Speed Boost for 30 seconds.
  3. **💎 Sacrifice 1 Life for Victory** → Instant teleport to portal (requires all stones).
  4. **⚡ Sacrifice All Stamina** → Restore to full lives (3).
  5. **💨 Sacrifice Speed Boost** → Kill all non-boss enemies instantly.
  6. **💎 Sacrifice Stamina & Invisibility** → Instantly collect remaining stones.
- **HUD Counter**: Tracks total sacrifices made across the run.
- **Victory Screen**: Displays sacrifices made, stones collected, lives, and ammo.

## Campfire Mechanic
- **Crafting**: Spend 3 wood (chopped from trees) to build a campfire.
- **Effect**: Distracts nearby enemies and dragons for 10 seconds.
- **Use Case**: Create breathing room to heal, reload, or finish objectives.

## Day / Night Cycle
- **Day Levels** (Forest, Desert):
  - Standard enemy speed.
  - At least 5 enemies on map.
- **Night Levels** (Winter, Island):
  - Enemies move **30% faster**.
  - Minimum of 8 enemies with aggressive spawn behavior.

## Enemy Types
- **👹 Chasers** – Red monsters that relentlessly pursue the player.
- **👻 Ghosts (Wanderers)** – Semi-transparent spirits moving unpredictably.
- **🐉 Boss Dragons** – One per level; large, fast, high health. Unique per biome:
  - Haunted Forest → **Red Dragon** (aggressive melee).
  - Frozen Wasteland → **Ice Dragon** (frost damage theme).
  - Desert of Souls → **Sand Dragon** (extremely fast).
  - Cursed Island → **Green Dragon** (poison / venom themed).
  - Marked larger on minimap for early detection.

## Stamina & Movement
- **Sprint** drains stamina continuously.
- **Low stamina** slows movement and changes footstep tempo.
- **Zero stamina** for 6 seconds while moving → lose 1 life.
- **Recover** by standing still or moving slowly.

## Audio & Atmosphere
- Dynamic footstep sounds tuned to movement state.
- Ambient background music (loops after user interaction).
- Contextual SFX for pickups, damage, trees, and victory.

## Tips & Best Practices
- **Use minimap** to plan routes and avoid ambushes.
- **Secure axes early** to navigate forests without damage.
- **Save bullets** for boss encounters; refill before fights.
- **Campfires** are critical for crowd control.
- **Manage stamina**; do not stay at zero stamina while moving.
- **Avoid night-time rushing** without power-ups—enemies are faster.
- **Stay off island water** (purple) on Cursed Island—instant death.
- **Teleportation sacrifice** can save a run if surrounded late.
- **Boss fight prep**: lay campfires, ensure ammo, sacrifice wisely.

## Level Progression & Unlocks
1. **Haunted Forest** – Intro level; teaches basics; Red Dragon boss.
2. **Frozen Wasteland** – Night level; Ice Dragon; introduces slippery terrain visuals.
3. **Desert of Souls** – Day level; Sand Dragon; fewer trees but open areas.
4. **Cursed Island** – Night level; Green Dragon; poisonous shoreline water.

## User Interface Highlights
- **Manual Icon** `ManualIcon` near portal toggles the game manual overlay.
- **HUD** shows stones count, stamina %, lives, sacrifices, active buffs, ammo.
- **Pause Menu** accessible via Escape / UI button.
- **Victory Screen** summarises performance with the theme quote displayed.

## Technical Overview
- Built with **React + TypeScript** and rendered on HTML `<canvas>`.
- Asset management via `AssetManager` singleton (`src/AssetManager.ts`).
- Main gameplay loop in `Game.tsx` with hooks managing state, audio, and rendering.
- Bundled with **Vite** (base path set to `./` for platforms like itch.io).

## How to Play Summary
1. Launch the game and read the manual near the start portal.
2. Explore the island using minimap guidance.
3. Prioritize grabbing an axe, then gun and ammo.
4. Use campfires and lake invisibility to control engagements.
5. Collect every stone; sacrifices can compensate for missing resources.
6. Enter the portal to finish the level; prepare for tougher challenges ahead.

## Credits & Acknowledgements
- **Design & Programming**: Your team (customize as needed).
- **Art & Audio**: Assets in `public/assets/` and `dist/assets/` folders.
- **Engine & Tools**: React, TypeScript, Vite.
- **Theme Inspiration**: Daydream Global Game Jam – “Sacrifices Must be Made.”

---
**Remember**: Every run asks, “What will you sacrifice to survive?”
