# 🧪 Monster Testing Guide

## Quick Test Setup

To test if the monster system is working:

### 1. Create Simple Test Images
Create simple colored squares as test images:

**Level 1 (Forest) - Green Monsters:**
- `monster1-1.png` - 32x32 green square
- `monster1-2.png` - 32x32 dark green square  
- `monster1-3.png` - 32x32 light green square
- `monster1-4.png` - 32x32 forest green square

**Level 2 (Winter) - Blue Monsters:**
- `monster2-1.png` - 32x32 blue square
- `monster2-2.png` - 32x32 dark blue square
- `monster2-3.png` - 32x32 light blue square
- `monster2-4.png` - 32x32 ice blue square

### 2. Debug Console
Open browser console (F12) and look for these messages:
- `"Using level X monster sprites: [array]"` - Success!
- `"Level X monster sprites not found, using fallback"` - Images missing
- `"Missing enemy sprite: monsterX-Y for level Z"` - Specific frame missing

### 3. Visual Test
- **With sprites**: Monsters show as colored squares
- **Without sprites**: Monsters show as red/pink blobs (fallback)

### 4. File Paths
Make sure files are exactly in:
```
public/assets/monsters/level1/monster1-1.png
public/assets/monsters/level1/monster1-2.png
public/assets/monsters/level1/monster1-3.png
public/assets/monsters/level1/monster1-4.png
```

### 5. File Format
- **Format**: PNG with transparency
- **Size**: 32x32 or 64x64 pixels recommended
- **Naming**: Exact case-sensitive names required

## Troubleshooting

**Problem**: Monsters still show as blobs
**Solution**: Check browser console for error messages

**Problem**: Console shows "sprites not found"  
**Solution**: Verify file paths and names are exact

**Problem**: Some frames missing
**Solution**: Make sure all 4 frames exist for each level
