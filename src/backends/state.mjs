import Store from "electron-store";
import { ipcMain } from "electron";
import { getMainWindow } from "../../electron/main.mjs";

// persistent electron store - python dictionary/json style
const electronStore = new Store();

const storeWrapper = {
  get: (key) => electronStore.get(key),
  has: (key) => electronStore.has(key),
  delete: (key) => electronStore.delete(key),
  clear: () => electronStore.clear(),
  onDidChange: (key, callback) => electronStore.onDidChange(key, callback),
  onDidAnyChange: (callback) => electronStore.onDidAnyChange(callback),

  // intercepting the electron-store set method to notify renderer
  set: (key, value) => {
    const result = electronStore.set(key, value);
    notifyStoreChange(key, value);
    return result;
  },
  get store() {
    return electronStore.store;
  },
  get path() {
    return electronStore.path;
  },
};

// notify renderer process of store changes
function notifyStoreChange(key, value) {
  const mainWindow = getMainWindow();
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send("store:change", { key, value });
  }
}

// allow access to electron-store from renderer
ipcMain.handle("store:get", (_event, key) => {
  return electronStore.get(key);
});

ipcMain.handle("store:get-all", () => {
  return electronStore.store;
});

export default storeWrapper;
