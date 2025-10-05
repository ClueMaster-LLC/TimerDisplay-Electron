import React, { useEffect, useRef } from "react";
import { useClueState, useGameActions } from "../state/store";
import VideoPlayer from "./video-player";

export default function CluePlayer({ mainPlayerRef }) {
  const clueState = useClueState();
  const gameActions = useGameActions();
  const videoRef = useRef(null);
  const audioRef = useRef(null);

  const handleClueEnd = () => {
    const { type } = clueState;
    // videos and audio should close themselves when done
    if (type === "video" || type === "audio") {
      gameActions.hideClue();
    }
  };

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
            className="absolute bottom-0 left-0 right-0"
            style={{ height: "45vh" }}
          >
            <div className="h-full bg-black bg-opacity-90 flex items-center justify-center px-8">
              <div className="max-w-4xl w-full p-8">
                <div className="text-center">
                  <p className="text-2xl text-white leading-relaxed whitespace-pre-wrap">
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

  return <div className="absolute inset-0 z-30">{renderClueContent()}</div>;
}
