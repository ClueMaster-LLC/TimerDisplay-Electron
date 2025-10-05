import React, { useEffect, useState } from "react";
import { useStoreValue } from "../state/store";

export default function Idle() {
  const roomConfig = useStoreValue("roomConfig");
  const [backgroundImage, setBackgroundImage] = useState(null);

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
    const loadBackgroundImage = async () => {
      if (!roomConfig?.isImage) {
        setBackgroundImage(null);
        return;
      }

      try {
        const imagePath = await window.IdleBackend.getImage();
        setBackgroundImage(imagePath);
      } catch (error) {
        console.error("Idle: Error loading background image:", error);
        setBackgroundImage(null);
      }
    };

    loadBackgroundImage();
  }, [roomConfig?.isImage]);

  if (backgroundImage) {
    return (
      <div className="idle-screen h-screen w-screen bg-gray-900">
        <img
          src={backgroundImage}
          className="w-full h-full object-cover"
          alt="Background"
        />
      </div>
    );
  }

  return (
    <div className="idle-screen h-screen w-screen bg-gray-900 flex items-center justify-center">
      <div className="text-center p-8 text-white">
        <h2 className="text-4xl font-bold mb-4">Cluemaster Timer</h2>
        <p className="text-xl opacity-75">Idle Mode. Start a game.</p>
      </div>
    </div>
  );
}
