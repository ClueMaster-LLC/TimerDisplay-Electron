import { parentPort } from "worker_threads";
import axios from "axios";
import { getStore, setStore } from "./worker-helpers.mjs";
import { gameDetailsAPI } from "../backends/apis.mjs";

let running = true;

async function run() {
  const deviceUniqueID = await getStore("uniqueCode");
  const apiToken = await getStore("APIToken");
  const headers = { Authorization: `Basic ${deviceUniqueID}:${apiToken}` };

  while (running) {
    // console.log("Worker: Fetching game info");
    try {
      const gameDetailsAPIEndpoint = gameDetailsAPI.replace(
        "{}",
        deviceUniqueID
      );
      const response = await axios.get(gameDetailsAPIEndpoint, {
        headers,
        validateStatus: () => true,
        timeout: 2500,
      });
      if (response.status === 401) {
        parentPort.postMessage({ type: "event", event: "reset" });
      }
      if (response.data) {
        const gameStatus = response.data.gameStatus;
        const cluesUsed = response.data.noOfCluesUsed;
        const currentGameInfo = await getStore("gameInfo");

        // check if gameEndDateTime changed
        const oldEndTime = currentGameInfo?.gameEndDateTime;
        const newEndTime = response.data.gameEndDateTime;

        if (oldEndTime !== newEndTime) {
          console.log("WORKER: gameEndDateTime CHANGED", {
            old: oldEndTime,
            new: newEndTime,
          });
        }

        if (JSON.stringify(currentGameInfo) !== JSON.stringify(response.data)) {
          await setStore("gameInfo", response.data);
        } else {
          if (oldEndTime !== newEndTime) {
            console.log(
              "WORKER: gameEndDateTime changed but JSON.stringify blocked update! Forcing update..."
            );
            await setStore("gameInfo", response.data);
          }
        }

        if (cluesUsed !== null) {
          parentPort.postMessage({
            type: "event",
            component: "icons",
            used: cluesUsed,
          });
        }
        parentPort.postMessage({
          type: "event",
          component: "game",
          status: gameStatus,
        });
      }
      parentPort.postMessage({ type: "event", event: "connectionRestored" });
    } catch (error) {
      if (
        error.code === "ECONNREFUSED" ||
        error.code === "ENOTFOUND" ||
        error.code === "ECONNABORTED" ||
        error.code === "ETIMEDOUT"
      ) {
        parentPort.postMessage({ type: "event", event: "connectionError" });
      } else {
        parentPort.postMessage({ type: "event", event: "connectionRestored" });
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

parentPort.on("message", (event) => {
  if (event.type === "stop") running = false;
});

run();
