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
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);

  useEffect(() => {
    if (
      backgroundMusic &&
      gameInfo?.isMusic &&
      isGameActive &&
      !isMusicPlaying
    ) {
      startBackgroundMusic();
    }
  }, [backgroundMusic, gameInfo?.isMusic, isGameActive, isMusicPlaying]);

  useEffect(() => {
    if (!isGameActive && isMusicPlaying) {
      stopBackgroundMusic();
    }
  }, [isGameActive, isMusicPlaying]);

  const mainPlayerRef = useRef(null);
  const musicRef = useRef(null);

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
    const handleWorkerEvent = (data) => {
      if (
        data.worker === "timerRequests" &&
        data.component === "timer" &&
        data.action === "update"
      ) {
      }
    };

    const workersEventHandler =
      window.WorkersBackend.onWorkerEvent(handleWorkerEvent);
    return () => workersEventHandler();
  }, []);

  useEffect(() => {
    if (!clue) {
      gameActions.hideClue();
      unmuteBackgroundMusic();
      return;
    }

    if (clue.clueStatus) {
      displayClue(clue);
    } else {
      gameActions.hideClue();
      unmuteBackgroundMusic();
    }
  }, [clue]);

  // game command handlers
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

  const handleStopGame = () => {
    setIsGameActive(false);
    setIsPaused(false);

    gameActions.hideClue();
    gameActions.pauseTimer();
    pauseMainVideo();
    stopBackgroundMusic();

    try {
      window.WorkersBackend.stop(["clue", "timerRequests"]);
    } catch (error) {
      console.error("Game: Error stopping workers:", error);
    }
  };

  const handlePlayEndVideo = async (data) => {
    handleStopGame();

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
    } catch (error) {
      console.error("Game: Error loading end video:", error);
    }
  };

  const handleResetGame = () => {
    gameActions.hideClue();
    gameActions.pauseTimer();
    pauseMainVideo();
    stopBackgroundMusic();

    setVideos({ intro: null, main: null, end: null });
    setOverlayVideo({ isVisible: false, src: null, type: null });
    setBackgroundMusic(null);
    setIsMusicPlaying(false);
    setTimerInitialized(false);
    setIsPaused(false);

    try {
      window.WorkersBackend.stop(["clue", "timerRequests"]);
    } catch (error) {
      console.error("Game: Error stopping workers:", error);
    }
  };

  const handlePauseGame = async () => {
    pauseMainVideo();
    pauseBackgroundMusic();
    gameActions.pauseTimer();
    setIsPaused(true);
    try {
      const latestTime = await window.GameBackend.calculateInitialTimer();
      if (latestTime !== null) {
        gameActions.setTimerTime(latestTime);
      }
    } catch (error) {
      console.error("Game: Error fetching latest time on pause:", error);
    }
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
      console.error("Game: Error loading intro video:", error);
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
    } catch (error) {
      console.error("Game: Error starting main game:", error);
    }
    await initializeTimer();
    setTimerInitialized(true);

    // if we were paused, reset the paused state
    if (isPaused) {
      setIsPaused(false);
    }

    if (gameInfo?.isVideo) {
      resumeMainVideo();
    }

    // resume background music if it was playing before pause
    if (gameInfo?.isMusic && backgroundMusic) {
      resumeBackgroundMusic();
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
        console.error("Game: Error sending intro post request:", error);
        await startMainGame();
      }
    } else if (type === "end-win" || type === "end-loss") {
      gameActions.setOverlayVisible(true);
    }
  };

  const startBackgroundMusic = () => {
    if (backgroundMusic && musicRef.current && !isMusicPlaying) {
      musicRef.current.currentTime = 0;
      const playPromise = musicRef.current.play();
      playPromise
        ?.then(() => {
          console.log("Game: Background music started successfully");
          setIsMusicPlaying(true);
        })
        .catch((error) => {
          console.error("Game: Error playing background music:", error);
        });
    } else {
      console.log("Game: Cannot start background music - missing requirements");
    }
  };

  const stopBackgroundMusic = () => {
    if (musicRef.current && isMusicPlaying) {
      console.log("Game: Stopping background music");
      musicRef.current.pause();
      musicRef.current.currentTime = 0;
      setIsMusicPlaying(false);
    }
  };

  const pauseBackgroundMusic = () => {
    if (musicRef.current && isMusicPlaying) {
      console.log("Game: Pausing background music");
      musicRef.current.pause();
      setIsMusicPlaying(false);
    }
  };

  const resumeBackgroundMusic = () => {
    if (musicRef.current && backgroundMusic && !isMusicPlaying) {
      console.log("Game: Resuming background music");
      const playPromise = musicRef.current.play();
      playPromise
        ?.then(() => {
          console.log("Game: Background music resumed successfully");
          setIsMusicPlaying(true);
        })
        .catch((error) => {
          console.error("Game: Error resuming background music:", error);
        });
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
      const initialTime = await window.GameBackend.calculateInitialTimer();
      if (initialTime !== null) {
        gameActions.setTimerTime(initialTime);
        const gameEndTime = await window.StoreBackend.get("gameEndTime");
        if (gameEndTime) {
          gameActions.setGameEndTime(gameEndTime);
        }
      }
    } catch (error) {
      console.error("Timer: Error:", error);
    }
  };

  const pauseMainVideo = () => {
    mainPlayerRef.current?.pause();
  };

  const resumeMainVideo = () => {
    const promise = mainPlayerRef.current?.play();
    promise?.catch((error) => {
      console.error("Game: Error resuming video:", error);
    });
  };

  const handleTimerEnd = async () => {
    gameActions.pauseTimer();
    pauseMainVideo();
    stopBackgroundMusic();
    window.dispatchEvent(
      new CustomEvent("gameCommand", {
        detail: {
          command: "PLAY_END_VIDEO",
          data: { isWin: false }, // timer ended = loss
        },
      })
    );

    try {
      await window.GameBackend.timerEndRequest?.();
    } catch (error) {
      console.error("Game: Error sending timer end request:", error);
    }
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

      muteBackgroundMusic();
    } catch (error) {
      console.error("Game: Error displaying clue:", error);
    }
  };

  const determineClueType = (clueData) => {
    const apiType = clueData.clueType?.toLowerCase();
    if (apiType === "message") return "text";
    if (apiType === "video") return "video";
    if (apiType === "audio") return "audio";
    if (apiType === "image" || apiType === "photo") return "image";

    const filename = clueData.clueFilename?.toLowerCase() || "";
    if (filename.match(/\.(mp4|webm|avi|mov|mkv)$/)) return "video";
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
