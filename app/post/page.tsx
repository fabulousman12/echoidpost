import styles from "@/styles/Feed.module.css";

type SearchParams = Promise<{
  category?: string;
  filter?: string;
  page?: string;
}>;

type MediaItem = {
  url: string;
  kind: "image" | "video";
  isCover?: boolean;
};

type PublicPost = {
  id: string;
  _id?: string;
  title?: string;
  body?: string;
  name?: string;
  username?: string;
  createdAt?: string;
  category?: string;
  subCategory?: string;
  coverImage?: string;
  cover_image?: string;
  coverUrl?: string;
  cover_url?: string;
  coverType?: string;
  coverMimeType?: string;
  likes?: number;
  comments?: number;
  dislike?: number;
  dislikes?: number;
  witness?: number;
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

const appOrigin = "https://app.echoidchat.online";
const apiOrigin = "https://server.echoidchat.online";
const homeCategoryLabels = ["All posts", "Tech", "Rant", "Story", "Questions", "Civic sense", "Politics", "Confessions"];
const sortOptions = [
  { id: "like", label: "By popularity" },
  { id: "time", label: "By date" },
  { id: "comment", label: "By comments" },
];
const bodyImageLinkRegex = /\[(Link|Link_cover):-\s*(https?:\/\/[^\]\s]+)\s*\]/gi;
const partialBodyImageLinkRegex = /\[(?:Link|Link_cover):-?[^\]\n]*\]?/gi;
const mediaTokenRegex = /\[\[media:([^[\]]+)\]\]/g;
const videoCoverUrlRegex = /\.(mp4|mov|webm|ogg|m4v)(?:[?#].*)?$/i;
const postPreviewLimit = 110;

function toCategoryValue(value?: string) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized || normalized === "all posts") return "";
  return normalized;
}

function toDisplayCategory(value?: string) {
  return String(value || "")
    .split(" ")
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function makeQuery(params: { category?: string; filter?: string; page?: number }) {
  const search = new URLSearchParams();
  if (params.category) search.set("category", params.category);
  if (params.filter) search.set("filter", params.filter);
  if (params.page && params.page > 1) search.set("page", String(params.page));
  const qs = search.toString();
  return qs ? `/post?${qs}` : "/post";
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 70) || "echo"
  );
}

function getPostId(post: PublicPost) {
  return String(post._id || post.id || "");
}

function getPostHref(post: PublicPost) {
  const id = getPostId(post);
  return `/post/${encodeURIComponent(id)}/${slugify(post.title || "echo")}`;
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
    mediaItems.push({ url, kind: getMediaKindFromUrl(url), isCover: label === "link_cover" });
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
      url: post.coverImage || post.cover_image || post.coverUrl || post.cover_url || "",
      kind: post.coverType || post.coverMimeType || "",
      isCover: true,
    },
    true
  );

  return mediaItems.sort((left, right) => Number(Boolean(right.isCover)) - Number(Boolean(left.isCover)));
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

function getPostBodyPreview(body = "") {
  const normalizedBody = stripMediaLinks(body);
  if (normalizedBody.length <= postPreviewLimit) return normalizedBody;
  return `${normalizedBody.slice(0, postPreviewLimit).trimEnd()}...`;
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

async function getFeed(category: string, filter: string, page: number): Promise<{ posts: PublicPost[]; hasMore: boolean }> {
  const search = new URLSearchParams();
  if (category) search.set("category", category);
  if (filter) search.set("filter", filter);
  if (page > 1) search.set("page", String(page));

  const res = await fetch(`${apiOrigin}/post/public/feed?${search.toString()}`, {
    next: { revalidate: 60 },
  });
  const data = await res.json().catch(() => ({}));
  const posts: PublicPost[] = Array.isArray(data?.posts)
    ? data.posts.map((post: PublicPost) => ({ ...post, id: getPostId(post) })).filter((post: PublicPost) => post.id)
    : [];

  return {
    posts,
    hasMore: Boolean(data?.hasMore),
  };
}

function renderMedia(media: MediaItem | undefined, altText: string) {
  if (!media?.url) return null;

  return (
    <div className={styles.mediaFrame}>
      {media.kind === "video" ? (
        <video src={media.url} className={styles.media} controls playsInline preload="metadata" />
      ) : (
        <img src={media.url} alt={altText} className={styles.media} />
      )}
    </div>
  );
}

export const metadata = {
  title: "EchoId public posts",
  description: "Browse public EchoId posts and open the full app conversation.",
};

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const selectedCategory = toCategoryValue(params.category);
  const selectedFilter = sortOptions.some((option) => option.id === params.filter) ? String(params.filter) : "like";
  const rawPage = Number.parseInt(String(params.page || "1"), 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const { posts, hasMore } = await getFeed(selectedCategory, selectedFilter, page);
  const selectedCategoryLabel = selectedCategory ? toDisplayCategory(selectedCategory) : "All posts";

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.brand}>
            <div className={styles.brandAvatar} aria-hidden="true">E</div>
            <strong>EchoId</strong>
          </div>
          <a href={appOrigin} className={styles.openApp}>Open in app</a>
        </header>

        <div className={styles.content}>
          <section className={styles.heroCard}>
            <div className={styles.sectionLabel}>Live frequency</div>
            <h1>Signals moving through the city right now.</h1>
            <div className={styles.statRow}>
              <div><strong>{posts.length}</strong><span>Loaded</span></div>
              <div><strong>{selectedCategoryLabel}</strong><span>Category</span></div>
              <div><strong>{sortOptions.find((option) => option.id === selectedFilter)?.label.replace("By ", "")}</strong><span>Sort</span></div>
            </div>
          </section>

          <nav className={styles.categories} aria-label="EchoId categories">
            {homeCategoryLabels.map((label) => {
              const value = toCategoryValue(label);
              return (
                <a
                  key={label}
                  href={makeQuery({ category: value, filter: selectedFilter })}
                  className={`${styles.categoryPill} ${value === selectedCategory ? styles.active : ""}`}
                  aria-current={value === selectedCategory ? "page" : undefined}
                >
                  {label}
                </a>
              );
            })}
          </nav>

          <section className={styles.section}>
            <div className={styles.sectionHeading}>
              <span className={styles.sectionLabel}>{selectedCategoryLabel}</span>
              <div className={styles.sortLinks}>
                {sortOptions.map((option) => (
                  <a
                    key={option.id}
                    href={makeQuery({ category: selectedCategory, filter: option.id })}
                    className={option.id === selectedFilter ? styles.activeSort : ""}
                  >
                    {option.label}
                  </a>
                ))}
              </div>
            </div>

            {posts.length === 0 ? <div className={styles.emptyCard}>No posts in this category yet.</div> : null}

            {posts.map((post) => {
              const author = post.name || "Anonymous";
              const handle = post.username ? `@${post.username}` : "@anonymous";
              const title = post.title || "EchoId post";
              const mediaItems = getPostMediaItems(post);
              const category = toDisplayCategory(post.category);

              return (
                <article key={post.id} className={styles.postCard}>
                  <a href={getPostHref(post)} className={styles.postLink} aria-label={`Open ${title}`}>
                    <div className={styles.postTop}>
                      <div>
                        <h2>{author}</h2>
                        <div className={styles.postMeta}>
                          <span>{handle}</span>
                          {formatRelativeTime(post.createdAt) ? <span>{formatRelativeTime(post.createdAt)}</span> : null}
                        </div>
                      </div>
                      {category ? <span className={styles.postTag}>{category}</span> : null}
                    </div>

                    <h3 className={styles.postTitle}>{title}</h3>
                    {mediaItems.length > 0 ? <div className={styles.imageWrap}>{renderMedia(mediaItems[0], title)}</div> : null}
                    <p>{getPostBodyPreview(post.body) || "Media-only post"}</p>
                  </a>

                  <div className={styles.actions} aria-label="Public preview actions">
                    <button type="button" disabled>Likes {Number(post.likes || 0)}</button>
                    <a href={getPostHref(post)}>Comments {Number(post.comments || 0)}</a>
                    <button type="button" disabled>Dislikes {Number(post.dislike ?? post.dislikes ?? 0)}</button>
                    {Number(post.witness || 0) > 0 ? <button type="button" disabled>Witness {Number(post.witness || 0)}</button> : null}
                  </div>

                  <a href={`${appOrigin}/app/post/${post.id}`} className={styles.cardCta}>Open in app</a>
                </article>
              );
            })}

            <div className={styles.pager}>
              {page > 1 ? <a href={makeQuery({ category: selectedCategory, filter: selectedFilter, page: page - 1 })}>Previous</a> : null}
              {hasMore ? <a href={makeQuery({ category: selectedCategory, filter: selectedFilter, page: page + 1 })}>Next</a> : null}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
