import React, { useEffect, useState, useRef } from "react";
import { useStoreValue } from "../state/store";
import VideoPlayer from "./video-player";

export default function Idle() {
  const roomConfig = useStoreValue("roomConfig");
  const [mediaData, setMediaData] = useState(null);
  const [productName, setProductName] = useState("ClueMaster Timer Display");
  const videoRef = useRef(null);

  useEffect(() => {
    const initializeWorkers = async () => {
      try {
        await window.WorkersBackend.start(["updateRoom", "shutdownRestart"]);
      } catch (error) {
        console.error("Idle: Error initializing workers:", error);
      }
    };

    initializeWorkers();

    return () => {
      try {
        window.WorkersBackend.stop(["updateRoom", "shutdownRestart"]);
      } catch (error) {
        console.error("Idle: Error stopping workers:", error);
      }
    };
  }, []);

  useEffect(() => {
    const fetchProductName = async () => {
      try {
        const name = await window.SplashBackend.getProductName();
        setProductName(name);
      } catch (error) {
        console.error("Idle: Error fetching product name:", error);
      }
    };

    fetchProductName();
  }, []);

  useEffect(() => {
    const loadIdleMedia = async () => {
      if (!roomConfig?.isImage && !roomConfig?.isVideo) {
        setMediaData(null);
        return;
      }

      try {
        const media = await window.IdleBackend.getMedia();
        setMediaData(media);
      } catch (error) {
        console.error("Idle: Error loading media:", error);
        setMediaData(null);
      }
    };

    loadIdleMedia();
  }, [roomConfig?.isImage, roomConfig?.isVideo]);

  useEffect(() => {
    return () => {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
    };
  }, []);

  if (mediaData?.type === "video") {
    return (
      <div className="idle-screen h-screen w-screen bg-gray-900">
        <VideoPlayer
          ref={videoRef}
          src={mediaData.url}
          autoplay={true}
          loop={true}
          muted={false}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  if (mediaData?.type === "image") {
    return (
      <div className="idle-screen h-screen w-screen bg-gray-900">
        <img
          src={mediaData.url}
          className="w-full h-full object-cover"
          alt="Background"
        />
      </div>
    );
  }

  return (
    <div className="idle-screen h-screen w-screen bg-gray-900 flex items-center justify-center">
      <div className="text-center p-8 text-white">
        <h2 className="text-4xl font-bold mb-4">{productName}</h2>
        <p className="text-xl opacity-75">Idle Mode. Start a game.</p>
      </div>
    </div>
  );
}
