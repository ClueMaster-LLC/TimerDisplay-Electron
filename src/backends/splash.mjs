import { ipcMain } from 'electron';
import fs from 'fs';
import os from 'os';
import path from 'path';
import axios from 'axios';
import { devicesFilesAPI, generateAPITokenAPI } from './apis.mjs';
import store from "./state.mjs"
import { getMainWindow } from '../../electron/main.mjs';
import { config } from '../config/environment.mjs';

import { app } from 'electron';
import { createRequire } from "module";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const require = createRequire(import.meta.url);
// In packaged app, load from app.getAppPath(), otherwise relative path
const packagePath = app.isPackaged 
    ? path.join(app.getAppPath(), "package.json")
    : path.join(__dirname, "../../package.json");
const _package  = require(packagePath)

// Use centralized cross-platform paths from environment config
const masterDirectory = config.masterDirectory || path.join(os.homedir(), config.productName)
const applicationData = config.applicationDataDirectory || path.join(masterDirectory, "application-data")
const configsData = config.deviceConfigsDirectory || path.join(masterDirectory, "device-configs")
const mediaFilesDirectory = config.mediaFilesDirectory || path.join(applicationData, "media-files")
const roomMediaFilesDirectory = path.join(mediaFilesDirectory, "room-media-files")
const clueMediaFilesDirectory = path.join(mediaFilesDirectory, "clue-media-files")
const uniqueCode = path.join(configsData, "unique-code.json")

ipcMain.handle("splash:worker", async() => {
    // Ensure all required directories exist on startup
    await fs.promises.mkdir(masterDirectory, {recursive: true})
    await fs.promises.mkdir(applicationData, {recursive: true})
    await fs.promises.mkdir(configsData, {recursive: true})
    await fs.promises.mkdir(mediaFilesDirectory, {recursive: true})
    await fs.promises.mkdir(roomMediaFilesDirectory, {recursive: true})
    await fs.promises.mkdir(clueMediaFilesDirectory, {recursive: true})
    if (fs.existsSync(uniqueCode)){
        const rawUniqueCodeFile = await fs.promises.readFile(uniqueCode, 'utf-8')
        const rawUniqueCodeFileData = JSON.parse(rawUniqueCodeFile)
        const rawUniqueCode = rawUniqueCodeFileData["uniqueCode"]
        const rawAPIKey = rawUniqueCodeFileData["APIToken"]
        
        // pushing existing unique code and api token to persistant store
        store.set('uniqueCode', rawUniqueCode)
        store.set('APIToken', rawAPIKey)
        
        const deviceFilesAPIEndpoint = devicesFilesAPI.replace("{device_unique_code}", rawUniqueCode)

        while (true){
            const devicesFilesAPIHeader = { 'Authorization': `Basic ${rawUniqueCode}:${rawAPIKey }` }
            try{
                const deviceFilesAPIRequest = await axios.get(deviceFilesAPIEndpoint, { headers: devicesFilesAPIHeader, validateStatus: () => true  })
                if (deviceFilesAPIRequest.status === 401){
                    const newUniqueCode = await generateUniqueCode()
                    const newAPIToken = await generateSecureAPIToken(newUniqueCode)
                    store.set('uniqueCode', newUniqueCode)
                    store.set("APIToken", newAPIToken)

                    // writing updated api token to uniqueCode.json
                    const configsObject = {"uniqueCode": newUniqueCode, "APIToken": newAPIToken}
                    await fs.promises.writeFile(uniqueCode, JSON.stringify(configsObject, null, 2), 'utf-8')

                    // authenticate device
                    const window = getMainWindow()
                    window.webContents.send('splash', {'authenticate': true})
                } else {
                    // do not authenticate device
                    const window = getMainWindow()
                    window.webContents.send('splash', {'authenticate': false})
                }
                return { success: true }
            } catch (error){
                if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED'){
                    // await new Promise((resolve) => setTimeout(resolve, 2500));
                    // continue
                }

                console.log("Splash: Device files api request error : ", error.message || error)
                const window = getMainWindow()
                window.webContents.send('splash', {'authenticate': false})
                return { success: true }
            }
        }
    } else {
        const newUniqueCode = await generateUniqueCode()
        const newAPIToken = await generateSecureAPIToken(newUniqueCode)
        const networkAddress = await getDeviceIPv4Address()
        const configsObject = {"uniqueCode": newUniqueCode, "APIToken": newAPIToken, "networkAddress": networkAddress}
        
        // writing new configs to persistant store
        store.set('uniqueCode', newUniqueCode)
        store.set('APIToken', newAPIToken)
        store.set('networkAddress', networkAddress)

        // Ensure directory exists before writing file
        await fs.promises.mkdir(configsData, {recursive: true})
        
        // writing new configs to uniqueCode.json
        await fs.promises.writeFile(uniqueCode, JSON.stringify(configsObject, null, 2), 'utf-8')
        console.log("Splash: New configs : ", configsObject)

        // authenticate device
        const window = getMainWindow()
        window.webContents.send('splash', {'authenticate': true})
    }
    return {success: true}

});

const generateUniqueCode = async () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let raw = '';
    for (let i = 0; i < 16; i++) {
        raw += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return raw.match(/.{1,4}/g).join('-');
}

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
}

const generateSecureAPIToken = async (uniqueCode) => {
    while (true){
        const generateAPITokenAPIHeaders = { "Content-Type": "application/json"}
        const generateAPITokenAPIData = { DeviceKey: uniqueCode, Username: "ClueMasterAPI", Password: "8BGIJh27uBtqBTb2%t*zho!z0nS62tq2pGN%24&5PS3D"}

        try{
            const generateAPITokenAPIRequest = await axios.post(generateAPITokenAPI, generateAPITokenAPIData, { headers: generateAPITokenAPIHeaders, validateStatus: () => true  })
            if (generateAPITokenAPIRequest.status != 200){
                await new Promise((resolve) => setTimeout(resolve, 2500));
                continue
            } else {
                return generateAPITokenAPIRequest.data.apiKey
            }
        } catch (error){
            if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND'){
                await new Promise((resolve) => setTimeout(resolve, 2500));
                continue
            } else {
                console.error("Splash: Generate api token error :", error);
                await new Promise((resolve) => setTimeout(resolve, 2500));
                continue
            }
        }
    }
}

ipcMain.handle("splash:get-version", async() => {
    return _package.version
})

ipcMain.handle("splash:get-local-ip", async() => {
    const networkAddress = await getDeviceIPv4Address()
    return networkAddress
})

ipcMain.handle("splash:get-product-name", async() => {
    // Use environment variable set at build time
    const productName = config.productName || "ClueMaster Timer Display";
    
    // Replace hyphens with spaces for display
    return productName.replace(/-/g, ' ');
})

