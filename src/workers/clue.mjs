import { parentPort } from "worker_threads";
import axios from "axios";
import { getStore, setStore } from "./worker-helpers.mjs";
import { gameClueAPI, postGameClueAPI } from "../backends/apis.mjs";

let running = true;

async function run() {
  const deviceUniqueID = await getStore("uniqueCode");
  const apiToken = await getStore("APIToken");
  const gameInfo = await getStore("gameInfo");
  const gameId = gameInfo?.gameId || null;
  const headers = { Authorization: `Basic ${deviceUniqueID}:${apiToken}` };

  while (running) {
    // console.log("Worker: Checking for game clues");
    try {
      if (gameId === null) return;
      const getGameClueAPIEndpoint = gameClueAPI.replace(
        "{initial_gameId}",
        gameId
      );
      const response = await axios.get(getGameClueAPIEndpoint, {
        headers,
        validateStatus: () => true,
      });
      if (response.status === 401) {
        parentPort.postMessage({ type: "event", event: "reset" });
      }
      if (response.data.hasOwnProperty("status") === false) {
        const clue = response.data;
        console.log("Worker: New clue received:", clue);
        const clueId = clue.gameClueId;
        // post request to acknowledge clue received
        const postGameClueAPIEndpoint = postGameClueAPI
          .replace("{gameId}", gameId)
          .replace("{gameClueId}", clueId);

        const request = await axios.post(postGameClueAPIEndpoint, null, {
          headers,
          validateStatus: () => true,
        });
        if (request.status === 200) {
          await setStore("clue", clue);
          parentPort.postMessage({
            type: "event",
            component: "clue",
            action: "show-hide",
          });
        }
      }
      parentPort.postMessage({ type: "event", event: "connectionRestored" });
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
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
