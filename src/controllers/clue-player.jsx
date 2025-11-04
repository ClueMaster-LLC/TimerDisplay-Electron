import React, { useEffect, useRef } from "react";
import { useClueState, useGameActions, useStoreValue } from "../state/store";
import VideoPlayer from "./video-player";

export default function CluePlayer({ mainPlayerRef }) {
  const clueState = useClueState();
  const gameActions = useGameActions();
  const gameInfo = useStoreValue("gameInfo", null);
  const roomConfig = useStoreValue("roomConfig", null);
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const alertAudioRef = useRef(null);

  const playClueAlert = async () => {
    try {
      if (!roomConfig?.isTVClueAlert) {
        const defaultAlertSrc = "./assets/MessageAlert.mp3";
        console.log(
          "CluePlayer: Default clue alert audio path:",
          defaultAlertSrc
        );
        console.log("CluePlayer: Playing default clue alert");
        if (alertAudioRef.current) {
          alertAudioRef.current.src = defaultAlertSrc;
          alertAudioRef.current.play();
        }
        return;
      }

      const customAlertSrc = await window.GameBackend.getCustomClueAlertAudio();
      if (customAlertSrc) {
        console.log("CluePlayer: Custom clue alert audio src:", customAlertSrc);
        console.log("CluePlayer: Playing custom clue alert");
        if (alertAudioRef.current) {
          alertAudioRef.current.src = customAlertSrc;
          alertAudioRef.current.play();
        }
      } else {
        const defaultAlertSrc = "./assets/MessageAlert.mp3";
        console.log("CluePlayer: Custom alert not found, using default");
        console.log(
          "CluePlayer: Default clue alert audio path:",
          defaultAlertSrc
        );
        if (alertAudioRef.current) {
          alertAudioRef.current.src = defaultAlertSrc;
          alertAudioRef.current.play();
        }
      }
    } catch (error) {
      console.error("CluePlayer: Error playing clue alert:", error);
      const defaultAlertSrc = "./assets/MessageAlert.mp3";
      if (alertAudioRef.current) {
        alertAudioRef.current.src = defaultAlertSrc;
        alertAudioRef.current.play();
      }
    }
  };

  const handleClueEnd = async () => {
    const { type, data } = clueState;
    console.log("CluePlayer: handleClueEnd called", { type, data });

    // videos and audio should close themselves when done
    if (type === "video" || type === "audio") {
      const gameId = data?.gameId || gameInfo?.gameId;
      const clueId = data?.clueId || data?.gameClueId;

      if (gameId && clueId) {
        try {
          await window.GameBackend.postClueStatus(gameId, clueId);
          console.log("CluePlayer: Successfully posted clue status");
        } catch (error) {
          console.error(
            "CluePlayer: Error notifying API about clue completion:",
            error
          );
        }
      } else {
        console.log("CluePlayer: Missing gameId or clueId for API call", {
          gameId,
          clueId,
        });
      }
      gameActions.hideClue();
    }
  };

  useEffect(() => {
    if (
      clueState.isActive &&
      (clueState.type === "text" || clueState.type === "image")
    ) {
      console.log("CluePlayer: Text/Image clue shown, playing alert");
      playClueAlert();
    }
  }, [clueState.isActive, clueState.type]);

  // unmute background music when clue ends
  useEffect(() => {
    if (!clueState.isActive) {
      window.dispatchEvent(new CustomEvent("unmuteBackgroundMusic"));
    }
  }, [clueState.isActive]);

  // mute the background video when showing visual clues
  useEffect(() => {
    if (!mainPlayerRef?.current?.setMuted) return;

    const shouldMute = clueState.isActive && clueState.type !== "audio";
    mainPlayerRef.current.setMuted(shouldMute);
  }, [clueState.isActive, clueState.type, mainPlayerRef]);

  // clean up media when clue goes away
  useEffect(() => {
    if (!clueState.isActive) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
      if (videoRef.current?.stop) {
        videoRef.current.stop();
      }
    }
  }, [clueState.isActive]);

  if (!clueState.isActive || !clueState.type || !clueState.src) {
    return null;
  }

  const renderClueContent = () => {
    switch (clueState.type) {
      case "video":
        return (
          <div className="absolute inset-0 bg-black">
            <VideoPlayer
              ref={videoRef}
              src={clueState.src}
              autoplay={true}
              loop={false}
              muted={false}
              className="w-full h-full object-contain"
              onVideoEnd={handleClueEnd}
            />
          </div>
        );

      case "image":
      case "gif":
        return (
          <div className="absolute inset-0 bg-black flex items-center justify-center">
            <img
              src={clueState.src}
              alt="Clue"
              className="max-w-full max-h-full object-contain"
            />
          </div>
        );

      case "audio":
        return (
          <audio
            ref={audioRef}
            src={clueState.src}
            autoPlay={true}
            onEnded={handleClueEnd}
            style={{ display: "none" }}
          />
        );

      case "text":
        return (
          <div
            className="absolute bottom-0 left-0 right-0 overflow-hidden"
            style={{ height: "45vh" }}
          >
            <div className="h-full bg-black/50 backdrop-blur-sm flex items-center justify-center px-8">
              <div className="max-w-4xl w-full p-8 overflow-hidden">
                <div className="text-center overflow-hidden">
                  <p className="text-2xl text-white leading-relaxed wrap-break-word">
                    {clueState.src}
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // audio clues dont need the visual wrapper div
  if (clueState.type === "audio") {
    return renderClueContent();
  }

  return (
    <div className="absolute inset-0 z-30">
      {renderClueContent()}
      <audio ref={alertAudioRef} preload="auto" style={{ display: "none" }} />
    </div>
  );
}
