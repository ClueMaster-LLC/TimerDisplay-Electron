/**
 * Screenshot Handler - Main Process
 * 
 * Handles screenshot capture and upload entirely in the main process.
 * This is optimized for large images and frequent uploads by avoiding
 * thread boundary crossings with large buffers.
 * 
 * The worker thread only polls the API and sends a lightweight signal
 * when a screenshot is requested. All image handling stays in main process.
 */

import { getMainWindow } from "../../electron/main.mjs";
import store from "./state.mjs";
import { postScreenshotAPI } from "./apis.mjs";
import axios from "axios";

// Screenshot settings - single source of truth
export const JPEG_QUALITY = 50;           // 0-100, lower = smaller file
export const SCREENSHOT_SCALE = 0.50;     // 0.0-1.0, resize factor (50% of original)
export const SCREENSHOT_MIN_SIZE = 600;   // Minimum width/height in pixels

export const THUMBNAIL_QUALITY = 50;      // 0-100, thumbnail can be lower quality
export const THUMBNAIL_WIDTH = 150;       // Fixed thumbnail width in pixels (height calculated from aspect ratio)

/**
 * Capture screenshot and upload to API.
 * Called by both the worker signal handler and menu item.
 * 
 * @returns {Promise<Object>} Result object with success, size, uploaded, etc.
 */
export async function captureAndUpload() {
  const window = getMainWindow();
  if (!window || window.isDestroyed()) {
    return { success: false, error: "Window not available" };
  }

  const uniqueCode = store.get("uniqueCode");
  const apiToken = store.get("APIToken");

  if (!uniqueCode || !apiToken) {
    return {
      success: false,
      error: "Not logged in - no credentials",
      uploaded: false,
    };
  }

  try {
    // Capture screenshot
    console.log("Screenshot: Capturing...");
    const image = await window.webContents.capturePage();
    if (image.isEmpty()) {
      return { success: false, error: "Captured image is empty" };
    }

    // Resize image to reduce file size (50% by default, min 600px, maintain aspect ratio)
    const originalSize = image.getSize();
    const aspectRatio = originalSize.width / originalSize.height;

    // Calculate scaled dimensions, then adjust if below minimum while preserving aspect ratio
    let scaledWidth = Math.round(originalSize.width * SCREENSHOT_SCALE);
    let scaledHeight = Math.round(originalSize.height * SCREENSHOT_SCALE);
    if (scaledWidth < SCREENSHOT_MIN_SIZE || scaledHeight < SCREENSHOT_MIN_SIZE) {
      if (aspectRatio >= 1) {
        // Wider than tall - constrain by height
        scaledHeight = SCREENSHOT_MIN_SIZE;
        scaledWidth = Math.round(scaledHeight * aspectRatio);
      } else {
        // Taller than wide - constrain by width
        scaledWidth = SCREENSHOT_MIN_SIZE;
        scaledHeight = Math.round(scaledWidth / aspectRatio);
      }
    }
    const resizedImage = image.resize({ width: scaledWidth, height: scaledHeight, quality: 'good' });

    // Create thumbnail (fixed 150px width, maintain aspect ratio)
    const thumbWidth = THUMBNAIL_WIDTH;
    const thumbHeight = Math.round(THUMBNAIL_WIDTH / aspectRatio);
    const thumbnailImage = image.resize({ width: thumbWidth, height: thumbHeight, quality: 'good' });

    // Convert to JPEG with data URI prefix
    const jpegBuffer = resizedImage.toJPEG(JPEG_QUALITY);
    const thumbBuffer = thumbnailImage.toJPEG(THUMBNAIL_QUALITY);
    const base64 = `data:image/jpeg;base64,${jpegBuffer.toString("base64")}`;
    const thumbnailBase64 = `data:image/jpeg;base64,${thumbBuffer.toString("base64")}`;
    const size = jpegBuffer.length;
    const sizeKB = (size / 1024).toFixed(1);
    const thumbSizeKB = (thumbBuffer.length / 1024).toFixed(1);

    console.log(`Screenshot: Captured ${scaledWidth}x${scaledHeight} (${SCREENSHOT_SCALE * 100}% scale), ${sizeKB} KB, thumb ${thumbWidth}x${thumbHeight} ${thumbSizeKB} KB`);

    // Upload to API
    // Note: uniqueCode is passed in URL, timestamp set by database (CreatedDate column)
    const endpoint = postScreenshotAPI.replace("{device_unique_code}", uniqueCode);
    const payload = {
      image: base64,
      thumbnail: thumbnailBase64,
      imageSize: size,
      thumbnailSize: thumbBuffer.length,
    };

    const response = await axios.post(endpoint, payload, {
      headers: {
        Authorization: `Basic ${uniqueCode}:${apiToken}`,
        "Content-Type": "application/json",
      },
      validateStatus: () => true,
      timeout: 30000,
    });

    const uploadSuccess = response.status === 200 || response.status === 201;
    console.log(`Screenshot: Upload ${uploadSuccess ? "SUCCESS" : "FAILED"} (${response.status})`);

    return {
      success: true,
      imageSize: size,
      imageSizeKB: sizeKB,
      thumbSize: thumbBuffer.length,
      thumbSizeKB,
      uploaded: uploadSuccess,
      uploadStatus: response.status,
      note: uploadSuccess ? "Uploaded to API" : `Upload failed: HTTP ${response.status}`,
    };
  } catch (err) {
    console.error("Screenshot: Error -", err.message);
    return {
      success: false,
      error: err.message,
      uploaded: false,
    };
  }
}
