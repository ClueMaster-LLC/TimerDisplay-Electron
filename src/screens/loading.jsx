import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import StartupMessage from "../components/StartupMessage";

export default function Loading() {
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const [progressMax, setProgressMax] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    window.LoadingBackend.worker();
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
