# Piper Voice Models

## Required Files

To enable ultra-realistic text-to-speech, download the following voice model files:

### Recommended: Lessac (High Quality - US English Female)
- **Model**: `en_US-lessac-high.onnx`
- **Config**: `en_US-lessac-high.onnx.json`
- **Download from**: https://github.com/rhasspy/piper/releases/download/v1.2.0/voice-en-us-lessac-high.tar.gz

### Alternative: Amy (High Quality - UK English Female)
- **Model**: `en_GB-southern_english_female-low.onnx`
- **Config**: `en_GB-southern_english_female-low.onnx.json`
- **Download from**: https://github.com/rhasspy/piper/releases/download/v1.2.0/voice-en-gb-southern-english-female-low.tar.gz

### Alternative: Ryan (US English Male)
- **Model**: `en_US-ryan-high.onnx`
- **Config**: `en_US-ryan-high.onnx.json`
- **Download from**: https://github.com/rhasspy/piper/releases/download/v1.2.0/voice-en-us-ryan-high.tar.gz

## Installation Steps

1. Download the tar.gz file for your chosen voice
2. Extract the contents
3. Copy both the `.onnx` and `.onnx.json` files to this directory
4. The TTS system will automatically detect and use the first available voice model

## Current Installation

Run the following PowerShell commands to download and extract the Lessac voice:

```powershell
cd "c:\Users\rbartram\Documents\GitHub\TimerDisplay-Electron\resources\piper\voices"
Invoke-WebRequest -Uri "https://github.com/rhasspy/piper/releases/download/v1.2.0/voice-en-us-lessac-high.tar.gz" -OutFile "voice-en-us-lessac-high.tar.gz"
tar -xzf voice-en-us-lessac-high.tar.gz
Remove-Item "voice-en-us-lessac-high.tar.gz"
```

This will extract:
- `en_US-lessac-high.onnx` (voice model)
- `en_US-lessac-high.onnx.json` (configuration)
