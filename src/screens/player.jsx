import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStoreValue } from "../state/store";
import Idle from "../controllers/idle";
import Game from "../controllers/game";

export default function Player() {
  const navigate = useNavigate();
  const gameInfo = useStoreValue("gameInfo", null);

  const [introPlayed, setIntroPlayed] = useState(false);
  const [hasGameBeenActive, setHasGameBeenActive] = useState(false);
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
      setIntroPlayed(false);
      setIsGameActive(false);
      return;
    }

    const { gameStatus, isIntro } = gameInfo;

    if (gameStatus === 2) {
      if (hasGameBeenActive) {
        window.dispatchEvent(
          new CustomEvent("gameCommand", {
            detail: {
              command: "STOP_GAME",
            },
          })
        );
      } else {
        // if in idle and the game has not been active, ignore stop game
        setIsGameActive(false);
      }
    } else if (gameStatus === 3) {
      // reset game - close the game component and come back to idle
      if (hasGameBeenActive) {
        window.dispatchEvent(
          new CustomEvent("gameCommand", {
            detail: {
              command: "RESET_GAME",
            },
          })
        );
      }
      setIsGameActive(false);
      setHasGameBeenActive(false);
      setIntroPlayed(false);
    } else if (gameStatus === 4) {
      // pause game - pause the background video player, the background music and the overlay timer
      if (hasGameBeenActive) {
        window.dispatchEvent(
          new CustomEvent("gameCommand", {
            detail: {
              command: "PAUSE_GAME",
            },
          })
        );
      }
    } else if (gameStatus === 5 || gameStatus === 6) {
      if (hasGameBeenActive) {
        window.dispatchEvent(
          new CustomEvent("gameCommand", {
            detail: {
              command: "PLAY_END_VIDEO",
              data: { isWin: gameStatus === 6 },
            },
          })
        );
      } else {
        // if in idle and the game has not been active, ignore play end video
        setIsGameActive(false);
      }
    } else if (gameStatus === 7) {
      if (!introPlayed) {
        setHasGameBeenActive(true);
        setIsGameActive(true); // Show game
        console.log("game status 7, intro : ", isIntro && !introPlayed);

        // Dispatch event after a small delay to ensure Game component is mounted
        setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("gameCommand", {
              detail: {
                command: "START_GAME",
                data: { isIntro: isIntro },
              },
            })
          );
        }, 100);
      }
    } else if (gameStatus === 1) {
      setHasGameBeenActive(true);
      const shouldPlayIntro = isIntro && !introPlayed;
      console.log("game status 1, intro : ", shouldPlayIntro);

      if (shouldPlayIntro) {
        setIntroPlayed(true);
      }

      setIsGameActive(true);
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent("gameCommand", {
            detail: {
              command: "START_GAME",
              data: { isIntro: shouldPlayIntro },
            },
          })
        );
      }, 100);
    }
  }, [gameInfo?.gameStatus]);

  return (
    <div className="player-screen h-screen w-screen">
      {isGameActive ? <Game gameInfo={gameInfo} /> : <Idle />}
    </div>
  );
}
