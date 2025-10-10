# Horror Islands

A survival horror game where you must collect stones and escape from terrifying enemies across multiple procedurally generated levels.

## Game Features

- **Multiple Environments**: Forest, Winter, Desert, and Island biomes
- **Enemy AI**: Different enemy types including chasers, wanderers, and bosses
- **Resource Management**: Collect stones, health pickups, axes, and guns
- **Campfire Mechanics**: Build campfires to distract enemies
- **Procedural Generation**: Infinite levels with randomized environments
- **Touch Controls**: Full mobile support with virtual joystick
- **Responsive Design**: Works on desktop, tablet, and mobile devices

## Controls

### Desktop
- **WASD**: Move
- **Shift**: Sprint (drains stamina)
- **Mouse**: Look around
- **Space**: Chop trees (with axe)
- **Click**: Shoot (with gun)
- **Escape**: Pause game

### Mobile/Touch
- **Virtual Joystick**: Move
- **Sprint Button**: Hold to sprint
- **Touch Screen**: Look and shoot
- **UI Buttons**: Pause, map, campfire

## Game Mechanics

1. **Objective**: Collect all stones in each level and reach the portal
2. **Enemies**: Avoid or defeat enemies that chase you
3. **Resources**: 
   - Stones: Required to complete levels
   - Health Pickups: Restore your health
   - Axe: Allows you to chop trees safely
   - Gun: Shoot enemies from a distance
4. **Campfires**: Use 3 wood to build campfires that distract enemies
5. **Stamina**: Sprinting drains stamina, rest to regenerate

## Deployment

This game is ready for deployment on itch.io:

1. Run `npm run build:itch` to create a deployment package
2. Upload the generated `horror-islands-itch.zip` to itch.io
3. The game will work in any modern web browser

## Technical Details

- Built with React and TypeScript
- Uses HTML5 Canvas for rendering
- Responsive design with CSS Flexbox
- Touch-friendly mobile controls
- Optimized for web deployment

## Browser Compatibility

- Chrome/Edge (recommended)
- Firefox
- Safari
- Mobile browsers (iOS Safari, Chrome Mobile)

Enjoy surviving the horror! 🎮👻