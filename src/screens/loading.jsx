import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

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
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#191F26] text-white">
      <img src="./assets/loading_beaker.gif" className="w-64 h-56 m-4" />
      <p className="text-xl mb-6">{status}</p>
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
  );
}
