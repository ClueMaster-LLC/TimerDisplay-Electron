import { ipcMain } from "electron";
import {
  gameIntroRequestAPI,
  postDeviceAPI,
  getGameStartEndTimeAPI,
  postGameClueStatusAPI,
} from "./apis.mjs";
import store from "./state.mjs";
import path from "path";
import fs from "fs";
import axios from "axios";
import os from "os";

const homeDirectory = os.homedir();
const masterDirectory = path.join(homeDirectory, "cluemaster-timer");
const applicationData = path.join(masterDirectory, "application-data");
const BASE_MEDIA_DIRECTORY = path.join(applicationData, "media-files");

const getIntroVideo = () => {
  try {
    const gameInfo = store.get("gameInfo");
    if (!gameInfo || !gameInfo.isIntro) {
      return null;
    }
    const roomMediaFilesDirectory = path.join(
      BASE_MEDIA_DIRECTORY,
      "room-media-files"
    );
    const videoFilesDirectory = path.join(
      roomMediaFilesDirectory,
      "intro-media"
    );

    if (!fs.existsSync(videoFilesDirectory)) {
      return null;
    }

    const files = fs.readdirSync(videoFilesDirectory);
    const introFile = path.join(videoFilesDirectory, files[0]);

    if (!introFile) {
      return null;
    }

    return `media://local/${introFile}`;
  } catch (error) {
    console.error("Game: Error getting intro video:", error);
    return null;
  }
};

const getEndVideo = () => {
  try {
    const gameInfo = store.get("gameInfo");

    if (!gameInfo) {
      return null;
    }

    const roomMediaFilesDirectory = path.join(
      BASE_MEDIA_DIRECTORY,
      "room-media-files"
    );

    let videoFilesDirectory;
    if (gameInfo.gameStatus === 5) {
      videoFilesDirectory = path.join(roomMediaFilesDirectory, "fail-media");
    } else if (gameInfo.gameStatus === 6) {
      videoFilesDirectory = path.join(roomMediaFilesDirectory, "success-media");
    } else {
      return null;
    }

    if (!fs.existsSync(videoFilesDirectory)) {
      return null;
    }

    const files = fs.readdirSync(videoFilesDirectory);
    const endFile = path.join(videoFilesDirectory, files[0]);
    if (!endFile) {
      return null;
    }
    return `media://local/${endFile}`;
  } catch (error) {
    console.error("Game: Error getting end video:", error);
    return null;
  }
};

const getMainVideo = () => {
  try {
    const roomMediaFilesDirectory = path.join(
      BASE_MEDIA_DIRECTORY,
      "room-media-files"
    );
    const videoFilesDirectory = path.join(
      roomMediaFilesDirectory,
      "video-files"
    );

    if (!fs.existsSync(videoFilesDirectory)) {
      return null;
    }

    const files = fs.readdirSync(videoFilesDirectory);
    const mainFile = path.join(videoFilesDirectory, files[0]);

    if (!mainFile) {
      return null;
    }

    return `media://local/${mainFile}`;
  } catch (error) {
    console.error("Game: Error getting main video:", error);
    return null;
  }
};

const getClueMedia = (clueData) => {
  try {
    if (!clueData) {
      console.log("Game: No clue data provided");
      return null;
    }

    if (!clueData.clueFilename || clueData.clueFilename === null) {
      return null;
    }

    const clueMediaDirectory = path.join(
      BASE_MEDIA_DIRECTORY,
      "clue-media-files"
    );

    const fullFilename = clueData.clueFilename;
    const filenameOnly = path.basename(fullFilename);
    const encodedFilename = filenameOnly.replace(/\s+/g, "%20");

    const possiblePaths = [
      path.join(clueMediaDirectory, encodedFilename),
      path.join(clueMediaDirectory, filenameOnly),
    ];

    for (const filePath of possiblePaths) {
      if (fs.existsSync(filePath)) {
        return `media://local/${filePath}`;
      }
    }

    return null;
  } catch (error) {
    console.error("Game: Error getting clue media:", error);
    return null;
  }
};

const introPostRequest = async () => {
  try {
    const deviceUniqueID = store.get("uniqueCode");
    const apiToken = store.get("APIToken");
    const gameInfo = store.get("gameInfo");
    const gameId = gameInfo?.gameId || null;
    const headers = { Authorization: `Basic ${deviceUniqueID}:${apiToken}` };

    if (gameId === null) {
      console.log("Game: No gameId found for intro post request");
      return null;
    }

    const introPostRequestEndpoint = gameIntroRequestAPI.replace("{}", gameId);
    const response = await axios.get(introPostRequestEndpoint, {
      headers,
      validateStatus: () => true,
    });

    if (response.status === 401) {
      console.log("Game: Unauthorized intro post request");
      return null;
    }

    if (response.status === 200) {
      console.log(
        "Game: Intro post request successful, response:",
        response.data
      );
      const deviceRequestID = response.data.DeviceRequestid;

      if (!deviceRequestID) {
        console.log("Game: No DeviceRequestid in intro response");
        return null;
      }

      const postDeviceAPIEndpoint = postDeviceAPI
        .replace("{device_unique_code}", deviceUniqueID)
        .replace("{deviceRequestId}", deviceRequestID);

      console.log(
        "Game: Sending post device request to:",
        postDeviceAPIEndpoint
      );

      const request = await axios.post(postDeviceAPIEndpoint, null, {
        headers,
        validateStatus: () => true,
      });

      if (request.status === 401) {
        console.log("Game: Post device request unauthorized for intro");
        return null;
      }

      if (request.status === 200) {
        console.log("Game: Post device request successful for intro");
        return true;
      } else {
        console.log(
          "Game: Post device request failed with status:",
          request.status
        );
        return null;
      }
    } else {
      console.log(
        "Game: Intro post request failed with status:",
        response.status
      );
      return null;
    }
  } catch (error) {
    console.error("Game: Error on intro post request:", error);
    return null;
  }
};

const postGameClueStatus = async (gameId, clueId) => {
  try {
    const deviceUniqueID = store.get("uniqueCode");
    const apiToken = store.get("APIToken");
    const headers = { Authorization: `Basic ${deviceUniqueID}:${apiToken}` };

    if (!gameId || !clueId) {
      console.log(
        "Game: Missing gameId or clueId for clue status post request"
      );
      return null;
    }

    const clueStatusEndpoint = postGameClueStatusAPI
      .replace("{game_ids}", gameId)
      .replace("{clue_ids}", clueId);

    const response = await axios.post(clueStatusEndpoint, null, {
      headers,
      validateStatus: () => true,
    });

    if (response.status === 401) {
      console.log("Game: Unauthorized clue status post request");
      return null;
    }

    if (response.status === 200) {
      console.log(
        "Game: Clue status post request successful, response:",
        response.data
      );
      return true;
    } else {
      console.log(
        "Game: Clue status post request failed with status:",
        response.status
      );
      return null;
    }
  } catch (error) {
    console.error("Game: Error on clue status post request:", error);
    return null;
  }
};

const getGameStartEndTime = async () => {
  try {
    const deviceUniqueID = store.get("uniqueCode");
    const apiToken = store.get("APIToken");
    const gameInfo = store.get("gameInfo");

    if (!deviceUniqueID || !apiToken) {
      console.error(
        "Game: missing device id or api token for timer calculation"
      );
      return null;
    }

    const headers = { Authorization: `Basic ${deviceUniqueID}:${apiToken}` };
    const endpoint = getGameStartEndTimeAPI.replace("{}", gameInfo.gameId);

    console.log("Game: Fetching game start/end time from:", endpoint);
    const response = await axios.get(endpoint, {
      headers,
      validateStatus: () => true,
    });

    if (response.status === 200 && response.data) {
      console.log("Game: Game start/end time response:", response.data);
      return response.data;
    } else {
      console.log(
        "Game: Game start/end time request failed with status:",
        response.status
      );
      return null;
    }
  } catch (error) {
    console.error("Game: Error fetching game start/end time:", error);
    return null;
  }
};

const calculateInitialTimerValue = async () => {
  try {
    const gameTimeData = await getGameStartEndTime();

    if (!gameTimeData) {
      console.log("no game time data, using default 300");
      return 300; // 5 minutes default
    }

    const now = new Date();
    const gameEndTime = new Date(gameTimeData.gameEndDateTime + "Z");

    const remainingTimeMs = gameEndTime.getTime() - now.getTime();
    const remainingTimeSeconds = Math.floor(remainingTimeMs / 1000);

    if (remainingTimeSeconds <= 0) {
      return 0;
    }

    store.set("gameEndTime", gameTimeData.gameEndDateTime);
    console.log("stored gameEndTime:", gameTimeData.gameEndDateTime);

    return remainingTimeSeconds;
  } catch (error) {
    console.error("Error:", error);
    return 300; // default fallback
  }
};

const getBackgroundMusic = () => {
  try {
    const gameInfo = store.get("gameInfo");
    if (!gameInfo?.isMusic) {
      return null;
    }

    const roomMediaFilesDirectory = path.join(
      BASE_MEDIA_DIRECTORY,
      "room-media-files"
    );
    const musicFilesDirectory = path.join(
      roomMediaFilesDirectory,
      "music-files"
    );

    if (!fs.existsSync(musicFilesDirectory)) {
      return null;
    }

    const files = fs.readdirSync(musicFilesDirectory);
    if (files.length === 0) {
      return null;
    }

    const musicPath = path.join(musicFilesDirectory, files[0]);
    console.log("Game: Background music path:", musicPath);
    const relativePath = path.relative(BASE_MEDIA_DIRECTORY, musicPath);
    console.log("Game: Background music relative path:", relativePath);
    return `media://local/${relativePath}`;
  } catch (error) {
    console.error("Game: Error getting background music:", error);
    return null;
  }
};

const getCustomClueAlertAudio = () => {
  try {
    const roomMediaFilesDirectory = path.join(
      BASE_MEDIA_DIRECTORY,
      "room-media-files"
    );
    const customClueMediaDirectory = path.join(
      roomMediaFilesDirectory,
      "custom-clue-media"
    );

    if (!fs.existsSync(customClueMediaDirectory)) {
      return null;
    }

    const files = fs.readdirSync(customClueMediaDirectory);
    if (files.length === 0) {
      return null;
    }

    const audioPath = path.join(customClueMediaDirectory, files[0]);
    const relativePath = path.relative(BASE_MEDIA_DIRECTORY, audioPath);
    return `media://local/${relativePath}`;
  } catch (error) {
    console.error("Game: Error getting custom clue alert audio:", error);
    return null;
  }
};

ipcMain.handle("game:get-intro-video", () => {
  return getIntroVideo();
});

ipcMain.handle("game:get-end-video", () => {
  return getEndVideo();
});

ipcMain.handle("game:get-main-video", () => {
  return getMainVideo();
});

ipcMain.handle("game:get-background-music", () => {
  return getBackgroundMusic();
});

ipcMain.handle("game:get-custom-clue-alert-audio", () => {
  return getCustomClueAlertAudio();
});

ipcMain.handle("game:intro-post-request", () => {
  return introPostRequest();
});

ipcMain.handle("game:calculate-initial-timer", () => {
  return calculateInitialTimerValue();
});

ipcMain.handle("game:post-clue-status", (event, gameId, clueId) => {
  return postGameClueStatus(gameId, clueId);
});

ipcMain.handle("game:get-clue-media", (event, clueData) => {
  return getClueMedia(clueData);
});
