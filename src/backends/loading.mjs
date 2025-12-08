import { getMainWindow } from "../../electron/main.mjs";
import {
  gameDetailsAPI,
  postDeviceDetailsUpdateAPI,
  roomInfoAPI,
} from "./apis.mjs";
import { ipcMain } from "electron";
import store from "./state.mjs";
import fs from "fs";
import path from "path";
import axios from "axios";
import os from "os";

import { createRequire } from "module";
import { config as envConfig } from '../config/environment.mjs';
const require = createRequire(import.meta.url);
const _package = require("../../package.json");

const homeDirectory = os.homedir();
const masterDirectory = path.join(homeDirectory, envConfig.productName);
const applicationData = path.join(masterDirectory, "application-data");
const configsDirectory = path.join(masterDirectory, "device-configs");

async function downloadFileStream(url, filePath, headers = {}) {
  const response = await axios.get(url, {
    responseType: "stream",
    headers,
  });

  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    writer.on("finish", () => resolve(filePath));
    writer.on("error", reject);
  });
}

ipcMain.handle("loading:worker", async () => {
  const deviceUniqueCode = store.get("uniqueCode");
  const apiKey = store.get("APIToken");
  const roomInfoAPIEndpoint = roomInfoAPI.replace(
    "{device_unique_code}",
    deviceUniqueCode
  );
  const apiEndpointHeader = {
    Authorization: `Basic ${deviceUniqueCode}:${apiKey}`,
  };

  while (true) {
    try {
      // confirming media files
      const window = getMainWindow();
      window.webContents.send("loading:status", {
        status: "Confirming media files download",
      });
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const roomInfoAPIRequest = await axios.get(roomInfoAPIEndpoint, {
        headers: apiEndpointHeader,
        validateStatus: () => true,
      });

      if (roomInfoAPIRequest.status !== 200) {
        throw new Error(`API Error: ${roomInfoAPIRequest.status}`);
      }

      if (roomInfoAPIRequest.data !== "No Configurations Files Found") {
        const roomMediaFilesDirectory = path.join(
          applicationData,
          "media-files",
          "room-media-files"
        );
        const musicFilesDirectory = path.join(
          roomMediaFilesDirectory,
          "music-files"
        );
        const imageFilesDirectory = path.join(
          roomMediaFilesDirectory,
          "idleScreen-media"
        );
        const videoFilesDirectory = path.join(
          roomMediaFilesDirectory,
          "gameBackground-media"
        );
        const introMediaDirectory = path.join(
          roomMediaFilesDirectory,
          "intro-media"
        );
        const successMediaDirectory = path.join(
          roomMediaFilesDirectory,
          "success-media"
        );
        const failMediaDirectory = path.join(
          roomMediaFilesDirectory,
          "fail-media"
        );
        const clueMediaDirectory = path.join(
          applicationData,
          "media-files",
          "clue-media-files"
        );
        const customClueMediaDirectory = path.join(
          roomMediaFilesDirectory,
          "custom-clue-media"
        );

        const roomInfoAPIData = roomInfoAPIRequest.data;
        const musicMediaFile = roomInfoAPIData.MusicPath;
        const imageMediaFile = roomInfoAPIData.PhotoPath;
        const videoMediaFile = roomInfoAPIData.VideoPath;
        const introMediaFile = roomInfoAPIData.IntroVideoPath;
        const successMediaFile = roomInfoAPIData.SuccessVideoPath;
        const failMediaFile = roomInfoAPIData.FailVideoPath;
        const clueMediaFiles = roomInfoAPIData.ClueMediaFiles;
        const customClueAlertMediaFile = roomInfoAPIData.TVClueAlertMusicPath;

        const totalFilesToDownload = clueMediaFiles.length + 6;
        window.webContents.send("loading:progress", {
          progress: null,
          progressMax: totalFilesToDownload,
        });

        // downloading room media files
        if (musicMediaFile !== null) {
          const fileName = musicMediaFile.split("/")[5].split("?X")[0];
          const file = path.join(musicFilesDirectory, fileName);
          if (fs.existsSync(file)) {
            console.log("Loading: Music file already exists");
            const allFiles = fs.readdirSync(musicFilesDirectory);
            for (const file of allFiles) {
              if (file !== fileName) {
                fs.unlinkSync(path.join(musicFilesDirectory, file));
              }
            }
          } else {
            await fs.promises.rm(musicFilesDirectory, {
              recursive: true,
              force: true,
            });
            await fs.promises.mkdir(musicFilesDirectory, { recursive: true });
            await downloadFileStream(
              musicMediaFile,
              path.join(musicFilesDirectory, fileName),
              apiEndpointHeader
            );
          }
        }
        window.webContents.send("loading:progress", {
          progress: true,
          progressMax: null,
        });

        if (imageMediaFile !== null) {
          const fileName = imageMediaFile.split("/")[5].split("?X")[0];
          const file = path.join(imageFilesDirectory, fileName);
          if (fs.existsSync(file)) {
            console.log("Loading: Image file already exists");
            const allFiles = fs.readdirSync(imageFilesDirectory);
            for (const file of allFiles) {
              if (file !== fileName) {
                fs.unlinkSync(path.join(imageFilesDirectory, file));
              }
            }
          } else {
            await fs.promises.rm(imageFilesDirectory, {
              recursive: true,
              force: true,
            });
            await fs.promises.mkdir(imageFilesDirectory, { recursive: true });
            await downloadFileStream(
              imageMediaFile,
              path.join(imageFilesDirectory, fileName),
              apiEndpointHeader
            );
          }
        }
        window.webContents.send("loading:progress", {
          progress: true,
          progressMax: null,
        });

        if (videoMediaFile !== null) {
          const fileName = videoMediaFile.split("/")[5].split("?X")[0];
          const file = path.join(videoFilesDirectory, fileName);
          if (fs.existsSync(file)) {
            console.log("Loading: Video file already exists");
            const allFiles = fs.readdirSync(videoFilesDirectory);
            for (const file of allFiles) {
              if (file !== fileName) {
                fs.unlinkSync(path.join(videoFilesDirectory, file));
              }
            }
          } else {
            await fs.promises.rm(videoFilesDirectory, {
              recursive: true,
              force: true,
            });
            await fs.promises.mkdir(videoFilesDirectory, { recursive: true });
            await downloadFileStream(
              videoMediaFile,
              path.join(videoFilesDirectory, fileName),
              apiEndpointHeader
            );
          }
        }
        window.webContents.send("loading:progress", {
          progress: true,
          progressMax: null,
        });

        if (introMediaFile !== null) {
          const fileName = introMediaFile.split("/")[5].split("?X")[0];
          const file = path.join(introMediaDirectory, fileName);
          if (fs.existsSync(file)) {
            console.log("Loading: Intro file already exists");
            const allFiles = fs.readdirSync(introMediaDirectory);
            for (const file of allFiles) {
              if (file !== fileName) {
                fs.unlinkSync(path.join(introMediaDirectory, file));
              }
            }
          } else {
            await fs.promises.rm(introMediaDirectory, {
              recursive: true,
              force: true,
            });
            await fs.promises.mkdir(introMediaDirectory, { recursive: true });
            await downloadFileStream(
              introMediaFile,
              path.join(introMediaDirectory, fileName),
              apiEndpointHeader
            );
          }
        }
        window.webContents.send("loading:progress", {
          progress: true,
          progressMax: null,
        });

        if (successMediaFile !== null) {
          const fileName = successMediaFile.split("/")[5].split("?X")[0];
          const file = path.join(successMediaDirectory, fileName);
          if (fs.existsSync(file)) {
            console.log("Loading: Success file already exists");
            const allFiles = fs.readdirSync(successMediaDirectory);
            for (const file of allFiles) {
              if (file !== fileName) {
                fs.unlinkSync(path.join(successMediaDirectory, file));
              }
            }
          } else {
            await fs.promises.rm(successMediaDirectory, {
              recursive: true,
              force: true,
            });
            await fs.promises.mkdir(successMediaDirectory, { recursive: true });
            await downloadFileStream(
              successMediaFile,
              path.join(successMediaDirectory, fileName),
              apiEndpointHeader
            );
          }
        }
        window.webContents.send("loading:progress", {
          progress: true,
          progressMax: null,
        });

        if (failMediaFile !== null) {
          const fileName = failMediaFile.split("/")[5].split("?X")[0];
          const file = path.join(failMediaDirectory, fileName);
          if (fs.existsSync(file)) {
            console.log("Loading: Fail file already exists");
            const allFiles = fs.readdirSync(failMediaDirectory);
            for (const file of allFiles) {
              if (file !== fileName) {
                fs.unlinkSync(path.join(failMediaDirectory, file));
              }
            }
          } else {
            await fs.promises.rm(failMediaDirectory, {
              recursive: true,
              force: true,
            });
            await fs.promises.mkdir(failMediaDirectory, { recursive: true });
            await downloadFileStream(
              failMediaFile,
              path.join(failMediaDirectory, fileName),
              apiEndpointHeader
            );
          }
        }
        window.webContents.send("loading:progress", {
          progress: true,
          progressMax: null,
        });

        if (customClueAlertMediaFile !== null) {
          const fileName = customClueAlertMediaFile
            .split("/")[5]
            .split("?X")[0];
          const file = path.join(customClueMediaDirectory, fileName);
          if (fs.existsSync(file)) {
            console.log("Loading: Custom clue alert file already exists");
            const allFiles = fs.readdirSync(customClueMediaDirectory);
            for (const file of allFiles) {
              if (file !== fileName) {
                fs.unlinkSync(path.join(customClueMediaDirectory, file));
              }
            }
          } else {
            await fs.promises.rm(customClueMediaDirectory, {
              recursive: true,
              force: true,
            });
            await fs.promises.mkdir(customClueMediaDirectory, {
              recursive: true,
            });
            await downloadFileStream(
              customClueAlertMediaFile,
              path.join(customClueMediaDirectory, fileName),
              apiEndpointHeader
            );
          }
        }

        // downloading clue media files
        const fileArray = [];
        for (const clue of clueMediaFiles) {
          const clueURL = clue.FilePath;
          if (clueURL !== null) {
            try {
              const parts = clueURL.split("/");
              if (parts.length < 6) continue;
              const fileName = parts[5].split("?X")[0];
              fileArray.push(fileName);
              const filePath = path.join(clueMediaDirectory, fileName);
              await downloadFileStream(clueURL, filePath, apiEndpointHeader);
              const window = getMainWindow();
              window.webContents.send("loading:progress", {
                progress: true,
                progressMax: null,
              });
            } catch (error) {
              console.log("Loading: Error downloading file : ", clueURL);
              console.log("Loading: Error - ", error.message);
            }
          } else {
            const window = getMainWindow();
            window.webContents.send("loading:progress", {
              progress: true,
              progressMax: null,
            });
          }
        }

        const allFiles = fs.readdirSync(clueMediaDirectory);
        for (const file of allFiles) {
          if (!fileArray.includes(file)) {
            fs.unlinkSync(path.join(clueMediaDirectory, file));
          }
        }
      }
      window.webContents.send("loading:status", {
        status: "Confirming room configurations",
      });
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const roomInfoAPIData = roomInfoAPIRequest.data;
      const roomConfig = {
        cluesAllowed: roomInfoAPIData.CluesAllowed,
        clueSize: roomInfoAPIData.ClueSizeOnScreen,
        maximumNumberOfClues: roomInfoAPIData.MaxNoOfClues,
        cluePositionVertical: roomInfoAPIData.CluePositionVertical,
        isTimeLimit: roomInfoAPIData.IsTimeLimit,
        timeLimit: roomInfoAPIData.TimeLimit,
        timeOverride: roomInfoAPIData.TimeOverride,
        isImage: roomInfoAPIData.IsPhoto,
        isMusic: roomInfoAPIData.IsMusic,
        isVideo: roomInfoAPIData.IsVideo,
        isFailVideo: roomInfoAPIData.IsFailVideo,
        isSuccessVideo: roomInfoAPIData.IsSuccessVideo,
        isTVClueAlert: roomInfoAPIData.IsTVClueAlert,
      };

      store.set("roomConfig", roomConfig);

      await fs.promises.writeFile(
        path.join(configsDirectory, "room-config.json"),
        JSON.stringify(roomConfig, null, 2)
      );
      window.webContents.send("loading:status", {
        status: "All files are up to date.",
      });

      // trying to  get initial game info
      try {
        const gameDetailsAPIEndpoint = gameDetailsAPI.replace(
          "{}",
          deviceUniqueCode
        );
        const response = await axios.get(gameDetailsAPIEndpoint, {
          headers: apiEndpointHeader,
          validateStatus: () => true,
        });
        store.set("gameInfo", response.data);
      } catch (error) {
        console.log(
          "Loading: Skipping error getting initial game info - ",
          error.message
        );
      }

      await updateDeviceDetails();
      window.webContents.send("loading:success", { success: true });
      return { success: true };
    } catch (error) {
      console.log("Loading: Worker error - ", error.message);
      const window = getMainWindow();

      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND' || error.message.includes('Network Error') || error.message.includes('API Error')) {
        window.webContents.send("loading:status", {
          status: "ClueMaster Servers Not Responding… Trying to Reconnect",
        });
        await new Promise((resolve) => setTimeout(resolve, 5000));
        continue;
      }

      window.webContents.send("loading:success", { success: false });
      return { success: false };
    }
  }
});

const updateDeviceDetails = async () => {
  const applicationID = _package.version;
  const networkAddress = store.get("networkAddress");
  const deviceUniqueCode = store.get("uniqueCode");
  const apiKey = store.get("APIToken");
  const apiEndpointHeader = {
    Authorization: `Basic ${deviceUniqueCode}:${apiKey}`,
  };

  try {
    const postDeviceDetailsAPIEndpoint = postDeviceDetailsUpdateAPI
      .replace("{device_id}", deviceUniqueCode)
      .replace("{device_ip}", networkAddress)
      .replace("{snap_version}", applicationID);
    const postDeviceDetailsAPIRequest = await axios.post(
      postDeviceDetailsAPIEndpoint,
      null,
      { headers: apiEndpointHeader, validateStatus: () => true }
    );
    if (postDeviceDetailsAPIRequest.status !== 200) {
      console.log(
        "Loading: Error updating device details status - ",
        postDeviceDetailsAPIRequest.status
      );
      console.log(
        "Loading: Error response - ",
        postDeviceDetailsAPIRequest.data
      );
    } else {
      const time = new Date().toString();
      console.log(
        "Loading: ",
        deviceUniqueCode,
        " - device details updated at ",
        time
      );
    }
  } catch (error) {
    console.log("Loading: Error updating device details - ", error.message);
  }
};
