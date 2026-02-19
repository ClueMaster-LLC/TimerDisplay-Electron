import { HashRouter, Routes, Route } from "react-router-dom";
import { useState, useEffect } from "react";
import { initializeStoreSync, cleanupStoreSync } from "./state/store";
import Splash from "./screens/splash";
import Authentication from "./screens/authentication";
import Loading from "./screens/loading";
import Player from "./screens/player";
import DebugOverlay from "./components/DebugOverlay";

// Closing overlay component
function ClosingOverlay() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-6 p-8">
        {/* Spinner */}
        <div className="relative">
          <div className="w-16 h-16 border-4 border-white/20 rounded-full"></div>
          <div className="absolute top-0 left-0 w-16 h-16 border-4 border-transparent border-t-white rounded-full animate-spin"></div>
        </div>
        
        {/* Text */}
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-white mb-2">
            Closing Application
          </h2>
          <p className="text-white/70 text-lg">
            Please wait...
          </p>
        </div>
      </div>
    </div>
  );
}

// Screenshot test result toast component
function ScreenshotToast({ result, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 8000);
    return () => clearTimeout(timer);
  }, [onClose]);

  // Determine colors based on capture and upload success
  const captureSuccess = result.success;
  const uploadSuccess = result.uploaded === true;
  const uploadAttempted = result.uploaded !== undefined;
  
  // Green if both succeeded, yellow if capture ok but upload failed, red if capture failed
  let bgColor = 'bg-red-900/90';
  let borderColor = 'border-red-500/50';
  let icon = '\u2717'; // ✗
  
  if (captureSuccess) {
    if (!uploadAttempted || uploadSuccess) {
      bgColor = 'bg-green-900/90';
      borderColor = 'border-green-500/50';
      icon = '\u2713'; // ✓
    } else {
      bgColor = 'bg-yellow-900/90';
      borderColor = 'border-yellow-500/50';
      icon = '\u26A0'; // ⚠
    }
  }

  return (
    <div className="fixed top-4 right-4 z-[9999] max-w-sm">
      <div className={`rounded-lg shadow-lg p-4 ${bgColor} border ${borderColor}`}>
        <div className="flex items-start gap-3">
          <span className="text-2xl">{icon}</span>
          <div className="flex-1">
            <h3 className="font-semibold text-white">
              {captureSuccess ? 'Screenshot Captured' : 'Screenshot Failed'}
            </h3>
            {captureSuccess ? (
              <div className="text-sm text-white/70 mt-1">
                <p>Size: {result.imageSizeKB} KB</p>
                {uploadAttempted && (
                  <p className={uploadSuccess ? 'text-green-300' : 'text-yellow-300'}>
                    {result.note || (uploadSuccess ? 'Uploaded to API' : 'Upload pending')}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-white/70 mt-1">{result.error}</p>
            )}
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white text-xl">×</button>
        </div>
      </div>
    </div>
  );
}

export default function main() {
  const [isClosing, setIsClosing] = useState(false);
  const [screenshotResult, setScreenshotResult] = useState(null);

  useEffect(() => {
    initializeStoreSync();
    return () => {
      cleanupStoreSync();
    };
  }, []);

  // Listen for app closing event
  useEffect(() => {
    if (window.AppBackend?.onClosing) {
      const unsubscribe = window.AppBackend.onClosing(() => {
        setIsClosing(true);
      });
      return () => unsubscribe();
    }
  }, []);

  // Listen for screenshot test results
  useEffect(() => {
    if (window.AppBackend?.onScreenshotTestResult) {
      const unsubscribe = window.AppBackend.onScreenshotTestResult((result) => {
        setScreenshotResult(result);
      });
      return () => unsubscribe?.();
    }
  }, []);

  return (
    <>
      {isClosing && <ClosingOverlay />}
      {screenshotResult && (
        <ScreenshotToast 
          result={screenshotResult} 
          onClose={() => setScreenshotResult(null)} 
        />
      )}
      <HashRouter>
        <Routes>
          <Route path="/" element={<Splash />} />
          <Route path="/authentication" element={<Authentication />} />
          <Route path="/loading" element={<Loading />} />
          <Route path="/player" element={<Player />} />
        </Routes>
        <DebugOverlay />
      </HashRouter>
    </>
  );
}
