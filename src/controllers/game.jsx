import React, { useEffect, useRef, useState } from "react";
import { useStoreValue, useGameActions } from "../state/store";
import VideoPlayer from "./video-player";
import Overlay from "./overlay";
import CluePlayer from "./clue-player";
import OverlayVideoPlayer from "./overlay-video-player";

export default function Game({ gameInfo }) {
  const clue = useStoreValue("clue", null);
  const gameActions = useGameActions();

  const [isGameActive, setIsGameActive] = useState(false);
  const [timerInitialized, setTimerInitialized] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const [videos, setVideos] = useState({
    intro: null,
    main: null,
    end: null,
  });

  const [overlayVideo, setOverlayVideo] = useState({
    isVisible: false,
    src: null,
    type: null, // 'intro', 'end-win', 'end-loss'
  });

  const [backgroundMusic, setBackgroundMusic] = useState(null);

  const mainPlayerRef = useRef(null);
  const musicRef = useRef(null);
  const currentClueRef = useRef(null); // Track the currently active clue

  useEffect(() => {
    const handleGameCommand = (event) => {
      const { command, data } = event.detail;

      switch (command) {
        case "START_GAME":
          handleStartGame(data);
          break;
        case "RESUME_GAME":
          handleResumeGame(data);
          break;
        case "STOP_GAME":
          handleStopGame();
          break;
        case "PLAY_END_VIDEO":
          handlePlayEndVideo(data);
          break;
        case "RESET_GAME":
          handleResetGame();
          break;
        case "PAUSE_GAME":
          handlePauseGame();
          break;
        default:
          console.warn("Unknown game command:", command);
      }
    };

    const handleUnmuteMusic = () => {
      unmuteBackgroundMusic();
    };

    window.addEventListener("gameCommand", handleGameCommand);
    window.addEventListener("unmuteBackgroundMusic", handleUnmuteMusic);
    return () => {
      window.removeEventListener("gameCommand", handleGameCommand);
      window.removeEventListener("unmuteBackgroundMusic", handleUnmuteMusic);
    };
  }, []);

  useEffect(() => {
    setupTimerAPI();
    return () => cleanupTimerAPI();
  }, []);

  useEffect(() => {
    const handleClueChange = async () => {
      if (!clue) {
        gameActions.hideClue();
        unmuteBackgroundMusic();
        currentClueRef.current = null;
        return;
      }

      if (clue.clueStatus) {
        // Check if there's a different clue currently playing
        const previousClue = currentClueRef.current;
        const newClueId = clue.gameClueId || clue.clueId;
        const prevClueId = previousClue?.gameClueId || previousClue?.clueId;

        if (previousClue && prevClueId && prevClueId !== newClueId) {
          const prevClueType = determineClueType(previousClue);
          if (prevClueType === "video" || prevClueType === "audio") {
            try {
              const gameId = previousClue.gameId || gameInfo?.gameId;
              if (gameId && prevClueId) {
                await window.GameBackend.postClueStatus(gameId, prevClueId);
              }
            } catch (error) { }
          }

          gameActions.hideClue();
          unmuteBackgroundMusic();

          await new Promise((resolve) => setTimeout(resolve, 50));
        }

        currentClueRef.current = clue;

        displayClue(clue);
      } else {
        gameActions.hideClue();
        unmuteBackgroundMusic();
        currentClueRef.current = null;
      }
    };

    handleClueChange();
  }, [clue]);

  const handleStartGame = async (data) => {
    setIsGameActive(true);

    if (data.isIntro) {
      await playIntroVideo();
    } else {
      await startMainGame();
    }
  };

  const handleResumeGame = async (data) => {
    setIsGameActive(true);

    if (data.isIntro) {
      await playIntroVideo();
    } else {
      await startMainGame();
    }
  };

  const handleStopGame = async () => {
    setIsGameActive(false);
    setIsPaused(false);

    const activeClue = currentClueRef.current;
    if (activeClue) {
      const gameId = activeClue.gameId || gameInfo?.gameId;
      const clueId = activeClue.clueId || activeClue.gameClueId;

      if (gameId && clueId) {
        try {
          console.log("Game: Posting clue status for stopped game", { gameId, clueId });
          await window.GameBackend.postClueStatus(gameId, clueId);
        } catch (error) {
          console.error("Game: Error posting clue status on stop:", error);
        }
      }
    }

    gameActions.hideClue();
    gameActions.pauseTimer();
    pauseMainVideo();
    stopBackgroundMusic();
    currentClueRef.current = null;

    try {
      await window.StoreBackend.set("clue", null);
      window.WorkersBackend.stop(["clue", "timerRequests"]);
    } catch (error) { }
  };

  const handlePlayEndVideo = async (data) => {
    await handleStopGame();

    try {
      const endVideo = await window.GameBackend.getEndVideo();
      if (endVideo) {
        setVideos((prev) => ({ ...prev, end: endVideo }));
        setOverlayVideo({
          isVisible: true,
          src: endVideo,
          type: data.isWin ? "end-win" : "end-loss",
        });
      }
    } catch (error) { }
  };

  const handleResetGame = () => {
    gameActions.hideClue();
    gameActions.pauseTimer();
    pauseMainVideo();
    stopBackgroundMusic();
    currentClueRef.current = null;

    setVideos({ intro: null, main: null, end: null });
    setOverlayVideo({ isVisible: false, src: null, type: null });
    setBackgroundMusic(null);
    setTimerInitialized(false);
    setIsPaused(false);

    try {
      window.WorkersBackend.stop(["clue", "timerRequests"]);
    } catch (error) { }
  };

  const handlePauseGame = async () => {
    pauseMainVideo();
    pauseBackgroundMusic();
    gameActions.pauseTimer();
    setIsPaused(true);
  };

  const playIntroVideo = async () => {
    try {
      const introVideo = await window.GameBackend.getIntroVideo();
      if (introVideo) {
        setVideos((prev) => ({ ...prev, intro: introVideo }));
        setOverlayVideo({
          isVisible: true,
          src: introVideo,
          type: "intro",
        });
      } else {
        await startMainGame();
      }
    } catch (error) {
      await startMainGame();
    }
  };

  const startMainGame = async () => {
    try {
      const [mainVideo, music] = await Promise.all([
        window.GameBackend.getMainVideo(),
        window.GameBackend.getBackgroundMusic(),
      ]);

      if (gameInfo?.isVideo) {
        setVideos((prev) => ({ ...prev, main: mainVideo }));
      }
      if (gameInfo?.isMusic) {
        setBackgroundMusic(music);
      }
      await window.WorkersBackend.start(["clue", "timerRequests"]);
    } catch (error) { }

    await initializeTimer();
    setTimerInitialized(true);

    if (isPaused) {
      setIsPaused(false);
    }

    if (gameInfo?.isVideo) {
      resumeMainVideo();
    }

    // Play or resume background music
    if (gameInfo?.isMusic) {
      if (isPaused) {
        resumeBackgroundMusic();
      } else {
        playBackgroundMusic();
      }
    }

    gameActions.resumeTimer();
    gameActions.setOverlayVisible(true);
  };

  const handleOverlayVideoEnd = async () => {
    const { type } = overlayVideo;

    setOverlayVideo({
      isVisible: false,
      src: null,
      type: null,
    });

    if (type === "intro") {
      try {
        await window.GameBackend.introPostRequest();

        await startMainGame();
      } catch (error) {
        await startMainGame();
      }
    } else if (type === "end-win" || type === "end-loss") {
      gameActions.setOverlayVisible(true);
    }
  };

  const playBackgroundMusic = () => {
    if (musicRef.current && !musicRef.current.paused) {
      return;
    }
    if (musicRef.current) {
      musicRef.current.play().catch((error) => { });
    }
  };

  const stopBackgroundMusic = () => {
    if (musicRef.current) {
      musicRef.current.pause();
      musicRef.current.currentTime = 0;
    }
  };

  const pauseBackgroundMusic = () => {
    if (musicRef.current) {
      musicRef.current.pause();
    }
  };

  const resumeBackgroundMusic = () => {
    if (musicRef.current) {
      musicRef.current.play().catch((error) => { });
    }
  };

  const muteBackgroundMusic = () => {
    if (musicRef.current) {
      musicRef.current.muted = true;
    }
  };

  const unmuteBackgroundMusic = () => {
    if (musicRef.current) {
      musicRef.current.muted = false;
    }
  };

  const initializeTimer = async () => {
    try {
      const freshGameInfo = await window.StoreBackend.get("gameInfo");
      const gameEndDateTime = freshGameInfo?.gameEndDateTime;

      if (gameEndDateTime) {
        gameActions.setGameEndTime(gameEndDateTime);
      }
    } catch (error) { }
  };

  const pauseMainVideo = () => {
    mainPlayerRef.current?.pause();
  };

  const resumeMainVideo = () => {
    const promise = mainPlayerRef.current?.play();
    promise?.catch((error) => { });
  };

  const handleTimerEnd = async () => {
    gameActions.pauseTimer();
    pauseMainVideo();
    stopBackgroundMusic();

    window.dispatchEvent(
      new CustomEvent("gameCommand", {
        detail: {
          command: "PLAY_END_VIDEO",
          data: { isWin: false },
        },
      })
    );

    try {
      await window.GameBackend.timerEndRequest?.();
    } catch (error) { }
  };

  const displayClue = async (clueData) => {
    try {
      if (!clueData.clueFilename) {
        if (clueData.clueText) {
          gameActions.showClue("text", clueData.clueText, clueData);
        }
        return;
      }

      const mediaSrc = await window.GameBackend.getClueMedia(clueData);
      if (!mediaSrc) return;

      const clueType = determineClueType(clueData);
      gameActions.showClue(clueType, mediaSrc, clueData);

      if (clueType === "video" || clueType === "audio") {
        muteBackgroundMusic();
      }
    } catch (error) { }
  };

  const determineClueType = (clueData) => {
    const apiType = clueData.clueType?.toLowerCase();
    if (apiType === "message") return "text";
    if (apiType === "video") return "video";
    if (apiType === "audio") return "audio";
    if (apiType === "image" || apiType === "photo") return "image";

    const filename = clueData.clueFilename?.toLowerCase() || "";
    if (filename.match(/\.(mp4|webm|avi|mov|mkv|m4v)$/)) return "video";
    if (filename.match(/\.(mp3|wav|aac|m4a|ogg)$/)) return "audio";
    if (filename.match(/\.gif$/)) return "gif";
    if (filename.match(/\.(jpg|jpeg|png|bmp|svg|webp)$/)) return "image";

    return "image";
  };

  const setupTimerAPI = () => {
    window.GameTimer = {
      pause: gameActions.pauseTimer,
      resume: gameActions.resumeTimer,
      updateTime: gameActions.setTimerTime,
      showTestClue: (type, src) =>
        gameActions.showClue(type, src, { test: true }),
      hideClue: gameActions.hideClue,
    };
  };

  const cleanupTimerAPI = () => {
    delete window.GameTimer;
  };

  return (
    <div className="game-screen h-screen w-screen bg-black relative">
      {videos.main && gameInfo?.isVideo && (
        <div className="absolute inset-0 z-0">
          <VideoPlayer
            ref={mainPlayerRef}
            src={videos.main}
            autoplay={true}
            loop={true}
            muted={false}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <OverlayVideoPlayer
        src={overlayVideo.src}
        isVisible={overlayVideo.isVisible}
        onVideoEnd={handleOverlayVideoEnd}
      />

      {backgroundMusic && (
        <audio
          ref={musicRef}
          src={backgroundMusic}
          loop={true}
          muted={false}
          preload="auto"
        />
      )}

      <Overlay gameInfo={gameInfo} onTimerEnd={handleTimerEnd} />
      <CluePlayer mainPlayerRef={mainPlayerRef} />
    </div>
  );
}
