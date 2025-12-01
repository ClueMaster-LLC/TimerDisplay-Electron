/**
 * TTS Configuration
 * 
 * This file documents the TTS system configuration.
 * To customize TTS behavior, modify the relevant parts of:
 * - src/controllers/clue-player.jsx (frontend behavior)
 * - electron/main.mjs (backend synthesis)
 */

export const TTS_CONFIG = {
  /**
   * Delay before speaking text clue after alert sound (milliseconds)
   * Default: 1000ms (1 second)
   */
  SPEECH_DELAY: 1000,

  /**
   * Voice model directory
   * Relative to application resources
   */
  VOICE_MODEL_DIR: "../resources/piper/voices",

  /**
   * Piper executable path
   * Relative to application resources
   */
  PIPER_EXE_PATH: "../resources/piper/piper/piper.exe",

  /**
   * Cache directory name
   * Created in application data directory
   */
  CACHE_DIR_NAME: "tts-cache",

  /**
   * Audio format settings
   */
  AUDIO_FORMAT: {
    format: "wav",
    sampleRate: 22050,
    bitDepth: 16,
    channels: 1, // mono
  },

  /**
   * Synthesis options
   */
  SYNTHESIS_OPTIONS: {
    // Speaking rate (0.5 - 2.0, default: 1.0)
    // Lower = slower, Higher = faster
    // Note: Currently not implemented, but can be added via Piper CLI flags
    speakingRate: 1.0,

    // Voice volume (0.0 - 1.0, default: 1.0)
    volume: 1.0,

    // Noise scale for variability (0.0 - 1.0, default: 0.667)
    // Higher = more expressive/variable
    noiseScale: 0.667,

    // Length scale for duration (>0, default: 1.0)
    // Higher = slower speech
    lengthScale: 1.0,
  },

  /**
   * Performance settings
   */
  PERFORMANCE: {
    // Maximum buffer size for Piper process (bytes)
    maxBufferSize: 10 * 1024 * 1024, // 10MB

    // Enable caching
    enableCache: true,

    // Cache expiration (milliseconds)
    // Set to 0 to never expire cached audio
    cacheExpiration: 0,
  },

  /**
   * Feature flags
   */
  FEATURES: {
    // Automatically speak text clues when displayed
    autoSpeak: true,

    // Play alert sound before speaking
    playAlertBeforeSpeech: true,

    // Log TTS events to console
    enableLogging: true,
  },
};

export default TTS_CONFIG;
