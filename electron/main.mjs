import { app, BrowserWindow, Menu, protocol, session, screen, ipcMain } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import os from "os";
import mime from "mime";
import { exec } from "child_process";
import { promisify } from "util";
import crypto from "crypto";
import http from "http";
import https from "https";
// electron-updater is a CommonJS module; import default and destructure
import updaterPkg from "electron-updater";
const { autoUpdater } = updaterPkg;
import log from "electron-log";

const execAsync = promisify(exec);

// Configure electron-updater logging to reduce verbosity
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = "warn"; // Only log warnings and errors
autoUpdater.logger.transports.console.level = "warn"; // Reduce console output

// Rely on electron-builder publish config in package.json; remove manual feed overrides.
autoUpdater.allowDowngrade = false;
autoUpdater.disableWebInstaller = true; // Not using web installer

// Note: UPDATE_REPO will be set after environment config is loaded
let UPDATE_REPO = 'TimerDisplay-Updates'; // Default to production
let isDevBuild = !app.isPackaged; // Default: dev mode if not packaged

// Import config to get app-specific directory names
import { config as envConfig } from '../src/config/environment.mjs';

const homeDirectory = os.homedir();
// Use config's cross-platform directory structure
const appDirName = envConfig.appDirName || envConfig.productName;
const masterDirectory = envConfig.masterDirectory || path.join(homeDirectory, appDirName);
const applicationData = envConfig.applicationDataDirectory || path.join(masterDirectory, "application-data");
const BASE_MEDIA_DIRECTORY = envConfig.mediaFilesDirectory || path.join(applicationData, "media-files");
const TTS_CACHE_DIRECTORY = path.join(masterDirectory, "tts-cache");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let mainWindow = null;
let _cursorHideKey = null;
let _cursorShowKey = null;
let workersModule = null;
let backgroundUpdateInterval = null;
let isAppQuitting = false; // Flag to track app shutdown state - prevents worker race conditions

function nodeStreamToWeb(stream) {
  return new ReadableStream({
    start(controller) {
      stream.on("data", (chunk) => controller.enqueue(chunk));
      stream.on("end", () => controller.close());
      stream.on("error", (err) => controller.error(err));
    },
    cancel() {
      stream.destroy();
    },
  });
}

export function getMainWindow() {
  return mainWindow;
}

export function isQuitting() {
  return isAppQuitting;
}

function createWindow() {
  const isUnpackagedDev = !app.isPackaged;
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  if (isUnpackagedDev) {
    // Running via npm run dev
    mainWindow = new BrowserWindow({
      show: false,
      frame: true,
      resizable: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true,
        sandbox: !envConfig.isSnap, // Disable sandbox for SNAP daemon (runs as root)
        preload: path.join(__dirname, "preload.cjs"),
      },
    });

    mainWindow.loadURL("http://localhost:5173");

    mainWindow.once("ready-to-show", () => {
      mainWindow.show();
      mainWindow.focus();
    });

    mainWindow.webContents.on("before-input-event", (event, input) => {
      if (input.type === "keyDown" && input.code === "F11") {
        event.preventDefault();
        mainWindow.setFullScreen(!mainWindow.isFullScreen());
      }
    });
  } else if (isDevBuild) {
    // Packaged DEV build - windowed mode like npm run dev
    mainWindow = new BrowserWindow({
      show: false,
      frame: true,
      resizable: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true,
        sandbox: !envConfig.isSnap, // Disable sandbox for SNAP daemon (runs as root)
        preload: path.join(__dirname, "preload.cjs"),
      },
    });

    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));

    mainWindow.once("ready-to-show", () => {
      mainWindow.show();
      mainWindow.focus();
    });

    mainWindow.webContents.on("before-input-event", (event, input) => {
      if (input.type === "keyDown" && input.code === "F11") {
        event.preventDefault();
        mainWindow.setFullScreen(!mainWindow.isFullScreen());
      }
    });
  } else {
    // Packaged PROD build - fullscreen kiosk mode
    mainWindow = new BrowserWindow({
      width,
      height,
      frame: true,
      resizable: true,
      show: false,
      autoHideMenuBar: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true,
        sandbox: !envConfig.isSnap, // Disable sandbox for SNAP daemon (runs as root)
        preload: path.join(__dirname, "preload.cjs"),
      },
    });

    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));

    // Create menu with debug options (matches VideoPlayer PROD template)
    const prodTemplate = [
      {
        label: 'File',
        submenu: [
          { role: 'quit' }
        ]
      },
      {
        label: 'View',
        submenu: [
          {
            role: 'togglefullscreen',
            accelerator: 'F11'
          }
        ]
      },
      {
        label: 'Debug Options',
        submenu: [
          {
            label: 'Toggle Debug Overlay',
            accelerator: 'CmdOrCtrl+Shift+D',
            click: () => {
              mainWindow.webContents.send('debug:toggle-overlay');
            }
          },
          { type: 'separator' },
          {
            label: 'Test Screenshot Capture',
            accelerator: 'CmdOrCtrl+Shift+S',
            click: async () => {
              try {
                console.log('Screenshot Test: Capturing...');
                const { captureAndUpload } = await import('../src/backends/screenshot-handler.mjs');
                const result = await captureAndUpload();
                console.log('Screenshot Test: Result -', result);
                mainWindow.webContents.send('screenshot-test-result', result);
              } catch (err) {
                console.error('Screenshot Test: Failed -', err.message);
                mainWindow.webContents.send('screenshot-test-result', {
                  success: false,
                  error: err.message,
                });
              }
            }
          }
        ]
      }
    ];
    const prodMenu = Menu.buildFromTemplate(prodTemplate);
    Menu.setApplicationMenu(prodMenu);

    mainWindow.once("ready-to-show", () => {
      mainWindow.maximize();
      mainWindow.show();
      mainWindow.setKiosk(true);
      mainWindow.setFullScreen(true);
      mainWindow.setAlwaysOnTop(true, "screen-saver", 1);
      mainWindow.focus();

      // hide cursor when we enter kiosk/fullscreen on startup
      if (_cursorShowKey) {
        mainWindow.webContents
          .removeInsertedCSS(_cursorShowKey)
          .catch(() => { });
        _cursorShowKey = null;
      }
      mainWindow.webContents
        .insertCSS("* { cursor: none !important; }")
        .then((k) => {
          _cursorHideKey = k;
        })
        .catch(() => { });
    });

    // blur listener to re-focus if it loses focus
    mainWindow.on("blur", () => {
      if (
        !mainWindow.isDestroyed() &&
        (mainWindow.isFullScreen() || mainWindow.isKiosk())
      ) {
        mainWindow.setAlwaysOnTop(true, "screen-saver", 1);
        mainWindow.focus();
      }
    });

    mainWindow.webContents.on("before-input-event", (event, input) => {
      if (input.type === "keyDown" && input.code === "F11") {
        event.preventDefault();
        const isFullscreen = mainWindow.isFullScreen();

        if (isFullscreen) {
          mainWindow.setKiosk(false);
          mainWindow.setFullScreen(false);
          mainWindow.setMenuBarVisibility(true);
          mainWindow.maximize();
          mainWindow.setAlwaysOnTop(false);
          // restore cursor when leaving fullscreen/kiosk: remove hide CSS and force show
          if (_cursorHideKey) {
            mainWindow.webContents
              .removeInsertedCSS(_cursorHideKey)
              .catch(() => { });
            _cursorHideKey = null;
          }
          if (!_cursorShowKey) {
            mainWindow.webContents
              .insertCSS("* { cursor: default !important; }")
              .then((k) => {
                _cursorShowKey = k;
              })
              .catch(() => { });
          }
        } else {
          mainWindow.setMenuBarVisibility(false);
          mainWindow.setKiosk(true);
          mainWindow.setFullScreen(true);
          mainWindow.setAlwaysOnTop(true, "screen-saver", 1);
          // hide cursor when entering fullscreen/kiosk: remove any show CSS and insert hide
          if (_cursorShowKey) {
            mainWindow.webContents
              .removeInsertedCSS(_cursorShowKey)
              .catch(() => { });
            _cursorShowKey = null;
          }
          mainWindow.webContents
            .insertCSS("* { cursor: none !important; }")
            .then((k) => {
              _cursorHideKey = k;
            })
            .catch(() => { });
        }
      }
    });

    // also respond to native fullscreen events and HTML5 fullscreen
    mainWindow.on("enter-full-screen", () => {
      mainWindow.setMenuBarVisibility(false);
      mainWindow.setAlwaysOnTop(true, "screen-saver", 1);
      if (_cursorShowKey) {
        mainWindow.webContents
          .removeInsertedCSS(_cursorShowKey)
          .catch(() => { });
        _cursorShowKey = null;
      }
      if (!_cursorHideKey)
        mainWindow.webContents
          .insertCSS("* { cursor: none !important; }")
          .then((k) => {
            _cursorHideKey = k;
          })
          .catch(() => { });
    });

    mainWindow.on("leave-full-screen", () => {
      mainWindow.setMenuBarVisibility(true);
      mainWindow.setAlwaysOnTop(false);
      if (_cursorHideKey) {
        mainWindow.webContents
          .removeInsertedCSS(_cursorHideKey)
          .catch(() => { });
        _cursorHideKey = null;
      }
      if (!_cursorShowKey) {
        mainWindow.webContents
          .insertCSS("* { cursor: default !important; }")
          .then((k) => {
            _cursorShowKey = k;
          })
          .catch(() => { });
      }
    });

    mainWindow.on("enter-html-full-screen", () => {
      mainWindow.setAlwaysOnTop(true, "screen-saver", 1);
      if (_cursorShowKey) {
        mainWindow.webContents
          .removeInsertedCSS(_cursorShowKey)
          .catch(() => { });
        _cursorShowKey = null;
      }
      if (!_cursorHideKey)
        mainWindow.webContents
          .insertCSS("* { cursor: none !important; }")
          .then((k) => {
            _cursorHideKey = k;
          })
          .catch(() => { });
    });

    mainWindow.on("leave-html-full-screen", () => {
      mainWindow.setAlwaysOnTop(false);
      if (_cursorHideKey) {
        mainWindow.webContents
          .removeInsertedCSS(_cursorHideKey)
          .catch(() => { });
        _cursorHideKey = null;
      }
      if (!_cursorShowKey) {
        mainWindow.webContents
          .insertCSS("* { cursor: default !important; }")
          .then((k) => {
            _cursorShowKey = k;
          })
          .catch(() => { });
      }
    });

    // also ensure cursor is restored when leaving maximized/windowed states
    mainWindow.on("unmaximize", () => {
      mainWindow.setAlwaysOnTop(false);
      if (_cursorHideKey) {
        mainWindow.webContents
          .removeInsertedCSS(_cursorHideKey)
          .catch(() => { });
        _cursorHideKey = null;
      }
      if (!_cursorShowKey) {
        mainWindow.webContents
          .insertCSS("* { cursor: default !important; }")
          .then((k) => {
            _cursorShowKey = k;
          })
          .catch(() => { });
      }
    });

    mainWindow.on("restore", () => {
      mainWindow.setAlwaysOnTop(false);
      if (_cursorHideKey) {
        mainWindow.webContents
          .removeInsertedCSS(_cursorHideKey)
          .catch(() => { });
        _cursorHideKey = null;
      }
      if (!_cursorShowKey) {
        mainWindow.webContents
          .insertCSS("* { cursor: default !important; }")
          .then((k) => {
            _cursorShowKey = k;
          })
          .catch(() => { });
      }
    });
  }

  // Stop workers before window closes to prevent "Object has been destroyed" errors
  mainWindow.on('close', async (event) => {
    // If we're already quitting (workers stopped), allow the close
    if (isAppQuitting) {
      return;
    }

    // Prevent the window from closing immediately
    event.preventDefault();

    // Set flag to prevent workers from sending messages to destroyed window
    isAppQuitting = true;

    // Notify renderer to show closing overlay
    try {
      if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
        mainWindow.webContents.send('app:closing');
        // Give the renderer a moment to show the overlay
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (err) {
      // Ignore errors if window is already destroyed
    }

    if (workersModule) {
      try {
        console.log("Window closing - stopping workers...");
        await workersModule.stopAllWorkers();
        console.log("Workers stopped successfully");
      } catch (err) {
        console.error("Error stopping workers on window close:", err);
      }
    }

    // Now actually close the window
    mainWindow.destroy();
  });
}

// media:// protocol for serving media files
protocol.registerSchemesAsPrivileged([
  {
    scheme: "media",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
]);

// hardware acceleration flags (cross-platform)
app.commandLine.appendSwitch("ignore-gpu-blocklist");
app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("enable-zero-copy");
app.commandLine.appendSwitch("enable-native-gpu-memory-buffers");
app.commandLine.appendSwitch("enable-accelerated-video-decode");
app.commandLine.appendSwitch("force_high_performance_gpu");

// VA-API hardware acceleration for Linux/SNAP
if (envConfig.isLinux || envConfig.isSnap) {
  // Force Wayland on ubuntu-frame
  app.commandLine.appendSwitch('ozone-platform-hint', 'auto');

  // Disable GPU driver bug workarounds for Intel
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
}

// Disable D-Bus accessibility (causes errors in SNAP)
if (envConfig.isSnap) {
  process.env.AT_SPI2_CORE_NO_DBUS = '1';
  // Set valid-format but non-existent socket to prevent parse errors
  process.env.DBUS_SESSION_BUS_ADDRESS = 'unix:path=/dev/null';

  // SNAP daemon runs as root - disable Chromium sandbox (snap strict confinement provides security)
  app.commandLine.appendSwitch('no-sandbox');
  app.commandLine.appendSwitch('disable-gpu-sandbox');
  app.commandLine.appendSwitch('no-zygote');
  app.commandLine.appendSwitch('disable-dev-shm-usage');
  app.commandLine.appendSwitch('in-process-gpu');

  // Disable D-Bus features that require session bus (not available for daemons)
  app.commandLine.appendSwitch('disable-features',
    'HardwareMediaKeyHandling,' +
    'MediaSessionService,' +
    'SystemNotifications,' +
    'GlobalMediaControls,' +
    'GlobalMediaControlsForCast,' +
    'GlobalMediaControlsPictureInPicture,' +
    'AudioServiceOutOfProcess,' +
    'MediaRouter'
  );

  // Disable additional D-Bus dependent services
  app.commandLine.appendSwitch('disable-breakpad');
  app.commandLine.appendSwitch('disable-component-update');
  app.commandLine.appendSwitch('disable-background-networking');
  app.commandLine.appendSwitch('disable-speech-api');
  app.commandLine.appendSwitch('disable-sync');
  app.commandLine.appendSwitch('disable-dbus');

  // CRITICAL: Disable client-side decorations for ubuntu-frame compatibility
  app.commandLine.appendSwitch('disable-features', 'WaylandWindowDecorations');

  // Audio configuration for SNAP/Ubuntu Core
  app.commandLine.appendSwitch('alsa-output-device', 'default');
  app.commandLine.appendSwitch('audio-buffer-size', '4096');

  console.log('SNAP detected: Chromium sandbox disabled (running as daemon)');
  console.log('SNAP detected: Wayland/Ozone platform enabled');
  console.log('SNAP detected: Hardware video decode enabled (VA-API)');
}

app.whenReady().then(async () => {
  const defaultSession = session.defaultSession;
  await defaultSession.clearCache();
  await defaultSession.clearStorageData({
    storages: [
      "appcache",
      "cookies",
      "filesystems",
      "indexdb",
      "localstorage",
      "shadercache",
      "websql",
      "serviceworkers",
      "cachestorage",
    ],
  });

  app.commandLine.appendSwitch("disable-http-cache");
  app.commandLine.appendSwitch("disable-background-timer-throttling");
  app.commandLine.appendSwitch("disable-renderer-backgrounding");

  protocol.handle("media", async (request) => {
    try {
      const url = new URL(request.url);
      const source = url.hostname; // 'local', 'external', or 'tts-cache'
      let filePath;

      if (source === "local") {
        const relativePath = url.pathname.slice(1); // remove leading '/'
        filePath = path.resolve(BASE_MEDIA_DIRECTORY, relativePath);

        if (!filePath.startsWith(BASE_MEDIA_DIRECTORY)) {
          console.error(
            "Security violation: Attempted to access unauthorized path:",
            filePath
          );
          return new Response("Forbidden", { status: 403 });
        }
      } else if (source === "tts-cache") {
        const relativePath = url.pathname.slice(1); // remove leading '/'
        filePath = path.resolve(TTS_CACHE_DIRECTORY, relativePath);

        if (!filePath.startsWith(TTS_CACHE_DIRECTORY)) {
          console.error(
            "Security violation: Attempted to access unauthorized TTS cache path:",
            filePath
          );
          return new Response("Forbidden", { status: 403 });
        }
      } else if (source === "external") {
        // Handle USB drive paths cross-platform
        if (envConfig.isWindows) {
          // Windows: media://external/E/path/file.mp4 -> E:\path\file.mp4
          const [, driveName, ...rest] = url.pathname.split("/");
          const fileName = rest.join(path.sep);
          const usbDrivePath = `${driveName}:\\`;

          if (!fs.existsSync(usbDrivePath)) {
            console.log("USB drive not found:", driveName);
            return new Response("USB drive not found", { status: 404 });
          }

          filePath = path.join(usbDrivePath, fileName);
          if (!filePath.startsWith(usbDrivePath)) {
            console.error(
              "Security violation: Attempted to access unauthorized path:",
              filePath
            );
            return new Response("Forbidden", { status: 403 });
          }
        } else {
          // Linux/SNAP: media://external/USB_LABEL/path/file.mp4
          const [, usbLabel, ...rest] = url.pathname.split("/");
          const restOfPath = rest.join("/");
          let found = false;

          for (const mountBase of (envConfig.removableMediaPaths || ['/media', '/mnt'])) {
            const candidatePath = path.join(mountBase, usbLabel, restOfPath);
            if (fs.existsSync(candidatePath)) {
              filePath = candidatePath;
              found = true;
              break;
            }
          }

          if (!found) {
            console.log("USB drive not found:", usbLabel);
            return new Response("USB drive not found", { status: 404 });
          }
        }
      } else {
        return new Response("Invalid source", { status: 400 });
      }

      if (!fs.existsSync(filePath)) {
        console.log(`File not found: ${filePath}`);
        return new Response("File not found", { status: 404 });
      }

      const stat = fs.statSync(filePath);
      const range = request.headers.get("range");
      const mimeType = mime.getType(filePath) || "application/octet-stream";

      if (range) {
        const [startStr, endStr] = range.replace(/bytes=/, "").split("-");
        const start = parseInt(startStr, 10);
        const end = endStr ? parseInt(endStr, 10) : stat.size - 1;
        const chunkSize = end - start + 1;

        const nodeStream = fs.createReadStream(filePath, { start, end });
        const webStream = nodeStreamToWeb(nodeStream);

        return new Response(webStream, {
          status: 206,
          headers: {
            "Content-Range": `bytes ${start}-${end}/${stat.size}`,
            "Accept-Ranges": "bytes",
            "Content-Length": chunkSize,
            "Content-Type": mimeType,
          },
        });
      } else {
        const nodeStream = fs.createReadStream(filePath);
        const webStream = nodeStreamToWeb(nodeStream);

        return new Response(webStream, {
          headers: {
            "Content-Length": stat.size,
            "Content-Type": mimeType,
            "Accept-Ranges": "bytes",
          },
        });
      }
    } catch (error) {
      console.error("Media: Handler error:", error);
      return new Response("Media: Internal server error", { status: 500 });
    }
  });

  try {
    console.log("Loading backend modules...");
    const stateModule = await import("../src/backends/state.mjs");
    const store = stateModule.default;
    console.log("✓ State module loaded");

    const uniqueCode = store.get("uniqueCode");
    const apiToken = store.get("APIToken");

    store.clear();

    if (uniqueCode) store.set("uniqueCode", uniqueCode);
    if (apiToken) store.set("APIToken", apiToken);

    console.log("Loading splash backend...");
    await import("../src/backends/splash.mjs");
    console.log("✓ Splash backend loaded");
    
    // Determine update repo based on environment config (after splash loads environment)
    try {
      const envModule = await import("../src/config/environment.mjs");
      const envConfig = envModule.config;
      isDevBuild = !app.isPackaged || envConfig.isDevelopment;
      UPDATE_REPO = isDevBuild ? 'TimerDisplay-Updates-Dev' : 'TimerDisplay-Updates';
      console.log(`UPDATER: Environment is ${envConfig.environment}, detected ${isDevBuild ? 'DEVELOPMENT' : 'PRODUCTION'} build, will check repo: ${UPDATE_REPO}`);
      
      // Set the feed URL dynamically based on build type
      autoUpdater.setFeedURL({
        provider: 'github',
        owner: 'ClueMaster-LLC',
        repo: UPDATE_REPO,
        releaseType: 'release'
      });
    } catch (error) {
      console.error("Failed to load environment config for updater:", error);
    }
    
    console.log("Loading workers module...");
    workersModule = await import("../src/workers/workers.mjs");
    console.log("✓ Workers module loaded");

    setTimeout(async () => {
      try {
        console.log("Loading additional backends...");
        await import("../src/backends/authentication.mjs");
        console.log("✓ Authentication backend loaded");
        await import("../src/backends/loading.mjs");
        console.log("✓ Loading backend loaded");
        await import("../src/backends/idle.mjs");
        console.log("✓ Idle backend loaded");
        await import("../src/backends/game.mjs");
        console.log("✓ Game backend loaded");
        console.log("All backend modules loaded successfully");
      } catch (error) {
        console.error("Failed to load additional backends:", error);
        console.error("Error stack:", error.stack);
      }
    }, 500);
  } catch (error) {
    console.error("Failed to load backend:", error);
    console.error("Error stack:", error.stack);
  }

  // Build application menu - add debug tools in dev/unpackaged builds
  const isUnpackagedDev = !app.isPackaged;
  if (isUnpackagedDev || isDevBuild) {
    const defaultMenu = Menu.getApplicationMenu();
    const menuTemplate = [
      {
        label: 'File',
        submenu: [
          { role: 'quit' }
        ]
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectAll' }
        ]
      },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' }
        ]
      },
      {
        label: 'Debug Options',
        submenu: [
          {
            label: 'Toggle Debug Overlay',
            accelerator: 'CmdOrCtrl+Shift+D',
            click: () => {
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('debug:toggle-overlay');
              }
            }
          },
          {
            label: 'Test Screenshot Capture',
            accelerator: 'CmdOrCtrl+Shift+S',
            click: async () => {
              try {
                console.log('Screenshot Test: Capturing...');
                const { captureAndUpload } = await import("../src/backends/screenshot-handler.mjs");
                const result = await captureAndUpload();
                console.log('Screenshot Test: Result -', result);
                if (mainWindow && !mainWindow.isDestroyed()) {
                  mainWindow.webContents.send('screenshot-test-result', result);
                }
              } catch (err) {
                console.error('Screenshot Test: Failed -', err.message);
                if (mainWindow && !mainWindow.isDestroyed()) {
                  mainWindow.webContents.send('screenshot-test-result', {
                    success: false,
                    error: err.message,
                  });
                }
              }
            }
          },
        ]
      },
      {
        label: 'Window',
        submenu: [
          { role: 'minimize' },
          { role: 'close' }
        ]
      }
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));
  } else {
    // Production: remove menu bar
    Menu.setApplicationMenu(null);
  }

  createWindow();

  // TTS: Text-to-Speech using Piper
  // Ensure TTS cache directory exists
  if (!fs.existsSync(TTS_CACHE_DIRECTORY)) {
    fs.mkdirSync(TTS_CACHE_DIRECTORY, { recursive: true });
  }

  // Track current voice model to detect changes
  const VOICE_TRACKER_FILE = path.join(TTS_CACHE_DIRECTORY, ".current_voice");

  // Default max cache size (500MB in bytes)
  const DEFAULT_MAX_CACHE_SIZE = 500 * 1024 * 1024;

  /**
   * Get TTS max cache size from room config or use default
   */
  const getTTSMaxCacheSize = async () => {
    try {
      const stateModule = await import("../src/backends/state.mjs");
      const store = stateModule.default;
      const roomConfig = store.get("roomConfig");
      if (roomConfig && typeof roomConfig.TTSMaxFolderSize === "number") {
        // TTSMaxFolderSize is in MB, convert to bytes
        const sizeInBytes = roomConfig.TTSMaxFolderSize * 1024 * 1024;
        console.log(`TTS: Using API TTSMaxFolderSize: ${roomConfig.TTSMaxFolderSize}MB (overriding default)`);
        return sizeInBytes;
      }
    } catch (error) {
      console.warn("TTS: Could not get TTSMaxFolderSize from roomConfig:", error);
    }
    const defaultSizeMB = Math.round(DEFAULT_MAX_CACHE_SIZE / 1024 / 1024);
    console.log(`TTS: Using default max cache size: ${defaultSizeMB}MB`);
    return DEFAULT_MAX_CACHE_SIZE;
  };

  /**
   * Clean up TTS cache if it exceeds size limit
   * Deletes oldest files first based on last access time
   */
  const cleanupTTSCache = async () => {
    try {
      const maxCacheSize = await getTTSMaxCacheSize();
      
      if (!fs.existsSync(TTS_CACHE_DIRECTORY)) {
        return;
      }

      // Get all wav files with their stats
      const files = fs.readdirSync(TTS_CACHE_DIRECTORY)
        .filter(f => f.endsWith(".wav"))
        .map(f => {
          const filePath = path.join(TTS_CACHE_DIRECTORY, f);
          const stats = fs.statSync(filePath);
          return {
            name: f,
            path: filePath,
            size: stats.size,
            atime: stats.atime.getTime(), // last access time
            mtime: stats.mtime.getTime()  // last modified time
          };
        });

      if (files.length === 0) {
        return;
      }

      // Calculate total cache size
      const totalSize = files.reduce((sum, file) => sum + file.size, 0);
      const maxSizeMB = Math.round(maxCacheSize / 1024 / 1024);
      const currentSizeMB = Math.round(totalSize / 1024 / 1024);

      console.log(`TTS Cache: ${currentSizeMB}MB / ${maxSizeMB}MB (${files.length} files)`);

      if (totalSize <= maxCacheSize) {
        return; // Cache is within limit
      }

      // Sort by last access time (oldest first), fallback to modified time
      files.sort((a, b) => {
        const timeA = a.atime || a.mtime;
        const timeB = b.atime || b.mtime;
        return timeA - timeB;
      });

      // Delete oldest files until we're under the limit
      let currentSize = totalSize;
      let deletedCount = 0;
      let deletedSize = 0;

      for (const file of files) {
        if (currentSize <= maxCacheSize * 0.8) { // Leave 20% buffer
          break;
        }

        try {
          fs.unlinkSync(file.path);
          currentSize -= file.size;
          deletedSize += file.size;
          deletedCount++;
        } catch (err) {
          console.error("TTS: Failed to delete cache file:", file.path, err);
        }
      }

      if (deletedCount > 0) {
        const deletedMB = Math.round(deletedSize / 1024 / 1024);
        const newSizeMB = Math.round(currentSize / 1024 / 1024);
        console.log(`TTS Cache: Deleted ${deletedCount} oldest files (${deletedMB}MB), cache now ${newSizeMB}MB`);
      }
    } catch (error) {
      console.error("TTS: Error during cache cleanup:", error);
    }
  };

  /**
   * Get the correct resources path for both dev and production
   */
  const getResourcesPath = () => {
    if (app.isPackaged) {
      // Production: use process.resourcesPath
      return process.resourcesPath;
    } else {
      // Development: go up from electron directory to project root
      return path.join(__dirname, "..");
    }
  };

  /**
   * Find available Piper voice model and clear cache if voice changed
   * This function is called on every synthesis to detect voice changes in real-time
   */
  const findPiperVoice = () => {
    const resourcesPath = getResourcesPath();
    const voicesDir = path.join(resourcesPath, "resources/piper/voices");
    
    if (!fs.existsSync(voicesDir)) {
      console.error("TTS: Voices directory not found:", voicesDir);
      return null;
    }

    // Re-scan directory on every call to detect new voices
    const files = fs.readdirSync(voicesDir);
    const onnxFile = files.find(f => f.endsWith(".onnx") && !f.endsWith(".onnx.json") && !f.includes(".backup") && !f.includes(".disabled"));
    
    if (onnxFile) {
      const modelPath = path.join(voicesDir, onnxFile);
      
      // Check if voice has changed since last synthesis
      let previousVoice = null;
      if (fs.existsSync(VOICE_TRACKER_FILE)) {
        try {
          previousVoice = fs.readFileSync(VOICE_TRACKER_FILE, "utf8").trim();
        } catch (e) {
          console.warn("TTS: Could not read voice tracker file:", e);
        }
      }

      // Only clear cache if voice has actually changed
      if (previousVoice && previousVoice !== onnxFile) {
        console.log(`TTS: Voice changed from '${previousVoice}' to '${onnxFile}' - clearing cache...`);
        try {
          const cacheFiles = fs.readdirSync(TTS_CACHE_DIRECTORY);
          let clearedCount = 0;
          for (const file of cacheFiles) {
            if (file.endsWith(".wav")) {
              fs.unlinkSync(path.join(TTS_CACHE_DIRECTORY, file));
              clearedCount++;
            }
          }
          console.log(`TTS: Cleared ${clearedCount} cached audio files`);
        } catch (error) {
          console.error("TTS: Error clearing cache after voice change:", error);
        }
      }

      // Update the voice tracker file
      try {
        fs.writeFileSync(VOICE_TRACKER_FILE, onnxFile, "utf8");
      } catch (e) {
        console.warn("TTS: Could not write voice tracker file:", e);
      }

      return modelPath;
    }

    console.error("TTS: No .onnx voice model found in:", voicesDir);
    return null;
  };

  /**
   * Synthesize speech using Piper
   */
  ipcMain.handle("tts:synthesize", async (_event, options) => {
    try {
      const { text } = options;
      
      if (!text || text.trim().length === 0) {
        throw new Error("Text is required");
      }

      // Clean up cache if it exceeds size limit
      await cleanupTTSCache();

      // Check for voice changes FIRST (before checking cache)
      // This will clear cache if voice has changed
      const voiceModel = findPiperVoice();
      if (!voiceModel) {
        throw new Error("No Piper voice model found. Please install a voice model in resources/piper/voices/");
      }

      // Generate cache key from text
      const hash = crypto.createHash("md5").update(text).digest("hex");
      const outputFile = path.join(TTS_CACHE_DIRECTORY, `${hash}.wav`);

      // Check if already cached (after voice change detection)
      if (fs.existsSync(outputFile)) {
        console.log("TTS: Using cached audio:", outputFile);
        return `media://tts-cache/${hash}.wav`;
      }

      // Get Piper executable path
      const resourcesPath = getResourcesPath();
      const piperExe = path.join(resourcesPath, "resources/piper/piper/piper.exe");

      console.log("TTS: Piper executable path:", piperExe);
      
      if (!fs.existsSync(piperExe)) {
        throw new Error("Piper executable not found at: " + piperExe);
      }

      const textLength = text.length;
      console.log(`TTS: Synthesizing speech with Piper (${textLength} characters)...`);
      console.log("TTS: Voice model:", voiceModel);
      console.log("TTS: Output file:", outputFile);

      // Create a temporary file for long text to avoid command line length limits
      const tempTextFile = path.join(TTS_CACHE_DIRECTORY, `${hash}_input.txt`);
      fs.writeFileSync(tempTextFile, text, "utf8");

      // Run Piper to synthesize speech with optimized settings for speed
      // Performance flags:
      // --noise_scale 0.333 (lower = faster, less variation)
      // --length_scale 0.9 (slightly faster speech)
      // --sentence_silence 0.1 (reduce pauses between sentences)
      const command = `cmd /c "type "${tempTextFile}" | "${piperExe}" --model "${voiceModel}" --output_file "${outputFile}" --noise_scale 0.333 --length_scale 0.9 --sentence_silence 0.1"`;
      
      console.log("TTS: Executing Piper command with performance optimizations...");
      const synthesisStart = Date.now();
      
      // Increase timeout and buffer for long text (up to 60 seconds, 50MB buffer)
      const timeout = Math.max(30000, Math.ceil(textLength / 50) * 1000); // ~1s per 50 chars
      
      await execAsync(command, {
        cwd: path.dirname(piperExe),
        maxBuffer: 50 * 1024 * 1024, // 50MB buffer for very long audio
        timeout: timeout,
        windowsHide: true // Hide command window for better performance
      });

      const synthesisTime = Date.now() - synthesisStart;
      console.log(`TTS: Synthesis completed in ${synthesisTime}ms`);

      // Clean up temp text file
      try {
        fs.unlinkSync(tempTextFile);
      } catch (e) {
        console.warn("TTS: Could not delete temp text file:", e);
      }

      if (!fs.existsSync(outputFile)) {
        throw new Error("Piper failed to generate audio file");
      }

      console.log("TTS: Speech synthesis completed successfully");
      return `media://tts-cache/${hash}.wav`;
    } catch (error) {
      console.error("TTS: Synthesis error:", error);
      throw error;
    }
  });

  /**
   * Check for voice changes and clear cache if needed
   */
  ipcMain.handle("tts:checkVoiceChange", async () => {
    try {
      // This will detect voice changes and clear cache if needed
      const voiceModel = findPiperVoice();
      return { success: true, currentVoice: voiceModel ? path.basename(voiceModel) : null };
    } catch (error) {
      console.error("TTS: Error checking voice change:", error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Get available voices
   */
  ipcMain.handle("tts:getVoices", async () => {
    try {
      const resourcesPath = getResourcesPath();
      const voicesDir = path.join(resourcesPath, "resources/piper/voices");
      
      if (!fs.existsSync(voicesDir)) {
        console.log("TTS: Voices directory not found:", voicesDir);
        return [];
      }

      const files = fs.readdirSync(voicesDir);
      const voices = files
        .filter(f => f.endsWith(".onnx") && !f.endsWith(".onnx.json") && !f.includes(".backup") && !f.includes(".disabled"))
        .map(f => ({
          name: f.replace(".onnx", ""),
          path: path.join(voicesDir, f),
        }));

      return voices;
    } catch (error) {
      console.error("TTS: Error getting voices:", error);
      return [];
    }
  });

  /**
   * Clear TTS cache
   */
  ipcMain.handle("tts:clearCache", async () => {
    try {
      if (fs.existsSync(TTS_CACHE_DIRECTORY)) {
        const files = fs.readdirSync(TTS_CACHE_DIRECTORY);
        for (const file of files) {
          if (file.endsWith(".wav")) {
            fs.unlinkSync(path.join(TTS_CACHE_DIRECTORY, file));
          }
        }
      }
      console.log("TTS: Cache cleared");
      return true;
    } catch (error) {
      console.error("TTS: Error clearing cache:", error);
      throw error;
    }
  });

  // Helper function to detect if running on Ubuntu Core with snap
  const isUbuntuCoreSnap = () => {
    const platform = os.platform();
    if (platform !== "linux") return false;
    // Check if SNAP environment variable is set (indicates running as snap)
    return !!process.env.SNAP;
  };

  /**
   * Make an HTTP request to the local snapd REST API over its Unix socket.
   * Requires the `snapd-control` interface to be connected.
   *
   * @param {string} method - HTTP method (GET, POST, etc.)
   * @param {string} apiPath - API path e.g. "/v2/snaps/mysnap"
   * @param {object|null} body - JSON body for POST requests
   * @param {number} timeout - Timeout in ms (default 30s, refreshes can be slow)
   * @returns {Promise<{ok: boolean, status: number, data: object, error?: string}>}
   */
  const snapdRequest = (method, apiPath, body = null, timeout = 30000) => {
    return new Promise((resolve) => {
      const postData = body ? JSON.stringify(body) : null;
      const options = {
        socketPath: "/run/snapd.socket",
        path: apiPath,
        method,
        headers: {
          "Content-Type": "application/json",
          ...(postData ? { "Content-Length": Buffer.byteLength(postData) } : {}),
        },
        timeout,
      };

      const req = http.request(options, (res) => {
        let raw = "";
        res.on("data", (chunk) => { raw += chunk; });
        res.on("end", () => {
          try {
            const data = JSON.parse(raw);
            resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, data });
          } catch (e) {
            resolve({ ok: false, status: res.statusCode, data: null, error: `JSON parse error: ${e.message}` });
          }
        });
      });

      req.on("error", (e) => {
        // EACCES / ENOENT = snapd-control interface not connected
        const hint = e.code === "EACCES" || e.code === "ENOENT"
          ? " (is the snapd-control interface connected?)"
          : "";
        resolve({ ok: false, status: 0, data: null, error: `${e.message}${hint}` });
      });

      req.on("timeout", () => {
        req.destroy();
        resolve({ ok: false, status: 0, data: null, error: `Request timed out (${timeout}ms)` });
      });

      if (postData) req.write(postData);
      req.end();
    });
  };

  /**
   * Poll a snapd async change until it reaches a terminal status.
   * Snapd POST operations (like refresh) return a change ID that must be polled.
   *
   * @param {string} changeId - The snapd change ID to poll
   * @param {function} onProgress - Callback for progress updates (0-100)
   * @returns {Promise<{ok: boolean, status: string, error?: string}>}
   */
  const pollSnapdChange = async (changeId, onProgress) => {
    const MAX_POLLS = 180;  // 15 minutes max (180 * 5s)
    const POLL_INTERVAL = 5000;

    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL));

      const resp = await snapdRequest("GET", `/v2/changes/${changeId}`);
      if (!resp.ok || !resp.data || !resp.data.result) {
        return { ok: false, status: "error", error: resp.error || "Failed to poll change status" };
      }

      const change = resp.data.result;
      const changeStatus = change.status;  // "Do", "Done", "Error", "Abort", etc.

      // Calculate progress from tasks
      if (change.tasks && change.tasks.length > 0 && onProgress) {
        const doneTasks = change.tasks.filter((t) => t.status === "Done").length;
        const pct = Math.floor((doneTasks / change.tasks.length) * 100);
        onProgress(pct);
      }

      if (changeStatus === "Done") {
        return { ok: true, status: "Done" };
      } else if (changeStatus === "Error" || changeStatus === "Abort" || changeStatus === "Hold") {
        const errMsg = change.err || `Change ended with status: ${changeStatus}`;
        return { ok: false, status: changeStatus, error: errMsg };
      }
      // Otherwise still in progress ("Do", "Doing", "Wait"), keep polling
    }
    return { ok: false, status: "timeout", error: "Snap refresh timed out after 15 minutes" };
  };

  /**
   * Fallback: Query the public Snap Store HTTP API to check if a newer version
   * exists, without being able to trigger a refresh. Used when snapd-control
   * is not connected.
   */
  const checkSnapStoreUpdates = () => {
    const snapName = process.env.SNAP_NAME;
    const currentVersion = process.env.SNAP_VERSION;
    if (!snapName || !currentVersion) {
      return Promise.resolve({ updateAvailable: false, currentVersion: currentVersion || "unknown", error: "SNAP env not set" });
    }
    const archMap = { x64: "amd64", arm64: "arm64", arm: "armhf", ia32: "i386" };
    const snapArch = archMap[process.arch] || "amd64";
    const preferredChannel = envConfig.isDevelopment ? "latest/edge" : "latest/stable";

    return new Promise((resolve) => {
      const req = https.request({
        hostname: "api.snapcraft.io",
        path: `/v2/snaps/info/${encodeURIComponent(snapName)}`,
        method: "GET",
        headers: { "Snap-Device-Series": "16", "Snap-Device-Architecture": snapArch },
        timeout: 10000,
      }, (res) => {
        let data = "";
        res.on("data", (c) => { data += c; });
        res.on("end", () => {
          try {
            if (res.statusCode !== 200) { resolve({ updateAvailable: false, currentVersion, error: `HTTP ${res.statusCode}` }); return; }
            const channelMap = JSON.parse(data)["channel-map"] || [];
            let m = channelMap.find((e) => e.channel?.name === preferredChannel && e.channel?.architecture === snapArch);
            if (!m) m = channelMap.find((e) => e.channel?.name === "latest/stable" && e.channel?.architecture === snapArch);
            if (!m) m = channelMap.find((e) => e.channel?.architecture === snapArch);
            if (m) {
              resolve({ updateAvailable: m.version !== currentVersion, currentVersion, storeVersion: m.version, channel: m.channel.name });
            } else {
              resolve({ updateAvailable: false, currentVersion, error: "Snap not found in store" });
            }
          } catch (e) { resolve({ updateAvailable: false, currentVersion, error: e.message }); }
        });
      });
      req.on("error", (e) => resolve({ updateAvailable: false, currentVersion, error: e.message }));
      req.on("timeout", () => { req.destroy(); resolve({ updateAvailable: false, currentVersion, error: "timeout" }); });
      req.end();
    });
  };

  // ─── System/Debug IPC handlers ─────────────────────────────────────────────
  // getVideoInfo via ffprobe (used by debug overlay)
  ipcMain.handle("system:get-video-info", async (_event, mediaPath) => {
    try {
      // Resolve media:// protocol paths to actual file paths
      let filePath = mediaPath;
      if (mediaPath && mediaPath.startsWith('media://')) {
        const url = new URL(mediaPath);
        const type = url.host; // 'local', 'external', or 'tts-cache'
        const restPath = decodeURIComponent(url.pathname).slice(1); // remove leading '/'

        if (type === 'local') {
          filePath = path.resolve(BASE_MEDIA_DIRECTORY, restPath);
        } else if (type === 'tts-cache') {
          filePath = path.resolve(TTS_CACHE_DIRECTORY, restPath);
        } else if (type === 'external') {
          const [driveName, ...rest] = restPath.split('/');
          if (envConfig.isWindows) {
            filePath = `${driveName}:\\${rest.join(path.sep)}`;
          } else {
            // Linux: try removable media mount points
            const mountBases = envConfig.removableMediaPaths || ['/media', '/mnt'];
            for (const mountBase of mountBases) {
              const candidate = path.join(mountBase, driveName, rest.join('/'));
              if (fs.existsSync(candidate)) {
                filePath = candidate;
                break;
              }
            }
          }
        }
      }

      console.log(`Getting video info for: ${filePath}`);
      const { getVideoInfo } = await import("../src/backends/transcoder.mjs");
      const info = await getVideoInfo(filePath);
      return info;
    } catch (error) {
      console.error("System: getVideoInfo error:", error);
      return { error: error.message, filename: path.basename(mediaPath || 'unknown') };
    }
  });

  // Get platform info (used by debug overlay & diagnostics)
  ipcMain.handle("system:get-platform-info", async () => {
    return {
      platform: os.platform(),
      arch: os.arch(),
      isSnap: envConfig.isSnap,
      isLinux: envConfig.isLinux,
      isWindows: envConfig.isWindows,
      isUbuntuCore: envConfig.isUbuntuCore,
      nodeVersion: process.version,
      electronVersion: process.versions.electron,
      chromeVersion: process.versions.chrome,
    };
  });

  // Screenshot capture (can also be triggered from renderer)
  ipcMain.handle("system:capture-screenshot", async () => {
    try {
      const { captureAndUpload } = await import("../src/backends/screenshot-handler.mjs");
      return await captureAndUpload();
    } catch (error) {
      console.error("System: screenshot capture error:", error);
      return { success: false, error: error.message };
    }
  });

  // IPC handler to get the update repo name
  ipcMain.handle("app-get-update-repo", async () => {
    return UPDATE_REPO;
  });

  // IPC handler to get the product name
  ipcMain.handle("app-get-product-name", async () => {
    return app.getName();
  });

  // Updater: handle update checks from renderer (preload exposes UpdaterBackend)
  ipcMain.handle("app-check-for-updates", async (_event, opts) => {
    const send = (type, data) => {
      try {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("updater-status", Object.assign({ type }, data || {}));
        }
      } catch (e) {
        console.error("Failed to send updater-status", e);
      }
    };
    try {
      // ─── Snap update flow ────────────────────────────────────────────────
      // Strategy: Try the local snapd REST API (requires snapd-control interface).
      // If that fails (interface not connected), fall back to the public Snap Store
      // HTTP API for a read-only version comparison.
      if (isUbuntuCoreSnap()) {
        const snapName = process.env.SNAP_NAME || "cluemaster-mediadisplay-core";
        const currentVersion = process.env.SNAP_VERSION || "unknown";
        send("checking");
        console.log(`UPDATER: Snap ${snapName} v${currentVersion} (rev ${process.env.SNAP_REVISION || "?"}) — checking for updates...`);

        // ── Step 1: Try snapd socket (full control) ──────────────────────
        const snapInfo = await snapdRequest("GET", `/v2/snaps/${encodeURIComponent(snapName)}`);

        if (snapInfo.ok && snapInfo.data?.result) {
          // snapd-control is working — we have full access
          console.log("UPDATER: snapd-control connected, checking for available refresh...");

          // Ask snapd to check for a refresh for this specific snap
          const refreshCheck = await snapdRequest("POST", "/v2/snaps", {
            action: "refresh",
            snaps: [snapName],
          }, 60000);

          if (refreshCheck.ok && refreshCheck.data?.change) {
            // Refresh initiated — snapd returned a change ID to track
            const changeId = refreshCheck.data.change;
            console.log(`UPDATER: Snap refresh started (change ${changeId}), tracking progress...`);

            send("available", { info: { version: "snap-update" } });
            send("download-progress", { percent: 0 });

            const result = await pollSnapdChange(changeId, (pct) => {
              send("download-progress", { percent: pct });
            });

            if (result.ok) {
              console.log("UPDATER: Snap refresh completed successfully");
              send("download-progress", { percent: 100 });
              send("downloaded", { info: { version: "snap-updated" } });
              // snapd will restart the daemon automatically after refresh
            } else {
              console.log(`UPDATER: Snap refresh failed: ${result.error}`);
              send("error", { message: `Snap refresh failed: ${result.error}` });
            }
            return { ok: result.ok, snap: true };

          } else if (refreshCheck.status === 400 && refreshCheck.data?.result?.message?.includes("snap has no updates")) {
            // snapd explicitly says no updates available
            console.log("UPDATER: Snap is up to date (snapd confirmed)");
            send("not-available", {
              message: "No updates available.",
              info: { version: currentVersion },
            });
            return { ok: true, snap: true };

          } else if (refreshCheck.data?.result?.message) {
            // Some other snapd response (e.g. "snap not installed")
            console.log(`UPDATER: snapd refresh response: ${refreshCheck.data.result.message}`);
            send("not-available", {
              message: refreshCheck.data.result.message,
              info: { version: currentVersion },
            });
            return { ok: true, snap: true };

          } else {
            console.log("UPDATER: Unexpected snapd response:", JSON.stringify(refreshCheck.data));
            send("not-available", {
              message: "Unable to check for updates via snapd",
              info: { version: currentVersion },
            });
            return { ok: false, snap: true };
          }

        } else {
          // ── Step 2: Fallback to Snap Store HTTP API (read-only) ───────
          console.log(`UPDATER: snapd-control not available (${snapInfo.error || "HTTP " + snapInfo.status}), falling back to Snap Store API...`);

          try {
            const storeResult = await checkSnapStoreUpdates();
            console.log("UPDATER: Snap Store check result:", JSON.stringify(storeResult));

            if (storeResult.error) {
              send("not-available", {
                message: `Unable to check for updates — snapd will handle updates automatically`,
                info: { version: currentVersion },
              });
            } else if (storeResult.updateAvailable) {
              console.log(`UPDATER: Snap update available: ${currentVersion} → ${storeResult.storeVersion} (${storeResult.channel})`);
              send("not-available", {
                message: `Update available (${storeResult.storeVersion}) — snapd will install automatically`,
                info: { version: storeResult.storeVersion },
              });
            } else {
              send("not-available", {
                message: "No updates available.",
                info: { version: currentVersion },
              });
            }
          } catch (e) {
            console.log("UPDATER: Snap Store fallback error:", e.message);
            send("not-available", {
              message: "Unable to check for updates — snapd will handle updates automatically",
              info: { version: currentVersion },
            });
          }
          return { ok: true, snap: true };
        }
      }

      // Windows: use electron-updater
      // allow forcing update checks while running unpacked (dev) for testing
      const forceDev = opts && opts.forceDev;
      const allowQuitInDev = opts && opts.allowQuit;

      // If not packaged and not forcing dev updates, forward a not-available/skipped message
      if (!app.isPackaged && !forceDev) {
        send("not-available", { message: "Skip checkForUpdates because application is not packed and dev update config is not forced" });
        return { ok: false, skipped: true };
      }

      // If running in dev and forceDev is true, simulate update events so UI can be tested
      if (!app.isPackaged && forceDev) {
        (async () => {
          send("checking");
          await new Promise((r) => setTimeout(r, 300));
          send("available", { info: { version: "dev-test" } });
          // simulate download progress
          for (let p = 0; p <= 100; p += 7) {
            send("download-progress", { percent: p, transferred: Math.floor(p * 1000), total: 100000 });
            // small delay
            // eslint-disable-next-line no-await-in-loop
            await new Promise((r) => setTimeout(r, 120));
          }
          send("downloaded", { info: { version: "dev-test" } });
          // In dev we don't actually quit/install unless explicitly allowed
          if (allowQuitInDev) {
            try {
              autoUpdater.quitAndInstall(true, true);
            } catch (e) {
              send("error", { message: e && e.message ? e.message : String(e) });
            }
          }
        })();

        return { ok: true, simulated: true };
      }

      // Normal packaged behavior
      autoUpdater.autoDownload = true;
      console.log("UPDATER: app version", app.getVersion());
      console.log(`UPDATER: starting update check for ${isDevBuild ? 'DEV' : 'PROD'} build (repo: ${UPDATE_REPO})`);

      // If a GitHub token is provided, add it to request headers (may help with organization rate limits)
      const ghToken = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
      if (ghToken) {
        autoUpdater.requestHeaders = Object.assign({}, autoUpdater.requestHeaders || {}, { Authorization: `token ${ghToken}` });
        console.log("UPDATER: Using GitHub token for authenticated requests");
      }

      // Manual GitHub latest release diagnostic fetch (bypasses electron-updater logic)
      let apiVersionInfo = null;
      try {
        const resp = await fetch(`https://api.github.com/repos/ClueMaster-LLC/${UPDATE_REPO}/releases/latest`, {
          headers: {
            Accept: "application/vnd.github+json",
            "Cache-Control": "no-cache"
          }
        });
        if (resp.ok) {
          apiVersionInfo = await resp.json();
          const assetNames = (apiVersionInfo.assets || []).map(a => a.name);
          console.log("UPDATER: GitHub API latest tag:", apiVersionInfo.tag_name, "name:", apiVersionInfo.name);
          console.log("UPDATER: GitHub latest assets:", assetNames.join(", "));
          send("diagnostic", { apiTag: apiVersionInfo.tag_name, apiAssets: assetNames });
        } else {
          console.log("UPDATER: GitHub API latest release fetch failed. Status:", resp.status);
          send("diagnostic", { apiErrorStatus: resp.status });
        }
      } catch (e) {
        console.log("UPDATER: GitHub API fetch error", e);
        send("diagnostic", { apiFetchError: e && e.message ? e.message : String(e) });
      }

      // Remove previous listeners to avoid duplicate events
      autoUpdater.removeAllListeners();

      // Extra diagnostic: list all releases to confirm ordering and presence of latest tag
      try {
        const releasesResp = await fetch(`https://api.github.com/repos/ClueMaster-LLC/${UPDATE_REPO}/releases`, { headers: { Accept: "application/vnd.github+json", "Cache-Control": "no-cache" } });
        if (releasesResp.ok) {
          const releases = await releasesResp.json();
          const tags = releases.map(r => r.tag_name).join(", ");
          console.log("UPDATER: Release tags (GitHub order):", tags);
          send("diagnostic", { releaseTags: releases.map(r => r.tag_name) });
        } else {
          console.log("UPDATER: Releases list fetch failed status", releasesResp.status);
          send("diagnostic", { releasesStatus: releasesResp.status });
        }
      } catch (e) {
        console.log("UPDATER: Releases fetch error", e);
        send("diagnostic", { releasesError: e && e.message ? e.message : String(e) });
      }

      autoUpdater.on("checking-for-update", () => send("checking"));
      autoUpdater.on("update-available", (info) => {
        console.log("UPDATE AVAILABLE - Version from GitHub:", info.version);
        send("available", { info });
      });
      autoUpdater.on("update-not-available", (info) => {
        console.log("NO UPDATE - Latest version on GitHub:", info.version);
        send("not-available", { info });
      });
      autoUpdater.on("error", (err) => send("error", { message: err && err.message ? err.message : String(err) }));
      autoUpdater.on("error", (err) => {
        try {
          console.log("UPDATER ERROR full object:", err);
          console.log("UPDATER ERROR stack:", err && err.stack);
          console.log("UPDATER CONFIG: appVersion=", app.getVersion());
          console.log("UPDATER CONFIG: requestHeaders=", autoUpdater.requestHeaders);
        } catch (eLog) {
          console.log("UPDATER: failed extra error logging", eLog);
        }
        send("error", { message: err && err.message ? err.message : String(err) });
      });
      autoUpdater.on("download-progress", (progress) => {
        const percent = Math.floor(progress.percent || 0);
        send("download-progress", { percent, bytesPerSecond: progress.bytesPerSecond, transferred: progress.transferred, total: progress.total });
      });
      autoUpdater.on("update-downloaded", (info) => {
        send("downloaded", { info });
        // Short delay so renderer UI can update before quitting
        setTimeout(() => {
          try {
            autoUpdater.quitAndInstall(true, true);
          } catch (e) {
            send("error", { message: e && e.message ? e.message : String(e) });
          }
        }, 400);
      });

      // Execute the actual update check
      try {
        console.log("UPDATER: invoking autoUpdater.checkForUpdates()");
        const result = await autoUpdater.checkForUpdates();
        if (result && result.updateInfo) {
          console.log("UPDATER: checkForUpdates returned updateInfo.version=", result.updateInfo.version);
        } else {
          console.log("UPDATER: checkForUpdates returned no updateInfo object");
        }
      } catch (e) {
        console.log("UPDATER: checkForUpdates threw error", e);
        send("error", { message: e && e.message ? e.message : String(e) });
      }

      await autoUpdater.checkForUpdates();
      return { ok: true };
    } catch (e) {
      send("error", { message: e && e.message ? e.message : String(e) });
      return { ok: false, error: e && e.message ? e.message : String(e) };
    }
  });

  // window focus monitoring
  if (app.isPackaged) {
    let focusLostDetected = false;
    const focusCheckInterval = setInterval(() => {
      if (mainWindow && !mainWindow.isFocused() && !mainWindow.isDestroyed()) {
        focusLostDetected = true;
        mainWindow.setAlwaysOnTop(true, "screen-saver", 1);
        mainWindow.focus();
        mainWindow.setAlwaysOnTop(true, "screen-saver", 1);

        clearInterval(focusCheckInterval);
      } else if (focusLostDetected && mainWindow && mainWindow.isFocused()) {
        clearInterval(focusCheckInterval);
      }
    }, 50); // check every 50ms

    setTimeout(() => {
      clearInterval(focusCheckInterval);
    }, 8000);
  }

  // Background update check - once per day for long-running apps
  // Only use electron-updater for background checks on Windows (SNAP uses snap refresh)
  if (app.isPackaged && !isUbuntuCoreSnap()) {
    const CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    
    backgroundUpdateInterval = setInterval(async () => {
      try {
        console.log("UPDATER: Running daily background update check...");
        await autoUpdater.checkForUpdates();
      } catch (err) {
        console.log("UPDATER: Background check error:", err);
      }
    }, CHECK_INTERVAL);
    
    console.log("UPDATER: Daily background update check scheduled (every 24 hours)");
  } else if (app.isPackaged && isUbuntuCoreSnap()) {
    // Background snap update check — queries snapd every 6 hours and triggers
    // a refresh if available. Snapd restarts the daemon automatically after refresh.
    const SNAP_CHECK_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours
    backgroundUpdateInterval = setInterval(async () => {
      const snapName = process.env.SNAP_NAME;
      if (!snapName) return;
      try {
        console.log("UPDATER: Running background snap update check...");
        const refreshCheck = await snapdRequest("POST", "/v2/snaps", {
          action: "refresh",
          snaps: [snapName],
        }, 60000);

        if (refreshCheck.ok && refreshCheck.data?.change) {
          console.log(`UPDATER: Background snap refresh started (change ${refreshCheck.data.change})`);
          // Don't need to poll — snapd will restart the daemon when done
        } else if (refreshCheck.status === 400 && refreshCheck.data?.result?.message?.includes("snap has no updates")) {
          console.log("UPDATER: Background check — no updates available");
        } else {
          console.log("UPDATER: Background snap check response:", refreshCheck.data?.result?.message || refreshCheck.error || "unknown");
        }
      } catch (err) {
        console.log("UPDATER: Background snap check error:", err.message);
      }
    }, SNAP_CHECK_INTERVAL);
    console.log("UPDATER: Background snap update check scheduled (every 6 hours via snapd)");
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});


app.on("before-quit", async () => {
  console.log("APP: before-quit - cleaning up workers and intervals...");

  // Clear background update interval
  if (backgroundUpdateInterval) {
    clearInterval(backgroundUpdateInterval);
    backgroundUpdateInterval = null;
  }

  // Terminate workers if module loaded (belt-and-suspenders - close handler may have already done this)
  if (workersModule) {
    try {
      await workersModule.stopAllWorkers();
      console.log("APP: workers terminated successfully");
    } catch (err) {
      console.error("APP: error terminating workers:", err);
    }
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
