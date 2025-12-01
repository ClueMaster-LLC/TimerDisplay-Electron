/**
 * Text-to-Speech Backend Service
 * Provides ultra-realistic offline TTS using Piper
 */

export class TTSBackend {
  constructor(ipcRenderer) {
    this.ipc = ipcRenderer;
    this.currentAudio = null;
    this.isPlaying = false;
  }

  /**
   * Synthesize speech from text and return audio file path
   * @param {string} text - Text to synthesize
   * @param {Object} options - TTS options
   * @returns {Promise<string>} Path to generated audio file
   */
  async synthesize(text, options = {}) {
    if (!text || text.trim().length === 0) {
      throw new Error("Text is required for TTS synthesis");
    }

    try {
      const audioPath = await this.ipc.invoke("tts:synthesize", {
        text: text.trim(),
        ...options,
      });
      return audioPath;
    } catch (error) {
      console.error("TTS Backend: Failed to synthesize speech:", error);
      throw error;
    }
  }

  /**
   * Play synthesized speech directly
   * @param {string} text - Text to speak
   * @param {Object} options - TTS and playback options
   * @returns {Promise<void>}
   */
  async speak(text, options = {}) {
    try {
      // Stop any currently playing audio
      this.stop();

      const audioPath = await this.synthesize(text, options);
      
      return new Promise((resolve, reject) => {
        this.currentAudio = new Audio(audioPath);
        this.isPlaying = true;

        this.currentAudio.onended = () => {
          this.isPlaying = false;
          this.currentAudio = null;
          resolve();
        };

        this.currentAudio.onerror = (error) => {
          this.isPlaying = false;
          this.currentAudio = null;
          console.error("TTS Backend: Audio playback error:", error);
          reject(error);
        };

        this.currentAudio.play().catch((error) => {
          this.isPlaying = false;
          this.currentAudio = null;
          reject(error);
        });
      });
    } catch (error) {
      console.error("TTS Backend: Failed to speak text:", error);
      throw error;
    }
  }

  /**
   * Stop current playback
   */
  stop() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
      this.isPlaying = false;
    }
  }

  /**
   * Pause current playback
   */
  pause() {
    if (this.currentAudio && this.isPlaying) {
      this.currentAudio.pause();
      this.isPlaying = false;
    }
  }

  /**
   * Resume paused playback
   */
  resume() {
    if (this.currentAudio && !this.isPlaying) {
      this.currentAudio.play().catch(console.error);
      this.isPlaying = true;
    }
  }

  /**
   * Check if TTS is currently speaking
   * @returns {boolean}
   */
  isSpeaking() {
    return this.isPlaying;
  }

  /**
   * Get available voices
   * @returns {Promise<Array>}
   */
  async getVoices() {
    try {
      return await this.ipc.invoke("tts:getVoices");
    } catch (error) {
      console.error("TTS Backend: Failed to get voices:", error);
      return [];
    }
  }

  /**
   * Clear TTS cache
   * @returns {Promise<void>}
   */
  async clearCache() {
    try {
      await this.ipc.invoke("tts:clearCache");
    } catch (error) {
      console.error("TTS Backend: Failed to clear cache:", error);
    }
  }
}

export default TTSBackend;
