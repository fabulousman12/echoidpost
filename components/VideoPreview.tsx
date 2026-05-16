"use client";

import type { ChangeEvent, SyntheticEvent } from "react";
import { useEffect, useRef, useState } from "react";

type VideoPreviewProps = {
  src: string;
  poster?: string;
  className?: string;
  mediaClassName?: string;
  controlsClassName?: string;
  fallbackClassName?: string;
  playClassName?: string;
  fullscreenUrl?: string;
  autoPlayInView?: boolean;
  controls?: boolean;
};

function isSafeMediaUrl(url = "") {
  return /^(https?:\/\/|blob:|data:video\/|data:image\/)/i.test(String(url).trim());
}

const videoUrlRegex = /\.(mp4|mov|webm|ogg|m4v)([?#].*)?$/i;

function getVideoThumbnailUrl(url = "") {
  const raw = String(url || "").trim();
  if (!raw || !videoUrlRegex.test(raw)) return "";
  return raw.replace(videoUrlRegex, ".png$2");
}

function useLazyMedia(rootMargin = "280px") {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isVisible) return undefined;
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setIsVisible(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [isVisible, rootMargin]);

  return [ref, isVisible] as const;
}

export default function VideoPreview({
  src,
  poster = "",
  className = "",
  mediaClassName = "",
  controlsClassName = "",
  fallbackClassName = "",
  playClassName = "",
  fullscreenUrl = "",
  autoPlayInView = false,
  controls = true,
}: VideoPreviewProps) {
  const [mediaRef, isVisible] = useLazyMedia();
  const derivedPoster = poster || getVideoThumbnailUrl(src);
  const [thumbnail, setThumbnail] = useState(derivedPoster);
  const [didTryThumbnail, setDidTryThumbnail] = useState(Boolean(derivedPoster));
  const [nativeFrameFailed, setNativeFrameFailed] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaybackFocused, setIsPlaybackFocused] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasActivatedPlayback, setHasActivatedPlayback] = useState(false);
  const [wantsPlayback, setWantsPlayback] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const nextPoster = poster || getVideoThumbnailUrl(src);
    setThumbnail(nextPoster);
    setDidTryThumbnail(Boolean(nextPoster));
    setNativeFrameFailed(false);
    setHasActivatedPlayback(false);
    setWantsPlayback(false);
    setIsPlaying(false);
    setIsMuted(false);
    return undefined;
  }, [isVisible, poster, src]);

  const shouldAutoplayActive = Boolean(autoPlayInView && isVisible && isPlaybackFocused);
  const shouldRenderVideo = Boolean(src && !nativeFrameFailed && (shouldAutoplayActive || hasActivatedPlayback));
  const progressValue = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  useEffect(() => {
    const node = mediaRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setIsPlaybackFocused(typeof document === "undefined" || document.visibilityState !== "hidden");
      return undefined;
    }

    const updateFocusFromViewport = () => {
      if (document.visibilityState === "hidden") {
        setIsPlaybackFocused(false);
        return;
      }
      const rect = node.getBoundingClientRect();
      const visibleWidth = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0));
      const visibleHeight = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
      const visibleArea = visibleWidth * visibleHeight;
      const totalArea = Math.max(1, rect.width * rect.height);
      setIsPlaybackFocused(visibleArea / totalArea >= 0.45);
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsPlaybackFocused(Boolean(entry?.isIntersecting && entry.intersectionRatio >= 0.45 && document.visibilityState !== "hidden"));
      },
      { threshold: [0, 0.45, 0.8] }
    );

    observer.observe(node);
    document.addEventListener("visibilitychange", updateFocusFromViewport);
    window.addEventListener("blur", updateFocusFromViewport);
    window.addEventListener("focus", updateFocusFromViewport);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", updateFocusFromViewport);
      window.removeEventListener("blur", updateFocusFromViewport);
      window.removeEventListener("focus", updateFocusFromViewport);
    };
  }, [mediaRef]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;
    if (!isPlaybackFocused) {
      video.pause?.();
      return undefined;
    }
    if (shouldAutoplayActive) {
      video.muted = isMuted;
      const playPromise = video.play?.();
      if (playPromise?.catch) playPromise.catch(() => setIsPlaying(false));
    } else {
      video.pause?.();
    }
    return undefined;
  }, [isMuted, isPlaybackFocused, shouldAutoplayActive, src]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !hasActivatedPlayback || !wantsPlayback || shouldAutoplayActive) return undefined;
    if (!isPlaybackFocused) {
      video.pause?.();
      return undefined;
    }
    const playPromise = video.play?.();
    if (playPromise?.catch) playPromise.catch(() => setIsPlaying(false));
    return undefined;
  }, [hasActivatedPlayback, isPlaybackFocused, shouldAutoplayActive, src, wantsPlayback]);

  const togglePlayback = async (event?: SyntheticEvent) => {
    event?.preventDefault();
    event?.stopPropagation();
    if (!controls) return;
    const video = videoRef.current;
    if (!video) {
      setHasActivatedPlayback(true);
      setWantsPlayback(true);
      return;
    }
    if (video.paused) {
      setWantsPlayback(true);
      const playPromise = video.play?.();
      if (playPromise?.catch) await playPromise.catch(() => {});
    } else {
      setWantsPlayback(false);
      video.pause?.();
    }
  };

  const openFullscreenPlayback = (event?: SyntheticEvent) => {
    event?.preventDefault();
    event?.stopPropagation();
    if (!controls) return;
    videoRef.current?.pause?.();
    if (fullscreenUrl) {
      window.open(fullscreenUrl, "_blank", "noopener,noreferrer");
      return;
    }
    videoRef.current?.requestFullscreen?.();
  };

  const handleTimelineChange = (event: ChangeEvent<HTMLInputElement>) => {
    event.stopPropagation();
    const video = videoRef.current;
    const nextPercent = Number(event.target.value || 0);
    if (!video || !duration) return;
    const nextTime = (nextPercent / 100) * duration;
    video.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const toggleMute = (event?: SyntheticEvent) => {
    event?.preventDefault();
    event?.stopPropagation();
    setIsMuted((current) => {
      const nextMuted = !current;
      if (videoRef.current) videoRef.current.muted = nextMuted;
      return nextMuted;
    });
  };

  if (!isSafeMediaUrl(src)) return null;

  return (
    <span
      ref={mediaRef}
      className={`${className} ${autoPlayInView ? "is-autoplaying" : ""} ${isPlaying ? "is-playing" : ""}`}
      role={controls ? "button" : undefined}
      tabIndex={controls ? 0 : undefined}
      aria-label="Video preview"
      onClick={togglePlayback}
      onDoubleClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        openFullscreenPlayback(event);
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        event.stopPropagation();
        togglePlayback(event);
      }}
    >
      {shouldRenderVideo ? (
        <video
          ref={videoRef}
          src={src}
          poster={thumbnail}
          className={mediaClassName}
          playsInline
          loop={autoPlayInView}
          autoPlay={autoPlayInView}
          muted={isMuted}
          preload="metadata"
          onError={() => setNativeFrameFailed(true)}
          onLoadedMetadata={(event) => setDuration(Number(event.currentTarget.duration || 0))}
          onTimeUpdate={(event) => setCurrentTime(Number(event.currentTarget.currentTime || 0))}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => {
            setIsPlaying(false);
            setWantsPlayback(false);
          }}
        />
      ) : thumbnail ? (
        <img src={thumbnail} alt="" className={mediaClassName} onError={() => setThumbnail("")} />
      ) : (
        <span className={fallbackClassName}>
          <span aria-hidden="true">Video</span>
          <span>{isVisible && !didTryThumbnail ? "Loading" : "Video"}</span>
        </span>
      )}
      <span className={playClassName} aria-hidden="true">
        <span>{isPlaying ? "Pause" : "Play"}</span>
      </span>
      {controls && shouldRenderVideo ? (
        <span className={controlsClassName} onClick={(event) => event.stopPropagation()}>
          <button type="button" onClick={toggleMute} aria-label={isMuted ? "Unmute video" : "Mute video"}>
            <span aria-hidden="true">{isMuted ? "M" : "S"}</span>
          </button>
          <input
            type="range"
            min="0"
            max="100"
            step="0.1"
            value={progressValue}
            onChange={handleTimelineChange}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            aria-label="Video timeline"
          />
          <button type="button" onClick={openFullscreenPlayback} aria-label="Open fullscreen video">
            <span aria-hidden="true">F</span>
          </button>
        </span>
      ) : null}
    </span>
  );
}
