import { exec } from "node:child_process";
import { app } from "electron";
import os from "node:os";

let shuttingDown = false;
let restarting = false;

function runCommand(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) return reject(error);
      resolve(stdout || stderr);
    });
  });
}

export async function shutdownDevice() {
  console.log("System: Trying to shutdown device ")
  if (shuttingDown) return;
  shuttingDown = true;

  try {
    if (os.platform() === "win32") {
      await runCommand("shutdown /s /f /t 0");
    } else {
      await runCommand("systemctl poweroff --force");
    }
  } catch (error) {
    console.error("System: Failed to shutdown:", error);
  } finally {
    app.quit();
  }
}

export async function restartDevice() {
  console.log("System: Trying to restart device ")
  if (restarting) return;
  restarting = true;

  try {
    if (os.platform() === "win32") {
      await runCommand("shutdown /r /t 0");
    } else {
      await runCommand("systemctl reboot --force");
    }
  } catch (error) {
    console.error("System : Failed to restart:", error);
  } finally {
    app.quit();
  }
}
