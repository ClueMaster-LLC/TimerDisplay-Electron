import React, { useState, useEffect, useRef } from "react";
import { useTimerState, useOverlayState, useGameActions } from "../state/store";

const ClueIcon = ({ size, isUsed = false }) => (
  <div
    className={`
      rounded-full border-2 flex items-center justify-center
      transition-all duration-300 font-bold backdrop-blur-sm
      ${
        isUsed
          ? "bg-transparent border-white/10 text-white/10"
          : "bg-slate-800/40 border-slate-600/40 text-white"
      }
    `}
    style={{
      width: size,
      height: size,
      fontSize: `${size * 0.4}px`,
    }}
  >
    ?
  </div>
);

const ClueIconGrid = ({
  totalClues = 0,
  usedClues = 0,
  position = "vertical-left",
  clueSize = 2,
}) => {
  if (totalClues === 0) return null;

  const getIconSize = () => {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const minDimension = Math.min(screenWidth, screenHeight);

    const sizeMultipliers = {
      0: 0.08,
      1: 0.1,
      2: 0.12,
      3: 0.15,
    };

    const multiplier = sizeMultipliers[clueSize] || sizeMultipliers[1];
    let baseSize = Math.max(40, minDimension * multiplier);

    if (totalClues > 8) baseSize *= 0.85;
    else if (totalClues > 6) baseSize *= 0.9;

    return Math.min(baseSize, 150); // Cap at 150px
  };

  const iconSize = getIconSize();
  const gap = Math.max(8, iconSize / 5);

  const clueIcons = Array.from({ length: totalClues }, (_, index) => (
    <ClueIcon key={index} size={iconSize} isUsed={index < usedClues} />
  ));

  const getPositionClasses = () => {
    const positions = {
      Left: "absolute left-4 top-1/2 transform -translate-y-1/2 flex-col",
      Right: "absolute right-4 top-1/2 transform -translate-y-1/2 flex-col",
      Top: "absolute top-4 left-1/2 transform -translate-x-1/2 flex-row",
      Bottom: "absolute bottom-4 left-1/2 transform -translate-x-1/2 flex-row",
      "vertical-left":
        "absolute left-4 top-1/2 transform -translate-y-1/2 flex-col",
      "vertical-right":
        "absolute right-4 top-1/2 transform -translate-y-1/2 flex-col",
      "horizontal-top":
        "absolute top-4 left-1/2 transform -translate-x-1/2 flex-row",
      "horizontal-bottom":
        "absolute bottom-4 left-1/2 transform -translate-x-1/2 flex-row",
    };
    return `${positions[position] || positions["Left"]} flex`;
  };

  return (
    <div className={getPositionClasses()} style={{ gap: `${gap}px` }}>
      {clueIcons}
    </div>
  );
};

const CountdownTimer = ({ onTimeEnd, onTimeUpdate, gameInfo }) => {
  const timerState = useTimerState();
  const gameActions = useGameActions();
  const intervalRef = useRef(null);

  // watch for changes in gameInfo.gameEndDateTime and update timer store
  useEffect(() => {
    if (gameInfo?.gameEndDateTime) {
      gameActions.setGameEndTime(gameInfo.gameEndDateTime);
    } else {
      console.log("Overlay: No gameEndDateTime in gameInfo");
    }
  }, [gameInfo?.gameEndDateTime]);

  // calculate time based on UTC gameEndTime
  const calculateTimeLeft = () => {
    if (!timerState.gameEndTime) {
      return 0;
    }

    // get current time in UTC
    const nowUTC = new Date();

    // parse gameEndTime - append 'Z' if not present to ensure UTC parsing
    const gameEndTimeStr = timerState.gameEndTime.endsWith("Z")
      ? timerState.gameEndTime
      : timerState.gameEndTime + "Z";
    const gameEndTimeUTC = new Date(gameEndTimeStr);

    // calculate remaining time in seconds
    const remainingTimeMs = gameEndTimeUTC.getTime() - nowUTC.getTime();
    const remainingTimeSeconds = Math.max(
      0,
      Math.floor(remainingTimeMs / 1000)
    );

    return remainingTimeSeconds;
  };

  // update timer every second
  useEffect(() => {
    if (timerState.paused || !timerState.gameEndTime) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // calculate and update immediately
    const timeLeft = calculateTimeLeft();
    gameActions.setTimerTime(timeLeft);

    if (timeLeft <= 0) {
      onTimeEnd?.();
      return;
    }

    // start interval to update every second
    intervalRef.current = setInterval(() => {
      const newTimeLeft = calculateTimeLeft();
      gameActions.setTimerTime(newTimeLeft);

      if (newTimeLeft <= 0) {
        onTimeEnd?.();
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [timerState.paused, timerState.gameEndTime, onTimeEnd]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const getTimerColor = () => {
    return "text-white";
  };

  return (
    <div
      className={`text-9xl font-mono font-bold ${getTimerColor()} transition-colors duration-300`}
    >
      {formatTime(timerState.time)}
    </div>
  );
};

export default function Overlay({ gameInfo, onTimerEnd }) {
  const overlayState = useOverlayState();
  const [roomInfo, setRoomInfo] = useState(null);

  useEffect(() => {
    const fetchRoomInfo = async () => {
      try {
        const info = await window.GameBackend.getRoomInfo();
        if (info) {
          setRoomInfo(info);
        }
      } catch (error) {
        console.error("Overlay: Error fetching room info:", error);
      }
    };

    fetchRoomInfo();
  }, []);

  if (!overlayState.visible) return null;
  const maxClues = roomInfo?.MaxNoOfClues || gameInfo?.noOfClues || 0;
  const clueSize = roomInfo?.ClueSizeOnScreen ?? 2;
  const cluePosition = roomInfo?.CluePositionVertical || "Left";

  return (
    <div className="absolute inset-0 pointer-events-none z-20">
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30">
        <CountdownTimer onTimeEnd={onTimerEnd} gameInfo={gameInfo} />
      </div>

      {gameInfo && maxClues > 0 && (
        <ClueIconGrid
          totalClues={maxClues}
          usedClues={gameInfo.noOfCluesUsed || 0}
          position={cluePosition}
          clueSize={clueSize}
        />
      )}
    </div>
  );
}
