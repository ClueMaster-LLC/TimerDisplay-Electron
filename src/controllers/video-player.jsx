import React, {
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useState,
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
    const imgRef = useRef(null);
    const [isImage, setIsImage] = useState(false);

    useEffect(() => {
      if (!src) {
        setIsImage(false);
        return;
      }

      const imageExtensions = /\.(jpg|jpeg|png|gif|bmp|svg|webp)(\?.*)?$/i;
      const isImageFile = imageExtensions.test(src);
      setIsImage(isImageFile);

      if (isImageFile) {
        console.log("Main Game: Detected image file:", src);
      } else {
        console.log("Main Game: Detected video file:", src);
      }
    }, [src]);

    useImperativeHandle(ref, () => ({
      play: () => {
        if (!isImage) {
          videoRef.current?.play();
        }
      },
      pause: () => {
        if (!isImage) {
          videoRef.current?.pause();
        }
      },
      stop: () => {
        if (!isImage && videoRef.current) {
          videoRef.current.pause();
          videoRef.current.currentTime = 0;
        }
      },
      setMuted: (muted) => {
        if (!isImage && videoRef.current) {
          videoRef.current.muted = muted;
        }
      },
      getCurrentTime: () => (!isImage ? videoRef.current?.currentTime || 0 : 0),
      getDuration: () => (!isImage ? videoRef.current?.duration || 0 : 0),
    }));

    useEffect(() => {
      if (isImage) return;

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
    }, [autoplay, onVideoStart, onVideoEnd, onVideoError, isImage]);

    if (!src) return null;

    if (isImage) {
      return (
        <img
          ref={imgRef}
          src={src}
          alt="Main content"
          className={className}
          style={style}
        />
      );
    }

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
