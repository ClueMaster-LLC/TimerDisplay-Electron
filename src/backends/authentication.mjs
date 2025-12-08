import { getMainWindow } from '../../electron/main.mjs';
import { deviceRequestAPI, postDeviceAPI, roomInfoAPI} from './apis.mjs'
import { ipcMain } from 'electron';
import store from './state.mjs'
import path from 'path'
import fs from 'fs'
import axios from 'axios';
import os from 'os';
import { config as envConfig } from '../config/environment.mjs';

const homeDirectory = os.homedir()
const masterDirectory = path.join(homeDirectory, envConfig.productName)
const applicationData = path.join(masterDirectory, "application-data")
const configsDirectory = path.join(masterDirectory, "device-configs")

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

ipcMain.handle('auth:worker', async () => {
  try{
    const deviceUniqueCode = store.get('uniqueCode')
    const apiKey = store.get('APIToken')
    const deviceRequestAPIEndpoint = deviceRequestAPI.replace('{device_unique_code}', deviceUniqueCode)
    const roomInfoAPIEndpoint = roomInfoAPI.replace('{device_unique_code}', deviceUniqueCode)
    const apiEndpointHeader = {'Authorization': `Basic ${deviceUniqueCode}:${apiKey}`}

    while (true){
      const window = getMainWindow()
      window.webContents.send('auth:status', {'status': 'Waiting for authentication'})
      await new Promise((resolve) => setTimeout(resolve, 2000))

      const deviceRequestAPIRequest = await axios.get(deviceRequestAPIEndpoint, { headers: apiEndpointHeader, validateStatus: () => true })
      if (deviceRequestAPIRequest.status !== 200){
        console.log('Auth: Device registation : Status ', deviceRequestAPIRequest.status)
        await new Promise((resolve) => setTimeout(resolve, 2500))
      } else {
        console.log('Auth: Device registation : Status ', deviceRequestAPIRequest.status)

        const window = getMainWindow()
        window.webContents.send('auth:status', {'status': 'Authenticating'})
        break
      }
    }

    while (true){
      const deviceRequestAPIRequest = await axios.get(deviceRequestAPIEndpoint, { headers: apiEndpointHeader, validateStatus: () => true })
      if (deviceRequestAPIRequest.data === 'No record found'){
        // download configurations
        const window = getMainWindow()
        window.webContents.send('auth:status', {'status': 'Downloading room configurations'})
        await new Promise((resolve) => setTimeout(resolve, 1000))

        const roomInfoAPIRequest = await axios.get(roomInfoAPIEndpoint, { headers: apiEndpointHeader, validateStatus: () => true })
        const roomInfoAPIData = roomInfoAPIRequest.data
        if (roomInfoAPIRequest.data !== 'No Configurations Files Found'){
          const roomConfig = {
            'cluesAllowed': roomInfoAPIData.CluesAllowed,
            'clueSize': roomInfoAPIData.ClueSizeOnScreen,
            'maximumNumberOfClues': roomInfoAPIData.MaxNoOfClues,
            'cluePositionVertical': roomInfoAPIData.CluePositionVertical,
            'isTimeLimit': roomInfoAPIData.IsTimeLimit,
            'timeLimit': roomInfoAPIData.TimeLimit,
            'timeOverride': roomInfoAPIData.TimeOverride,
            'isImage': roomInfoAPIData.IsPhoto,
            'isMusic': roomInfoAPIData.IsMusic,
            'isVideo': roomInfoAPIData.IsVideo,
            'isIntroVideo': roomInfoAPIData.IsIntroVideo,
            'isFailVideo': roomInfoAPIData.IsFailVideo,
            'isSuccessVideo': roomInfoAPIData.IsSuccessVideo,
            'isTVClueAlert': roomInfoAPIData.IsTVClueAlert,
          }

          await fs.promises.writeFile(path.join(configsDirectory, 'room-config.json'), JSON.stringify(roomConfig, null, 2))
        }

        window.webContents.send('auth:auth', {'authSuccess': true})
        await new Promise((resolve) => setTimeout(resolve, 1000))
        return {success: true}

      } else {
        const deviceRequestID = deviceRequestAPIRequest.data.DeviceRequestid
        const requestID = deviceRequestAPIRequest.data.RequestID
        const mediaFilesRequestID = 6

        if (requestID !== mediaFilesRequestID){
          // make dummy post request
          const dummyPostRequestEndpoint = postDeviceAPI.replace('{device_unique_code}', deviceUniqueCode).replace('{deviceRequestId}', deviceRequestID)
          await axios.post(dummyPostRequestEndpoint, null, { headers: apiEndpointHeader, validateStatus: () => true })
          await new Promise((resolve) => setTimeout(resolve, 1000))
        } else {
          // download media files
          const window = getMainWindow()
          window.webContents.send('auth:status', {'status': 'Downloading media files'})
          await new Promise((resolve) => setTimeout(resolve, 1000))
          
          const roomInfoAPIRequest = await axios.get(roomInfoAPIEndpoint, { headers: apiEndpointHeader, validateStatus: () => true })
          if (roomInfoAPIRequest.data !== 'No Configurations Files Found'){
            const roomMediaFilesDirectory = path.join(applicationData, 'media-files', 'room-media-files')
            const musicFilesDirectory = path.join(roomMediaFilesDirectory, 'music-files')
            const imageFilesDirectory = path.join(roomMediaFilesDirectory, 'idleScreen-media')
            const videoFilesDirectory = path.join(roomMediaFilesDirectory, 'gameBackground-media')
            const introMediaDirectory = path.join(roomMediaFilesDirectory, 'intro-media')
            const successMediaDirectory = path.join(roomMediaFilesDirectory, 'success-media')
            const failMediaDirectory = path.join(roomMediaFilesDirectory, 'fail-media')
            const clueMediaDirectory = path.join(applicationData, 'media-files', 'clue-media-files')
            const customClueMediaDirectory = path.join(roomMediaFilesDirectory, 'custom-clue-media')

            if (fs.existsSync(roomMediaFilesDirectory) === true){
              await fs.promises.rm(roomMediaFilesDirectory, { recursive: true, force: true })
            }

            if (fs.existsSync(clueMediaDirectory) === true){
              await fs.promises.rm(clueMediaDirectory, { recursive: true, force: true })
            }

            // creating the directories
            await fs.promises.mkdir(roomMediaFilesDirectory, {recursive: true})
            await fs.promises.mkdir(musicFilesDirectory, {recursive: true})
            await fs.promises.mkdir(imageFilesDirectory, {recursive: true})
            await fs.promises.mkdir(videoFilesDirectory, {recursive: true})
            await fs.promises.mkdir(introMediaDirectory, {recursive: true})
            await fs.promises.mkdir(successMediaDirectory, {recursive: true})
            await fs.promises.mkdir(failMediaDirectory, {recursive: true})
            await fs.promises.mkdir(clueMediaDirectory, {recursive: true})
            await fs.promises.mkdir(customClueMediaDirectory, {recursive: true})

            const roomInfoAPIData = roomInfoAPIRequest.data
            const musicMediaFile = roomInfoAPIData.MusicPath
            const imageMediaFile = roomInfoAPIData.PhotoPath
            const videoMediaFile = roomInfoAPIData.VideoPath
            const introMediaFile = roomInfoAPIData.IntroVideoPath
            const successMediaFile = roomInfoAPIData.SuccessVideoPath
            const failMediaFile = roomInfoAPIData.FailVideoPath
            const clueMediaFiles = roomInfoAPIData.ClueMediaFiles
            const customClueAlertMediaFile = roomInfoAPIData.TVClueAlertMusicPath

            const totalFilesToDownload = clueMediaFiles.length + 6 // 6 is for the room media files
            console.log("total files to download : ", totalFilesToDownload)
            window.webContents.send('auth:progress', {'progress': null, 'progressMax': totalFilesToDownload})

            // downloading room media files
            if (musicMediaFile !== null){
              const fileName = musicMediaFile.split("/")[5].split("?X")[0]
              await downloadFileStream(musicMediaFile, path.join(musicFilesDirectory, fileName), apiEndpointHeader);
            }
            window.webContents.send('auth:progress', {'progress': true, 'progressMax': null})

            if (imageMediaFile !== null){
              const fileName = imageMediaFile.split("/")[5].split("?X")[0]
              await downloadFileStream(imageMediaFile, path.join(imageFilesDirectory, fileName), apiEndpointHeader);
            }
            window.webContents.send('auth:progress', {'progress': true, 'progressMax': null})

            if (videoMediaFile !== null){
              const fileName = videoMediaFile.split("/")[5].split("?X")[0]
              await downloadFileStream(videoMediaFile, path.join(videoFilesDirectory, fileName), apiEndpointHeader);
            }
            window.webContents.send('auth:progress', {'progress': true, 'progressMax': null})

            if (introMediaFile !== null){
              const fileName = introMediaFile.split("/")[5].split("?X")[0]
              await downloadFileStream(introMediaFile, path.join(introMediaDirectory, fileName), apiEndpointHeader);
            }
            window.webContents.send('auth:progress', {'progress': true, 'progressMax': null})

            if (successMediaFile !== null){
              const fileName = successMediaFile.split("/")[5].split("?X")[0]
              await downloadFileStream(successMediaFile, path.join(successMediaDirectory, fileName), apiEndpointHeader);
            }
            window.webContents.send('auth:progress', {'progress': true, 'progressMax': null})

            if (failMediaFile !== null){
              const fileName = failMediaFile.split("/")[5].split("?X")[0]
              await downloadFileStream(failMediaFile, path.join(failMediaDirectory, fileName), apiEndpointHeader);
            }
            window.webContents.send('auth:progress', {'progress': true, 'progressMax': null})

            if (customClueAlertMediaFile !== null){
              const fileName = customClueAlertMediaFile.split("/")[5].split("?X")[0]
              await downloadFileStream(customClueAlertMediaFile, path.join(customClueMediaDirectory, fileName), apiEndpointHeader);
            }

            // downloading clue media files
            for (const clue of clueMediaFiles){
              const clueURL = clue.FilePath
              if (clueURL !== null){
                try{
                  const parts = clueURL.split('/')
                  if (parts.length < 6) continue
                  const fileName = parts[5].split('?X')[0]
                  const filePath = path.join(clueMediaDirectory, fileName)
                  await downloadFileStream(clueURL, filePath, apiEndpointHeader);
                  const window = getMainWindow()
                  window.webContents.send('auth:progress', {'progress': true, 'progressMax': null})
                }catch (error) {
                  console.log('Auth: Error downloading file : ', clueURL)
                  console.log('Auth: Error - ', error.message)
                }
              } else {
                const window = getMainWindow()
                window.webContents.send('auth:progress', {'progress': true, 'progressMax': null})
              }
            }
          }
          const dummyPostRequestEndpoint = postDeviceAPI.replace('{device_unique_code}', deviceUniqueCode).replace('{deviceRequestId}', deviceRequestID)
          await axios.post(dummyPostRequestEndpoint, null, { headers: apiEndpointHeader, validateStatus: () => true })
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }
      }
    }
  } catch (error){
    console.log('Auth: Error authenticating device : ', error)
    const window = getMainWindow()
    window.webContents.send('auth:auth', {'authSuccess': false})
    return {success: false}
  }
});

const getDeviceIPv4Address = async () => {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '127.0.0.1'; // fallback if none found
};

ipcMain.handle('auth:get-device-code', async () => {
  return store.get('uniqueCode') || 'UNKNOWN';
});

ipcMain.handle('auth:get-local-ip', async () => {
  return await getDeviceIPv4Address();
});
