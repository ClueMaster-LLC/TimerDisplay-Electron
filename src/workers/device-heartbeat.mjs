// heartbeat-worker.mjs
import { parentPort } from "worker_threads";
import { getStore } from "./worker-helpers.mjs";
import { postDeviceHeartBeatAPI } from "../backends/apis.mjs";
import axios from "axios";
import { spawn } from "node:child_process";
const si = await import("systeminformation");

let running = true;

function watchCpuUsage(callback) {
  const cp = spawn("typeperf", [
    "\\Processor Information(_Total)\\% Processor Utility",
    "-si",
    "1",
  ]);

  cp.stdout.on("data", (data) => {
    const lines = data.toString().trim().split(/\r?\n/);
    for (const line of lines) {
      if (!line || line.startsWith("\"(PDH-CSV")) continue;
      const parts = line.split(",");
      if (parts.length < 2) continue;

      const raw = parts[1].replace(/"/g, "");
      const value = parseFloat(raw);
      if (!isNaN(value)) {
        callback(Number(value.toFixed(1)));
      }
    }
  });

  cp.stderr.on("data", (data) => {
    console.error("CPU error:", data.toString());
  });

  cp.on("close", (code) => {
    console.log(`typeperf exited with code ${code}`);
  });

  return cp;
}

let latestCpuUsage = 0;
watchCpuUsage((cpu) => {
  latestCpuUsage = cpu;
});

async function run() {
  const deviceUniqueID = await getStore("uniqueCode");
  const apiToken = await getStore("APIToken");
  const apiEndpointHeaders = {
    Authorization: `Basic ${deviceUniqueID}:${apiToken}`,
  };

  while (running) {
    try {
      // get network iface
      const ifaces = await si.networkInterfaces();
      const iface = ifaces.find(
        (i) => i.operstate === "up" && i.speed > 0
      );

      let averageNetworkUsage = 0;
      if (iface) {
        const net1 = await si.networkStats(iface.iface);
        await new Promise((r) => setTimeout(r, 1000));
        const net2 = await si.networkStats(iface.iface);

        const bytesSent = net2[0].tx_bytes - net1[0].tx_bytes;
        const bytesRecv = net2[0].rx_bytes - net1[0].rx_bytes;
        const totalBits = (bytesSent + bytesRecv) * 8;
        const bitsPerSec = totalBits; // already 1 second diff
        averageNetworkUsage = Number(
          Math.min(
            (bitsPerSec / (iface.speed * 1_000_000)) * 100,
            100
          ).toFixed(1)
        );
      }

      // memory usage
      const mem = await si.mem();
      const averageMemoryUsage = Number(
        ((mem.active / mem.total) * 100).toFixed(1)
      );

      // console.log('CPU Usage : ', latestCpuUsage)

      const deviceHeartbeatAPIEndpoint = postDeviceHeartBeatAPI
        .replace("{device_id}", deviceUniqueID)
        .replace("{cpu_avg}", latestCpuUsage)
        .replace("{memory_avg}", averageMemoryUsage)
        .replace("{network_avg}", averageNetworkUsage);

      const request = await axios.post(deviceHeartbeatAPIEndpoint, null, {
        headers: apiEndpointHeaders,
        validateStatus: () => true,
      });

      if (request.status === 401) {
        console.log("Worker: 401 client error. Resetting video player to auth screen");
        parentPort.postMessage({ type: "event", event: "reset" });
      }

      if (request.status !== 200 && request.status !== 401) {
        console.log(
          "Worker: Error uploading device heartbeat details - ",
          request.status
        );
      }

      parentPort.postMessage({ type: "event", event: "connectionRestored" });

      await new Promise((resolve) => setTimeout(resolve, 9000)); // total ~10s loop
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
        parentPort.postMessage({ type: "event", event: "connectionError" });
      } else {
        console.log("Worker: Update room error - ", error);
        parentPort.postMessage({ type: "event", event: "connectionRestored" });
      }
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
  }
}

parentPort.on("message", (event) => {
  if (event.type === "stop") {
    running = false;
  }
});

run();
