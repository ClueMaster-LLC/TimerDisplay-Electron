# Ultra-Realistic AI Text-to-Speech (TTS) Integration

## Overview

This application now features an offline, ultra-realistic AI voice text-to-speech system using **Piper**, a high-quality neural TTS engine. When text clues are displayed on screen, they are automatically spoken aloud using natural-sounding voices.

## Features

- ✅ **Offline Operation**: Runs completely locally with no internet required
- ✅ **Ultra-Realistic Voices**: Uses neural network-based voice synthesis
- ✅ **Automatic Speech**: Text clues are automatically spoken when displayed
- ✅ **Smart Caching**: Synthesized audio is cached to improve performance
- ✅ **Low Latency**: Fast speech generation with optimized processing
- ✅ **Professional Quality**: Studio-quality audio output

## How It Works

### 1. Voice Model
The system uses the **Lessac** voice model, which provides:
- **Language**: US English (en_US)
- **Quality**: High-quality neural voice
- **Gender**: Female voice
- **Size**: ~109 MB model
- **Provider**: Rhasspy Piper

### 2. TTS Pipeline

1. **Text Input**: When a text clue appears in `clue-player.jsx`
2. **Alert Sound**: Plays the clue alert notification (1 second delay)
3. **Synthesis**: Text is sent to Piper for speech synthesis
4. **Caching**: Generated audio is cached with MD5 hash of text
5. **Playback**: Audio plays automatically through the clue player
6. **Cleanup**: Audio stops when clue is dismissed

### 3. Caching System

- **Location**: `%USERPROFILE%\cluemaster-timer\application-data\tts-cache\`
- **Format**: WAV audio files
- **Naming**: MD5 hash of text content
- **Benefits**: 
  - Instant playback for repeated messages
  - Reduced CPU usage
  - No regeneration needed

## Architecture

### Backend Components

#### 1. **TTS Service** (`src/backends/tts.mjs`)
- JavaScript class providing TTS API
- Methods: `synthesize()`, `speak()`, `stop()`, `pause()`, `resume()`
- Manages audio playback lifecycle

#### 2. **Main Process Handlers** (`electron/main.mjs`)
- IPC handlers for TTS operations:
  - `tts:synthesize` - Generate speech audio
  - `tts:getVoices` - List available voice models
  - `tts:clearCache` - Clear cached audio files
- Piper CLI integration
- Cache management
- Voice model detection

#### 3. **Preload Bridge** (`electron/preload.cjs`)
- Exposes `TTSBackend` to renderer process
- Secure IPC communication bridge

### Frontend Integration

#### **Clue Player** (`src/controllers/clue-player.jsx`)
- Automatic TTS triggering for text clues
- Audio lifecycle management
- Cleanup on clue dismiss
- Error handling and logging

## Voice Models

### Current: Lessac (High Quality)
- **File**: `en_US-lessac-high.onnx`
- **Config**: `en_US-lessac-high.onnx.json`
- **Size**: 108.6 MB
- **Quality**: Excellent clarity and naturalness

### Alternative Voices

You can download additional voices from [Piper Voices Repository](https://huggingface.co/rhasspy/piper-voices/tree/v1.0.0):

#### US English Male (Ryan)
```powershell
cd "resources\piper\voices"
Invoke-WebRequest -Uri "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/ryan/high/en_US-ryan-high.onnx" -OutFile "en_US-ryan-high.onnx"
Invoke-WebRequest -Uri "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/ryan/high/en_US-ryan-high.onnx.json" -OutFile "en_US-ryan-high.onnx.json"
```

#### UK English Female (Amy)
```powershell
cd "resources\piper\voices"
Invoke-WebRequest -Uri "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_GB/southern_english_female/low/en_GB-southern_english_female-low.onnx" -OutFile "en_GB-southern_english_female-low.onnx"
Invoke-WebRequest -Uri "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_GB/southern_english_female/low/en_GB-southern_english_female-low.onnx.json" -OutFile "en_GB-southern_english_female-low.onnx.json"
```

The system automatically uses the first `.onnx` file it finds in the voices directory.

## Usage

### Automatic Mode (Default)
Text clues are automatically spoken when displayed. No user action required.

### Manual Control (via DevTools)
```javascript
// Synthesize speech and get audio file path
const audioPath = await window.TTSBackend.synthesize({ 
  text: "Welcome to the escape room!" 
});

// List available voices
const voices = await window.TTSBackend.getVoices();
console.log(voices);

// Clear TTS cache
await window.TTSBackend.clearCache();
```

## Performance

- **First Generation**: 1-3 seconds (depending on text length)
- **Cached Playback**: Instant (<100ms)
- **CPU Usage**: Minimal (synthesis runs once per unique text)
- **Memory**: ~200MB for model + synthesis buffer
- **Disk Space**: ~5-10 MB per 100 cached messages

## Troubleshooting

### No Voice Output

1. **Check voice model exists**:
   ```powershell
   Test-Path "resources\piper\voices\en_US-lessac-high.onnx"
   ```

2. **Check Piper executable**:
   ```powershell
   Test-Path "resources\piper\piper\piper.exe"
   ```

3. **View logs**: Open DevTools (F12) and check console for TTS errors

### Voice Not Working in Production

Ensure voice files are included in the build:
- Check `resources/piper/voices/` directory in installation
- Verify `piper.exe` is in `resources/piper/piper/`

### Clear Cache Issues

Manually delete cache:
```powershell
Remove-Item "$env:USERPROFILE\cluemaster-timer\application-data\tts-cache\*.wav"
```

## Technical Details

### Piper TTS Engine
- **Technology**: Neural text-to-speech
- **Architecture**: ONNX Runtime inference
- **Training**: Multi-speaker datasets
- **Quality**: Comparable to cloud TTS services
- **Speed**: Real-time synthesis on modern hardware

### Audio Specifications
- **Format**: WAV (PCM)
- **Sample Rate**: 22050 Hz
- **Bit Depth**: 16-bit
- **Channels**: Mono
- **Codec**: Uncompressed

### Security
- All TTS processing happens locally
- No external network calls
- Cache files stored in user's application data directory
- Sandboxed file access via custom `media://` protocol

## Future Enhancements

Potential improvements for future versions:
- [ ] Voice selection UI in settings
- [ ] Speech rate control
- [ ] Volume adjustment
- [ ] Voice pitch control
- [ ] Multi-language support
- [ ] SSML markup support for prosody
- [ ] Background TTS for faster clue delivery

## Credits

- **Piper TTS**: [rhasspy/piper](https://github.com/rhasspy/piper)
- **Voice Models**: [Rhasspy Piper Voices](https://huggingface.co/rhasspy/piper-voices)
- **Lessac Voice**: Quality female US English voice model

## License

The TTS integration uses Piper, which is licensed under MIT License. Voice models have their own licenses - check the Piper voices repository for details.
