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
const uniqueCodeFile = path.join(configsData, "unique-code.json")

// Legacy Python app paths (for migration on SNAP/Ubuntu Core)
// Old structure: $SNAP_USER_DATA/CluemasterTimerDisplay/assets/application data/unique_code.json
const legacyAssetsDir = config.isSnap ? path.join(masterDirectory, "assets") : null;
const legacyAppDataDir = config.isSnap ? path.join(masterDirectory, "assets", "application data") : null;
const legacyUniqueCodeFile = config.isSnap ? path.join(legacyAppDataDir, "unique_code.json") : null;

/**
 * Migrate legacy Python app configuration to new Electron app structure.
 * Old Python app stored configs in: assets/application data/unique_code.json
 * New Electron app stores configs in: device-configs/unique-code.json
 * 
 * This ensures seamless upgrades from old Python snap to new Electron snap.
 */
async function migrateLegacyConfig() {
    if (!config.isSnap || !legacyUniqueCodeFile) {
        return null; // Only run migration on SNAP environments
    }

    try {
        if (!fs.existsSync(legacyUniqueCodeFile)) {
            console.log("Splash: No legacy unique_code.json found, skipping migration");
            return null;
        }

        console.log("Splash: Found legacy Python app config, migrating to new structure...");
        console.log("Splash: Legacy file:", legacyUniqueCodeFile);

        // Read the old unique_code.json
        const legacyContent = await fs.promises.readFile(legacyUniqueCodeFile, 'utf-8');
        const legacyData = JSON.parse(legacyContent);
        
        console.log("Splash: Legacy data keys:", Object.keys(legacyData));

        // Extract unique code and API token from legacy format
        // Old Python app used keys with spaces: "Device Unique Code", "apiKey", "IPv4 Address"
        const uniqueCode = legacyData["Device Unique Code"] || legacyData.uniqueCode || legacyData.unique_code || legacyData.deviceKey || legacyData.device_key;
        const apiToken = legacyData.apiKey || legacyData.APIToken || legacyData.apiToken || legacyData.api_token || legacyData.api_key;
        const networkAddress = legacyData["IPv4 Address"] || legacyData.networkAddress || legacyData.network_address || legacyData.ipAddress || legacyData.ip_address;

        if (!uniqueCode) {
            console.log("Splash: Legacy file found but no unique code detected, cannot migrate");
            console.log("Splash: Legacy data contents:", JSON.stringify(legacyData, null, 2));
            return null;
        }

        // Create new directory structure
        await fs.promises.mkdir(configsData, { recursive: true });

        // Create new unique-code.json with migrated data
        const newConfigData = {
            uniqueCode: uniqueCode,
            APIToken: apiToken || null,
            networkAddress: networkAddress || null,
            migratedFrom: "legacy-python-app",
            migratedAt: new Date().toISOString()
        };

        await fs.promises.writeFile(uniqueCodeFile, JSON.stringify(newConfigData, null, 2), 'utf-8');
        console.log("Splash: Successfully migrated legacy config to:", uniqueCodeFile);
        console.log("Splash: Migrated unique code:", uniqueCode);

        // Keep legacy config file intact for rollback compatibility
        // If we need to revert to the old Python snap, the original file will still exist
        console.log("Splash: Legacy config file preserved at:", legacyUniqueCodeFile);

        // Delete old media folder to avoid duplicates (media will re-download automatically)
        const legacyMediaDir = path.join(legacyAssetsDir, "media");
        try {
            if (fs.existsSync(legacyMediaDir)) {
                await fs.promises.rm(legacyMediaDir, { recursive: true, force: true });
                console.log("Splash: Deleted legacy media folder:", legacyMediaDir);
            }
        } catch (mediaErr) {
            console.log("Splash: Could not delete legacy media folder (non-critical):", mediaErr.message);
        }

        // Also check for legacy "application data/media" folder
        const legacyAppDataMediaDir = path.join(legacyAppDataDir, "media");
        try {
            if (fs.existsSync(legacyAppDataMediaDir)) {
                await fs.promises.rm(legacyAppDataMediaDir, { recursive: true, force: true });
                console.log("Splash: Deleted legacy app data media folder:", legacyAppDataMediaDir);
            }
        } catch (mediaErr) {
            console.log("Splash: Could not delete legacy app data media folder (non-critical):", mediaErr.message);
        }

        return newConfigData;
    } catch (error) {
        console.error("Splash: Error during legacy config migration:", error.message);
        return null;
    }
}

ipcMain.handle("splash:worker", async() => {
    // Ensure all required directories exist on startup
    // (masterDirectory may exist from old Python app but device-configs and application-data might not)
    await fs.promises.mkdir(masterDirectory, {recursive: true})
    await fs.promises.mkdir(applicationData, {recursive: true})
    await fs.promises.mkdir(configsData, {recursive: true})
    await fs.promises.mkdir(mediaFilesDirectory, {recursive: true})
    await fs.promises.mkdir(roomMediaFilesDirectory, {recursive: true})
    await fs.promises.mkdir(clueMediaFilesDirectory, {recursive: true})

    // Attempt to migrate legacy Python app config before checking for new config
    if (!fs.existsSync(uniqueCodeFile)) {
        const migratedConfig = await migrateLegacyConfig();
        if (migratedConfig) {
            console.log("Splash: Using migrated legacy configuration");
        }
    }

    if (fs.existsSync(uniqueCodeFile)){
        const rawUniqueCodeFile = await fs.promises.readFile(uniqueCodeFile, 'utf-8')
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
                    await fs.promises.writeFile(uniqueCodeFile, JSON.stringify(configsObject, null, 2), 'utf-8')

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
        await fs.promises.writeFile(uniqueCodeFile, JSON.stringify(configsObject, null, 2), 'utf-8')
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

