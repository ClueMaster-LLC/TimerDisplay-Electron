import React, { useState, useEffect, useRef } from "react";
import { useTimerState, useOverlayState } from "../state/store";

const ClueIcon = ({ size, isUsed = false }) => (
  <div
    className={`
      rounded-full border-2 flex items-center justify-center
      transition-all duration-300 font-bold backdrop-blur-sm
      ${
        isUsed
          ? "bg-gray-300/30 border-gray-400/30 text-gray-500"
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
}) => {
  if (totalClues === 0) return null;

  const getResponsiveIconSize = () => {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const minDimension = Math.min(screenWidth, screenHeight);

    let baseSize = Math.max(60, minDimension * 0.08);

    if (totalClues <= 4) return Math.min(baseSize * 1.2, 100);
    if (totalClues <= 6) return Math.min(baseSize * 1.0, 90);
    if (totalClues <= 8) return Math.min(baseSize * 0.9, 80);
    return Math.min(baseSize * 0.8, 70);
  };

  const iconSize = getResponsiveIconSize();
  const gap = Math.max(12, iconSize / 4);

  const clueIcons = Array.from({ length: totalClues }, (_, index) => (
    <ClueIcon key={index} size={iconSize} isUsed={index < usedClues} />
  ));

  const getPositionClasses = () => {
    const positions = {
      "vertical-left":
        "absolute left-4 top-1/2 transform -translate-y-1/2 flex-col",
      "vertical-right":
        "absolute right-4 top-1/2 transform -translate-y-1/2 flex-col",
      "horizontal-top":
        "absolute top-4 left-1/2 transform -translate-x-1/2 flex-row",
      "horizontal-bottom":
        "absolute bottom-4 left-1/2 transform -translate-x-1/2 flex-row",
    };
    return `${positions[position] || positions["vertical-left"]} flex`;
  };

  return (
    <div className={getPositionClasses()} style={{ gap: `${gap}px` }}>
      {clueIcons}
    </div>
  );
};

const CountdownTimer = ({ onTimeEnd, onTimeUpdate }) => {
  const timerState = useTimerState();
  const [timeLeft, setTimeLeft] = useState(timerState.time);
  const intervalRef = useRef(null);

  // sync timer with the store when it gets updated
  useEffect(() => {
    if (timerState.setTime !== null) {
      setTimeLeft(timerState.setTime);
    }
  }, [timerState.setTime]);

  // sync timer with store time when component mounts or timer state changes
  useEffect(() => {
    setTimeLeft(timerState.time);
  }, [timerState.time]);

  // main timer countdown logic
  useEffect(() => {
    if (!timerState.paused && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (timerState.gameEndTime) {
            const now = new Date();
            const gameEndTime = new Date(timerState.gameEndTime + "Z");
            const remainingTimeMs = gameEndTime.getTime() - now.getTime();
            const remainingTimeSeconds = Math.floor(remainingTimeMs / 1000);

            if (remainingTimeSeconds <= 0) {
              onTimeEnd?.();
              return 0;
            }

            onTimeUpdate?.(remainingTimeSeconds);
            return remainingTimeSeconds;
          } else {
            const newTime = prev - 1;
            onTimeUpdate?.(newTime);

            if (newTime <= 0) {
              onTimeEnd?.();
              return 0;
            }

            return newTime;
          }
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [
    timerState.paused,
    timeLeft,
    timerState.gameEndTime,
    onTimeEnd,
    onTimeUpdate,
  ]);

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
      {formatTime(timeLeft)}
    </div>
  );
};

export default function Overlay({ gameInfo, onTimerEnd }) {
  const overlayState = useOverlayState();

  if (!overlayState.visible) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-20">
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30">
        <CountdownTimer onTimeEnd={onTimerEnd} />
      </div>

      {gameInfo && (
        <ClueIconGrid
          totalClues={gameInfo.noOfClues || 0}
          usedClues={gameInfo.noOfCluesUsed || 0}
          position={overlayState.position}
        />
      )}
    </div>
  );
}
