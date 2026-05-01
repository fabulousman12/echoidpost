"use client";

import { useState } from "react";
import styles from "@/styles/Post.module.css";

type PostShareButtonProps = {
  shareUrl: string;
  title: string;
  author: string;
  previewText?: string;
  previewMediaUrl?: string;
  previewMediaKind?: "image" | "video";
};

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand("copy");
  document.body.removeChild(textArea);
}

export default function PostShareButton({
  shareUrl,
  title,
  author,
  previewText,
  previewMediaUrl,
  previewMediaKind = "image",
}: PostShareButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");

  const handleCopy = async () => {
    await copyTextToClipboard(shareUrl);
    setCopyStatus("Link copied");
  };

  const handleShare = async () => {
    await copyTextToClipboard(shareUrl);
    setCopyStatus("Link copied. Choose an app to share.");
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: previewText || `Open ${author}'s EchoId post`,
          url: shareUrl,
        });
      } catch (error) {
        if ((error as Error)?.name !== "AbortError") {
          setCopyStatus("Link copied");
        }
      }
    }
  };

  return (
    <>
      <button type="button" className={styles.shareTrigger} onClick={() => setIsOpen(true)} aria-haspopup="dialog">
        Share post
      </button>

      {isOpen ? (
        <div className={styles.shareOverlay} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setIsOpen(false)}>
          <section className={styles.shareModal} role="dialog" aria-modal="true" aria-labelledby="post-share-title">
            <div className={styles.shareHead}>
              <div>
                <span>Share post</span>
                <strong id="post-share-title">{title}</strong>
              </div>
              <button type="button" aria-label="Close share dialog" onClick={() => setIsOpen(false)}>
                X
              </button>
            </div>

            <div className={styles.sharePreview}>
              {previewMediaUrl ? (
                <div className={styles.sharePreviewMedia}>
                  {previewMediaKind === "video" ? (
                    <video src={previewMediaUrl} muted playsInline preload="metadata" />
                  ) : (
                    <img src={previewMediaUrl} alt={title} />
                  )}
                </div>
              ) : null}
              <div className={styles.sharePreviewCopy}>
                <strong>{author}</strong>
                <p>{previewText || "Open this EchoId post in the app."}</p>
              </div>
            </div>

            <div className={styles.shareLink}>{shareUrl}</div>

            <div className={styles.shareActions}>
              <button type="button" onClick={handleCopy}>
                Copy link
              </button>
              <button type="button" className={styles.primaryShareAction} onClick={handleShare}>
                Share link
              </button>
            </div>
            {copyStatus ? <div className={styles.shareStatus}>{copyStatus}</div> : null}
          </section>
        </div>
      ) : null}
    </>
  );
}
