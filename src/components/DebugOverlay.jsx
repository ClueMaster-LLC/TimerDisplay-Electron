import React, { useEffect, useRef, useState, useCallback } from "react";

/**
 * Debug Overlay - Shows real-time FPS, codec info, decode status, and dropped frames
 * Toggle visibility with Ctrl+Shift+D or View menu
 * Design matches ClueMaster VideoPlayer-Electron overlay style
 *
 * Auto-discovers the currently playing <video> element in the DOM so it works
 * as a global overlay without needing explicit props from parent components.
 */
export default function DebugOverlay({ videoElement: videoElementProp, videoPath: videoPathProp, visible: visibleProp }) {
  const [visible, setVisible] = useState(visibleProp ?? false);
  const [fps, setFps] = useState(0);
  const [jitterCount, setJitterCount] = useState(0);
  const [videoInfo, setVideoInfo] = useState(null);
  const [decodeInfo, setDecodeInfo] = useState(null);
  const [platformInfo, setPlatformInfo] = useState(null);

  // Auto-discovered video element and path (used when props not provided)
  const [discoveredVideoSrc, setDiscoveredVideoSrc] = useState(null);
  const discoveredVideoRef = useRef(null);

  const fpsFrameTimesRef = useRef([]);
  const fpsAnimationFrameRef = useRef(null);
  const decodeMonitorRef = useRef(null);
  const videoInfoCacheRef = useRef(new Map());
  const videoDiscoveryRef = useRef(null);

  // Resolved video element and path (props take priority, then auto-discovered)
  const activeVideoElement = videoElementProp || discoveredVideoRef.current;
  const activeVideoPath = videoPathProp || discoveredVideoSrc;

  // Sync with prop
  useEffect(() => {
    if (visibleProp !== undefined) setVisible(visibleProp);
  }, [visibleProp]);

  // Toggle with Ctrl+Shift+D + IPC from main process menu
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && e.code === "KeyD") {
        e.preventDefault();
        setVisible((v) => !v);
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    // Also listen for menu toggle from main process
    const cleanup = window.SystemBackend?.onToggleDebugOverlay?.(() => {
      setVisible((v) => !v);
    });

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      cleanup?.();
    };
  }, []);

  // Auto-discover currently playing video element from the DOM
  // This allows the overlay to work globally without explicit props
  useEffect(() => {
    if (!visible) {
      discoveredVideoRef.current = null;
      setDiscoveredVideoSrc(null);
      if (videoDiscoveryRef.current) {
        clearInterval(videoDiscoveryRef.current);
        videoDiscoveryRef.current = null;
      }
      return;
    }

    // Don't auto-discover if props are provided
    if (videoElementProp && videoPathProp) return;

    const discoverVideo = () => {
      const videos = document.querySelectorAll('video');
      let bestVideo = null;
      let bestScore = -1;

      videos.forEach((video) => {
        if (!video.src && !video.currentSrc) return;
        let score = 0;
        // Playing video gets highest priority
        if (!video.paused && !video.ended) score += 100;
        // Visible video (opacity > 0, not hidden)
        const style = window.getComputedStyle(video);
        if (style.opacity !== '0' && style.visibility !== 'hidden') score += 50;
        // Has video dimensions (actually rendering)
        if (video.videoWidth > 0 && video.videoHeight > 0) score += 25;
        // Has meaningful duration
        if (video.duration > 0 && isFinite(video.duration)) score += 10;
        // Currently has playback progress
        if (video.currentTime > 0) score += 5;

        if (score > bestScore) {
          bestScore = score;
          bestVideo = video;
        }
      });

      if (bestVideo) {
        const src = bestVideo.currentSrc || bestVideo.src;
        if (discoveredVideoRef.current !== bestVideo || discoveredVideoSrc !== src) {
          discoveredVideoRef.current = bestVideo;
          setDiscoveredVideoSrc(src);
        }
      } else {
        if (discoveredVideoRef.current !== null) {
          discoveredVideoRef.current = null;
          setDiscoveredVideoSrc(null);
        }
      }
    };

    // Initial discovery
    discoverVideo();
    // Re-discover periodically (videos change during playback)
    videoDiscoveryRef.current = setInterval(discoverVideo, 2000);

    return () => {
      if (videoDiscoveryRef.current) {
        clearInterval(videoDiscoveryRef.current);
        videoDiscoveryRef.current = null;
      }
    };
  }, [visible, videoElementProp, videoPathProp]);

  // FPS monitoring via requestAnimationFrame
  // Includes a warmup delay so the overlay's own render doesn't falsely inflate FPS/jitter
  useEffect(() => {
    if (!visible) {
      fpsFrameTimesRef.current = [];
      setFps(0);
      setJitterCount(0);
      return;
    }

    const WARMUP_DELAY_MS = 500; // Let overlay render settle before measuring
    const fpsWindowSize = 30;
    const fpsUpdateInterval = 15;
    const jitterThresholdMultiplier = 2;

    let warmupTimer = null;
    let cancelled = false;

    warmupTimer = setTimeout(() => {
      if (cancelled) return;

      let lastFrameTime = performance.now();
      let frameCount = 0;

      const measureFPS = (currentTime) => {
        if (cancelled) return;
        frameCount++;
        fpsFrameTimesRef.current.push(currentTime);

        if (fpsFrameTimesRef.current.length > fpsWindowSize) {
          fpsFrameTimesRef.current.shift();
        }

        if (frameCount % fpsUpdateInterval === 0 && fpsFrameTimesRef.current.length > 1) {
          const firstTime = fpsFrameTimesRef.current[0];
          const lastTime = fpsFrameTimesRef.current[fpsFrameTimesRef.current.length - 1];
          const elapsed = (lastTime - firstTime) / 1000;
          const calculatedFps = Math.round(fpsFrameTimesRef.current.length / elapsed);
          setFps(calculatedFps);
        }

        // Detect jitter - frame took significantly longer than expected
        const frameDelta = currentTime - lastFrameTime;
        const expectedFrameTime = 1000 / 60;
        if (frameDelta > expectedFrameTime * jitterThresholdMultiplier) {
          setJitterCount(prev => prev + 1);
        }

        lastFrameTime = currentTime;
        fpsAnimationFrameRef.current = requestAnimationFrame(measureFPS);
      };

      fpsAnimationFrameRef.current = requestAnimationFrame(measureFPS);
    }, WARMUP_DELAY_MS);

    return () => {
      cancelled = true;
      if (warmupTimer) clearTimeout(warmupTimer);
      if (fpsAnimationFrameRef.current) {
        cancelAnimationFrame(fpsAnimationFrameRef.current);
      }
    };
  }, [visible]);

  // Get video info via ffprobe (main process)
  useEffect(() => {
    if (!visible) {
      videoInfoCacheRef.current.clear();
      setVideoInfo(null);
      return;
    }
    if (!activeVideoPath) {
      setVideoInfo(null);
      return;
    }

    const cached = videoInfoCacheRef.current.get(activeVideoPath);
    if (cached) {
      setVideoInfo(cached);
      return;
    }

    window.SystemBackend?.getVideoInfo?.(activeVideoPath)
      .then((info) => {
        if (info && !info.error) {
          videoInfoCacheRef.current.set(activeVideoPath, info);
          setVideoInfo(info);
        } else {
          const filename = activeVideoPath.split('/').pop() || activeVideoPath.split('\\').pop();
          const fallback = { filename, error: info?.error };
          videoInfoCacheRef.current.set(activeVideoPath, fallback);
          setVideoInfo(fallback);
        }
      })
      .catch((err) => {
        const filename = activeVideoPath.split('/').pop() || activeVideoPath.split('\\').pop();
        const fallback = { filename, error: err.message };
        videoInfoCacheRef.current.set(activeVideoPath, fallback);
        setVideoInfo(fallback);
      });
  }, [activeVideoPath, visible]);

  // Get platform info once
  useEffect(() => {
    if (!visible) return;

    window.SystemBackend?.getPlatformInfo?.()
      .then(setPlatformInfo)
      .catch(() => {});
  }, [visible]);

  // Hardware decode detection via MediaCapabilities + dropped frame monitoring
  useEffect(() => {
    if (!visible || !videoInfo) {
      setDecodeInfo(null);
      if (decodeMonitorRef.current) {
        clearInterval(decodeMonitorRef.current);
        decodeMonitorRef.current = null;
      }
      return;
    }

    const checkHardwareSupport = async () => {
      // Use codecRaw if available (from ffprobe), fall back to codec display name
      const rawCodec = videoInfo.codecRaw || videoInfo.codec;
      if (!rawCodec) return;

      try {
        const codecMap = {
          'h264': 'video/mp4; codecs="avc1.42E01E"',
          'avc1': 'video/mp4; codecs="avc1.42E01E"',
          'avc': 'video/mp4; codecs="avc1.42E01E"',
          'hevc': 'video/mp4; codecs="hev1.1.6.L93.B0"',
          'h265': 'video/mp4; codecs="hev1.1.6.L93.B0"',
          'hvc1': 'video/mp4; codecs="hev1.1.6.L93.B0"',
          'av1': 'video/mp4; codecs="av01.0.00M.08"',
          'av01': 'video/mp4; codecs="av01.0.00M.08"',
          'vp9': 'video/webm; codecs="vp9"',
          'vp09': 'video/webm; codecs="vp9"',
          'vp8': 'video/webm; codecs="vp8"',
        };

        const codecLower = (rawCodec || '').toLowerCase();
        let mimeType = codecMap[codecLower] || 'video/mp4; codecs="avc1.42E01E"';

        // VP9 can be in MP4 or WebM, try both if needed
        const isVP9 = codecLower === 'vp9' || codecLower === 'vp09';

        if (navigator.mediaCapabilities) {
          const config = {
            type: 'file',
            video: {
              contentType: mimeType,
              width: videoInfo.width || 1920,
              height: videoInfo.height || 1080,
              bitrate: (videoInfo.bitrate || 5000) * 1000,
              framerate: videoInfo.fps || 30,
            }
          };

          let result = await navigator.mediaCapabilities.decodingInfo(config);

          // If VP9 in WebM failed, try MP4 container
          if (isVP9 && !result.supported) {
            config.video.contentType = 'video/mp4; codecs="vp09.00.10.08"';
            result = await navigator.mediaCapabilities.decodingInfo(config);
          }

          let method = 'Unknown';
          let isHardware = false;

          if (result.powerEfficient && result.smooth) {
            method = 'GPU Hardware';
            isHardware = true;
          } else if (result.smooth && result.supported) {
            method = 'GPU Accelerated';
            isHardware = true;
          } else if (result.supported) {
            method = 'Software (CPU)';
          } else {
            method = 'Software Fallback';
          }

          setDecodeInfo(prev => ({
            ...prev,
            isHardware,
            method,
            powerEfficient: result.powerEfficient,
            smooth: result.smooth,
          }));
        }
      } catch (err) {
        console.warn('MediaCapabilities check failed:', err);
      }
    };

    checkHardwareSupport();

    // Monitor dropped frames using auto-discovered or prop video element
    const videoEl = activeVideoElement;
    if (videoEl) {
      const quality = videoEl.getVideoPlaybackQuality?.();
      const baselineDropped = quality?.droppedVideoFrames || 0;
      const baselineTotal = quality?.totalVideoFrames || 0;

      const monitorDroppedFrames = () => {
        if (!videoEl) return;
        const quality = videoEl.getVideoPlaybackQuality?.();
        if (quality) {
          const droppedSinceOpen = quality.droppedVideoFrames - baselineDropped;
          const totalSinceOpen = quality.totalVideoFrames - baselineTotal;
          const dropRate = totalSinceOpen > 0 ? Math.round((droppedSinceOpen / totalSinceOpen) * 100) : 0;

          setDecodeInfo(prev => ({
            ...prev,
            droppedFrames: droppedSinceOpen,
            totalFrames: totalSinceOpen,
            dropRate,
            warning: dropRate > 5 ? 'High frame drops - possible software decode' : null,
          }));
        }
      };

      // Check dropped frames every second
      decodeMonitorRef.current = setInterval(monitorDroppedFrames, 1000);
      // Don't call immediately - wait 1 second to get meaningful data
    }

    return () => {
      if (decodeMonitorRef.current) {
        clearInterval(decodeMonitorRef.current);
        decodeMonitorRef.current = null;
      }
    };
  }, [videoInfo, visible, activeVideoElement]);

  if (!visible) return null;

  return (
    <>
      {/* Large FPS counter - top left */}
      <div
        style={{
          position: 'fixed',
          top: '1.5vh',
          left: '1.5vw',
          zIndex: 9999,
          fontFamily: 'monospace',
          fontSize: 'min(5vw, 5vh, 80px)',
          fontWeight: 'bold',
          color: fps >= 55 ? '#00ff00' : fps >= 45 ? '#ffff00' : '#ff0000',
          textShadow: '0.15vw 0.15vw 0.3vw rgba(0,0,0,0.8)',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        FPS: {fps}
      </div>

      {/* Large Jitter counter */}
      <div
        style={{
          position: 'fixed',
          top: '8vh',
          left: '1.5vw',
          zIndex: 9999,
          fontFamily: 'monospace',
          fontSize: 'min(5vw, 5vh, 80px)',
          fontWeight: 'bold',
          color: jitterCount === 0 ? '#00ff00' : jitterCount < 10 ? '#ffff00' : '#ff0000',
          textShadow: '0.15vw 0.15vw 0.3vw rgba(0,0,0,0.8)',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        Jitter: {jitterCount}
      </div>

      {/* Video Info Panel */}
      {videoInfo && (
        <div
          style={{
            position: 'fixed',
            top: '16vh',
            left: '1.5vw',
            zIndex: 9999,
            fontFamily: 'monospace',
            fontSize: 'min(2.75vw, 3.1vh, 50px)',
            color: '#ffffff',
            textShadow: '0.1vw 0.1vw 0.2vw rgba(0,0,0,0.9)',
            pointerEvents: 'none',
            userSelect: 'none',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            padding: 'min(1.9vw, 1.9vh, 30px) min(2.5vw, 2.5vh, 40px)',
            borderRadius: 'min(1vw, 1vh, 15px)',
            maxWidth: '80vw',
            maxHeight: '70vh',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
          }}
        >
          {/* Filename */}
          <div style={{ marginBottom: 'min(1vh, 15px)', color: '#66ccff', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            ⏵ {videoInfo.filename || (activeVideoPath ? (activeVideoPath.split('/').pop() || activeVideoPath.split('\\').pop()) : 'Unknown')}
          </div>

          {/* Codec */}
          {videoInfo.codec && (
            <div style={{ marginBottom: 'min(0.6vh, 10px)' }}>
              <span style={{ color: '#aaaaaa' }}>Codec:</span>{' '}
              <span style={{ color: '#ffcc00', fontWeight: 'bold' }}>{videoInfo.codec}</span>
            </div>
          )}

          {/* Source FPS */}
          {videoInfo.fps && (
            <div style={{ marginBottom: 'min(0.6vh, 10px)' }}>
              <span style={{ color: '#aaaaaa' }}>Source FPS:</span>{' '}
              <span style={{ color: '#00ff99' }}>{videoInfo.fps}</span>
            </div>
          )}

          {/* Resolution */}
          {videoInfo.width && videoInfo.height && (
            <div style={{ marginBottom: 'min(0.6vh, 10px)' }}>
              <span style={{ color: '#aaaaaa' }}>Resolution:</span>{' '}
              <span style={{ color: '#ff99ff' }}>{videoInfo.width}×{videoInfo.height}</span>
            </div>
          )}

          {/* Bitrate */}
          {videoInfo.bitrate && (
            <div>
              <span style={{ color: '#aaaaaa' }}>Bitrate:</span>{' '}
              <span style={{ color: '#99ccff' }}>{videoInfo.bitrate} kbps</span>
            </div>
          )}

          {/* Decode Info */}
          {decodeInfo && (
            <>
              <div style={{ marginTop: 'min(1.5vh, 22px)', borderTop: '1px solid #555', paddingTop: 'min(1.5vh, 22px)' }}>
                <span style={{ color: '#aaaaaa' }}>Decode:</span>{' '}
                <span style={{
                  color: decodeInfo.isHardware ? '#00ff00' : '#ff9900',
                  fontWeight: 'bold'
                }}>
                  {decodeInfo.isHardware ? '⬢ ' : '⬡ '}{decodeInfo.method || 'Unknown'}
                </span>
                {decodeInfo.powerEfficient && (
                  <span style={{ color: '#00ff99', marginLeft: 'min(1.25vw, 20px)' }}> ⚡ Power Efficient</span>
                )}
              </div>
              {decodeInfo.droppedFrames !== undefined && (
                <div style={{ marginTop: 'min(0.6vh, 10px)' }}>
                  <span style={{ color: '#aaaaaa' }}>Dropped Frames:</span>{' '}
                  <span style={{
                    color: decodeInfo.droppedFrames === 0 ? '#00ff00' :
                           decodeInfo.droppedFrames < 10 ? '#ffff00' : '#ff4444'
                  }}>
                    {decodeInfo.droppedFrames} / {decodeInfo.totalFrames || 0}
                    {decodeInfo.dropRate > 0 && ` (${decodeInfo.dropRate}%)`}
                  </span>
                </div>
              )}
              {decodeInfo.warning && (
                <div style={{ color: '#ff9900', marginTop: 'min(1vh, 15px)', fontSize: 'min(2.5vw, 2.5vh, 40px)' }}>
                  ⚠ {decodeInfo.warning}
                </div>
              )}
            </>
          )}

          {/* Error */}
          {videoInfo.error && (
            <div style={{ color: '#ff6666', marginTop: 'min(1vh, 15px)' }}>
              ⚠ {videoInfo.error}
            </div>
          )}

          {/* Platform info */}
          {platformInfo && (
            <div style={{ marginTop: 'min(1.5vh, 22px)', borderTop: '1px solid #555', paddingTop: 'min(1vh, 15px)', color: '#888888', fontSize: 'min(2vw, 2.25vh, 32px)' }}>
              {platformInfo.platform}/{platformInfo.arch}
              {platformInfo.isSnap ? ' (SNAP)' : ''}
              {' • '}Electron {platformInfo.electronVersion}
            </div>
          )}
        </div>
      )}
    </>
  );
}
