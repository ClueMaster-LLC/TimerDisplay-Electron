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
  const ttsAudioRef = useRef(null);
  const isSpeakingRef = useRef(false);
  const ttsCancelledRef = useRef(false);

  const speakTextClue = async (text) => {
    try {
      // Stop any previous TTS playback
      if (ttsAudioRef.current) {
        ttsAudioRef.current.pause();
        ttsAudioRef.current = null;
      }
      
      if (!text || text.trim().length === 0) {
        console.warn("CluePlayer TTS: No text to speak");
        return;
      }

      console.log("CluePlayer TTS: Synthesizing speech for text clue...");
      isSpeakingRef.current = true;

      // Synthesize speech using Piper TTS
      const audioPath = await window.TTSBackend.synthesize({ text: text.trim() });
      
      if (!audioPath) {
        console.error("CluePlayer TTS: No audio path returned from synthesis");
        isSpeakingRef.current = false;
        return;
      }

      console.log("CluePlayer TTS: Playing synthesized speech:", audioPath);

      // Create and play audio element
      const audio = new Audio(audioPath);
      ttsAudioRef.current = audio;

      audio.onended = () => {
        console.log("CluePlayer TTS: Speech playback completed");
        isSpeakingRef.current = false;
        ttsAudioRef.current = null;
      };

      audio.onerror = (error) => {
        console.error("CluePlayer TTS: Audio playback error:", error);
        isSpeakingRef.current = false;
        ttsAudioRef.current = null;
      };

      await audio.play();
      console.log("CluePlayer TTS: Speech playback started");
    } catch (error) {
      console.error("CluePlayer TTS: Failed to speak text clue:", error);
      isSpeakingRef.current = false;
      ttsAudioRef.current = null;
    }
  };

  const playClueAlert = async () => {
    try {
      let alertSrc;
      
      if (!roomConfig?.isTVClueAlert) {
        alertSrc = "./assets/MessageAlert.mp3";
        console.log("CluePlayer: Using default clue alert");
      } else {
        const customAlertSrc = await window.GameBackend.getCustomClueAlertAudio();
        if (customAlertSrc) {
          alertSrc = customAlertSrc;
          console.log("CluePlayer: Using custom clue alert");
        } else {
          alertSrc = "./assets/MessageAlert.mp3";
          console.log("CluePlayer: Custom alert not found, using default");
        }
      }

      if (alertAudioRef.current) {
        alertAudioRef.current.src = alertSrc;
        
        // Wait for metadata to load so we can get the duration
        await new Promise((resolve) => {
          if (alertAudioRef.current.duration && !isNaN(alertAudioRef.current.duration)) {
            resolve();
          } else {
            alertAudioRef.current.addEventListener('loadedmetadata', () => resolve(), { once: true });
          }
        });
        
        const duration = (alertAudioRef.current.duration || 1) * 1000;
        console.log(`CluePlayer: Alert audio duration: ${duration}ms`);
        
        await alertAudioRef.current.play();
        return duration;
      }
      
      return 1000; // Fallback if no audio ref
    } catch (error) {
      console.error("CluePlayer: Error playing clue alert:", error);
      return 1000; // Fallback duration
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
      console.log("CluePlayer: clueTTS value:", clueState.clueTTS, "Type:", typeof clueState.clueTTS);

      // Reset cancellation flag when new clue starts
      ttsCancelledRef.current = false;

      // If it's a text clue AND clueTTS is enabled (or undefined/null as fallback), start synthesizing immediately (parallel with alert)
      if (clueState.type === "text" && clueState.src && clueState.clueTTS !== false) {
        const text = clueState.src;
        const textLength = text.trim().length;
        let audioPath = null;
        let synthesisComplete = false;
        
        // Estimate synthesis time based on text length (roughly 3 seconds per 100 chars)
        const estimatedTime = Math.max(5000, Math.ceil(textLength / 100) * 3000);
        const maxWaitTime = Math.min(estimatedTime, 30000); // Cap at 30 seconds
        
        console.log(`CluePlayer TTS: Starting synthesis for ${textLength} characters (max wait: ${maxWaitTime}ms)`);
        
        // Start synthesis immediately (don't wait)
        const synthesisStartTime = Date.now();
        window.TTSBackend.synthesize({ text: text.trim() })
          .then((path) => {
            const synthesisTime = Date.now() - synthesisStartTime;
            audioPath = path;
            synthesisComplete = true;
            console.log(`CluePlayer TTS: Synthesis ready in ${synthesisTime}ms:`, path);
          })
          .catch((error) => {
            console.error("CluePlayer TTS: Pre-synthesis error:", error);
            synthesisComplete = true; // Mark complete even on error to prevent hanging
          });

        // Play alert and get its duration, then wait for it to finish
        (async () => {
          const alertDuration = await playClueAlert();
          console.log(`CluePlayer: Alert will play for ${alertDuration}ms, then TTS will start`);
          
          // Wait for alert to finish plus 100ms buffer
          await new Promise(resolve => setTimeout(resolve, alertDuration + 500));
          
          // Check if TTS was cancelled during alert playback
          if (ttsCancelledRef.current) {
            console.log("CluePlayer TTS: Cancelled during alert playback");
            return;
          }
          
          console.log("CluePlayer: Alert finished, waiting for TTS synthesis to complete");
          
          // Wait for synthesis to complete if it's not done yet
          const startWait = Date.now();
          let lastLog = 0;
          
          while (!synthesisComplete && !ttsCancelledRef.current && Date.now() - startWait < maxWaitTime) {
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Log progress every 2 seconds for long synthesis
            const elapsed = Date.now() - synthesisStartTime;
            if (elapsed - lastLog > 2000) {
              console.log(`CluePlayer TTS: Still synthesizing... (${Math.round(elapsed / 1000)}s elapsed)`);
              lastLog = elapsed;
            }
          }
          
          if (ttsCancelledRef.current) {
            console.log("CluePlayer TTS: Cancelled during synthesis wait");
            return;
          }
          
          if (!synthesisComplete) {
            console.error(`CluePlayer TTS: Synthesis timeout after ${maxWaitTime}ms - text may be too long`);
            return;
          }
          
          // Final check before playing
          if (ttsCancelledRef.current) {
            console.log("CluePlayer TTS: Cancelled before playback");
            return;
          }
          
          if (audioPath) {
            // Play the pre-synthesized audio
            try {
              if (ttsAudioRef.current) {
                ttsAudioRef.current.pause();
                ttsAudioRef.current = null;
              }
              
              isSpeakingRef.current = true;
              const audio = new Audio(audioPath);
              ttsAudioRef.current = audio;

              audio.onended = () => {
                console.log("CluePlayer TTS: Playback completed");
                isSpeakingRef.current = false;
                ttsAudioRef.current = null;
              };

              audio.onerror = (error) => {
                console.error("CluePlayer TTS: Playback error:", error);
                isSpeakingRef.current = false;
                ttsAudioRef.current = null;
              };

              await audio.play();
              console.log("CluePlayer TTS: Playback started");
            } catch (error) {
              console.error("CluePlayer TTS: Failed to play:", error);
              isSpeakingRef.current = false;
              ttsAudioRef.current = null;
            }
          } else {
            console.warn("CluePlayer TTS: No audio to play (synthesis failed)");
          }
        })().catch((error) => {
          console.error("CluePlayer: Error in TTS flow:", error);
        });
      } else {
        // For image clues or text clues with TTS explicitly disabled, just play the alert
        playClueAlert();
        if (clueState.type === "text" && clueState.src && clueState.clueTTS === false) {
          console.log("CluePlayer TTS: Skipping TTS playback (clueTTS is explicitly disabled for this clue)");
        }
      }
    } else if (!clueState.isActive) {
      // Cancel TTS when clue becomes inactive
      ttsCancelledRef.current = true;
    }
  }, [clueState.isActive, clueState.type, clueState.src, clueState.clueTTS, roomConfig]);

  // unmute background music when clue ends or when switching to text/image clues
  useEffect(() => {
    if (!clueState.isActive) {
      window.dispatchEvent(new CustomEvent("unmuteBackgroundMusic"));
    } else if (
      clueState.isActive &&
      (clueState.type === "text" ||
        clueState.type === "image" ||
        clueState.type === "gif")
    ) {
      window.dispatchEvent(new CustomEvent("unmuteBackgroundMusic"));
    }
  }, [clueState.isActive, clueState.type]);

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
      // Stop TTS playback
      if (ttsAudioRef.current) {
        ttsAudioRef.current.pause();
        ttsAudioRef.current = null;
      }
      isSpeakingRef.current = false;
    }
  }, [clueState.isActive]);

  const [viewport, setViewport] = React.useState(() => ({
    width: typeof window !== "undefined" ? window.innerWidth : 0,
    height: typeof window !== "undefined" ? window.innerHeight : 0,
  }));

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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
        const cleanedText = clueState.src
          .replace(/[\n\r\t]+/g, " ")
          .replace(/\s+/g, " ")
          .trim();

        // Responsive calculations matching timer logic but scaled for text
        const sizeFromWidth = viewport.width * 0.025; // 2.5% of width
        const maxFromHeight = viewport.height * 0.04; // 4% of height
        const fontSize = Math.max(16, Math.round(Math.min(sizeFromWidth, maxFromHeight)));

        const containerHeight = viewport.height * 0.45; // 45% of viewport height

        return (
          <div
            className="absolute bottom-0 left-0 right-0 flex items-end justify-center"
            style={{ height: `${containerHeight}px` }}
          >
            <div
              className="w-full flex items-center justify-center"
              style={{
                width: "98.7%",
                height: `${containerHeight}px`,
                backgroundColor: "rgba(17, 17, 17, 0.7)",
                padding: "1.3%",
              }}
            >
              <p
                className="text-white font-bold text-center leading-relaxed"
                style={{
                  fontSize: `${fontSize}px`,
                  overflowWrap: "break-word",
                  wordBreak: "normal",
                  whiteSpace: "normal",
                }}
              >
                {cleanedText}
              </p>
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
