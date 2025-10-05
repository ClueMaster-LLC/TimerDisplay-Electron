import React, { useEffect, useRef, useState } from "react";
import { useStoreValue, useGameActions } from "../state/store";
import VideoPlayer from "./video-player";
import Overlay from "./overlay";
import CluePlayer from "./clue-player";

export default function Game({ gameInfo }) {
  const clue = useStoreValue("clue", null);
  const gameActions = useGameActions();

  const [videos, setVideos] = useState({
    intro: null,
    main: null,
    end: null,
  });
  const [currentView, setCurrentView] = useState("main");
  const [introPlayed, setIntroPlayed] = useState(false);
  const [timerInitialized, setTimerInitialized] = useState(false);

  const mainPlayerRef = useRef(null);

  // load all the video files when component starts
  useEffect(() => {
    const loadInitialVideos = async () => {
      try {
        const [intro, main] = await Promise.all([
          window.GameBackend.getIntroVideo(),
          window.GameBackend.getMainVideo(),
        ]);
        setVideos((prev) => ({ ...prev, intro, main }));
      } catch (error) {
        console.error("Game: Error loading videos:", error);
      }
    };

    const initializeWorkers = async () => {
      try {
        await window.WorkersBackend.start(["clue"]);
      } catch (error) {
        console.error("Game: Error starting workers:", error);
      }
    };

    loadInitialVideos();
    initializeWorkers();
    setupTimerAPI();

    return () => {
      cleanupTimerAPI();
    };
  }, []);

  // watch for game status changes and do stuff accordingly
  useEffect(() => {
    if (!gameInfo) return;
    const { gameStatus, isIntro } = gameInfo;
    let newView = "main";
    let shouldShowOverlay = true;

    if (gameStatus === 1 || gameStatus === 7) {
      if (isIntro && videos.intro && !introPlayed) {
        newView = "intro";
        shouldShowOverlay = false;
      }
    } else if (gameStatus === 5 || gameStatus === 6) {
      loadEndVideo();
      if (videos.end) {
        newView = "end";
        shouldShowOverlay = false;
      }
    }

    setCurrentView(newView);
    gameActions.setOverlayVisible(shouldShowOverlay);

    if (shouldShowOverlay && !timerInitialized) {
      initializeTimer();
      setTimerInitialized(true);
    }

    // pause or resume the game depending on status
    if (gameStatus === 4) {
      gameActions.pauseTimer();
      pauseMainVideo();
    } else if (gameStatus === 1) {
      gameActions.resumeTimer();
      resumeMainVideo();
    }
  }, [gameInfo, videos, introPlayed, timerInitialized]);

  useEffect(() => {
    if (!clue) {
      gameActions.hideClue();
      return;
    }

    if (clue.clueStatus) {
      displayClue(clue);
    } else {
      gameActions.hideClue();
    }
  }, [clue]);

  const loadEndVideo = async () => {
    if (videos.end) return;

    try {
      const endVideo = await window.GameBackend.getEndVideo();
      setVideos((prev) => ({ ...prev, end: endVideo }));
    } catch (error) {
      console.error("Game: Error loading end video:", error);
    }
  };

  const displayClue = async (clueData) => {
    try {
      // this is just a text clue with no file
      if (!clueData.clueFilename) {
        if (clueData.clueText) {
          gameActions.showClue("text", clueData.clueText, clueData);
        }
        return;
      }

      // this clue has a media file
      const mediaSrc = await window.GameBackend.getClueMedia(clueData);
      if (!mediaSrc) return;

      const clueType = determineClueType(clueData);
      gameActions.showClue(clueType, mediaSrc, clueData);
    } catch (error) {
      console.error("Game: Error displaying clue:", error);
    }
  };

  const determineClueType = (clueData) => {
    // first try to get type from the api
    const apiType = clueData.clueType?.toLowerCase();
    if (apiType === "message") return "text";
    if (apiType === "video") return "video";
    if (apiType === "audio") return "audio";
    if (apiType === "image" || apiType === "photo") return "image";

    // if that doesnt work check the file extension
    const filename = clueData.clueFilename?.toLowerCase() || "";
    if (filename.match(/\.(mp4|webm|avi|mov|mkv)$/)) return "video";
    if (filename.match(/\.(mp3|wav|aac|m4a|ogg)$/)) return "audio";
    if (filename.match(/\.gif$/)) return "gif";
    if (filename.match(/\.(jpg|jpeg|png|bmp|svg|webp)$/)) return "image";

    return "image"; // just assume its an image if we cant figure it out
  };

  const initializeTimer = async () => {
    try {
      const initialTime = await window.GameBackend.calculateInitialTimer();
      if (initialTime !== null) {
        gameActions.setTimerTime(initialTime);
      }
    } catch (error) {
      console.error("Game: Error initializing timer:", error);
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

  const handleIntroEnd = async () => {
    setIntroPlayed(true);
    setCurrentView("main");
    gameActions.setOverlayVisible(true);

    try {
      await window.GameBackend.introPostRequest();
    } catch (error) {
      console.error("Game: Error sending intro post request:", error);
    }

    if (!timerInitialized) {
      initializeTimer();
      setTimerInitialized(true);
    }
  };

  const handleTimerEnd = async () => {
    gameActions.pauseTimer();
    pauseMainVideo();

    try {
      await window.GameBackend.timerEndRequest?.();
    } catch (error) {
      console.error("Game: Error sending timer end request:", error);
    }
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

  const renderCurrentView = () => {
    switch (currentView) {
      case "intro":
        return (
          <VideoPlayer
            src={videos.intro}
            autoplay={true}
            muted={true}
            onVideoEnd={handleIntroEnd}
            className="w-full h-full object-cover"
          />
        );
      case "end":
        return (
          <VideoPlayer
            src={videos.end}
            autoplay={true}
            muted={true}
            className="w-full h-full object-cover"
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="game-screen h-screen w-screen bg-black relative">
      {/* main background video that loops */}
      {videos.main && (
        <div className="absolute inset-0 z-0">
          <VideoPlayer
            ref={mainPlayerRef}
            src={videos.main}
            autoplay={true}
            loop={true}
            muted={true}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="absolute inset-0 z-10">{renderCurrentView()}</div>
      <Overlay gameInfo={gameInfo} onTimerEnd={handleTimerEnd} />
      <CluePlayer mainPlayerRef={mainPlayerRef} />
    </div>
  );
}
