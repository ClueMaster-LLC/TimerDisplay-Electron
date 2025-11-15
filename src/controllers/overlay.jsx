import React, { useState, useEffect, useRef } from "react";
import {
  useTimerState,
  useCountUpTimerState,
  useOverlayState,
  useGameActions,
} from "../state/store";

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
  clueSize = 2,
}) => {
  if (totalClues === 0) return null;

  const [viewport, setViewport] = useState(() => {
    if (typeof window === "undefined") {
      return { width: 0, height: 0 };
    }
    return { width: window.innerWidth, height: window.innerHeight };
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const getIconSize = () => {
    const width = viewport.width || 0;
    const fallbackWidth = 900;
    const effectiveWidth = width > 0 ? width : fallbackWidth;

    const denominators = {
      0: 16,
      1: 14,
      2: 12,
      3: 10,
    };

    const denominator = denominators.hasOwnProperty(clueSize)
      ? denominators[clueSize]
      : denominators[1];

    let baseSize = effectiveWidth / denominator;

    if (totalClues > 8) baseSize *= 0.85;
    else if (totalClues > 6) baseSize *= 0.9;

    return Math.min(baseSize, 150);
  };

  const iconSize = getIconSize();
  const gap = Math.max(8, iconSize / 5);
  const padding = Math.max(16, iconSize * 0.3);

  const clueIcons = Array.from({ length: totalClues }, (_, index) => (
    <ClueIcon key={index} size={iconSize} isUsed={index < usedClues} />
  ));

  const getPositionStyle = () => {
    const positions = {
      Left: {
        left: `${padding}px`,
        top: "50%",
        transform: "translateY(-50%)",
        flexDirection: "column",
      },
      Right: {
        right: `${padding}px`,
        top: "50%",
        transform: "translateY(-50%)",
        flexDirection: "column",
      },
      Top: {
        top: `${padding}px`,
        left: "50%",
        transform: "translateX(-50%)",
        flexDirection: "row",
      },
      Bottom: {
        bottom: `${padding}px`,
        left: "50%",
        transform: "translateX(-50%)",
        flexDirection: "row",
      },
      "vertical-left": {
        left: `${padding}px`,
        top: "50%",
        transform: "translateY(-50%)",
        flexDirection: "column",
      },
      "vertical-right": {
        right: `${padding}px`,
        top: "50%",
        transform: "translateY(-50%)",
        flexDirection: "column",
      },
      "horizontal-top": {
        top: `${padding}px`,
        left: "50%",
        transform: "translateX(-50%)",
        flexDirection: "row",
      },
      "horizontal-bottom": {
        bottom: `${padding}px`,
        left: "50%",
        transform: "translateX(-50%)",
        flexDirection: "row",
      },
    };
    return positions[position] || positions["Left"];
  };

  return (
    <div
      className="absolute flex"
      style={{
        ...getPositionStyle(),
        gap: `${gap}px`,
      }}
    >
      {clueIcons}
    </div>
  );
};

const GameTimerDisplay = ({ onTimeEnd, gameInfo, roomInfo }) => {
  const countdownTimer = useTimerState();
  const countUpTimer = useCountUpTimerState();
  const gameActions = useGameActions();
  const countdownIntervalRef = useRef(null);
  const countUpIntervalRef = useRef(null);
  const countUpBaseRef = useRef(0);
  const countUpStartRef = useRef(null);
  const lastGameIdRef = useRef(null);
  const [viewport, setViewport] = useState(() => {
    if (typeof window === "undefined") {
      return { width: 0, height: 0 };
    }
    return { width: window.innerWidth, height: window.innerHeight };
  });
  const currentGameId = gameInfo?.gameId ?? null;
  const isTimeLimit = roomInfo?.IsTimeLimit ?? gameInfo?.isTimeLimit ?? true;
  const isPaused = countdownTimer.paused;

  useEffect(() => {
    if (isTimeLimit && gameInfo?.gameEndDateTime) {
      gameActions.setGameEndTime(gameInfo.gameEndDateTime);
    } else {
      gameActions.setGameEndTime(null);
    }
  }, [isTimeLimit, gameInfo?.gameEndDateTime, gameActions]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    if (lastGameIdRef.current !== currentGameId) {
      lastGameIdRef.current = currentGameId;
      countUpBaseRef.current = 0;
      countUpStartRef.current = null;
      gameActions.resetCountUpTimer();

      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      if (countUpIntervalRef.current) {
        clearInterval(countUpIntervalRef.current);
        countUpIntervalRef.current = null;
      }
    }
  }, [currentGameId, isTimeLimit, gameActions]);

  const calculateTimeLeft = () => {
    if (!countdownTimer.gameEndTime) {
      return 0;
    }

    const nowUTC = new Date();

    const gameEndTimeStr = countdownTimer.gameEndTime.endsWith("Z")
      ? countdownTimer.gameEndTime
      : countdownTimer.gameEndTime + "Z";
    const gameEndTimeUTC = new Date(gameEndTimeStr);

    const remainingTimeMs = gameEndTimeUTC.getTime() - nowUTC.getTime();
    const remainingTimeSeconds = Math.max(
      0,
      Math.floor(remainingTimeMs / 1000)
    );

    return remainingTimeSeconds;
  };

  useEffect(() => {
    if (!isTimeLimit) {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      return;
    }

    if (isPaused || !countdownTimer.gameEndTime) {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      return;
    }

    const timeLeft = calculateTimeLeft();
    gameActions.setTimerTime(timeLeft);

    if (timeLeft <= 0) {
      onTimeEnd?.();
      return;
    }

    countdownIntervalRef.current = setInterval(() => {
      const newTimeLeft = calculateTimeLeft();
      gameActions.setTimerTime(newTimeLeft);

      if (newTimeLeft <= 0) {
        onTimeEnd?.();
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
      }
    }, 1000);

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [
    isPaused,
    countdownTimer.gameEndTime,
    onTimeEnd,
    isTimeLimit,
    currentGameId,
    gameActions,
  ]);

  useEffect(() => {
    if (isTimeLimit) {
      countUpBaseRef.current = 0;
      countUpStartRef.current = null;
      if (countUpIntervalRef.current) {
        clearInterval(countUpIntervalRef.current);
        countUpIntervalRef.current = null;
      }
      return;
    }

    const stopInterval = () => {
      if (countUpIntervalRef.current) {
        clearInterval(countUpIntervalRef.current);
        countUpIntervalRef.current = null;
      }
    };

    const finalizeElapsed = (updateStore) => {
      if (!countUpStartRef.current) return;
      const elapsed = Math.floor((Date.now() - countUpStartRef.current) / 1000);
      if (elapsed > 0) {
        countUpBaseRef.current += elapsed;
        if (updateStore) {
          gameActions.setCountUpTime(countUpBaseRef.current);
        }
      } else if (updateStore) {
        gameActions.setCountUpTime(countUpBaseRef.current);
      }
      countUpStartRef.current = null;
    };

    if (isPaused) {
      finalizeElapsed(true);
      stopInterval();
      return;
    }

    if (!countUpStartRef.current) {
      countUpStartRef.current = Date.now();
    }

    const updateElapsed = () => {
      const elapsed = Math.floor((Date.now() - countUpStartRef.current) / 1000);
      const total = countUpBaseRef.current + elapsed;
      gameActions.setCountUpTime(total);
    };

    updateElapsed();
    countUpIntervalRef.current = setInterval(updateElapsed, 1000);

    return () => {
      stopInterval();
      finalizeElapsed(false);
    };
  }, [isTimeLimit, isPaused, gameActions, currentGameId]);

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    return [hours, mins, secs]
      .map((unit) => unit.toString().padStart(2, "0"))
      .join(":");
  };

  const getTimerStyle = () => {
    const minDimension = Math.min(viewport.width, viewport.height);
    const baseFontSize = Math.max(48, Math.round(minDimension * 0.18));

    return {
      fontSize: `${baseFontSize}px`,
      lineHeight: 1,
    };
  };

  return (
    <div
      className="font-mono font-bold text-white transition-colors duration-300"
      style={getTimerStyle()}
    >
      {formatTime(isTimeLimit ? countdownTimer.time : countUpTimer.time)}
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
      } catch (error) {}
    };

    fetchRoomInfo();
  }, []);

  if (!overlayState.visible) return null;

  const cluesAllowed = roomInfo?.CluesAllowed === true;
  const maxClues = cluesAllowed
    ? roomInfo?.MaxNoOfClues || gameInfo?.noOfClues || 0
    : 0;
  const clueSize = roomInfo?.ClueSizeOnScreen ?? 2;
  const cluePosition = roomInfo?.CluePositionVertical || "Left";

  return (
    <div className="absolute inset-0 pointer-events-none z-20">
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30">
        <GameTimerDisplay
          onTimeEnd={onTimerEnd}
          gameInfo={gameInfo}
          roomInfo={roomInfo}
        />
      </div>

      {gameInfo && cluesAllowed && maxClues > 0 && (
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
