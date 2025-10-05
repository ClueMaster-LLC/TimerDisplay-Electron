import { ipcMain } from "electron";
import store from "./state.mjs";
import path from "path";
import fs from "fs";
import os from "os";

const homeDirectory = os.homedir();
const masterDirectory = path.join(homeDirectory, "cluemaster-timer");
const applicationData = path.join(masterDirectory, "application-data");
const BASE_MEDIA_DIRECTORY = path.join(applicationData, "media-files");

const getIdleImage = () => {
  try {
    const roomMediaFilesDirectory = path.join(
      BASE_MEDIA_DIRECTORY,
      "room-media-files"
    );
    const imageFilesDirectory = path.join(
      roomMediaFilesDirectory,
      "image-files"
    );
    if (!fs.existsSync(imageFilesDirectory)) {
      return null;
    }
    const files = fs.readdirSync(imageFilesDirectory);
    if (files.length === 0) {
      return null;
    }
    const imagePath = path.join(imageFilesDirectory, files[0]);
    return `media://local/${imagePath}`;
  } catch (error) {
    console.error("Idle: Error getting image:", error);
    return null;
  }
};

ipcMain.handle("idle:get-image", () => {
  const images = getIdleImage();
  return images;
});
