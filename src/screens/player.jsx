import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStoreValue } from "../state/store";
import Idle from "../controllers/idle";
import Game from "../controllers/game";

export default function Player() {
  const navigate = useNavigate();
  const gameInfo = useStoreValue("gameInfo", null);
  const [isGameActive, setIsGameActive] = useState(false);

  useEffect(() => {
    const initializeWorkers = async () => {
      try {
        await window.WorkersBackend.start(["gameInfo"]);
      } catch (error) {
        console.error("Player: Failed to initialize workers:", error);
      }
    };

    initializeWorkers();

    const workersEventHandler = window.WorkersBackend.onWorkerEvent((data) => {
      switch (data.event) {
        case "reset":
          navigate("/");
          break;
        case "syncRequest":
          navigate("/loading");
          break;
      }
    });

    return () => {
      window.WorkersBackend.stop(["gameInfo"]);
      workersEventHandler();
    };
  }, []);

  useEffect(() => {
    if (!gameInfo) {
      setIsGameActive(false);
      return;
    }

    // check if game is actually running - these are the good statuses
    const activeStatuses = [1, 4, 5, 6, 7];
    const shouldBeActive = activeStatuses.includes(gameInfo.gameStatus);

    setIsGameActive(shouldBeActive);
  }, [gameInfo?.gameStatus]);

  return (
    <div className="player-screen h-screen w-screen">
      {isGameActive ? <Game gameInfo={gameInfo} /> : <Idle />}
    </div>
  );
}
