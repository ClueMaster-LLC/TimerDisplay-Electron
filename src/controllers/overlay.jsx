import React, { useState, useEffect, useRef } from "react";
import { useTimerState, useOverlayState } from "../state/store";

const ClueIcon = ({ size, isUsed = false }) => (
  <div
    className={`
      rounded-full border-2 flex items-center justify-center
      transition-all duration-300 font-bold
      ${
        isUsed
          ? "bg-gray-500 border-gray-400 text-gray-300"
          : "bg-black border-gray-600 text-white"
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

  const iconSize =
    totalClues <= 4 ? 60 : totalClues <= 6 ? 50 : totalClues <= 8 ? 45 : 40;
  const gap = Math.max(8, iconSize / 5);

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

  // main timer countdown logic
  useEffect(() => {
    if (!timerState.paused && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          const newTime = prev - 1;
          onTimeUpdate?.(newTime);

          if (newTime <= 0) {
            onTimeEnd?.();
            return 0;
          }

          return newTime;
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
  }, [timerState.paused, timeLeft, onTimeEnd, onTimeUpdate]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const getTimerColor = () => {
    if (timeLeft <= 30) return "text-red-500";
    if (timeLeft <= 60) return "text-yellow-500";
    return "text-white";
  };

  return (
    <div
      className={`text-8xl font-mono font-bold ${getTimerColor()} transition-colors duration-300`}
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
