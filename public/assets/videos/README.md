# 🎬 Video Assets

Place your game videos in this folder:

## Required Videos

### **intro.mp4**
- **Purpose**: Intro video for first-time players
- **Triggers**: When player clicks "PLAY" for the first time
- **Content**: Game explanation, story introduction, mechanics tutorial
- **Duration**: Recommended 30-90 seconds
- **Format**: MP4, H.264 codec recommended
- **Resolution**: 1920x1080 or 1280x720

### **outro.mp4** 
- **Purpose**: Victory video after completing all 4 levels
- **Triggers**: When player completes Level 4 (final level)
- **Content**: Congratulations, victory celebration, credits
- **Duration**: Recommended 30-60 seconds
- **Format**: MP4, H.264 codec recommended
- **Resolution**: 1920x1080 or 1280x720

## Video Features

### **Auto-play**: Videos start automatically
### **Controls**: Players can pause, seek, adjust volume
### **Skip button**: Top-right corner skip option
### **Auto-advance**: Videos automatically proceed to next screen when finished
### **Responsive**: Videos scale to fit any screen size

## File Structure
```
📁 public/assets/videos/
├── intro.mp4          # First-time player introduction
├── outro.mp4          # Victory celebration video
└── README.md          # This file
```

## Technical Notes
- Videos use `objectFit: 'contain'` to maintain aspect ratio
- Black background ensures clean presentation
- Skip buttons have blur backdrop for readability
- Videos are cached by browser for smooth playback
