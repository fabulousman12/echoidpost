import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import PostShareButton from "./PostShareButton";
import styles from "@/styles/Post.module.css";

type PageParams = Promise<{ id: string; slug: string }>;

type MediaItem = {
  url: string;
  kind: "image" | "video";
  isCover?: boolean;
};

type BodyBlock =
  | { type: "text"; key: string; value: string }
  | { type: "media"; key: string; value: MediaItem };

type PublicPost = {
  id: string;
  _id?: string;
  posterId?: string;
  title?: string;
  body?: string;
  name?: string;
  username?: string;
  createdAt?: string;
  category?: string;
  coverImage?: string;
  likes?: number;
  comments?: number;
  dislike?: number;
  dislikes?: number;
  witness?: number;
  expire?: string;
  expiresAt?: string;
  expiryAt?: string;
  expireAt?: string;
  isDeleted?: boolean | number | string;
  isDelete?: boolean | number | string;
  deleted?: boolean | number | string;
  banned?: boolean | number | string;
  isBanned?: boolean | number | string;
  userBanned?: boolean | number | string;
  status?: string;
  visibility?: string;
  isPublic?: boolean;
  public?: boolean;
  media?: unknown[];
  mediaItems?: unknown[];
  mediaList?: unknown[];
  attachments?: unknown[];
  files?: unknown[];
  imageUrls?: unknown[];
  image_urls?: unknown[];
  mediaUrls?: unknown[];
  media_urls?: unknown[];
};

const bodyImageLinkRegex = /\[(Link|Link_cover):-\s*(https?:\/\/[^\]\s]+)\s*\]/gi;
const partialBodyImageLinkRegex = /\[(?:Link|Link_cover):-?[^\]\n]*\]?/gi;
const mediaTokenRegex = /\[\[media:([^[\]]+)\]\]/g;
const videoCoverUrlRegex = /\.(mp4|mov|webm|ogg|m4v)(?:[?#].*)?$/i;
const publicPostsHref = "/post";
const appOrigin = "https://app.echoidchat.online";
const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL || "https://post.echoidchat.online";

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 70) || "echo"
  );
}

function isVideoUrl(url = "") {
  return videoCoverUrlRegex.test(String(url).trim());
}

function getMediaKindFromUrl(url = ""): "image" | "video" {
  return isVideoUrl(url) ? "video" : "image";
}

function getStructuredMediaUrl(entry: unknown) {
  if (!entry) return "";
  if (typeof entry === "string") return entry.trim();
  if (typeof entry !== "object") return "";

  const value = entry as Record<string, unknown>;
  return String(
    value.url ||
      value.mediaUrl ||
      value.media_url ||
      value.publicUrl ||
      value.public_url ||
      value.signedUrl ||
      value.signed_url ||
      value.previewUrl ||
      value.preview_url ||
      value.imageUrl ||
      value.image_url ||
      value.videoUrl ||
      value.video_url ||
      value.coverImage ||
      value.cover_image ||
      ""
  ).trim();
}

function getStructuredMediaKind(entry: unknown, fallbackUrl = ""): "image" | "video" {
  if (entry && typeof entry === "object") {
    const value = entry as Record<string, unknown>;
    const explicitKind = String(value.kind || value.mediaType || value.type || value.mimeType || "")
      .trim()
      .toLowerCase();
    if (explicitKind.startsWith("video")) return "video";
    if (explicitKind.startsWith("image")) return "image";
  }
  return getMediaKindFromUrl(fallbackUrl);
}

function pushMediaItem(items: MediaItem[], seenUrls: Set<string>, entry: unknown, isCover = false) {
  const url = getStructuredMediaUrl(entry);
  if (!url || seenUrls.has(url)) return;
  seenUrls.add(url);

  const entryRecord = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
  items.push({
    url,
    kind: getStructuredMediaKind(entry, url),
    isCover: Boolean(isCover || entryRecord.isCover || entryRecord.cover),
  });
}

function extractBodyMediaItems(body = "") {
  const mediaItems: MediaItem[] = [];
  const seenUrls = new Set<string>();
  let match: RegExpExecArray | null;
  const source = String(body || "");

  bodyImageLinkRegex.lastIndex = 0;
  while ((match = bodyImageLinkRegex.exec(source))) {
    const label = String(match[1] || "").trim().toLowerCase();
    const url = String(match[2] || "").trim();
    if (!url || seenUrls.has(url)) continue;
    seenUrls.add(url);
    mediaItems.push({
      url,
      kind: getMediaKindFromUrl(url),
      isCover: label === "link_cover",
    });
  }
  bodyImageLinkRegex.lastIndex = 0;

  return mediaItems;
}

function getPostMediaItems(post: PublicPost) {
  const bodyMedia = extractBodyMediaItems(post.body);
  const mediaItems = [...bodyMedia];
  const seenUrls = new Set(bodyMedia.map((item) => item.url));

  [
    ...(Array.isArray(post.mediaItems) ? post.mediaItems : []),
    ...(Array.isArray(post.media) ? post.media : []),
    ...(Array.isArray(post.mediaList) ? post.mediaList : []),
    ...(Array.isArray(post.attachments) ? post.attachments : []),
    ...(Array.isArray(post.files) ? post.files : []),
    ...(Array.isArray(post.imageUrls) ? post.imageUrls : []),
    ...(Array.isArray(post.image_urls) ? post.image_urls : []),
    ...(Array.isArray(post.mediaUrls) ? post.mediaUrls : []),
    ...(Array.isArray(post.media_urls) ? post.media_urls : []),
  ].forEach((entry) => pushMediaItem(mediaItems, seenUrls, entry));

  pushMediaItem(
    mediaItems,
    seenUrls,
    {
      url: post.coverImage || "",
      isCover: true,
    },
    true
  );

  return mediaItems.sort((left, right) => Number(Boolean(right.isCover)) - Number(Boolean(left.isCover)));
}

function getLeadMedia(post: PublicPost) {
  const mediaItems = getPostMediaItems(post);
  return mediaItems.find((item) => item.isCover) || mediaItems[0] || null;
}

function stripMediaLinks(body = "") {
  return String(body || "")
    .replace(bodyImageLinkRegex, "")
    .replace(partialBodyImageLinkRegex, "")
    .replace(mediaTokenRegex, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getBodyBlocks(post: PublicPost) {
  const source = String(post.body || "");
  const leadMedia = getLeadMedia(post);
  const blocks: BodyBlock[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  bodyImageLinkRegex.lastIndex = 0;
  while ((match = bodyImageLinkRegex.exec(source))) {
    if (match.index > lastIndex) {
      const text = source.slice(lastIndex, match.index);
      if (text.trim()) {
        blocks.push({ type: "text", key: `text-${match.index}`, value: text });
      }
    }

    const label = String(match[1] || "").trim().toLowerCase();
    const url = String(match[2] || "").trim();
    const media: MediaItem = {
      url,
      isCover: label === "link_cover",
      kind: getMediaKindFromUrl(url),
    };

    if (url && (!leadMedia || url !== leadMedia.url)) {
      blocks.push({ type: "media", key: `media-${match.index}`, value: media });
    }

    lastIndex = match.index + match[0].length;
  }
  bodyImageLinkRegex.lastIndex = 0;

  if (lastIndex < source.length) {
    const text = source.slice(lastIndex);
    if (text.trim()) {
      blocks.push({ type: "text", key: `text-tail-${lastIndex}`, value: text });
    }
  }

  return blocks
    .map((block) =>
      block.type === "text"
        ? {
            ...block,
            value: block.value
              .replace(/[ \t]+\n/g, "\n")
              .replace(/\n[ \t]+/g, "\n")
              .replace(/[ \t]{2,}/g, " ")
              .replace(/\n{3,}/g, "\n\n")
              .trim(),
          }
        : block
    )
    .filter((block) => (block.type === "text" ? block.value.length > 0 : Boolean(block.value.url)));
}

function formatRelativeTime(createdAt?: string) {
  const time = Date.parse(String(createdAt || ""));
  if (!Number.isFinite(time)) return "";
  const minutes = Math.max(0, Math.floor((Date.now() - time) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function displayCategory(value?: string) {
  return String(value || "")
    .split(" ")
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function getAuthorName(post: PublicPost) {
  return post.name || (post.username ? `@${post.username}` : "EchoId user");
}

function getPostTitle(post: PublicPost) {
  return post.title?.trim() || "EchoId post";
}

function isTruthyFlag(value: unknown) {
  if (typeof value === "string") return ["true", "1", "yes"].includes(value.trim().toLowerCase());
  return Boolean(value);
}

function getExpiryTime(post: PublicPost) {
  const rawExpiry = post.expire || post.expiresAt || post.expiryAt || post.expireAt || "";
  const expiry = Date.parse(String(rawExpiry));
  return Number.isFinite(expiry) ? expiry : 0;
}

function isIndexablePost(post: PublicPost) {
  const status = String(post.status || "").trim().toLowerCase();
  const visibility = String(post.visibility || "").trim().toLowerCase();
  const expiry = getExpiryTime(post);

  if (isTruthyFlag(post.isDeleted) || isTruthyFlag(post.isDelete) || isTruthyFlag(post.deleted)) return false;
  if (isTruthyFlag(post.banned) || isTruthyFlag(post.isBanned) || isTruthyFlag(post.userBanned)) return false;
  if (["deleted", "banned", "blocked", "removed", "expired", "private", "draft"].includes(status)) return false;
  if (visibility && visibility !== "public") return false;
  if (post.isPublic === false || post.public === false) return false;
  if (expiry > 0 && expiry <= Date.now()) return false;

  return true;
}

function getSeoDescription(post: PublicPost) {
  const body = stripMediaLinks(post.body).replace(/\s+/g, " ").trim();
  const author = getAuthorName(post);
  const category = displayCategory(post.category);
  const stats = [
    Number(post.likes || 0) ? `${Number(post.likes || 0)} likes` : "",
    Number(post.comments || 0) ? `${Number(post.comments || 0)} comments` : "",
    Number(post.witness || 0) ? `${Number(post.witness || 0)} witness` : "",
  ].filter(Boolean);
  const context = [author, category, ...stats].filter(Boolean).join(" • ");
  const description = [body, context].filter(Boolean).join(" — ");

  return (description || `Public EchoId post by ${author}`).slice(0, 160);
}

function getPostPath(post: PublicPost) {
  return `/post/${encodeURIComponent(post.id)}/${slugify(getPostTitle(post))}`;
}

function getPostUrl(post: PublicPost) {
  return `${siteOrigin}${getPostPath(post)}`;
}

async function getPost(id: string): Promise<PublicPost | null> {
  const res = await fetch(`https://server.echoidchat.online/post/public/${id}`, {
    next: { revalidate: 60 },
  });

  const data = await res.json();
  if (!data?.success || !data?.post) return null;

  const post = {
    ...data.post,
    id: data.post._id || data.post.id,
  };

  return isIndexablePost(post) ? post : null;
}

function renderMedia(media: MediaItem | null, altText: string, className = styles.mediaFrame) {
  if (!media?.url) return null;

  return (
    <div className={className}>
      {media.kind === "video" ? (
        <video src={media.url} className={styles.media} controls playsInline preload="metadata" />
      ) : (
        <img src={media.url} alt={altText} className={styles.media} />
      )}
    </div>
  );
}

export async function generateMetadata({ params }: { params: PageParams }): Promise<Metadata> {
  const { id } = await params;
  const post = await getPost(id);

  if (!post) {
    return {
      title: "Post not found | EchoId",
      robots: { index: false, follow: false },
    };
  }

  const title = `${getPostTitle(post)} | EchoId`;
  const description = getSeoDescription(post);
  const canonical = getPostUrl(post);
  const leadMedia = getLeadMedia(post);
  const image = leadMedia?.kind === "image" ? leadMedia.url : undefined;

  return {
    title,
    description,
    authors: [{ name: getAuthorName(post) }],
    category: post.category,
    alternates: {
      canonical,
    },
    openGraph: {
      type: "article",
      url: canonical,
      title,
      description,
      siteName: "EchoId",
      publishedTime: post.createdAt,
      authors: [getAuthorName(post)],
      section: displayCategory(post.category) || undefined,
      images: image ? [{ url: image, alt: getPostTitle(post) }] : [],
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      images: image ? [image] : [],
    },
  };
}

export default async function Page({ params }: { params: PageParams }) {
  const { id, slug } = await params;
  const post = await getPost(id);

  if (!post) {
    return (
      <main className={styles.page}>
        <section className={styles.notFound}>
          <h1>Post not found</h1>
          <a href={publicPostsHref}>Back to EchoId</a>
        </section>
      </main>
    );
  }

  const canonicalPath = getPostPath(post);
  if (slug !== slugify(getPostTitle(post))) {
    permanentRedirect(canonicalPath);
  }

  const author = post.name || "Anonymous";
  const handle = post.username ? `@${post.username}` : "@anonymous";
  const title = getPostTitle(post);
  const leadMedia = getLeadMedia(post);
  const mediaItems = getPostMediaItems(post);
  const bodyBlocks = getBodyBlocks(post);
  const extraMedia = mediaItems.filter((item) => item.url && item.url !== leadMedia?.url && bodyBlocks.length === 0);
  const fullBody = stripMediaLinks(post.body);
  const category = displayCategory(post.category);
  const appPostHref = `${appOrigin}/app/post/${post.id}`;
  const sharePreviewText = (title || fullBody || "").trim().slice(0, 160);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <a href={publicPostsHref} className={styles.back} aria-label="Back to EchoId public posts">
          <span aria-hidden="true">←</span>
          <span>Back</span>
        </a>
        <strong>Echo</strong>
      </header>

      <section className={styles.layout}>
        <article className={styles.card}>
          {leadMedia ? <div className={styles.hero}>{renderMedia(leadMedia, title)}</div> : null}

          <div className={`${styles.sheet} ${leadMedia ? "" : styles.noHero}`}>
            {extraMedia.length > 0 ? (
              <div className={styles.mediaStack}>
                {extraMedia.map((media, index) => (
                  <div key={`${media.url}-${index}`}>{renderMedia(media, title)}</div>
                ))}
              </div>
            ) : null}

            <section className={styles.copy}>
              <div className={styles.authorCard}>
                <div className={styles.avatar} aria-hidden="true">
                  <span>{author.charAt(0).toUpperCase()}</span>
                </div>
                <div className={styles.authorCopy}>
                  <strong>{author}</strong>
                  <span>{handle}</span>
                </div>
              </div>

              <div className={styles.metaRow}>
                {formatRelativeTime(post.createdAt) ? <span>{formatRelativeTime(post.createdAt)}</span> : null}
                {category ? <span>{category}</span> : null}
              </div>

              <h1 className={styles.title}>{title}</h1>

              <div className={styles.body}>
                {bodyBlocks.length > 0 ? (
                  bodyBlocks.map((block) =>
                    block.type === "media" ? (
                      <div key={block.key} className={styles.inlineMedia}>
                        {renderMedia(block.value, title)}
                      </div>
                    ) : (
                      <p key={block.key}>{block.value}</p>
                    )
                  )
                ) : fullBody ? (
                  <p>{fullBody}</p>
                ) : (
                  <p className={styles.muted}>Media-only post</p>
                )}
              </div>

              <div className={styles.stats} aria-label="Post stats">
                <span>Likes {Number(post.likes || 0)}</span>
                <span>Comments {Number(post.comments || 0)}</span>
                <span>Dislikes {Number(post.dislike ?? post.dislikes ?? 0)}</span>
                {Number(post.witness || 0) > 0 ? <span>Witness {Number(post.witness || 0)}</span> : null}
              </div>
            </section>
          </div>
        </article>

        <aside className={styles.sidePanel}>
          <div>
            <span className={styles.panelLabel}>Public preview</span>
            <h2>Open EchoId for the full conversation.</h2>
            <p>Comments and reactions are available in the app experience.</p>
          </div>
          <a href={appPostHref} className={styles.cta}>
            Open full experience
          </a>
          <PostShareButton
            shareUrl={appPostHref}
            title={title}
            author={author}
            previewText={sharePreviewText}
            previewMediaUrl={leadMedia?.url}
            previewMediaKind={leadMedia?.kind}
          />
        </aside>
      </section>
    </main>
  );
}
