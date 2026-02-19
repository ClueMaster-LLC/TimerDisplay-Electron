/**
 * Screenshot Worker - Polls API for screenshot requests
 * When a request is detected, notifies main process to capture and upload
 */

import { parentPort } from "worker_threads";
import { getStore } from "./worker-helpers.mjs";
import { getScreenshotRequestAPI } from "../backends/apis.mjs";
import axios from "axios";

let running = true;
const POLL_INTERVAL = 5000; // 5 seconds

parentPort.on("message", (message) => {
  if (message.type === "stop") {
    running = false;
  }
});

async function run() {
  // Wait for credentials to be available
  let deviceUniqueID = await getStore("uniqueCode");
  let apiToken = await getStore("APIToken");

  while ((!deviceUniqueID || !apiToken) && running) {
    await new Promise((r) => setTimeout(r, 5000));
    deviceUniqueID = await getStore("uniqueCode");
    apiToken = await getStore("APIToken");
  }

  if (!running) return;

  const headers = { Authorization: `Basic ${deviceUniqueID}:${apiToken}` };
  const endpoint = getScreenshotRequestAPI.replace("{device_unique_code}", deviceUniqueID);

  while (running) {
    try {
      const response = await axios.get(endpoint, {
        headers,
        timeout: 10000,
        validateStatus: () => true,
      });

      if (response.status === 200 && response.data?.screenshotRequested) {
        console.log("Screenshot Worker: Capture requested by API");
        parentPort.postMessage({ type: "event", event: "captureRequested" });
      }
    } catch (error) {
      // Silent fail - network errors expected when offline
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
  }
}

run();
