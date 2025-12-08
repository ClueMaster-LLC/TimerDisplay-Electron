import { ipcMain } from "electron";
import store from "./state.mjs";
import path from "path";
import fs from "fs";
import os from "os";
import { config as envConfig } from '../config/environment.mjs';

const homeDirectory = os.homedir();
const masterDirectory = path.join(homeDirectory, envConfig.productName);
const applicationData = path.join(masterDirectory, "application-data");
const BASE_MEDIA_DIRECTORY = path.join(applicationData, "media-files");

const getIdleMedia = () => {
  try {
    const roomMediaFilesDirectory = path.join(
      BASE_MEDIA_DIRECTORY,
      "room-media-files"
    );
    const imageFilesDirectory = path.join(
      roomMediaFilesDirectory,
      "idleScreen-media"
    );
    if (!fs.existsSync(imageFilesDirectory)) {
      return null;
    }
    const files = fs.readdirSync(imageFilesDirectory);
    if (files.length === 0) {
      return null;
    }
    const filePath = path.join(imageFilesDirectory, files[0]);
    const relativePath = path.relative(BASE_MEDIA_DIRECTORY, filePath);
    const mediaUrl = `media://local/${relativePath}`;

    const fileExtension = path.extname(files[0]).toLowerCase();
    const videoExtensions = [".mp4", ".webm", ".avi", ".mov", ".mkv", ".m4v"];
    const isVideo = videoExtensions.includes(fileExtension);

    return {
      url: mediaUrl,
      type: isVideo ? "video" : "image",
      filename: files[0],
    };
  } catch (error) {
    console.error("Idle: Error getting media:", error);
    return null;
  }
};

ipcMain.handle("idle:get-media", () => {
  const media = getIdleMedia();
  return media;
});
