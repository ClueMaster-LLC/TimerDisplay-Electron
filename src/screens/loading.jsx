import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import StartupMessage from "../components/StartupMessage";

// Check if browser supports HEVC/H.265 codec
function checkHevcSupport() {
  const testVideo = document.createElement('video');
  const hevcCodecs = [
    'video/mp4; codecs="hev1.1.6.L93.B0"',
    'video/mp4; codecs="hvc1.1.6.L93.B0"',
    'video/mp4; codecs="hev1"',
    'video/mp4; codecs="hvc1"',
  ];

  for (const codec of hevcCodecs) {
    const support = testVideo.canPlayType(codec);
    if (support === 'probably' || support === 'maybe') {
      console.log(`Loading: HEVC supported via codec: ${codec}`);
      return true;
    }
  }
  console.log('Loading: HEVC NOT supported - transcoding will be enabled');
  return false;
}

// Check if VP9 has hardware-accelerated decode support
async function checkVp9HardwareSupport() {
  if (!navigator.mediaCapabilities) {
    console.log('Loading: mediaCapabilities API not available, assuming software VP9');
    return false;
  }

  // Try WebM container (more common for VP9)
  const webmConfig = {
    type: 'file',
    video: {
      contentType: 'video/webm; codecs="vp9"',
      width: 1920,
      height: 1080,
      framerate: 30,
      bitrate: 10000000
    }
  };

  try {
    const webmResult = await navigator.mediaCapabilities.decodingInfo(webmConfig);
    if (webmResult.powerEfficient) {
      console.log('Loading: VP9 (WebM) has hardware accelerated decode');
      return true;
    }
    console.log('Loading: VP9 (WebM) decode info:', { supported: webmResult.supported, smooth: webmResult.smooth, powerEfficient: webmResult.powerEfficient });
  } catch (e) {
    console.log('Loading: VP9 WebM check failed:', e.message);
  }

  // Try MP4 container as fallback
  const mp4Config = {
    type: 'file',
    video: {
      contentType: 'video/mp4; codecs="vp09.00.10.08"',
      width: 1920,
      height: 1080,
      framerate: 30,
      bitrate: 10000000
    }
  };

  try {
    const mp4Result = await navigator.mediaCapabilities.decodingInfo(mp4Config);
    if (mp4Result.powerEfficient) {
      console.log('Loading: VP9 (MP4) has hardware accelerated decode');
      return true;
    }
    console.log('Loading: VP9 (MP4) decode info:', { supported: mp4Result.supported, smooth: mp4Result.smooth, powerEfficient: mp4Result.powerEfficient });
  } catch (e) {
    console.log('Loading: VP9 MP4 check failed:', e.message);
  }

  console.log('Loading: VP9 does NOT have hardware accelerated decode - will transcode to H.264');
  return false;
}

export default function Loading() {
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const [progressMax, setProgressMax] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    // Check codec support before starting worker
    async function startLoading() {
      const hevcSupported = checkHevcSupport();
      console.log(`Loading: HEVC/H.265 native support: ${hevcSupported ? 'YES' : 'NO'}`);

      // Check VP9 hardware decode support
      const vp9HardwareSupported = await checkVp9HardwareSupport();
      console.log(`Loading: VP9 hardware decode support: ${vp9HardwareSupported ? 'YES' : 'NO (will transcode)'}`);

      // Pass codec support status to backend - transcode if NOT hardware supported
      window.LoadingBackend.worker({ hevcSupported, vp9HardwareSupported });
    }

    startLoading();
    const statusEventHandler = window.LoadingBackend.onLoadingStatusEvent(
      (event) => {
        if (event.status !== null) {
          setStatus(event.status);
        }
      }
    );
    const progressEventHandler = window.LoadingBackend.onLoadingProgressEvent(
      (event) => {
        if (event.progressMax !== null) {
          setProgressMax(event.progressMax);
        }
        if (event.progress === true) {
          setProgress((progress) => progress + 1);
        }
        // Handle percentage-based progress (e.g., transcoding)
        if (typeof event.progressPercent === 'number') {
          setProgress(event.progressPercent);
          setProgressMax(100);
        }
      }
    );
    const successEventHandler = window.LoadingBackend.onLoadingSuccessEvent(
      (event) => {
        if (event.success === true) {
          setProgressMax(0);
          setStatus("Media files confirmed");
          setTimeout(() => navigate("/player"), 3000);
        } else {
          if (event.success === false) {
            setProgressMax(0);
            setStatus("Failed to confirm media files. Please restart the app");
          }
        }
      }
    );
    return () => {
      statusEventHandler();
      progressEventHandler();
      successEventHandler();
    };
  }, []);

  return (
    <>
      <StartupMessage mode="other" />
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#191F26] text-white">
        <img
        src="./assets/loading_beaker.gif"
        className="m-4"
        style={{
          width: 'auto',      // scale with Electron window width
          maxWidth: 800,      // never bigger than the original 800px
          height: '80vh',     // keep aspect ratio
          maxHeight: 600      // never taller than 600px
        }}
      />
      <p className="text-xl mb-6 text-center px-4 break-words">
        {status}
      </p>
      {progressMax > 0 && (
        <div className="w-1/3">
          <div className="h-3 rounded border-2 border-[#4e71cf]">
            <div
              className="h-full bg-[#4e71cf] transition-all duration-300"
              style={{ width: `${(progress / progressMax) * 100}%` }}
            ></div>
          </div>
        </div>
      )}
      </div>
    </>
  );
}
