import { Worker } from "worker_threads";
import { getMainWindow } from "../../electron/main.mjs";
import { ipcMain } from "electron";
import store from "../backends/state.mjs";
import { restartDevice, shutdownDevice } from "../backends/system.mjs";

let workers = {};

const createWorker = async (name, file) => {
  const worker = new Worker(new URL(`./${file}`, import.meta.url), {
    type: "module",
  });

  worker.on("message", (message) => {
    // console.log(`Main: ${name} worker event:`, message);
    if (message.type === "store:get") {
      const value = store.get(message.key);
      worker.postMessage({ id: message.id, value: value });
    } else if (message.type === "store:set") {
      store.set(message.key, message.value);
      worker.postMessage({ id: message.id, result: true });
    } else if (message.type === "event") {
      const window = getMainWindow();
      if (window && !window.isDestroyed()) {
        window.webContents.send("workers:event", { worker: name, ...message });
      }
    } else if (message.type === "system") {
      if (message.event === "restartRequest") {
        setTimeout(() => restartDevice(), 2500);
      } else if (message.event === "shutdownRequest") {
        setTimeout(() => shutdownDevice(), 2500);
      }
    }
  });

  worker.on("error", (error) => {
    console.error(`${name} worker error:`, error);
  });

  worker.on("exit", (code) => {
    console.log(`${name} worker exited with code`, code);
    delete workers[name];
  });

  workers[name] = worker;
};

const workerFiles = {
  updateRoom: "update-room.mjs",
  shutdownRestart: "shutdown-restart.mjs",
  deviceHeartBeat: "device-heartbeat.mjs",
  gameInfo: "game-info.mjs",
  clue: "clue.mjs",
  timerRequests: "timer-requests.mjs",
};

const startWorkers = async (workerNames) => {
  const names = Array.isArray(workerNames) ? workerNames : [workerNames];

  const startPromises = names.map(async (workerName) => {
    if (!workers[workerName] && workerFiles[workerName]) {
      await createWorker(workerName, workerFiles[workerName]);
      console.log(`${workerName} worker started.`);
      return workerName;
    } else if (workers[workerName]) {
      console.log(`${workerName} worker already running.`);
      return null;
    } else {
      console.warn(`Unknown worker: ${workerName}`);
      return null;
    }
  });

  const results = await Promise.all(startPromises);
  const started = results.filter((name) => name !== null);

  if (started.length > 0) {
    console.log(`Started workers: ${started.join(", ")}`);
  }

  return started;
};

const stopWorkers = async (workerNames) => {
  const names = Array.isArray(workerNames) ? workerNames : [workerNames];

  const stopPromises = names.map(async (workerName) => {
    const worker = workers[workerName];
    if (worker) {
      try {
        worker.postMessage({ type: "stop" });
        await new Promise((resolve) => setTimeout(resolve, 500)); // allow cleanup
        await worker.terminate();
        delete workers[workerName];
        console.log(`${workerName} worker stopped.`);
        return workerName;
      } catch (error) {
        console.error(`Error stopping ${workerName} worker:`, error);
        return null;
      }
    } else {
      console.log(`${workerName} worker not running.`);
      return null;
    }
  });

  const results = await Promise.all(stopPromises);
  const stopped = results.filter((name) => name !== null);

  if (stopped.length > 0) {
    console.log(`Stopped workers: ${stopped.join(", ")}`);
  }

  return stopped;
};

export const stopAllWorkers = async () => {
  await stopWorkers(Object.keys(workers));
};

ipcMain.handle("workers:start", async (event, workers) => {
  const started = await startWorkers(workers);
  return started;
});

ipcMain.handle("workers:stop", async (event, workers) => {
  const stopped = await stopWorkers(workers);
  return stopped;
});

ipcMain.handle("workers:get-override-media", (event, mediaID) => {
  console.log("Workers: Override media ID : ", mediaID, typeof mediaID);

  const mediaSequence = store.get("mediaSequence");
  const media = mediaSequence.filter((item) => item.id == mediaID);
  if (!media || media.length === 0) {
    console.log("Workers: Media not found for ID:", mediaID);
    return null;
  }
  return "media://local/" + media[0].file;
});
