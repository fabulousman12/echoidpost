type PublicPost = {
  id?: string;
  _id?: string;
  title?: string;
  createdAt?: string;
  updatedAt?: string;
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
};

const apiOrigin = process.env.NEXT_PUBLIC_API_URL || process.env.API_ORIGIN || "https://server.echoidchat.online";
const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL || "https://post.echoidchat.online";
const configuredMaxSitemapPages = Number(process.env.SITEMAP_MAX_FEED_PAGES || 20);
const maxSitemapPages = Number.isFinite(configuredMaxSitemapPages) && configuredMaxSitemapPages > 0 ? configuredMaxSitemapPages : 20;

export const dynamic = "force-dynamic";
export const revalidate = 0;

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 70) || "echo"
  );
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getPostId(post: PublicPost) {
  return String(post._id || post.id || "").trim();
}

function getExpiryTime(post: PublicPost) {
  const rawExpiry = post.expire || post.expiresAt || post.expiryAt || post.expireAt || "";
  const expiry = Date.parse(String(rawExpiry));
  return Number.isFinite(expiry) ? expiry : 0;
}

function isTruthyFlag(value: unknown) {
  if (typeof value === "string") return ["true", "1", "yes"].includes(value.trim().toLowerCase());
  return Boolean(value);
}

function isIndexablePost(post: PublicPost) {
  const status = String(post.status || "").trim().toLowerCase();
  const visibility = String(post.visibility || "").trim().toLowerCase();
  const expiry = getExpiryTime(post);

  if (!getPostId(post)) return false;
  if (isTruthyFlag(post.isDeleted) || isTruthyFlag(post.isDelete) || isTruthyFlag(post.deleted)) return false;
  if (isTruthyFlag(post.banned) || isTruthyFlag(post.isBanned) || isTruthyFlag(post.userBanned)) return false;
  if (["deleted", "banned", "blocked", "removed", "expired", "private", "draft"].includes(status)) return false;
  if (visibility && visibility !== "public") return false;
  if (post.isPublic === false || post.public === false) return false;
  if (expiry > 0 && expiry <= Date.now()) return false;

  return true;
}

function getPostUrl(post: PublicPost) {
  const id = getPostId(post);
  return `${siteOrigin}/post/${encodeURIComponent(id)}/${slugify(post.title || "echo")}`;
}

async function getFeedPage(page: number): Promise<{ posts: PublicPost[]; hasMore: boolean }> {
  const search = new URLSearchParams({ filter: "time" });
  if (page > 1) search.set("page", String(page));

  const response = await fetch(`${apiOrigin}/post/public/feed?${search.toString()}`, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Feed request failed with ${response.status}`);
  }

  const data = await response.json().catch(() => ({}));
  return {
    posts: Array.isArray(data?.posts) ? data.posts : [],
    hasMore: Boolean(data?.hasMore),
  };
}

async function getSitemapPosts() {
  const posts = new Map<string, PublicPost>();

  for (let page = 1; page <= maxSitemapPages; page += 1) {
    const feed = await getFeedPage(page);
    feed.posts.filter(isIndexablePost).forEach((post) => {
      posts.set(getPostId(post), post);
    });

    if (!feed.hasMore) break;
  }

  return [...posts.values()];
}

function buildSitemapXml(posts: PublicPost[]) {
  const urls = [
    `  <url><loc>${escapeXml(`${siteOrigin}/post`)}</loc><changefreq>hourly</changefreq><priority>0.8</priority></url>`,
    ...posts.map((post) => {
      const lastmod = Date.parse(String(post.updatedAt || post.createdAt || ""));
      const lastmodTag = Number.isFinite(lastmod) ? `<lastmod>${new Date(lastmod).toISOString()}</lastmod>` : "";
      return `  <url><loc>${escapeXml(getPostUrl(post))}</loc>${lastmodTag}<changefreq>daily</changefreq><priority>0.7</priority></url>`;
    }),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}

export async function GET() {
  try {
    const posts = await getSitemapPosts();
    const xml = buildSitemapXml(posts);

    return new Response(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    });
  } catch {
    return new Response("Sitemap unavailable", {
      status: 502,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }
}
