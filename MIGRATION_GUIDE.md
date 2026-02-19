# Migration Guide: Linux/SNAP Support & All Improvements

**Source Project:** VideoPlayer-Electron  
**Date:** February 18, 2026  
**Version:** 2026.2.1

This document contains ALL changes since implementing Linux/SNAP/Ubuntu Core support. Use this guide to port these features to similar Electron projects.

---

## AI Agent Instructions

> **IMPORTANT: Read this entire section before starting any implementation.**

You are implementing features from the ClueMaster VideoPlayer-Electron project into this Electron application. This migration guide contains 15 sections of code changes, improvements, and bug fixes that must be ported to this project.

### Your Mission

Implement ALL sections in this guide into this project. The target project is similar to the source (both are Electron apps with React, worker threads, and API integration) but has different features (timer display with on-demand media instead of looping video player).

### Implementation Process

**Phase 1: Analysis (Do First)**
1. Read this ENTIRE migration guide from start to finish before making any changes
2. Explore this project's existing file structure using `list_dir` and `read_file`
3. Identify the equivalent files in this project for each section (e.g., find where environment config lives, where the main process is, where workers are defined)
4. Create a mapping of source files → target files for each section
5. Note any sections that may not apply (e.g., Legacy Config Migration only applies if upgrading from a Python app)

**Phase 2: Implementation (Section by Section)**
For each section (1 through 15):
1. Read the section completely
2. Find the equivalent location in this project
3. Adapt the code to fit this project's existing patterns and naming conventions
4. Implement the changes
5. Verify no syntax errors using `node --check` for .mjs/.cjs files
6. Mark the section complete before moving to the next

**Phase 3: Verification (Do Last)**
1. Run `npm run build:dev` to verify the build succeeds
2. Check for any remaining errors using `get_errors`
3. Summarize what was implemented and any sections that were skipped (with reasons)

### Critical Rules

1. **DO NOT skip sections** without explicit user approval - every section contains important cross-platform compatibility code
2. **ADAPT, don't copy blindly** - file paths, import statements, and variable names may differ in this project
3. **PRESERVE existing functionality** - add new code alongside existing features, don't replace working code
4. **FOLLOW this project's conventions** - match existing code style, naming patterns, and file organization
5. **ASK if uncertain** - if a section's applicability is unclear, ask the user before skipping

### Section Applicability Notes

| Section | Always Apply | Conditional |
|---------|--------------|-------------|
| 1. Platform Detection | ✅ Required | - |
| 2. Directory Structure | ✅ Required | - |
| 3. Legacy Migration | - | Only if upgrading from Python app |
| 4. Media Protocol | ✅ Required | Adapt paths to this project's media structure |
| 5. FFmpeg/FFprobe | ✅ Required | - |
| 6. H.265/VP9 Transcoding | ✅ Required | - |
| 7. Video Optimizations | ✅ Required | Adapt to this project's video components |
| 8. Debug Overlay | ✅ Required | Adapt to this project's UI |
| 9. Audio Config (Linux) | ✅ Required | - |
| 10. Chromium Flags | ✅ Required | - |
| 11. Screenshot Capture | ✅ Required | - |
| 12. Auto-Updater | ✅ Required | - |
| 13. Snapcraft.yaml | ✅ Required | - |
| 14. Wrapper Script | ✅ Required | - |
| 15. Bug Fixes | ✅ Required | - |

### Expected Deliverables

When complete, provide:
1. List of all files created or modified
2. Summary of each section's implementation
3. Any sections skipped and why
4. Build verification results
5. Any follow-up items or manual steps required

---

## Table of Contents

1. [Overview](#overview)
2. [Platform Detection & Environment Config](#1-platform-detection--environment-config)
3. [Directory Structure (Cross-Platform)](#2-directory-structure-cross-platform)
4. [Legacy Config Migration (SNAP)](#3-legacy-config-migration-snap)
5. [Media Protocol Handler](#4-media-protocol-handler)
6. [FFmpeg/FFprobe Integration](#5-ffmpegffprobe-integration)
7. [H.265/VP9/AV1 Transcoding](#6-h265vp9av1-transcoding)
8. [Video Player Optimizations](#7-video-player-optimizations)
9. [Debug Overlay](#8-debug-overlay)
10. [Audio Configuration (Linux) - dmix](#9-audio-configuration-linux---dmix-for-concurrent-audio-streams)
11. [Chromium Hardware Acceleration Flags](#10-chromium-hardware-acceleration-flags)
12. [Screenshot Capture Feature](#11-screenshot-capture-feature)
13. [Auto-Updater (Windows Only)](#12-auto-updater-windows-only)
14. [Snapcraft.yaml Reference](#13-snapcraftyaml-reference)
15. [Wrapper Script (Linux)](#14-wrapper-script-linux)
16. [Bug Fixes](#15-bug-fixes)
17. [Video Interrupt & Restore (Stack-Based)](#16-video-interrupt--restore-stack-based)

---

## Overview

### What Changed

| Category | Description |
|----------|-------------|
| **Platform Support** | Full Linux/SNAP/Ubuntu Core support alongside Windows |
| **Environment Config** | Unified config with platform detection |
| **Directory Structure** | Platform-aware paths for data storage |
| **Legacy Migration** | Auto-migrate from Python app config (SNAP upgrade) |
| **Media Protocol** | Cross-platform `media://` handler |
| **FFmpeg/FFprobe** | Platform-specific bundling and paths |
| **H.265/VP9/AV1 Transcoding** | Fallback when hardware decode unavailable (includes VP9 on Windows if software-only) |
| **Video Optimizations** | Double-buffering, GPU layers, hardware decode |
| **Debug Overlay** | Real-time FPS, codec, decode status |
| **Audio (Linux)** | ALSA + dmix + apulse for concurrent audio streams |
| **Hardware Acceleration** | VA-API flags for Intel GPUs |
| **Interrupt/Restore** | Stack-based video position save/restore for overlays |
| **Screenshot Capture** | Remote capture via API |

---

## 1. Platform Detection & Environment Config

**File:** `src/config/environment.mjs`

Add comprehensive platform detection and path configuration:

```javascript
// Platform and environment detection
const isSnap = typeof process !== 'undefined' && process.env?.SNAP !== undefined;
const isLinux = typeof process !== 'undefined' && process.platform === 'linux';
const isWindows = typeof process !== 'undefined' && process.platform === 'win32';
const isUbuntuCore = isLinux && isSnap;

// SNAP environment paths
const snapUserData = typeof process !== 'undefined' ? process.env?.SNAP_USER_DATA : undefined;
const snapUserCommon = typeof process !== 'undefined' ? process.env?.SNAP_USER_COMMON : undefined;

// Home directory (cross-platform)
const homeDirectory = typeof process !== 'undefined' && typeof require !== 'undefined' 
  ? require('os').homedir() 
  : (typeof process !== 'undefined' ? process.env?.HOME || process.env?.USERPROFILE : undefined);

// Path utilities
const pathSep = typeof process !== 'undefined' && process.platform === 'win32' ? '\\' : '/';
const joinPath = (...parts) => parts.filter(Boolean).join(pathSep);

// Export in config object
export const config = {
  // ... existing config ...
  
  // Platform detection
  isSnap,
  isLinux,
  isWindows,
  isUbuntuCore,
  
  // Platform-specific paths
  snapUserData,
  snapUserCommon,
  homeDirectory,
};
```

---

## 2. Directory Structure (Cross-Platform)

**File:** `src/config/environment.mjs`

Configure data directories based on platform:

```javascript
// Directory name - must match old Python app for SNAP upgrade compatibility
// Old Python app used: "CluemasterVideoPlayer" (no hyphens)
const appDirName = isSnap ? "CluemasterVideoPlayer" : env.VITE_PRODUCT_NAME;

// Master directory where all app data is stored
const masterDirectory = isSnap && snapUserData
  ? joinPath(snapUserData, appDirName)
  : homeDirectory ? joinPath(homeDirectory, appDirName) : undefined;

const applicationDataDirectory = masterDirectory ? joinPath(masterDirectory, "application-data") : undefined;
const mediaFilesDirectory = applicationDataDirectory ? joinPath(applicationDataDirectory, "media-files") : undefined;
const deviceConfigsDirectory = masterDirectory ? joinPath(masterDirectory, "device-configs") : undefined;

// USB/Removable media paths (platform-specific)
const getRemovableMediaPaths = () => {
  if (isWindows) return []; // Windows uses drive letters
  if (isSnap) {
    return ['/media/root', '/run/media/root', '/media', '/mnt'];
  }
  if (isLinux && typeof require !== 'undefined') {
    const os = require('os');
    const username = os.userInfo().username;
    return [
      joinPath('/media', username),
      joinPath('/run/media', username),
      '/media',
      '/mnt'
    ];
  }
  return ['/media', '/mnt'];
};
const removableMediaPaths = getRemovableMediaPaths();
```

**Directory Layout:**

| Platform | Master Directory |
|----------|------------------|
| Windows DEV | `C:\Users\<user>\ClueMaster-VideoPlayer-DEV\` |
| Windows PROD | `C:\Users\<user>\ClueMaster-VideoPlayer\` |
| SNAP (Ubuntu Core) | `/root/snap/<snap-name>/<rev>/CluemasterVideoPlayer/` |

---

## 3. Legacy Config Migration (SNAP)

**File:** `src/backends/splash.mjs`

For SNAP upgrades from a previous Python app, migrate config automatically:

```javascript
import fs from 'fs';
import path from 'path';
import config from '../config/environment.mjs';

async function migrateLegacyConfig() {
  // Only run on SNAP
  if (!config.isSnap) return null;
  
  // Check if new config already exists
  const newConfigPath = path.join(config.deviceConfigsDirectory, 'unique-code.json');
  if (fs.existsSync(newConfigPath)) {
    console.log('Migration: New config exists, skipping migration');
    return null;
  }
  
  // Check for legacy config
  const legacyConfigPath = path.join(config.legacyApplicationDataDirectory, 'unique_code.json');
  if (!fs.existsSync(legacyConfigPath)) {
    console.log('Migration: No legacy config found');
    return null;
  }
  
  try {
    // Read legacy config (Python app used spaces in keys)
    const legacyData = JSON.parse(fs.readFileSync(legacyConfigPath, 'utf8'));
    
    // Create new config with proper keys
    const newConfig = {
      uniqueCode: legacyData['unique code'] || legacyData.uniqueCode,
      apiToken: legacyData['api token'] || legacyData.apiToken,
    };
    
    // Ensure directory exists
    fs.mkdirSync(config.deviceConfigsDirectory, { recursive: true });
    
    // Write new config
    fs.writeFileSync(newConfigPath, JSON.stringify(newConfig, null, 2));
    console.log('Migration: Successfully migrated legacy config');
    
    return newConfig;
  } catch (error) {
    console.error('Migration: Failed -', error.message);
    return null;
  }
}
```

---

## 4. Media Protocol Handler

**File:** `electron/main.mjs`

Register custom protocol to serve media files with range request support:

```javascript
import { app, protocol, net } from 'electron';
import path from 'path';
import fs from 'fs';
import config from '../src/config/environment.mjs';

// Register protocol scheme before app is ready
protocol.registerSchemesAsPrivileged([
  { 
    scheme: 'media', 
    privileges: { 
      bypassCSP: true, 
      stream: true, 
      supportFetchAPI: true 
    } 
  }
]);

app.whenReady().then(() => {
  // Handle media:// protocol
  protocol.handle('media', async (request) => {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    
    // media://local/filename.mp4 -> local media files
    // media://external/DRIVE/path/file.mp4 -> USB drive files
    
    if (pathParts[0] === 'local') {
      const filename = decodeURIComponent(pathParts.slice(1).join('/'));
      const filePath = path.join(config.mediaFilesDirectory, filename);
      
      // Security: Validate path is within allowed directory
      if (!filePath.startsWith(config.mediaFilesDirectory)) {
        return new Response('Forbidden', { status: 403 });
      }
      
      return net.fetch('file://' + filePath);
      
    } else if (pathParts[0] === 'external') {
      // Handle USB drive paths
      let filePath;
      
      if (config.isWindows) {
        // Windows: media://external/E/path/file.mp4 -> E:\path\file.mp4
        const driveLetter = pathParts[1];
        const restOfPath = pathParts.slice(2).join('/');
        filePath = `${driveLetter}:\\${restOfPath}`;
      } else {
        // Linux: media://external/USB_LABEL/path/file.mp4 -> /media/root/USB_LABEL/path/file.mp4
        const usbLabel = pathParts[1];
        const restOfPath = pathParts.slice(2).join('/');
        
        // Try each possible mount location
        for (const mountBase of config.removableMediaPaths) {
          const candidatePath = path.join(mountBase, usbLabel, restOfPath);
          if (fs.existsSync(candidatePath)) {
            filePath = candidatePath;
            break;
          }
        }
        
        if (!filePath) {
          return new Response('USB drive not found', { status: 404 });
        }
      }
      
      return net.fetch('file://' + filePath);
    }
    
    return new Response('Not Found', { status: 404 });
  });
});
```

---

## 5. FFmpeg/FFprobe Integration

**File:** `src/backends/transcoder.mjs` (NEW FILE)

Cross-platform FFmpeg/FFprobe path resolution:

```javascript
import path from 'path';
import { spawn } from 'child_process';
import config from '../config/environment.mjs';

/**
 * Get platform-specific path to FFmpeg binary
 * @param {'ffmpeg'|'ffprobe'} binary - Which binary to get
 * @returns {string} Full path to binary
 */
export function getFfmpegPath(binary) {
  if (config.isSnap) {
    // SNAP bundles FFmpeg in $SNAP/bin/
    return path.join(process.env.SNAP, 'bin', binary);
  }
  
  if (config.isWindows) {
    // Windows bundles in resources/ffmpeg-win/
    const { app } = require('electron');
    const resourcesPath = app.isPackaged
      ? path.join(process.resourcesPath, 'ffmpeg-win')
      : path.join(__dirname, '..', '..', 'resources', 'ffmpeg-win');
    return path.join(resourcesPath, `${binary}.exe`);
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
  const ffprobePath = getFfmpegPath('ffprobe');
  
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
        reject(new Error(`ffprobe failed: ${stderr}`));
        return;
      }
      
      try {
        const data = JSON.parse(stdout);
        const stream = data.streams?.[0];
        
        if (!stream) {
          reject(new Error('No video stream found'));
          return;
        }
        
        // Parse frame rate (can be "30/1" or "29.97")
        let fps = 0;
        if (stream.r_frame_rate) {
          const [num, denom] = stream.r_frame_rate.split('/');
          fps = denom ? (parseInt(num) / parseInt(denom)) : parseFloat(num);
        }
        
        resolve({
          codec: stream.codec_name,
          width: stream.width,
          height: stream.height,
          fps: Math.round(fps * 100) / 100,
          bitrate: stream.bit_rate ? Math.round(stream.bit_rate / 1000) : null,
        });
      } catch (e) {
        reject(new Error(`Failed to parse ffprobe output: ${e.message}`));
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
```

---

## 6. H.265/VP9/AV1 Transcoding

**File:** `src/backends/transcoder.mjs`

```javascript
/**
 * Transcode H.265/VP9/AV1 video to H.264 for compatibility
 * @param {string} inputPath - Path to video file
 * @param {string} outputPath - Path for H.264 output
 * @param {Function} onProgress - Progress callback (0-100)
 * @param {string} sourceCodec - Original codec name for logging
 * @returns {Promise<boolean>} - True if successful
 */
export async function transcodeToH264(inputPath, outputPath, onProgress, sourceCodec = 'unknown') {
  const ffmpegPath = getFfmpegPath('ffmpeg');
  
  return new Promise((resolve, reject) => {
    const args = [
      '-i', inputPath,
      '-c:v', 'libx264',
      '-crf', '20',          // Quality (lower = better, 18-23 typical)
      '-preset', 'fast',      // Speed/quality tradeoff
      '-pix_fmt', 'yuv420p',  // Convert 10-bit to 8-bit for max compatibility
      '-c:a', 'aac',          // Audio codec
      '-b:a', '192k',         // Audio bitrate
      '-movflags', '+faststart', // Web optimization
      '-y',                   // Overwrite output
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
        resolve(true);
      } else {
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });
    
    proc.on('error', reject);
  });
}
```

**File:** `src/screens/loading.jsx` (VP9 hardware detection)

```javascript
// Check if VP9 has hardware-accelerated decode support
async function checkVp9HardwareSupport() {
  if (!navigator.mediaCapabilities) {
    return false;
  }
  
  const config = {
    type: 'file',
    video: {
      contentType: 'video/webm; codecs="vp9"',
      width: 1920, height: 1080, framerate: 30, bitrate: 10000000
    }
  };
  
  try {
    const result = await navigator.mediaCapabilities.decodingInfo(config);
    return result.powerEfficient; // true = GPU hardware, false = CPU software
  } catch {
    return false;
  }
}
```

**File:** `src/backends/loading.mjs` (integrate transcoding with VP9 support)

```javascript
import { needsTranscoding, transcodeToH264 } from './transcoder.mjs';

ipcMain.handle('loading:worker', async (_event, options = {}) => {
  const hevcSupported = options?.hevcSupported ?? false;
  const vp9HardwareSupported = options?.vp9HardwareSupported ?? true;
  
  // Determine if transcoding is needed
  const isWindows = process.platform === 'win32';
  const needsVp9Transcode = isWindows && !vp9HardwareSupported;
  const shouldTranscode = !isWindows || needsVp9Transcode;
  
  if (shouldTranscode) {
    const transcodeCheck = await needsTranscoding(filePath);
    
    // Skip HEVC if browser supports it natively
    const skipHevc = transcodeCheck.originalCodec === 'HEVC' && hevcSupported;
    // Skip VP9 on Windows if hardware decode available
    const skipVp9OnWindows = transcodeCheck.originalCodec === 'VP9' && isWindows && vp9HardwareSupported;
    
    if (transcodeCheck.needsTranscode && !skipHevc && !skipVp9OnWindows) {
      await transcodeToH264(inputPath, outputPath, onProgress, transcodeCheck.originalCodec);
    }
  }
});
```

### Platform Transcoding Behavior

| Codec | Windows (VP9 HW) | Windows (VP9 SW) | Linux/Ubuntu |
|-------|------------------|------------------|--------------|
| H.264 | ✅ Play native | ✅ Play native | ✅ Play native |
| HEVC | ✅ Play native | ✅ Play native | ⚠️ Transcode if no VA-API |
| VP9 | ✅ Play native | 🔄 Transcode | 🔄 Always transcode |
| AV1 | ✅ Play native | ✅ Play native | 🔄 Always transcode |

### Supported Media Extensions

| Type | Extensions |
|------|------------|
| **Video** | `.mp4`, `.mpg`, `.mpeg`, `.m4v`, `.mkv`, `.webm`, `.avi`, `.mov` |
| **Audio** | `.mp3`, `.wav`, `.flac`, `.ogg` |
| **Images** | `.png`, `.gif`, `.jpg`, `.jpeg` |
  if (hevcSupported || config.isWindows) {
    return filePath;
  }
  
  // Check if this is an H.265 video
  const isHevc = await isH265Video(filePath);
  if (!isHevc) {
    return filePath;
  }
  
  console.log(`Loading: Transcoding H.265 → H.264: ${path.basename(filePath)}`);
  
  // Create temporary output path
  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const name = path.basename(filePath, ext);
  const tempPath = path.join(dir, `${name}_h264${ext}`);
  
  try {
    await transcodeToH264(filePath, tempPath, (progress) => {
      // Report progress to UI
      parentPort?.postMessage({ type: 'progressPercent', progress });
    });
    
    // Replace original with transcoded version
    fs.unlinkSync(filePath);
    fs.renameSync(tempPath, filePath);
    
    console.log(`Loading: Transcoding complete: ${path.basename(filePath)}`);
    return filePath;
    
  } catch (error) {
    console.error(`Loading: Transcoding failed: ${error.message}`);
    // Clean up temp file if it exists
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    throw error;
  }
}
```

---

## 7. Video Player Optimizations

**File:** `src/screens/video-player.jsx`

Key optimizations for smooth playback:

```jsx
// GPU compositor layer optimization
const videoStyle = {
  transform: 'translateZ(0)',       // Force GPU layer
  backfaceVisibility: 'hidden',     // Prevent artifacts
  willChange: 'opacity',            // Compositor hint
  contain: 'layout style paint',    // CSS containment
};

// Double-buffered playback
const [activeBuffer, setActiveBuffer] = useState(0);
const videoRefs = [useRef(null), useRef(null)];

// Preload next video at 80% completion
const handleTimeUpdate = (e) => {
  const video = e.target;
  const progress = video.currentTime / video.duration;
  
  if (progress > 0.8 && !nextVideoPreloaded) {
    preloadNextVideo();
    setNextVideoPreloaded(true);
  }
};

// Check readyState before playing
const playNextVideo = async () => {
  const nextBuffer = 1 - activeBuffer;
  const nextVideo = videoRefs[nextBuffer].current;
  
  // Wait for video to be ready
  if (nextVideo.readyState < 3) {
    await new Promise(resolve => {
      nextVideo.addEventListener('canplay', resolve, { once: true });
    });
  }
  
  nextVideo.play();
  setActiveBuffer(nextBuffer);
};

// Single-video loop optimization
useEffect(() => {
  if (playlist.length === 1) {
    videoRefs[0].current.loop = true;
  }
}, [playlist]);
```

---

## 8. Debug Overlay

**File:** `src/screens/video-player.jsx` (add overlay component)

```jsx
function DebugOverlay({ video, videoPath }) {
  const [fps, setFps] = useState(0);
  const [jitter, setJitter] = useState(0);
  const [videoInfo, setVideoInfo] = useState(null);
  const [decodeInfo, setDecodeInfo] = useState(null);
  const [droppedFrames, setDroppedFrames] = useState(0);
  const frameTimestamps = useRef([]);
  const initialDroppedRef = useRef(null);

  // FPS calculation
  useEffect(() => {
    if (!video) return;
    
    let animationId;
    const measureFps = () => {
      const now = performance.now();
      frameTimestamps.current.push(now);
      
      // Keep last 60 frames
      while (frameTimestamps.current.length > 60) {
        frameTimestamps.current.shift();
      }
      
      if (frameTimestamps.current.length > 1) {
        const elapsed = now - frameTimestamps.current[0];
        const currentFps = (frameTimestamps.current.length - 1) / (elapsed / 1000);
        setFps(Math.round(currentFps));
        
        // Calculate jitter
        const intervals = [];
        for (let i = 1; i < frameTimestamps.current.length; i++) {
          intervals.push(frameTimestamps.current[i] - frameTimestamps.current[i-1]);
        }
        const avgInterval = intervals.reduce((a,b) => a+b, 0) / intervals.length;
        const variance = intervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) / intervals.length;
        setJitter(Math.round(Math.sqrt(variance)));
      }
      
      animationId = requestAnimationFrame(measureFps);
    };
    
    animationId = requestAnimationFrame(measureFps);
    return () => cancelAnimationFrame(animationId);
  }, [video]);

  // Get video info via ffprobe
  useEffect(() => {
    if (!videoPath) return;
    
    window.SystemBackend?.getVideoInfo?.(videoPath)
      .then(setVideoInfo)
      .catch(console.error);
  }, [videoPath]);

  // Hardware decode detection
  useEffect(() => {
    if (!videoInfo) return;
    
    navigator.mediaCapabilities?.decodingInfo({
      type: 'file',
      video: {
        contentType: `video/mp4; codecs="${videoInfo.codec}"`,
        width: videoInfo.width,
        height: videoInfo.height,
        framerate: videoInfo.fps,
      }
    }).then(setDecodeInfo);
  }, [videoInfo]);

  // Dropped frames monitoring
  useEffect(() => {
    if (!video) return;
    
    const checkDropped = setInterval(() => {
      const quality = video.getVideoPlaybackQuality?.();
      if (quality) {
        if (initialDroppedRef.current === null) {
          initialDroppedRef.current = quality.droppedVideoFrames;
        }
        setDroppedFrames(quality.droppedVideoFrames - initialDroppedRef.current);
      }
    }, 500);
    
    return () => clearInterval(checkDropped);
  }, [video]);

  // Color coding
  const fpsColor = fps >= 55 ? 'text-green-400' : fps >= 45 ? 'text-yellow-400' : 'text-red-400';
  const jitterColor = jitter === 0 ? 'text-green-400' : jitter < 10 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="fixed top-4 left-4 bg-black/80 text-white p-4 rounded-lg font-mono text-sm z-50">
      <div className={fpsColor}>FPS: {fps}</div>
      <div className={jitterColor}>Jitter: {jitter}ms</div>
      {videoInfo && (
        <>
          <div>Codec: {videoInfo.codec}</div>
          <div>Source FPS: {videoInfo.fps}</div>
          <div>Resolution: {videoInfo.width}×{videoInfo.height}</div>
          {videoInfo.bitrate && <div>Bitrate: {videoInfo.bitrate} kbps</div>}
        </>
      )}
      {decodeInfo && (
        <div>
          Decode: {decodeInfo.powerEfficient ? '⬢ GPU Hardware' : decodeInfo.smooth ? '⬢ GPU Accelerated' : '⬡ Software (CPU)'}
        </div>
      )}
      <div>Dropped: {droppedFrames}</div>
    </div>
  );
}
```

---

## 9. Audio Configuration (Linux) - dmix for Concurrent Audio Streams

**File:** `wrapper/wrapper.sh`

### Why dmix is Required

ALSA by default only allows one application to access a hardware audio device at a time. Without dmix, attempting to play multiple audio streams simultaneously (e.g., background music + sound effect, or video + MP3 overlay) results in:

```
ALSA: Device or resource busy
```

**dmix** is ALSA's software mixing plugin that enables **concurrent audio playback** from multiple sources on the same hardware device.

### Key Concepts

| Component | Purpose |
|-----------|---------|
| **dmix** | Software mixer that combines multiple audio streams |
| **ipc_key** | Unique identifier for shared memory between processes (MUST be unique per device) |
| **plug** | Automatic sample rate/format conversion wrapper |
| **multi** | Combines multiple hardware outputs into single virtual device |
| **route** | Duplicates stereo audio to all outputs in a multi device |
| **apulse** | PulseAudio API emulator that redirects to ALSA (required for Chromium) |

### Configuration Strategy

The wrapper script auto-detects available audio devices and creates an appropriate `.asoundrc`:

| Scenario | Configuration |
|----------|---------------|
| **3+ devices** | Multi-output + route plugin (duplicate stereo to all) with dmix per output |
| **2 devices** | Multi-output with dmix per output |
| **1 device** | Simple plug through dmix |
| **0 devices** | Fallback to hw:0,3 (most common HDMI) |

### dmix Configuration Template

Each hardware output needs its own dmix device with a **unique ipc_key**:

```bash
# Example: HDMI 0 with dmix for concurrent audio
pcm.dmix_hdmi0 {
    type dmix
    ipc_key 1026              # UNIQUE key for shared memory (1024-1028 range)
    slave {
        pcm "hw:0,3"          # Hardware device
        period_time 0
        period_size 1024      # Buffer size for low latency
        buffer_size 4096
        rate 48000            # Sample rate
    }
}

# Plug wrapper for automatic format conversion
pcm.plug_hdmi0 {
    type plug
    slave.pcm "dmix_hdmi0"
}
```

### Complete Audio Configuration Script

```bash
#!/bin/bash
# Wrapper script for Linux/SNAP with dmix support

ASOUNDRC="$SNAP_USER_DATA/.asoundrc"

# Auto-detect available PCM devices
HAS_ANALOG=0; HAS_USB_AUDIO=0; HAS_HDMI0=0; HAS_HDMI1=0; HAS_HDMI2=0

if [ -f /proc/asound/pcm ]; then
    grep -q "^00-00:.*playback" /proc/asound/pcm && HAS_ANALOG=1
    grep -q "^01-00:.*playback" /proc/asound/pcm && HAS_USB_AUDIO=1
    grep -q "^00-03:.*playback" /proc/asound/pcm && HAS_HDMI0=1
    grep -q "^00-07:.*playback" /proc/asound/pcm && HAS_HDMI1=1
    grep -q "^00-08:.*playback" /proc/asound/pcm && HAS_HDMI2=1
fi

DEVICE_COUNT=$((HAS_ANALOG + HAS_USB_AUDIO + HAS_HDMI0 + HAS_HDMI1 + HAS_HDMI2))

# Generate .asoundrc with dmix for each detected device
# Each dmix needs a UNIQUE ipc_key!

if [ $DEVICE_COUNT -ge 2 ]; then
    # Multi-output configuration with dmix per output
    cat > "$ASOUNDRC" << 'EOF'
# ALSA config with dmix for concurrent audio streams

# dmix devices (software mixing) - UNIQUE ipc_key per device!
pcm.dmix_analog {
    type dmix
    ipc_key 1024
    slave { pcm "hw:0,0"; period_size 1024; buffer_size 4096; rate 48000 }
}

pcm.dmix_usb {
    type dmix
    ipc_key 1025
    slave { pcm "hw:1,0"; period_size 1024; buffer_size 4096; rate 48000 }
}

pcm.dmix_hdmi0 {
    type dmix
    ipc_key 1026
    slave { pcm "hw:0,3"; period_size 1024; buffer_size 4096; rate 48000 }
}

pcm.dmix_hdmi1 {
    type dmix
    ipc_key 1027
    slave { pcm "hw:0,7"; period_size 1024; buffer_size 4096; rate 48000 }
}

pcm.dmix_hdmi2 {
    type dmix
    ipc_key 1028
    slave { pcm "hw:0,8"; period_size 1024; buffer_size 4096; rate 48000 }
}

# Plug wrappers for format conversion
pcm.plug_analog { type plug; slave.pcm "dmix_analog" }
pcm.plug_usb { type plug; slave.pcm "dmix_usb" }
pcm.plug_hdmi0 { type plug; slave.pcm "dmix_hdmi0" }
pcm.plug_hdmi1 { type plug; slave.pcm "dmix_hdmi1" }
pcm.plug_hdmi2 { type plug; slave.pcm "dmix_hdmi2" }

# Multi-output device (combines all detected outputs)
pcm.!default {
    type plug
    slave.pcm "multi_out"
}

pcm.multi_out {
    type route
    slave.pcm {
        type multi
        # Include only detected devices in slaves section
        slaves.a.pcm "plug_hdmi0"
        slaves.a.channels 2
        slaves.b.pcm "plug_hdmi1"
        slaves.b.channels 2
        # ... add more as detected
        bindings.0.slave a
        bindings.0.channel 0
        bindings.1.slave a
        bindings.1.channel 1
        bindings.2.slave b
        bindings.2.channel 0
        bindings.3.slave b
        bindings.3.channel 1
    }
    ttable.0.0 1
    ttable.1.1 1
    ttable.0.2 1
    ttable.1.3 1
}
EOF

elif [ $DEVICE_COUNT -eq 1 ]; then
    # Single device with dmix
    if [ $HAS_HDMI0 -eq 1 ]; then
        cat > "$ASOUNDRC" << 'EOF'
pcm.dmix_hdmi0 {
    type dmix
    ipc_key 1026
    slave { pcm "hw:0,3"; period_size 1024; buffer_size 4096; rate 48000 }
}
pcm.!default { type plug; slave.pcm "dmix_hdmi0" }
EOF
    # Add similar blocks for other single-device scenarios
    fi
    
else
    # Fallback - still use dmix!
    cat > "$ASOUNDRC" << 'EOF'
pcm.dmix_fallback {
    type dmix
    ipc_key 1026
    slave { pcm "hw:0,3"; period_size 1024; buffer_size 4096; rate 48000 }
}
pcm.!default { type plug; slave.pcm "dmix_fallback" }
EOF
fi

# Unmute audio controls
amixer -c 0 sset Master unmute 100% 2>/dev/null || true
for i in 0 1 2; do
    amixer -c 0 sset "IEC958,$i" unmute 2>/dev/null || true
done
[ $HAS_USB_AUDIO -eq 1 ] && amixer -c 1 sset PCM unmute 2>/dev/null || true

# Run Electron with apulse (PulseAudio emulation over ALSA)
export ALSA_CONFIG_PATH="$ASOUNDRC"
exec apulse "$SNAP/cluemaster-videoplayer" "$@"
```

### Critical Implementation Notes

1. **Unique ipc_key per device**: Each dmix MUST have a unique `ipc_key`. Using the same key for multiple devices causes audio to only play on one output.

2. **Always use dmix**: Even with a single output device, wrap it in dmix to support concurrent audio streams.

3. **apulse is required**: Chromium/Electron requires PulseAudio API. apulse translates PulseAudio calls to ALSA.

4. **Test concurrent playback**: Use `speaker-test -D default -c 2 -t sine -l 3 &` to play a test tone in background while playing another audio source.

### Debugging Audio

```bash
# Enter snap shell
sudo snap run --shell cluemaster-videoplayer-core.daemon

# List all detected PCM devices
cat /proc/asound/pcm

# Test individual outputs through dmix
speaker-test -D dmix_hdmi0 -c 2 -t sine -l 1
speaker-test -D dmix_analog -c 2 -t sine -l 1

# Test concurrent playback (run in background, then play another)
speaker-test -D default -c 2 -t sine -l 10 &
aplay /path/to/test.wav  # Should play simultaneously!

# View generated .asoundrc
cat $SNAP_USER_DATA/.asoundrc

# Check for "Device or resource busy" errors in logs
# This indicates dmix is NOT working - check ipc_key uniqueness
```

### Hardware Compatibility

| CPU | Analog Output | USB Audio | HDMI Outputs | Notes |
|-----|---------------|-----------|--------------|-------|
| Intel N100 | hw:0,0 (onboard) | - | hw:0,3, hw:0,7, hw:0,8 | Traditional HDA |
| Intel J4215 | - | hw:1,0 (USB chip) | hw:0,3, hw:0,7, hw:0,8 | 3.5mm via USB |

---

## 10. Chromium Hardware Acceleration Flags

**File:** `electron/main.mjs`

Add flags before app.ready for VA-API support:

```javascript
import { app } from 'electron';
import config from '../src/config/environment.mjs';

// VA-API hardware acceleration for Linux/SNAP
if (config.isLinux || config.isSnap) {
  // Force Wayland on ubuntu-frame
  app.commandLine.appendSwitch('ozone-platform-hint', 'auto');
  
  // Enable hardware video decode
  app.commandLine.appendSwitch('enable-accelerated-video-decode');
  app.commandLine.appendSwitch('ignore-gpu-blocklist');
  app.commandLine.appendSwitch('disable-gpu-driver-bug-workarounds');
  
  // VA-API and HEVC support
  app.commandLine.appendSwitch('enable-features', [
    'VaapiVideoDecoder',
    'VaapiVideoEncoder',
    'VaapiVideoDecodeLinuxGL',
    'AcceleratedVideoDecodeLinuxGL',
    'AcceleratedVideoDecodeLinuxZeroCopyGL',
    'VaapiIgnoreDriverChecks',
    'PlatformHEVCDecoderSupport',
    'WaylandWindowDecorations',
  ].join(','));
  
  // Disable D-Bus (not available in SNAP)
  app.commandLine.appendSwitch('disable-features', 'UseOzonePlatform');
}

// Disable D-Bus accessibility (causes errors in SNAP)
if (config.isSnap) {
  process.env.AT_SPI2_CORE_NO_DBUS = '1';
  process.env.DBUS_SESSION_BUS_ADDRESS = 'disabled:';
}
```

---

## 11. Screenshot Capture Feature

### 13a. API Endpoints

**File:** `src/backends/apis.mjs`

```javascript
export const getScreenshotRequestAPI = "{api_base_url}/api/Device/GetScreenshotRequest/{device_unique_code}";
export const postScreenshotAPI = "{api_base_url}/api/Device/PostScreenshot/{device_unique_code}";
```

### 13b. Screenshot Handler (Main Process)

**File:** `src/backends/screenshot-handler.mjs` (NEW FILE)

```javascript
import axios from "axios";
import store from "./state.mjs";
import { postScreenshotAPI } from "./apis.mjs";

export const JPEG_QUALITY = 50;

let getMainWindow = null;

export async function captureAndUpload() {
  try {
    if (!getMainWindow) {
      const mainModule = await import("../../electron/main.mjs");
      getMainWindow = mainModule.getMainWindow;
    }

    const mainWindow = getMainWindow();
    if (!mainWindow || mainWindow.isDestroyed()) {
      return { success: false, error: "Window not available" };
    }

    const image = await mainWindow.webContents.capturePage();
    if (image.isEmpty()) {
      return { success: false, error: "Captured image is empty" };
    }

    const jpegBuffer = image.toJPEG(JPEG_QUALITY);
    const base64Image = jpegBuffer.toString("base64");
    const sizeKB = Math.round(jpegBuffer.length / 1024);

    const uniqueCode = store.get("uniqueCode");
    const apiToken = store.get("APIToken");

    if (!uniqueCode || !apiToken) {
      return { 
        success: true, 
        sizeKB,
        uploaded: false,
        timestamp: new Date().toISOString()
      };
    }

    const endpoint = postScreenshotAPI.replace("{device_unique_code}", uniqueCode);
    const response = await axios.post(
      endpoint,
      { image: base64Image },
      { 
        headers: { Authorization: `Basic ${uniqueCode}:${apiToken}` },
        timeout: 30000,
        validateStatus: () => true
      }
    );

    return {
      success: true,
      sizeKB,
      uploaded: response.status >= 200 && response.status < 300,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

### 13c. Screenshot Worker (Lightweight Polling)

**File:** `src/workers/screenshot.mjs` (NEW FILE)

```javascript
import { parentPort } from "worker_threads";
import { getStore } from "./worker-helpers.mjs";
import { getScreenshotRequestAPI } from "../backends/apis.mjs";
import axios from "axios";

let running = true;
const POLL_INTERVAL = 5000;

parentPort.on("message", (message) => {
  if (message.type === "stop") {
    running = false;
  }
});

async function run() {
  const deviceUniqueID = await getStore("uniqueCode");
  const apiToken = await getStore("APIToken");
  
  if (!deviceUniqueID || !apiToken) {
    await new Promise(r => setTimeout(r, 5000));
  }

  const headers = { Authorization: `Basic ${deviceUniqueID}:${apiToken}` };
  const endpoint = getScreenshotRequestAPI.replace("{device_unique_code}", deviceUniqueID);

  while (running) {
    try {
      const response = await axios.get(endpoint, {
        headers,
        timeout: 10000,
        validateStatus: () => true,
      });

      if (response.status === 200 && response.data?.screenshotRequested) {
        parentPort.postMessage({ type: "event", event: "captureRequested" });
      }
    } catch (error) {
      // Silent fail - network errors expected when offline
    }

    await new Promise(r => setTimeout(r, POLL_INTERVAL));
  }
}

run();
```

### 13d. Workers Manager Integration

**File:** `src/workers/workers.mjs`

```javascript
import { captureAndUpload } from "../backends/screenshot-handler.mjs";

// In startWorkersForPlayer():
await createWorker("screenshot", "screenshot.mjs");

// In worker message handler:
if (message.event === "captureRequested") {
  const result = await captureAndUpload();
  console.log("Screenshot:", result.success ? `${result.sizeKB} KB` : result.error);
  return;
}
```

---

## 12. Auto-Updater (Windows Only)

**File:** `electron/main.mjs`

```javascript
// Only load electron-updater on Windows (SNAP uses snap refresh)
if (config.isWindows && app.isPackaged) {
  const { autoUpdater } = await import('electron-updater');
  
  const UPDATE_REPO = config.isDevelopment 
    ? "VideoPlayer-Updates-Dev" 
    : "VideoPlayer-Updates";
  
  autoUpdater.setFeedURL({
    provider: "github",
    owner: "YourOrg",
    repo: UPDATE_REPO,
  });
  
  // Check every 24 hours
  setInterval(() => autoUpdater.checkForUpdates(), 24 * 60 * 60 * 1000);
  autoUpdater.checkForUpdates();
}
```

---

## 13. Snapcraft.yaml Reference

**File:** `snap/snapcraft.yaml`

Key sections for reference:

```yaml
name: your-app-name
version: '2026.1.35'
base: core24
confinement: strict
grade: stable

apps:
  daemon:
    command: usr/bin/wrapper
    daemon: simple
    restart-condition: always
    restart-delay: 5s
    plugs:
      - network
      - network-bind
      - opengl
      - alsa
      - removable-media
      - wayland
      - hardware-observe
      - shutdown
      - mount-observe

environment:
  # VA-API for Intel GPU
  LIBVA_DRIVERS_PATH: "$SNAP/usr/lib/x86_64-linux-gnu/dri"
  LIBVA_DRIVER_NAME: "iHD"
  
  # Library paths
  LD_LIBRARY_PATH: "$SNAP/usr/lib/x86_64-linux-gnu:$SNAP/lib/x86_64-linux-gnu"
  
  # Electron/Chromium - disable sandbox for daemon (runs as root)
  ELECTRON_DISABLE_SANDBOX: "1"
  ELECTRON_EXTRA_LAUNCH_ARGS: "--no-sandbox --disable-gpu-sandbox --no-zygote --disable-dev-shm-usage --in-process-gpu"

parts:
  # Use Node.js 24 from snap
  cluemaster-videoplayer:
    plugin: nil
    build-snaps:
      - node/24/stable
    # ... rest of part configparts:
  your-app:
    plugin: dump
    source: .
    build-packages:
      - nodejs
      - npm
    stage-packages:
      - libasound2
      - libva2
      - libva-drm2
      - intel-media-va-driver
      - apulse
    override-build: |
      npm ci
      npm run build:prod
      # Copy built files...

  ffmpeg-binary:
    plugin: dump
    source: https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-gpl.tar.xz
    organize:
      bin/ffmpeg: bin/ffmpeg
      bin/ffprobe: bin/ffprobe
```

---

## 14. Wrapper Script (Linux)

**File:** `wrapper/wrapper.sh`

Complete wrapper script (see Section 11 for audio configuration).

Key responsibilities:
- Configure ALSA audio
- Set up environment variables
- Unmute audio controls
- Launch with apulse for PulseAudio emulation

---

## 15. Bug Fixes

### Semver Version Format

**Issue:** electron-updater rejects versions with leading zeros

**Fix:** Use `2026.1.3` format (not `2026.01.03`)

**Files:**
- `package.json`: `"version": "2026.1.3"`
- `snap/snapcraft.yaml`: `version: '2026.1.3'`

### Cursor Management

**Issue:** Duplicate CSS rules when toggling cursor visibility

**Fix:** Track CSS insertion keys

```javascript
let cursorHideKey = null;

function hideCursor(webContents) {
  if (cursorHideKey) return; // Already hidden
  
  cursorHideKey = webContents.insertCSS('* { cursor: none !important; }');
}

function showCursor(webContents) {
  if (cursorHideKey) {
    webContents.removeInsertedCSS(cursorHideKey);
    cursorHideKey = null;
  }
}
```

### ES Modules __dirname

**Issue:** `__dirname` not available in ES modules

**Fix:** Use `fileURLToPath`

```javascript
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
```

---

## 16. Video Interrupt & Restore (Stack-Based)

This feature enables seamless video interruption and restoration, allowing one video to interrupt another and then resume the original from the exact position it left off.

### Use Case
Perfect for applications where:
- Background/ambient video plays continuously
- Short overlays (sound effects, announcements) need to interrupt
- After the overlay ends, the background video resumes from where it was

### Architecture Overview

**Files:**
- `player.jsx` (or equivalent): Manages override state and interrupt stack
- `video-player.jsx` (or equivalent): Handles video rendering with seamless seek/restore

### State Management (Parent Component)

```javascript
// In player.jsx or equivalent

// Stack of interrupted videos with position data
const interruptedStackRef = useRef([]);

// Track current playback position
const currentGroupIndexRef = useRef(0);
const currentTimeRef = useRef(0);

// State for restored video (passed to VideoPlayer)
const [groupStartIndex, setGroupStartIndex] = useState(0);
const [startTime, setStartTime] = useState(0);

// Ref to track current override (avoids stale closure in event handlers)
const currentOverrideRef = useRef(null);

// Keep ref in sync with state
useEffect(() => {
  currentOverrideRef.current = overrideVideo;
}, [overrideVideo]);
```

### Interrupt Handler (Push to Stack)

```javascript
// When new overlay is triggered while another is playing
const handleNewOverlay = (newOverlay) => {
  // Save current state to stack using refs (not stale state)
  const currentOverride = currentOverrideRef.current;
  if (currentOverride) {
    console.log("Saving interrupted video to stack, time:", currentTimeRef.current.toFixed(1));
    interruptedStackRef.current.push({
      overrideVideo: currentOverride,
      groupIndex: currentGroupIndexRef.current,
      currentTime: currentTimeRef.current,  // Exact position in seconds
    });
  }
  
  // Reset position for new overlay
  setGroupStartIndex(0);
  setStartTime(0);
  currentGroupIndexRef.current = 0;
  currentTimeRef.current = 0;
  
  // Set new overlay
  setOverrideVideo(newOverlay);
};
```

### Restore Handler (Pop from Stack)

```javascript
// When overlay ends
const handleOverrideEnd = () => {
  // Check if there's a video to restore
  if (interruptedStackRef.current.length > 0) {
    const restored = interruptedStackRef.current.pop();
    console.log("Restoring video, time:", (restored.currentTime || 0).toFixed(1));
    
    // Update refs
    currentGroupIndexRef.current = restored.groupIndex || 0;
    currentTimeRef.current = restored.currentTime || 0;
    
    // Update state to trigger restore
    setGroupStartIndex(restored.groupIndex || 0);
    setStartTime(restored.currentTime || 0);
    setOverrideVideo(restored.overrideVideo);
    return;
  }
  
  // No restoration needed, clear state
  setOverrideVideo(null);
};
```

### Time Update Callback

```javascript
// Callback from VideoPlayer to track current time
const handleTimeUpdate = (time) => {
  currentTimeRef.current = time;
};

// Pass to VideoPlayer component
<VideoPlayer
  overrideVideo={overrideVideo}
  overrideStartTime={startTime}
  onTimeUpdate={handleTimeUpdate}
  onOverrideEnd={handleOverrideEnd}
/>
```

### Video Player Component (Seamless Seek)

```javascript
// In video-player.jsx or equivalent

// Props for restore functionality
const {
  overrideStartTime = 0,
  onTimeUpdate = () => {},
} = props;

// Refs for immediate effect (no React re-render wait)
const pendingSeekTimeRef = useRef(0);
const seekingToRestoreRef = useRef(false);

// Detect when restore is requested
useEffect(() => {
  if (overrideStartTime > 0) {
    console.log("Will seek to", overrideStartTime.toFixed(1), "seconds after load");
    pendingSeekTimeRef.current = overrideStartTime;
    seekingToRestoreRef.current = true;
    
    // Keep overlay visible during transition (prevents base content flash)
    setTransitioning(true);
  }
}, [overrideVideo, overrideStartTime]);

// Before loading new src, hide video if seeking
if (pendingSeekTimeRef.current > 0) {
  seekingToRestoreRef.current = true;
  videoElement.style.visibility = 'hidden';  // DOM manipulation - immediate!
}

// After video loads (canplaythrough event)
const handleCanPlayThrough = () => {
  if (pendingSeekTimeRef.current > 0) {
    const seekTime = pendingSeekTimeRef.current;
    pendingSeekTimeRef.current = 0;
    
    console.log("Seeking to", seekTime.toFixed(1), "seconds (video hidden)");
    
    // Wait for seek to complete before showing
    const onSeeked = () => {
      videoElement.removeEventListener('seeked', onSeeked);
      
      // NOW show the video (at correct position)
      seekingToRestoreRef.current = false;
      videoElement.style.visibility = 'visible';
      
      // Start playback
      videoElement.play();
    };
    
    videoElement.addEventListener('seeked', onSeeked);
    videoElement.currentTime = seekTime;
    return;  // Don't start playing yet
  }
  
  // No seek needed, play immediately
  videoElement.play();
};

// Track time for save/restore
const handleTimeUpdate = () => {
  if (videoElement.currentTime > 0) {
    onTimeUpdate(videoElement.currentTime);
  }
};

videoElement.ontimeupdate = handleTimeUpdate;
```

### Key Implementation Details

1. **Use refs, not state, for event handlers** - State captured in closures becomes stale. Refs always have current value.

2. **DOM manipulation for immediate visibility** - `videoElement.style.visibility = 'hidden'` takes effect immediately, unlike React state which waits for re-render.

3. **Seek while hidden, show after complete** - The `seeked` event fires when seek is complete. Only then make video visible.

4. **Keep overlay layer visible during restore** - Use a "transitioning" state to prevent the base content from flashing.

5. **Clear stack on appropriate events** - Clear the stack when user explicitly stops playback or component unmounts.

### Testing Checklist

- [ ] Interrupt video A with video B, B plays from start
- [ ] B ends, A resumes at exact position (not start)
- [ ] No visual flash of A at position 0
- [ ] No flash of base content during transition
- [ ] Multiple interrupts work (A → B → C → B → A)
- [ ] Concurrent audio works (dmix configured)
- [ ] Stop command clears entire stack
- [ ] Reset command clears stack AND restarts playlist from index 0

---

## Implementation Checklist

- [ ] Platform detection in environment.mjs
- [ ] Directory structure configuration
- [ ] Legacy config migration (if upgrading from Python app)
- [ ] Media protocol handler
- [ ] FFmpeg/FFprobe path resolution
- [ ] H.265 transcoding fallback
- [ ] Video player optimizations
- [ ] Debug overlay
- [ ] Audio configuration with dmix (Linux)
- [ ] Chromium hardware acceleration flags
- [ ] Screenshot capture feature
- [ ] Auto-updater (Windows only)
- [ ] Snapcraft.yaml configuration
- [ ] Wrapper script for Linux
- [ ] Bug fixes (semver, cursor, ESM)
- [ ] Video interrupt/restore with position save

---

## Notes for AI Agent

When implementing in the target project:

1. **Adapt to existing structure** - File paths and imports may differ
2. **Preserve existing features** - Add alongside, don't replace
3. **Test incrementally** - Verify each section before proceeding
4. **Platform testing** - Test on both Windows and Linux/SNAP
5. **Check for conflicts** - Ensure no duplicate IPC channels or worker names
