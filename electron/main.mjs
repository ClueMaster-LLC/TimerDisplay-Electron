import { app, BrowserWindow, Menu, protocol, session, screen, ipcMain } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import os from "os";
import mime from "mime";
import { exec } from "child_process";
import { promisify } from "util";
// electron-updater is a CommonJS module; import default and destructure
import updaterPkg from "electron-updater";
const { autoUpdater } = updaterPkg;

const execAsync = promisify(exec);

// Rely on electron-builder publish config in package.json; remove manual feed overrides.
autoUpdater.allowDowngrade = true;

const homeDirectory = os.homedir();
const masterDirectory = path.join(homeDirectory, "cluemaster-timer");
const applicationData = path.join(masterDirectory, "application-data");
const BASE_MEDIA_DIRECTORY = path.join(applicationData, "media-files");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let mainWindow = null;
let _cursorHideKey = null;
let _cursorShowKey = null;
let workersModule = null;

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

function createWindow() {
  const isDev = !app.isPackaged;
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  if (isDev) {
    mainWindow = new BrowserWindow({
      show: false,
      frame: true,
      resizable: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true,
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
  } else {
    mainWindow = new BrowserWindow({
      width,
      height,
      frame: true,
      resizable: true,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true,
        preload: path.join(__dirname, "preload.cjs"),
      },
    });

    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));

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

// hardware acceleration flags
app.commandLine.appendSwitch("ignore-gpu-blocklist");
app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("enable-zero-copy");
app.commandLine.appendSwitch("enable-native-gpu-memory-buffers");
app.commandLine.appendSwitch("enable-accelerated-video-decode");
app.commandLine.appendSwitch("force_high_performance_gpu");

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
      const source = url.hostname; // 'local' or 'external'
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
      } else if (source === "external") {
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
    const stateModule = await import("../src/backends/state.mjs");
    const store = stateModule.default;

    const uniqueCode = store.get("uniqueCode");
    const apiToken = store.get("APIToken");

    store.clear();

    if (uniqueCode) store.set("uniqueCode", uniqueCode);
    if (apiToken) store.set("APIToken", apiToken);

    await import("../src/backends/splash.mjs");
    workersModule = await import("../src/workers/workers.mjs");

    setTimeout(async () => {
      await import("../src/backends/authentication.mjs");
      await import("../src/backends/loading.mjs");
      await import("../src/backends/idle.mjs");
      await import("../src/backends/game.mjs");
    }, 500);
  } catch (error) {
    console.error("Failed to load backend:", error);
  }

  // remove default menu bar completely
  // Menu.setApplicationMenu(null);

  createWindow();

  // Helper function to detect if running on Ubuntu Core with snap
  const isUbuntuCoreSnap = () => {
    const platform = os.platform();
    if (platform !== "linux") return false;
    // Check if SNAP environment variable is set (indicates running as snap)
    return !!process.env.SNAP;
  };

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
      // If running on Ubuntu Core as snap, use snapd refresh instead of electron-updater
      if (isUbuntuCoreSnap()) {
        send("checking");
        try {
          // Get snap name from SNAP_NAME environment variable
          const snapName = process.env.SNAP_NAME || "cluemaster-timer";
          console.log("UPDATER: Running on Ubuntu Core snap, checking for snap updates:", snapName);

          // Check if our specific snap has updates available (doesn't trigger updates)
          const { stdout: refreshList } = await execAsync("snap refresh --list");
          console.log("UPDATER: Available snap updates:", refreshList);

          if (refreshList && refreshList.includes(snapName)) {
            // Update available for our snap
            send("available", { info: { version: "snap-update" } });
            send("download-progress", { percent: 0 });

            // Trigger snap refresh for our specific snap only (snapd handles download and install)
            console.log("UPDATER: Snap update available, triggering refresh for", snapName);
            const refreshProcess = exec(`snap refresh ${snapName}`);

            // Monitor progress (snap doesn't provide detailed progress, simulate it)
            let progress = 0;
            const progressInterval = setInterval(() => {
              progress = Math.min(progress + 10, 90);
              send("download-progress", { percent: progress });
            }, 500);

            refreshProcess.on("close", (code) => {
              clearInterval(progressInterval);
              if (code === 0) {
                send("download-progress", { percent: 100 });
                send("downloaded", { info: { version: "snap-updated" } });
                // Snap will restart the app automatically
                console.log("UPDATER: Snap refresh completed successfully");
              } else {
                send("error", { message: `Snap refresh failed with code ${code}` });
              }
            });

            return { ok: true, snap: true };
          } else {
            // No updates available for our snap
            console.log("UPDATER: No snap updates available for", snapName);
            send("not-available", { info: { version: "current" } });
            return { ok: true, snap: true };
          }
        } catch (e) {
          console.log("UPDATER: Snap refresh check error", e);
          send("error", { message: e && e.message ? e.message : String(e) });
          return { ok: false, snap: true, error: e && e.message ? e.message : String(e) };
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
      console.log("UPDATER: starting update check using embedded publish config (repo: TimerDisplay-Updates)");

      // If a GitHub token is provided, add it to request headers (may help with organization rate limits)
      const ghToken = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
      if (ghToken) {
        autoUpdater.requestHeaders = Object.assign({}, autoUpdater.requestHeaders || {}, { Authorization: `token ${ghToken}` });
        console.log("UPDATER: Using GitHub token for authenticated requests");
      }

      // Manual GitHub latest release diagnostic fetch (bypasses electron-updater logic)
      let apiVersionInfo = null;
      try {
        const resp = await fetch("https://api.github.com/repos/ClueMaster-LLC/TimerDisplay-Updates/releases/latest", {
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
        const releasesResp = await fetch("https://api.github.com/repos/ClueMaster-LLC/TimerDisplay-Updates/releases", { headers: { Accept: "application/vnd.github+json", "Cache-Control": "no-cache" } });
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

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});


app.on("before-quit", async (e) => {
  if (workersModule) {
    e.preventDefault();
    await workersModule.stopAllWorkers();
    workersModule = null;
    app.quit();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
