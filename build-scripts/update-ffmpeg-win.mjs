/**
 * Download and update FFmpeg binaries for Windows builds
 * 
 * Usage: npm run update-ffmpeg
 * 
 * Downloads the latest FFmpeg essentials build from gyan.dev and extracts
 * ffmpeg.exe and ffprobe.exe to resources/ffmpeg-win/
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import { createWriteStream, mkdirSync, rmSync, existsSync } from 'fs';
import { pipeline } from 'stream/promises';
import { createGunzip } from 'zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const FFMPEG_URL = 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip';
const TARGET_DIR = path.join(projectRoot, 'resources', 'ffmpeg-win');
const TEMP_DIR = path.join(projectRoot, 'node_modules', '.cache', 'ffmpeg-download');

console.log('╔════════════════════════════════════════════╗');
console.log('║     FFmpeg Updater for Windows Builds      ║');
console.log('╚════════════════════════════════════════════╝');
console.log('');

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`📥 Downloading from: ${url}`);
    console.log(`   Destination: ${dest}`);
    
    const file = createWriteStream(dest);
    
    const request = https.get(url, (response) => {
      // Handle redirects (301, 302, 303, 307, 308)
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        file.close();
        if (existsSync(dest)) fs.unlinkSync(dest);
        console.log(`   Following redirect to: ${response.headers.location}`);
        return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
      }
      
      if (response.statusCode !== 200) {
        file.close();
        if (existsSync(dest)) fs.unlinkSync(dest);
        reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
        return;
      }
      
      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloadedSize = 0;
      let lastPercent = 0;
      
      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        if (totalSize) {
          const percent = Math.round((downloadedSize / totalSize) * 100);
          if (percent !== lastPercent && percent % 10 === 0) {
            process.stdout.write(`   Progress: ${percent}%\r`);
            lastPercent = percent;
          }
        }
      });
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log(`   Progress: 100% - Complete!`);
        resolve();
      });
    });
    
    request.on('error', (err) => {
      file.close();
      if (existsSync(dest)) fs.unlinkSync(dest);
      reject(err);
    });
  });
}

async function extractZip(zipPath, extractDir) {
  console.log(`📦 Extracting ZIP archive...`);
  
  // Use PowerShell's Expand-Archive on Windows
  if (process.platform === 'win32') {
    execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${extractDir}' -Force"`, {
      stdio: 'inherit'
    });
  } else {
    // Use unzip on Linux/Mac (for cross-platform dev)
    execSync(`unzip -o "${zipPath}" -d "${extractDir}"`, {
      stdio: 'inherit'
    });
  }
  
  console.log(`   Extraction complete!`);
}

async function main() {
  try {
    // Ensure target directory exists
    if (!existsSync(TARGET_DIR)) {
      mkdirSync(TARGET_DIR, { recursive: true });
      console.log(`📁 Created target directory: ${TARGET_DIR}`);
    }
    
    // Ensure temp directory exists
    if (!existsSync(TEMP_DIR)) {
      mkdirSync(TEMP_DIR, { recursive: true });
    }
    
    const zipPath = path.join(TEMP_DIR, 'ffmpeg.zip');
    const extractDir = path.join(TEMP_DIR, 'extracted');
    
    // Clean up previous extraction
    if (existsSync(extractDir)) {
      rmSync(extractDir, { recursive: true, force: true });
    }
    mkdirSync(extractDir, { recursive: true });
    
    // Download FFmpeg
    await downloadFile(FFMPEG_URL, zipPath);
    
    // Extract ZIP
    await extractZip(zipPath, extractDir);
    
    // Find the bin directory (it's inside a versioned folder)
    const extractedContents = fs.readdirSync(extractDir);
    const ffmpegFolder = extractedContents.find(f => f.startsWith('ffmpeg-'));
    
    if (!ffmpegFolder) {
      throw new Error('Could not find FFmpeg folder in extracted archive');
    }
    
    const binDir = path.join(extractDir, ffmpegFolder, 'bin');
    
    if (!existsSync(binDir)) {
      throw new Error(`Bin directory not found: ${binDir}`);
    }
    
    // Copy binaries to target
    // Note: Only ffprobe.exe is needed on Windows (for debug overlay video info)
    // ffmpeg.exe is NOT needed because transcoding is disabled on Windows
    // (Windows has native codec support via Windows Media Foundation)
    console.log(`📋 Copying ffprobe to ${TARGET_DIR}...`);
    
    const ffprobeSrc = path.join(binDir, 'ffprobe.exe');
    const ffprobeDest = path.join(TARGET_DIR, 'ffprobe.exe');
    
    if (!existsSync(ffprobeSrc)) {
      throw new Error(`ffprobe.exe not found in ${binDir}`);
    }
    
    fs.copyFileSync(ffprobeSrc, ffprobeDest);
    console.log(`   ✅ ffprobe.exe copied`);
    
    // Get version info
    const versionOutput = execSync(`"${ffprobeDest}" -version`, { encoding: 'utf8' });
    const versionMatch = versionOutput.match(/ffprobe version (\S+)/);
    const version = versionMatch ? versionMatch[1] : 'unknown';
    
    // Clean up
    console.log(`🧹 Cleaning up temporary files...`);
    rmSync(zipPath, { force: true });
    rmSync(extractDir, { recursive: true, force: true });
    
    console.log('');
    console.log('╔════════════════════════════════════════════╗');
    console.log('║            Update Complete!                ║');
    console.log('╚════════════════════════════════════════════╝');
    console.log('');
    console.log(`   FFprobe Version: ${version}`);
    console.log(`   Location: ${TARGET_DIR}`);
    console.log('');
    console.log('   Files updated:');
    console.log(`   • ffprobe.exe (${(fs.statSync(ffprobeDest).size / 1024 / 1024).toFixed(1)} MB)`);
    console.log('');
    console.log('   Note: ffmpeg.exe is NOT included (not needed on Windows)');
    console.log('');
    
  } catch (error) {
    console.error('');
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
