import React, { useEffect, useRef } from "react";
import VideoPlayer from "./video-player";

const OverlayVideoPlayer = ({
  src,
  isVisible,
  onVideoEnd,
  onVideoError,
  autoplay = true,
  muted = false,
}) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (isVisible && videoRef.current) {
      videoRef.current.currentTime = 0;
    }
  }, [isVisible]);

  if (!isVisible || !src) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-50 bg-black">
      <VideoPlayer
        ref={videoRef}
        src={src}
        autoplay={autoplay}
        muted={muted}
        onVideoEnd={onVideoEnd}
        onVideoError={onVideoError}
        className="w-full h-full object-cover"
      />
    </div>
  );
};

export default OverlayVideoPlayer;
