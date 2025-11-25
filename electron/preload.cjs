const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("SplashBackend", {
  worker: () => ipcRenderer.invoke("splash:worker"),
  getVersion: () => ipcRenderer.invoke("splash:get-version"),
  getLocalIP: () => ipcRenderer.invoke("splash:get-local-ip"),
  authenticate: (callback) => {
    const listener = (_event, data) => {
      callback(data.authenticate);
    };
    ipcRenderer.on("splash", listener);
    return () => {
      ipcRenderer.removeListener("splash", listener);
    };
  },
});

contextBridge.exposeInMainWorld("AuthenticationBackend", {
  worker: () => ipcRenderer.invoke("auth:worker"),
  getDeviceID: () => ipcRenderer.invoke("auth:get-device-code"),
  getLocalIP: () => ipcRenderer.invoke("auth:get-local-ip"),
  onStatusEvent: (callback) => {
    const listener = (_event, data) => {
      callback(data);
    };
    ipcRenderer.on("auth:status", listener);
    return () => {
      ipcRenderer.removeListener("auth:status", listener);
    };
  },
  onLoadingProgressEvent: (callback) => {
    const listener = (_event, data) => {
      callback(data);
    };
    ipcRenderer.on("auth:progress", listener);
    return () => {
      ipcRenderer.removeListener("auth:progress", listener);
    };
  },
  onAuthEvent: (callback) => {
    const listener = (_event, data) => {
      callback(data);
    };
    ipcRenderer.on("auth:auth", listener);
    return () => {
      ipcRenderer.removeListener("auth:auth", listener);
    };
  },
});

contextBridge.exposeInMainWorld("LoadingBackend", {
  worker: () => ipcRenderer.invoke("loading:worker"),
  onLoadingStatusEvent: (callback) => {
    const listener = (_event, data) => {
      callback(data);
    };
    ipcRenderer.on("loading:status", listener);
    return () => {
      ipcRenderer.removeListener("loading:status", listener);
    };
  },
  onLoadingProgressEvent: (callback) => {
    const listener = (_event, data) => {
      callback(data);
    };
    ipcRenderer.on("loading:progress", listener);
    return () => {
      ipcRenderer.removeListener("loading:progress", listener);
    };
  },
  onLoadingSuccessEvent: (callback) => {
    const listener = (_event, data) => {
      callback(data);
    };
    ipcRenderer.on("loading:success", listener);
    return () => {
      ipcRenderer.removeListener("loading:success", listener);
    };
  },
});

contextBridge.exposeInMainWorld("IdleBackend", {
  getMedia: () => ipcRenderer.invoke("idle:get-media"),
});

contextBridge.exposeInMainWorld("GameBackend", {
  getIntroVideo: () => ipcRenderer.invoke("game:get-intro-video"),
  getMainVideo: () => ipcRenderer.invoke("game:get-main-video"),
  getEndVideo: () => ipcRenderer.invoke("game:get-end-video"),
  getBackgroundMusic: () => ipcRenderer.invoke("game:get-background-music"),
  getCustomClueAlertAudio: () =>
    ipcRenderer.invoke("game:get-custom-clue-alert-audio"),
  introPostRequest: () => ipcRenderer.invoke("game:intro-post-request"),
  getClueMedia: (clueData) =>
    ipcRenderer.invoke("game:get-clue-media", clueData),
  postClueStatus: (gameId, clueId) =>
    ipcRenderer.invoke("game:post-clue-status", gameId, clueId),
  getRoomInfo: () => ipcRenderer.invoke("game:get-room-info"),
});

contextBridge.exposeInMainWorld("WorkersBackend", {
  start: (workers) => ipcRenderer.invoke("workers:start", workers),
  stop: (workers) => ipcRenderer.invoke("workers:stop", workers),
  onWorkerEvent: (callback) => {
    const listener = (_event, message) => {
      callback(message);
    };
    ipcRenderer.on("workers:event", listener);
    return () => {
      ipcRenderer.removeListener("workers:event", listener);
    };
  },
});

contextBridge.exposeInMainWorld("StoreBackend", {
  get: (key) => ipcRenderer.invoke("store:get", key),
  set: (key, value) => ipcRenderer.invoke("store:set", key, value),
  getAll: () => ipcRenderer.invoke("store:get-all"),
  onChange: (callback) => {
    const listener = (_event, { key, value }) => {
      callback(key, value);
    };
    ipcRenderer.on("store:change", listener);
    return () => {
      ipcRenderer.removeListener("store:change", listener);
    };
  },
});

// Updater API: allows renderer to request update checks and receive update events
contextBridge.exposeInMainWorld("UpdaterBackend", {
  checkForUpdates: (opts) => ipcRenderer.invoke("app-check-for-updates", opts),
  onUpdateEvent: (callback) => {
    const listener = (_event, payload) => {
      callback(payload);
    };
    ipcRenderer.on("updater-status", listener);
    return () => {
      ipcRenderer.removeListener("updater-status", listener);
    };
  },
});
