import { parentPort } from "worker_threads";
import { getStore } from "./worker-helpers.mjs";
import { postDeviceAPI, downloadFilesRequestAPI } from "../backends/apis.mjs";
import axios from "axios";

let running = true;

async function run() {
  const deviceUniqueID = await getStore("uniqueCode");
  const apiToken = await getStore("APIToken");
  const deviceRequestAPIEndpoint = downloadFilesRequestAPI.replace(
    "{unique_code}",
    deviceUniqueID
  );

  const apiEndpointHeaders = {
    Authorization: `Basic ${deviceUniqueID}:${apiToken}`,
  };

  while (running) {
    try {
      const response = await axios.get(deviceRequestAPIEndpoint, {
        headers: apiEndpointHeaders,
        validateStatus: () => true,
      });
      if (response.status === 401) {
        console.log(
          "Worker: 401 client error. Resetting video player to auth screen"
        );
        parentPort.postMessage({ type: "event", event: "reset" });
      }

      console.log(response.data);
      if (response.data && typeof response.data === "object") {
        const deviceRequestID = response.data.DeviceRequestid;
        const requestID = response.data.RequestID;

        if (requestID === 6) {
          const postDeviceAPIEndpoint = postDeviceAPI
            .replace("{device_unique_code}", deviceUniqueID)
            .replace("{deviceRequestId}", deviceRequestID);
          const request = await axios.post(postDeviceAPIEndpoint, null, {
            headers: apiEndpointHeaders,
            validateStatus: () => true,
          });
          if (request.status == 200) {
            // console.log("Worker: Files updated, reloading");
            parentPort.postMessage({ type: "event", event: "syncRequest" });
          }
        }
      }
      // no connection erros and the try block was a success
      parentPort.postMessage({ type: "event", event: "connectionRestored" });
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
        parentPort.postMessage({ type: "event", event: "connectionError" });
      } else {
        // console.log("Worker: Update room error - ", error);
        parentPort.postMessage({ type: "event", event: "connectionRestored" });
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}

parentPort.on("message", (event) => {
  if (event.type === "stop") {
    running = false;
  }
});

run();
