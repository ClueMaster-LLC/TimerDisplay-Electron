import { exec, spawn } from "node:child_process";
import { app } from "electron";
import os from "node:os";

let shuttingDown = false;
let restarting = false;

// Detect SNAP environment (Ubuntu Core)
const isSnap = process.env.SNAP !== undefined;
const isWindows = os.platform() === "win32";
const isLinux = os.platform() === "linux";

function runCommand(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) return reject(error);
      resolve(stdout || stderr);
    });
  });
}

/**
 * Build a clean environment for D-Bus calls.
 * Removes session bus references to prevent "Unable to autolaunch" errors.
 * 
 * The wrapper.sh sets DBUS_SESSION_BUS_ADDRESS="unix:path=/dev/null" to suppress
 * Chromium D-Bus errors, but dbus-send/gdbus need a clean env to talk to the
 * system bus without getting confused by the fake session bus.
 */
function getCleanDbusEnv() {
  const cleanEnv = { ...process.env };
  
  // Disable session bus with a valid "disabled" address (not empty string)
  // Empty string causes "Could not parse server address" errors
  cleanEnv.DBUS_SESSION_BUS_ADDRESS = "disabled:";
  
  // Remove X11 display (not needed for system bus calls)
  delete cleanEnv.DISPLAY;
  
  // Do NOT set DBUS_SYSTEM_BUS_ADDRESS - let dbus-send/gdbus find it automatically
  // The default location /var/run/dbus/system_bus_socket is used
  delete cleanEnv.DBUS_SYSTEM_BUS_ADDRESS;
  
  return cleanEnv;
}

/**
 * Run a D-Bus power action using dbus-send.
 * dbus-send is the standard D-Bus command-line tool.
 * 
 * This mimics the Python dbus approach used in VideoPlayer-MPV:
 *   bus = dbus.SystemBus()
 *   bus_object = bus.get_object("org.freedesktop.login1", "/org/freedesktop/login1")
 *   bus_object.PowerOff(True, dbus_interface="org.freedesktop.login1.Manager")
 * 
 * @param {string} action - Either "PowerOff" or "Reboot"
 */
async function runDbusSendAction(action) {
  return new Promise((resolve, reject) => {
    // Try multiple possible paths for dbus-send
    const dbusSendPaths = [
      "dbus-send",                           // In PATH
      "/usr/bin/dbus-send",                  // Standard location
      `${process.env.SNAP}/usr/bin/dbus-send` // Snap location
    ].filter(Boolean);
    
    const args = [
      "--system",                            // Use system bus
      "--print-reply",                       // Print reply for debugging
      "--dest=org.freedesktop.login1",       // Destination service
      "/org/freedesktop/login1",             // Object path
      `org.freedesktop.login1.Manager.${action}`,  // Method
      "boolean:true"                         // interactive parameter
    ];
    
    console.log(`System: Attempting dbus-send ${action}...`);
    console.log(`System: dbus-send args: ${args.join(" ")}`);
    
    const tryPath = (pathIndex) => {
      if (pathIndex >= dbusSendPaths.length) {
        reject(new Error(`dbus-send ${action} failed: all paths exhausted`));
        return;
      }
      
      const dbusSendPath = dbusSendPaths[pathIndex];
      console.log(`System: Trying dbus-send at: ${dbusSendPath}`);
      
      const child = spawn(dbusSendPath, args, {
        stdio: ["ignore", "pipe", "pipe"],
        env: getCleanDbusEnv()
      });
      
      let stdout = "";
      let stderr = "";
      
      child.stdout.on("data", (data) => { stdout += data.toString(); });
      child.stderr.on("data", (data) => { stderr += data.toString(); });
      
      child.on("close", (code) => {
        if (code === 0) {
          console.log(`System: dbus-send ${action} succeeded:`, stdout.trim());
          resolve(stdout);
        } else {
          console.warn(`System: dbus-send at ${dbusSendPath} failed (exit ${code}): ${stderr.trim()}`);
          tryPath(pathIndex + 1);
        }
      });
      
      child.on("error", (error) => {
        console.warn(`System: Failed to spawn dbus-send at ${dbusSendPath}:`, error.message);
        tryPath(pathIndex + 1);
      });
    };
    
    tryPath(0);
  });
}

/**
 * Run a D-Bus power action using gdbus (GLib D-Bus tool).
 * 
 * @param {string} action - Either "PowerOff" or "Reboot"
 */
async function runGdbusAction(action) {
  return new Promise((resolve, reject) => {
    // Try multiple possible paths for gdbus
    const gdbusPaths = [
      "gdbus",                               // In PATH
      "/usr/bin/gdbus",                      // Standard location
      `${process.env.SNAP}/usr/bin/gdbus`    // Snap location
    ].filter(Boolean);
    
    const args = [
      "call",
      "--system",
      "--dest", "org.freedesktop.login1",
      "--object-path", "/org/freedesktop/login1",
      "--method", `org.freedesktop.login1.Manager.${action}`,
      "true"
    ];
    
    console.log(`System: Attempting gdbus ${action}...`);
    
    const tryPath = (pathIndex) => {
      if (pathIndex >= gdbusPaths.length) {
        reject(new Error(`gdbus ${action} failed: all paths exhausted`));
        return;
      }
      
      const gdbusPath = gdbusPaths[pathIndex];
      console.log(`System: Trying gdbus at: ${gdbusPath}`);
      
      const child = spawn(gdbusPath, args, {
        stdio: ["ignore", "pipe", "pipe"],
        env: getCleanDbusEnv()
      });
      
      let stdout = "";
      let stderr = "";
      
      child.stdout.on("data", (data) => { stdout += data.toString(); });
      child.stderr.on("data", (data) => { stderr += data.toString(); });
      
      child.on("close", (code) => {
        if (code === 0) {
          console.log(`System: gdbus ${action} succeeded:`, stdout.trim());
          resolve(stdout);
        } else {
          console.warn(`System: gdbus at ${gdbusPath} failed (exit ${code}): ${stderr.trim()}`);
          tryPath(pathIndex + 1);
        }
      });
      
      child.on("error", (error) => {
        console.warn(`System: Failed to spawn gdbus at ${gdbusPath}:`, error.message);
        tryPath(pathIndex + 1);
      });
    };
    
    tryPath(0);
  });
}

/**
 * Fallback: Try multiple methods to shutdown/reboot on Linux
 * Order of preference:
 * 1. dbus-send (standard D-Bus CLI tool, works in snaps with shutdown plug)
 * 2. gdbus (GLib D-Bus tool, also works in snaps)
 * 3. systemctl (works on standard Linux with polkit)
 * 4. poweroff/reboot commands (requires root)
 */
async function linuxPowerAction(action) {
  const dbusMethod = action === "shutdown" ? "PowerOff" : "Reboot";
  const systemctlCmd = action === "shutdown" ? "systemctl poweroff" : "systemctl reboot";
  const directCmd = action === "shutdown" ? "poweroff" : "reboot";
  
  console.log(`System: ========================================`);
  console.log(`System: Initiating Linux ${action}...`);
  console.log(`System: SNAP=${process.env.SNAP || 'not set'}`);
  console.log(`System: Checking system bus socket...`);
  
  // Check if system bus socket exists
  const fs = await import('fs');
  const socketPath = '/var/run/dbus/system_bus_socket';
  if (fs.existsSync(socketPath)) {
    console.log(`System: ✓ System bus socket found at ${socketPath}`);
  } else {
    console.log(`System: ✗ System bus socket NOT found at ${socketPath}`);
  }
  
  // Try dbus-send first (most reliable for snaps)
  try {
    console.log(`System: Method 1 - Attempting ${action} via dbus-send...`);
    await runDbusSendAction(dbusMethod);
    console.log(`System: dbus-send ${action} succeeded!`);
    return; // Success
  } catch (dbusSendError) {
    console.warn(`System: dbus-send ${action} failed:`, dbusSendError.message);
  }
  
  // Try gdbus second
  try {
    console.log(`System: Method 2 - Attempting ${action} via gdbus...`);
    await runGdbusAction(dbusMethod);
    console.log(`System: gdbus ${action} succeeded!`);
    return; // Success
  } catch (gdbusError) {
    console.warn(`System: gdbus ${action} failed:`, gdbusError.message);
  }
  
  // Fallback to systemctl
  try {
    console.log(`System: Method 3 - Attempting ${action} via systemctl...`);
    await runCommand(systemctlCmd);
    console.log(`System: systemctl ${action} succeeded!`);
    return; // Success
  } catch (systemctlError) {
    console.warn(`System: systemctl ${action} failed:`, systemctlError.message);
  }
  
  // Last resort: direct command
  try {
    console.log(`System: Method 4 - Attempting ${action} via direct command (${directCmd})...`);
    await runCommand(directCmd);
    console.log(`System: direct ${action} succeeded!`);
    return; // Success
  } catch (directError) {
    console.error(`System: All ${action} methods failed. Last error:`, directError.message);
    throw directError;
  }
}

export async function shutdownDevice() {
  console.log("System: Initiating device shutdown...");
  console.log(`System: Platform: ${os.platform()}, SNAP: ${isSnap}`);
  
  if (shuttingDown) {
    console.log("System: Shutdown already in progress, ignoring duplicate request");
    return;
  }
  shuttingDown = true;

  try {
    if (isWindows) {
      console.log("System: Windows detected, using shutdown.exe");
      await runCommand("shutdown /s /f /t 0");
    } else if (isLinux) {
      await linuxPowerAction("shutdown");
    } else {
      console.error("System: Unsupported platform for shutdown:", os.platform());
    }
  } catch (error) {
    console.error("System: Failed to shutdown device:", error);
    shuttingDown = false; // Reset flag on failure to allow retry
  } finally {
    // Quit the app after initiating shutdown
    // The OS will handle the actual power off
    console.log("System: Quitting application after shutdown request");
    app.quit();
  }
}

export async function restartDevice() {
  console.log("System: Initiating device restart...");
  console.log(`System: Platform: ${os.platform()}, SNAP: ${isSnap}`);
  
  if (restarting) {
    console.log("System: Restart already in progress, ignoring duplicate request");
    return;
  }
  restarting = true;

  try {
    if (isWindows) {
      console.log("System: Windows detected, using shutdown.exe /r");
      await runCommand("shutdown /r /t 0");
    } else if (isLinux) {
      await linuxPowerAction("reboot");
    } else {
      console.error("System: Unsupported platform for restart:", os.platform());
    }
  } catch (error) {
    console.error("System: Failed to restart device:", error);
    restarting = false; // Reset flag on failure to allow retry
  } finally {
    // Quit the app after initiating restart
    // The OS will handle the actual reboot
    console.log("System: Quitting application after restart request");
    app.quit();
  }
}
