import { app, BrowserWindow, Menu, protocol, session, screen } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import os from "os";
import mime from "mime";

const homeDirectory = os.homedir();
const masterDirectory = path.join(homeDirectory, "cluemaster-timer");
const applicationData = path.join(masterDirectory, "application-data");
const BASE_MEDIA_DIRECTORY = path.join(applicationData, "media-files");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let mainWindow = null;
let _cursorHideKey = null;
let _cursorShowKey = null;

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
          .catch(() => {});
        _cursorShowKey = null;
      }
      mainWindow.webContents
        .insertCSS("* { cursor: none !important; }")
        .then((k) => {
          _cursorHideKey = k;
        })
        .catch(() => {});
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
              .catch(() => {});
            _cursorHideKey = null;
          }
          if (!_cursorShowKey) {
            mainWindow.webContents
              .insertCSS("* { cursor: default !important; }")
              .then((k) => {
                _cursorShowKey = k;
              })
              .catch(() => {});
          }
        } else {
          mainWindow.setKiosk(true);
          mainWindow.setFullScreen(true);
          mainWindow.setAlwaysOnTop(true, "screen-saver", 1);
          // hide cursor when entering fullscreen/kiosk: remove any show CSS and insert hide
          if (_cursorShowKey) {
            mainWindow.webContents
              .removeInsertedCSS(_cursorShowKey)
              .catch(() => {});
            _cursorShowKey = null;
          }
          mainWindow.webContents
            .insertCSS("* { cursor: none !important; }")
            .then((k) => {
              _cursorHideKey = k;
            })
            .catch(() => {});
        }
      }
    });

    // also respond to native fullscreen events and HTML5 fullscreen
    mainWindow.on("enter-full-screen", () => {
      mainWindow.setAlwaysOnTop(true, "screen-saver", 1);
      if (_cursorShowKey) {
        mainWindow.webContents
          .removeInsertedCSS(_cursorShowKey)
          .catch(() => {});
        _cursorShowKey = null;
      }
      if (!_cursorHideKey)
        mainWindow.webContents
          .insertCSS("* { cursor: none !important; }")
          .then((k) => {
            _cursorHideKey = k;
          })
          .catch(() => {});
    });

    mainWindow.on("leave-full-screen", () => {
      mainWindow.setAlwaysOnTop(false);
      if (_cursorHideKey) {
        mainWindow.webContents
          .removeInsertedCSS(_cursorHideKey)
          .catch(() => {});
        _cursorHideKey = null;
      }
      if (!_cursorShowKey) {
        mainWindow.webContents
          .insertCSS("* { cursor: default !important; }")
          .then((k) => {
            _cursorShowKey = k;
          })
          .catch(() => {});
      }
    });

    mainWindow.on("enter-html-full-screen", () => {
      mainWindow.setAlwaysOnTop(true, "screen-saver", 1);
      if (_cursorShowKey) {
        mainWindow.webContents
          .removeInsertedCSS(_cursorShowKey)
          .catch(() => {});
        _cursorShowKey = null;
      }
      if (!_cursorHideKey)
        mainWindow.webContents
          .insertCSS("* { cursor: none !important; }")
          .then((k) => {
            _cursorHideKey = k;
          })
          .catch(() => {});
    });

    mainWindow.on("leave-html-full-screen", () => {
      mainWindow.setAlwaysOnTop(false);
      if (_cursorHideKey) {
        mainWindow.webContents
          .removeInsertedCSS(_cursorHideKey)
          .catch(() => {});
        _cursorHideKey = null;
      }
      if (!_cursorShowKey) {
        mainWindow.webContents
          .insertCSS("* { cursor: default !important; }")
          .then((k) => {
            _cursorShowKey = k;
          })
          .catch(() => {});
      }
    });

    // also ensure cursor is restored when leaving maximized/windowed states
    mainWindow.on("unmaximize", () => {
      mainWindow.setAlwaysOnTop(false);
      if (_cursorHideKey) {
        mainWindow.webContents
          .removeInsertedCSS(_cursorHideKey)
          .catch(() => {});
        _cursorHideKey = null;
      }
      if (!_cursorShowKey) {
        mainWindow.webContents
          .insertCSS("* { cursor: default !important; }")
          .then((k) => {
            _cursorShowKey = k;
          })
          .catch(() => {});
      }
    });

    mainWindow.on("restore", () => {
      mainWindow.setAlwaysOnTop(false);
      if (_cursorHideKey) {
        mainWindow.webContents
          .removeInsertedCSS(_cursorHideKey)
          .catch(() => {});
        _cursorHideKey = null;
      }
      if (!_cursorShowKey) {
        mainWindow.webContents
          .insertCSS("* { cursor: default !important; }")
          .then((k) => {
            _cursorShowKey = k;
          })
          .catch(() => {});
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
    await import("../src/workers/workers.mjs");

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

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
