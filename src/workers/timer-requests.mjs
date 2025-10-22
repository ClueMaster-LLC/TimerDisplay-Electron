import { parentPort } from "worker_threads";
import axios from "axios";
import { getStore } from "./worker-helpers.mjs";
import { getTimerRequestAPI, postDeviceAPI } from "../backends/apis.mjs";

let running = true;

async function run() {
  const deviceUniqueID = await getStore("uniqueCode");
  const apiToken = await getStore("APIToken");
  const headers = { Authorization: `Basic ${deviceUniqueID}:${apiToken}` };

  while (running) {
    // console.log("Worker: Checking for timer requests");
    try {
      const getTimerRequestAPIEndpoint = getTimerRequestAPI.replace(
        "{}",
        deviceUniqueID
      );
      const response = await axios.get(getTimerRequestAPIEndpoint, {
        headers,
        validateStatus: () => true,
      });
      if (response.status === 401) {
        parentPort.postMessage({ type: "event", event: "reset" });
      }

      if (response.data && typeof response.data === "object") {
        const deviceRequestID = response.data.DeviceRequestid;

        // acknowledge timer requests
        const postDeviceAPIEndpoint = postDeviceAPI
          .replace("{device_unique_code}", deviceUniqueID)
          .replace("{deviceRequestId}", deviceRequestID);
        const request = await axios.post(postDeviceAPIEndpoint, null, {
          headers,
          validateStatus: () => true,
        });
        if (request.status === 200) {
          parentPort.postMessage({
            type: "event",
            component: "timer",
            action: "update",
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
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}

parentPort.on("message", (event) => {
  if (event.type === "stop") running = false;
});

run();
