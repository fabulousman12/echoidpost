"use client";

import type { TouchEvent } from "react";
import { useEffect, useRef, useState } from "react";
import VideoPreview from "@/components/VideoPreview";

export type PostMediaItem = {
  url: string;
  kind: "image" | "video";
  isCover?: boolean;
  thumbnailUrl?: string;
};

type PostMediaCarouselProps = {
  mediaItems: PostMediaItem[];
  altText: string;
  postHref?: string;
  autoPlayVideos?: boolean;
  className?: string;
  frameClassName: string;
  mediaClassName: string;
  dotsClassName: string;
  dotClassName: string;
  activeDotClassName: string;
  thumbsClassName: string;
  thumbClassName: string;
  activeThumbClassName: string;
  thumbMediaClassName: string;
  videoClassName: string;
  videoControlsClassName: string;
  videoFallbackClassName: string;
  videoPlayClassName: string;
};

function isSafeMediaUrl(url = "") {
  const raw = String(url || "").trim();
  if (!raw || /[\u0000-\u001f]/.test(raw)) return false;
  if (/^(javascript|vbscript|data:text|data:application):/i.test(raw)) return false;
  return /^(https?:\/\/|blob:|data:image\/|data:video\/)/i.test(raw);
}

export default function PostMediaCarousel({
  mediaItems,
  altText,
  postHref = "",
  autoPlayVideos = false,
  className = "",
  frameClassName,
  mediaClassName,
  dotsClassName,
  dotClassName,
  activeDotClassName,
  thumbsClassName,
  thumbClassName,
  activeThumbClassName,
  thumbMediaClassName,
  videoClassName,
  videoControlsClassName,
  videoFallbackClassName,
  videoPlayClassName,
}: PostMediaCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const items = Array.isArray(mediaItems)
    ? mediaItems.filter((item) => item?.url && isSafeMediaUrl(item.url) && (item.kind === "image" || item.kind === "video"))
    : [];

  useEffect(() => {
    setActiveIndex(0);
  }, [items.length, items[0]?.url]);

  if (!items.length) return null;

  const activeItem = items[Math.min(activeIndex, items.length - 1)] || items[0];
  const canSwipe = items.length > 1;
  const showIndex = (nextIndex: number) => {
    if (!items.length) return;
    setActiveIndex((nextIndex + items.length) % items.length);
  };

  const handleTouchStart = (event: TouchEvent) => {
    if (!canSwipe) return;
    const touch = event.touches?.[0];
    if (!touch) return;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (event: TouchEvent) => {
    if (!canSwipe || !touchStartRef.current) return;
    const touch = event.changedTouches?.[0];
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!touch || !start) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < 36 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
    showIndex(activeIndex + (deltaX < 0 ? 1 : -1));
  };

  return (
    <div className={className}>
      <div className={frameClassName} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        {activeItem.kind === "video" ? (
          <VideoPreview
            src={activeItem.url}
            poster={activeItem.thumbnailUrl}
            className={videoClassName}
            mediaClassName={mediaClassName}
            controlsClassName={videoControlsClassName}
            fallbackClassName={videoFallbackClassName}
            playClassName={videoPlayClassName}
            fullscreenUrl={activeItem.url}
            autoPlayInView={autoPlayVideos}
          />
        ) : postHref ? (
          <a href={postHref} aria-label={`Open ${altText}`}>
            <img src={activeItem.url} alt={altText} className={mediaClassName} />
          </a>
        ) : (
          <img src={activeItem.url} alt={altText} className={mediaClassName} />
        )}
      </div>

      {items.length > 1 ? (
        <>
          <div className={dotsClassName} aria-label="Post media">
            {items.map((item, index) => (
              <button
                key={`${item.url}-${index}`}
                type="button"
                className={`${dotClassName} ${index === activeIndex ? activeDotClassName : ""}`}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  showIndex(index);
                }}
                aria-label={`Show media ${index + 1}`}
              />
            ))}
          </div>
          <div className={thumbsClassName}>
            {items.map((item, index) => (
              <button
                key={`${item.url}-thumb-${index}`}
                type="button"
                className={`${thumbClassName} ${index === activeIndex ? activeThumbClassName : ""}`}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  showIndex(index);
                }}
                aria-label={`Preview media ${index + 1}`}
              >
                {item.kind === "video" ? (
                  <VideoPreview
                    src={item.url}
                    poster={item.thumbnailUrl}
                    className={thumbMediaClassName}
                    mediaClassName={thumbMediaClassName}
                    controlsClassName={videoControlsClassName}
                    fallbackClassName={videoFallbackClassName}
                    playClassName={videoPlayClassName}
                    controls={false}
                  />
                ) : (
                  <img src={item.url} alt="" className={thumbMediaClassName} />
                )}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
