import fs from "fs";
import path from "path";
import os from "os";
import { ipcMain } from "electron";
// Import drivelist safely - handle if it's not available
let drivelist = null;
import store from "../backends/state.mjs";
import { config as envConfig } from '../config/environment.mjs';

const SUPPORTED_MEDIA_EXTENSIONS = [
  ".mp4",
  ".mpg",
  ".mpeg",
  ".m4v",
  ".mkv",
  ".avi",
  ".png",
  ".mp3",
  ".wav",
  ".gif",
  ".jpg",
  ".jpeg",
];

const homeDirectory = os.homedir();
const masterDirectory = path.join(homeDirectory, envConfig.productName);
const applicationData = path.join(masterDirectory, "application-data");
const BASE_MEDIA_DIRECTORY = path.join(applicationData, "media-files");

const getDeviceIPv4Address = async () => {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return "127.0.0.1";
};

function collectAllFiles(directoryPath) {
  let results = [];
  try {
    const items = fs.readdirSync(directoryPath, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(directoryPath, item.name);
      if (item.isDirectory()) {
        results = results.concat(collectAllFiles(fullPath));
      } else {
        results.push(fullPath);
      }
    }
  } catch (error) {
    console.log(
      `Player - Collect all files error reading: ${directoryPath}`,
      error
    );
  }
  return results;
}

function filterSupportedFiles(files) {
  return files.filter((file) =>
    SUPPORTED_MEDIA_EXTENSIONS.some((ext) => file.toLowerCase().endsWith(ext))
  );
}

function getNumericPriority(filename) {
  const nameWithoutExt = path.basename(filename, path.extname(filename));
  const numericMatch = nameWithoutExt.match(/^(\d+)/);
  if (numericMatch) {
    return parseInt(numericMatch[1], 10);
  }
  return 999999;
}

function sortByNumericPriority(files) {
  return files.sort((a, b) => {
    const priorityA = getNumericPriority(a);
    const priorityB = getNumericPriority(b);
    return priorityA - priorityB;
  });
}

async function collectUsbMediaFiles() {
  try {
    // Try to load drivelist dynamically
    if (!drivelist) {
      try {
        const drivelistModule = await import("drivelist");
        drivelist = drivelistModule.default;
      } catch (error) {
        console.warn(
          "drivelist not available, skipping USB media detection:",
          error.message
        );
        return [];
      }
    }

    const drives = await drivelist.list();
    const usbRoots = [];

    drives.forEach((drive) => {
      if (
        drive.isUSB &&
        drive.isRemovable &&
        !drive.isSystem &&
        drive.mountpoints.length > 0
      ) {
        drive.mountpoints.forEach((mp) => usbRoots.push(path.resolve(mp.path)));
      }
    });

    let usbFiles = [];
    for (const usbRoot of usbRoots) {
      if (fs.existsSync(usbRoot)) {
        const files = collectAllFiles(usbRoot);
        usbFiles = usbFiles.concat(filterSupportedFiles(files));
      }
    }

    const formattedFiles = usbFiles.map((file) => {
      const driveRoot = path.parse(file).root;
      const driveName = driveRoot.replace(/[:\\]/g, ""); // → "X"
      const relativePath = path.relative(driveRoot, file);
      return `media://external/${driveName}/${relativePath}`;
    });

    return sortByNumericPriority(formattedFiles);
  } catch (error) {
    console.log("Player: Error collecting USB media files:", error);
    return [];
  }
}

function collectLocalMediaFiles() {
  let localFiles = [];
  try {
    const files = fs.readdirSync(BASE_MEDIA_DIRECTORY);
    localFiles = files.map((file) => path.join(BASE_MEDIA_DIRECTORY, file));
  } catch (error) {
    console.log("Player - Collect local media files error:", error);
  }

  let mediaSequence = [];
  try {
    const sequenceFilePath = path.join(
      masterDirectory,
      "device-configs",
      "media-sequences.json"
    );
    if (fs.existsSync(sequenceFilePath)) {
      const raw = fs.readFileSync(sequenceFilePath, "utf-8");
      const parsed = JSON.parse(raw);
      mediaSequence = Array.isArray(parsed.mediaSequence)
        ? parsed.mediaSequence
        : [];
    }
  } catch (error) {
    console.log("Player - Error reading media sequence file:", error);
  }

  const sequenceMap = new Map();
  for (const item of mediaSequence) {
    if (!item) continue;
    const nameRaw = typeof item.file === "string" ? item.file : null;
    if (!nameRaw) continue;
    const seqNum = Number(item.sequence);
    if (!Number.isFinite(seqNum)) continue;
    const basename = path.basename(nameRaw).toLowerCase();
    sequenceMap.set(basename, seqNum);
  }

  const formattedFiles = filterSupportedFiles(localFiles).map((absPath) => {
    const relative = path
      .relative(BASE_MEDIA_DIRECTORY, absPath)
      .split(path.sep)
      .join("/");
    const filename = path.basename(absPath);
    const seq =
      sequenceMap.get(filename.toLowerCase()) ?? Number.MAX_SAFE_INTEGER;
    return { url: `media://local/${relative}`, sequence: seq, filename };
  });

  formattedFiles.sort(
    (a, b) => a.sequence - b.sequence || a.filename.localeCompare(b.filename)
  );
  return formattedFiles.map((item) => item.url);
}

ipcMain.handle("player:get-media-assets", async () => {
  try {
    const localFiles = collectLocalMediaFiles();
    const usbFiles = await collectUsbMediaFiles();
    console.log(
      `Player: Found ${localFiles.length} local files and ${usbFiles.length} USB files`
    );

    const allMediaFiles = [...usbFiles, ...localFiles];

    if (allMediaFiles.length === 0) {
      console.log("Player - No media files found. Nothing to play.");
      return [];
    }

    console.log(
      `Player: Final playlist order - USB files: ${usbFiles.length}, Local files: ${localFiles.length}`
    );
    console.log("Player: All media files: ", allMediaFiles);
    return allMediaFiles;
  } catch (error) {
    console.error("Player: Error getting media assets:", error);
    return [];
  }
});

ipcMain.handle("player:read-file", async (_e, filePath) => {
  const _buffer = await fs.promises.readFile(filePath);
  return _buffer.buffer.slice(
    _buffer.byteOffset,
    _buffer.byteOffset + _buffer.byteLength
  );
});

ipcMain.handle("player:get-device-code", async () => {
  return store.get("uniqueCode") || "UNKNOWN";
});

ipcMain.handle("player:get-local-ip", async () => {
  return await getDeviceIPv4Address();
});
