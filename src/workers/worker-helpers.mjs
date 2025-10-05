import { parentPort } from "worker_threads";

function request(type, key, value) {
  return new Promise((resolve, reject) => {
    const id = Math.random().toString(36).slice(2);

    const listener = (message) => {
      if (message.id === id) {
        parentPort.off("message", listener);

        if (message.error) {
          reject(new Error(message.error));
        } else {
          resolve(message.value);
        }
      }
    };

    parentPort.on("message", listener);
    parentPort.postMessage({ id, type, key, value });

    setTimeout(() => {
      parentPort.off("message", listener);
      reject(new Error(`Worker: Timeout waiting for response to ${type}:${key}`));
    }, 5000);
  });
}

export const getStore = (key) => request("store:get", key);
export const setStore = (key, val) => request("store:set", key, val);
