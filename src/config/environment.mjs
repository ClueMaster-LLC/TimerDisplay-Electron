// Environment configuration loader
// This file provides API endpoints based on build environment

// Build-time environment configuration
// These values are replaced at build time by the build script
// DO NOT commit actual values - these should always be empty strings in source control
// Important: Always reset these values to empty strings before committing. The build script modifies this file during the build process, but those changes should never be committed to source control.
const BUILD_TIME_CONFIG = {
  VITE_API_BASE_URL: '',
  VITE_ENVIRONMENT: '',
  VITE_APP_VERSION: '',
  VITE_PRODUCT_NAME: '',
  VITE_APP_ID: ''
};

// ─── Platform & SNAP detection ───────────────────────────────────────────────
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

// Check if we have build-time config (packaged app) or runtime config (dev/renderer)
function getEnv() {
  // In renderer process with Vite
  if (typeof import.meta.env !== 'undefined' && import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env;
  }
  
  // In packaged main process with build-time config
  if (BUILD_TIME_CONFIG.VITE_API_BASE_URL && !BUILD_TIME_CONFIG.VITE_API_BASE_URL.startsWith('__BUILD_')) {
    return BUILD_TIME_CONFIG;
  }
  
  // In dev main process - use process.env set by the build script
  if (process.env.VITE_API_BASE_URL) {
    return process.env;
  }
  
  return {};
}

const env = getEnv();

console.log('Environment config - API Base URL:', env.VITE_API_BASE_URL);
console.log('Environment config - Environment:', env.VITE_ENVIRONMENT);

// Throw error if required environment variables are missing
if (!env.VITE_API_BASE_URL) {
  throw new Error('FATAL: VITE_API_BASE_URL environment variable is not set. Check .env.development or .env.production file and ensure build script runs correctly.');
}

if (!env.VITE_APP_ID) {
  throw new Error('FATAL: VITE_APP_ID environment variable is not set. Check .env.development or .env.production file and ensure build script runs correctly.');
}

// ─── Directory Structure (cross-platform) ────────────────────────────────────
// SNAP uses a fixed directory name for upgrade compatibility
const appDirName = isSnap ? "CluemasterTimerDisplay" : env.VITE_PRODUCT_NAME;

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

export const config = {
  // Vite exposes env vars prefixed with VITE_ to the renderer
  apiBaseUrl: env.VITE_API_BASE_URL,
  environment: env.VITE_ENVIRONMENT || 'unknown',
  appVersion: env.VITE_APP_VERSION || 'unknown',
  productName: env.VITE_PRODUCT_NAME, // Required - no fallback to ensure proper app naming
  appId: env.VITE_APP_ID, // Required - no fallback to ensure proper directory separation
  isDevelopment: env.VITE_ENVIRONMENT === 'development',
  isProduction: env.VITE_ENVIRONMENT === 'production',

  // Platform detection
  isSnap,
  isLinux,
  isWindows,
  isUbuntuCore,

  // Platform-specific paths
  snapUserData,
  snapUserCommon,
  homeDirectory,

  // Data directories
  appDirName,
  masterDirectory,
  applicationDataDirectory,
  mediaFilesDirectory,
  deviceConfigsDirectory,
  removableMediaPaths,
};

// For debugging (remove in production)
console.log('Environment config loaded:', config);

export default config;
