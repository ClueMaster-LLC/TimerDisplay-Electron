import React, {
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";

const VideoPlayer = forwardRef(
  (
    {
      src,
      autoplay = false,
      loop = false,
      muted = true,
      controls = false,
      className = "",
      onVideoStart,
      onVideoEnd,
      onVideoError,
      style = {},
    },
    ref
  ) => {
    const videoRef = useRef(null);

    useImperativeHandle(ref, () => ({
      play: () => videoRef.current?.play(),
      pause: () => videoRef.current?.pause(),
      stop: () => {
        if (videoRef.current) {
          videoRef.current.pause();
          videoRef.current.currentTime = 0;
        }
      },
      setMuted: (muted) => {
        if (videoRef.current) {
          videoRef.current.muted = muted;
        }
      },
      getCurrentTime: () => videoRef.current?.currentTime || 0,
      getDuration: () => videoRef.current?.duration || 0,
    }));

    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      const handlers = {
        play: () => onVideoStart?.(),
        ended: () => onVideoEnd?.(),
        error: (e) => onVideoError?.(e),
        loadeddata: () => {
          if (autoplay) {
            const playPromise = video.play();
            playPromise?.catch(onVideoError);
          }
        },
      };

      Object.entries(handlers).forEach(([event, handler]) => {
        video.addEventListener(event, handler);
      });

      return () => {
        Object.entries(handlers).forEach(([event, handler]) => {
          video.removeEventListener(event, handler);
        });
      };
    }, [autoplay, onVideoStart, onVideoEnd, onVideoError]);

    if (!src) return null;

    return (
      <video
        ref={videoRef}
        src={src}
        autoPlay={autoplay}
        loop={loop}
        muted={muted}
        controls={controls}
        className={className}
        style={style}
      />
    );
  }
);

VideoPlayer.displayName = "VideoPlayer";

export default VideoPlayer;
