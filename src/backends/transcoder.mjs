/**
 * FFmpeg/FFprobe Integration & H.265/VP9/AV1 Transcoding
 * Cross-platform path resolution and video transcoding utilities
 */

import path from 'path';
import { spawn } from 'child_process';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { config } from '../config/environment.mjs';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Get platform-specific path to FFmpeg binary
 * @param {'ffmpeg'|'ffprobe'} binary - Which binary to get
 * @returns {string} Full path to binary
 */
export async function getFfmpegPath(binary) {
  if (config.isSnap) {
    // SNAP bundles FFmpeg in $SNAP/bin/
    return path.join(process.env.SNAP, 'bin', binary);
  }

  if (config.isWindows) {
    // Use the same logic as sync version - process.resourcesPath is available in main process
    const syncPath = getFfmpegPathSync(binary);
    return syncPath;
  }

  // Linux (non-snap): Use system FFmpeg
  return binary;
}

// Synchronous version that doesn't use dynamic import
let _cachedFfmpegDir = null;
function getFfmpegPathSync(binary) {
  if (config.isSnap) {
    return path.join(process.env.SNAP, 'bin', binary);
  }

  if (config.isWindows) {
    if (!_cachedFfmpegDir) {
      // In packaged app, process.resourcesPath points to the resources folder
      // In dev, resolve relative to this file's directory
      if (process.resourcesPath) {
        const packagedPath = path.join(process.resourcesPath, 'resources', 'ffmpeg-win');
        if (fs.existsSync(packagedPath)) {
          _cachedFfmpegDir = packagedPath;
        } else {
          // electron-builder may put it directly in resourcesPath
          const altPath = path.join(process.resourcesPath, 'ffmpeg-win');
          if (fs.existsSync(altPath)) {
            _cachedFfmpegDir = altPath;
          }
        }
      }
      // Dev fallback: resolve from this file's location
      if (!_cachedFfmpegDir) {
        _cachedFfmpegDir = path.join(__dirname, '..', '..', 'resources', 'ffmpeg-win');
      }
    }
    const exeName = `${binary}.exe`;
    const fullPath = path.join(_cachedFfmpegDir, exeName);
    if (fs.existsSync(fullPath)) return fullPath;
    // Last resort: hope it's on PATH
    return exeName;
  }

  // Linux (non-snap): Use system FFmpeg
  return binary;
}

/**
 * Get video metadata using ffprobe
 * @param {string} videoPath - Path to video file
 * @returns {Promise<Object>} Video info (codec, fps, width, height, bitrate)
 */
export async function getVideoInfo(videoPath) {
  const ffprobePath = getFfmpegPathSync('ffprobe');

  return new Promise((resolve, reject) => {
    const args = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_streams',
      '-select_streams', 'v:0',
      videoPath
    ];

    const proc = spawn(ffprobePath, args);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => stdout += data);
    proc.stderr.on('data', (data) => stderr += data);

    proc.on('close', (code) => {
      if (code !== 0) {
        const filename = path.basename(videoPath);
        // If ffprobe fails, return partial info with error
        resolve({
          error: `ffprobe exit code ${code}: ${stderr.trim()}`,
          filename: filename,
        });
        return;
      }

      try {
        const data = JSON.parse(stdout);
        const stream = data.streams?.[0];

        if (!stream) {
          reject(new Error('No video stream found'));
          return;
        }

        // Parse frame rate from avg_frame_rate first, fallback to r_frame_rate
        let fps = 0;
        const frameRate = stream.avg_frame_rate || stream.r_frame_rate;
        if (frameRate) {
          if (frameRate.includes('/')) {
            const [num, den] = frameRate.split('/').map(Number);
            if (den > 0 && num > 0) {
              fps = Math.round((num / den) * 100) / 100;
            }
          } else {
            fps = parseFloat(frameRate);
          }
          // Sanity check: cap FPS at reasonable values (1-240)
          if (fps && (fps < 1 || fps > 240)) {
            // Try r_frame_rate as fallback if avg_frame_rate gives weird value
            const altFrameRate = stream.r_frame_rate;
            if (altFrameRate && altFrameRate !== frameRate) {
              if (altFrameRate.includes('/')) {
                const [num2, den2] = altFrameRate.split('/').map(Number);
                if (den2 > 0 && num2 > 0) fps = Math.round((num2 / den2) * 100) / 100;
              } else {
                fps = parseFloat(altFrameRate);
              }
            }
          }
        }

        // Friendly codec display names
        const codec = stream.codec_name;
        const codecDisplay = {
          'h264': 'H.264/AVC',
          'avc1': 'H.264/AVC',
          'hevc': 'H.265/HEVC',
          'h265': 'H.265/HEVC',
          'hvc1': 'H.265/HEVC',
          'av1': 'AV1',
          'av01': 'AV1',
          'vp9': 'VP9',
          'vp09': 'VP9',
          'vp8': 'VP8',
          'mpeg4': 'MPEG-4',
          'mpeg2video': 'MPEG-2',
        };

        const filename = path.basename(videoPath);

        resolve({
          codec: codecDisplay[codec] || codec?.toUpperCase() || 'Unknown',
          codecRaw: codec,
          fps: fps,
          width: stream.width || null,
          height: stream.height || null,
          bitrate: stream.bit_rate ? Math.round(parseInt(stream.bit_rate) / 1000) : null,
          duration: stream.duration ? parseFloat(stream.duration) : null,
          filename: filename,
        });
      } catch (e) {
        reject(new Error(`Failed to parse ffprobe output: ${e.message}`));
      }
    });

    proc.on('error', (err) => {
      const filename = path.basename(videoPath);
      if (err.code === 'ENOENT') {
        // ffprobe not installed - expected on Windows dev without FFmpeg
        if (!getVideoInfo._warnedNoFfprobe) {
          getVideoInfo._warnedNoFfprobe = true;
          console.log('Transcoder: ffprobe not found. Install FFmpeg to see video codec info in debug overlay.');
          if (config.isWindows) {
            console.log('  Windows: Download from https://www.gyan.dev/ffmpeg/builds/ and add to PATH');
          }
        }
        resolve({
          error: 'ffprobe not installed',
          filename: filename,
        });
      } else {
        resolve({
          error: `Failed to spawn ffprobe: ${err.message}`,
          filename: filename,
        });
      }
    });
  });
}

/**
 * Check if video is H.265/HEVC
 */
export async function isH265Video(videoPath) {
  try {
    const info = await getVideoInfo(videoPath);
    return info.codec === 'hevc' || info.codec === 'h265';
  } catch {
    return false;
  }
}

/**
 * Codecs that may need transcoding to H.264 for compatibility
 */
const TRANSCODE_CODECS = ['hevc', 'h265', 'hvc1', 'vp9', 'vp09', 'av1', 'av01'];

/**
 * Check if a video needs transcoding
 * @param {string} videoPath - Path to video file
 * @returns {Promise<{needsTranscode: boolean, originalCodec: string}>}
 */
export async function needsTranscoding(videoPath) {
  try {
    const info = await getVideoInfo(videoPath);
    const codec = (info.codecRaw || '').toLowerCase();
    const needsTranscode = TRANSCODE_CODECS.includes(codec);
    const originalCodec = codec === 'hevc' || codec === 'h265' || codec === 'hvc1' ? 'HEVC'
      : codec === 'vp9' || codec === 'vp09' ? 'VP9'
      : codec === 'av1' || codec === 'av01' ? 'AV1'
      : codec.toUpperCase();
    return { needsTranscode, originalCodec, info };
  } catch {
    return { needsTranscode: false, originalCodec: 'unknown', info: null };
  }
}

/**
 * Transcode H.265/VP9/AV1 video to H.264 for compatibility
 * @param {string} inputPath - Path to video file
 * @param {string} outputPath - Path for H.264 output
 * @param {Function} onProgress - Progress callback (0-100)
 * @param {string} sourceCodec - Original codec name for logging
 * @returns {Promise<boolean>} - True if successful
 */
export async function transcodeToH264(inputPath, outputPath, onProgress, sourceCodec = 'unknown') {
  const ffmpegPath = getFfmpegPathSync('ffmpeg');

  console.log(`Transcoder: ${sourceCodec} → H.264: ${path.basename(inputPath)}`);

  return new Promise((resolve, reject) => {
    const args = [
      '-i', inputPath,
      '-c:v', 'libx264',
      '-crf', '20',           // Quality (lower = better, 18-23 typical)
      '-preset', 'fast',       // Speed/quality tradeoff
      '-pix_fmt', 'yuv420p',   // Convert 10-bit to 8-bit for max compatibility
      '-c:a', 'aac',           // Audio codec
      '-b:a', '192k',          // Audio bitrate
      '-movflags', '+faststart', // Web optimization
      '-y',                    // Overwrite output
      outputPath
    ];

    const proc = spawn(ffmpegPath, args);

    proc.stderr.on('data', (data) => {
      const line = data.toString();

      // Parse progress from FFmpeg output
      const timeMatch = line.match(/time=(\d+):(\d+):(\d+)/);
      if (timeMatch && onProgress) {
        const seconds = parseInt(timeMatch[1]) * 3600 +
                       parseInt(timeMatch[2]) * 60 +
                       parseInt(timeMatch[3]);
        const progress = Math.min(100, Math.round(seconds / 36));
        onProgress(progress);
      }
    });

    proc.on('close', (code) => {
      if (code === 0) {
        console.log(`Transcoder: Completed: ${path.basename(outputPath)}`);
        resolve(true);
      } else {
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn ffmpeg: ${err.message}`));
    });
  });
}

/**
 * Get transcoded filename for a video file
 * @param {string} originalFileName - Original filename (e.g., "video.mp4")
 * @returns {string} - Transcoded filename (e.g., "video_h264.mp4")
 */
export function getTranscodedFileName(originalFileName) {
  const ext = path.extname(originalFileName);
  const name = path.basename(originalFileName, ext);
  return `${name}_h264.mp4`;
}

/**
 * Transcode a media file if needed, replacing the original
 * @param {string} filePath - Path to the video file
 * @param {Object} options - Options
 * @param {boolean} options.hevcSupported - Whether browser supports HEVC natively
 * @param {boolean} options.vp9Supported - Whether VP9 playback is smooth (hardware or software)
 * @param {boolean} options.av1Supported - Whether AV1 playback is smooth (hardware or software)
 * @param {Function} options.onProgress - Progress callback
 * @returns {Promise<string>} Path to the (possibly transcoded) file
 */
export async function transcodeIfNeeded(filePath, options = {}) {
  const { hevcSupported = false, vp9Supported = true, av1Supported = true, onProgress } = options;

  const check = await needsTranscoding(filePath);
  if (!check.needsTranscode) return filePath;

  // HEVC: skip if browser/platform supports it natively
  if (check.originalCodec === 'HEVC' && hevcSupported) return filePath;

  // VP9: Chromium has built-in software decode (libvpx) on all platforms.
  // Only transcode if smooth playback is not possible.
  if (check.originalCodec === 'VP9' && vp9Supported) return filePath;

  // AV1: Chromium has built-in software decode (dav1d) on all platforms.
  // Only transcode if smooth playback is not possible.
  if (check.originalCodec === 'AV1' && av1Supported) return filePath;

  console.log(`Transcoder: ${check.originalCodec} → H.264: ${path.basename(filePath)}`);

  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const name = path.basename(filePath, ext);
  const tempPath = path.join(dir, `${name}_h264${ext}`);

  try {
    await transcodeToH264(filePath, tempPath, onProgress, check.originalCodec);

    // Replace original with transcoded version
    fs.unlinkSync(filePath);
    fs.renameSync(tempPath, filePath);

    console.log(`Transcoder: Complete: ${path.basename(filePath)}`);
    return filePath;
  } catch (error) {
    console.error(`Transcoder: Failed: ${error.message}`);
    // Clean up temp file if it exists
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    throw error;
  }
}
