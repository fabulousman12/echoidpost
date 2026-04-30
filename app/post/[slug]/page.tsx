import styles from "@/styles/Post.module.css";

function extractId(slug?: string) {
  if (!slug || typeof slug !== "string") return "";
  return slug.split("-").pop() || "";
}

// 🔥 Fetch post (ISR)
async function getPost(id: string) {
  const res = await fetch(
    `https://server.echoidchat.online/post/public/${id}`,
    {
      next: { revalidate: 60 },
    }
  );

  const data = await res.json();

  if (!data?.success || !data?.post) return null;

  return {
    ...data.post,
    id: data.post._id,
  };
}

// 🔥 SEO metadata (replaces <Head>)
export async function generateMetadata({ params }: { params: { slug: string } }) {
  const id = extractId(params.slug);
  const post = await getPost(id);

  if (!post) {
    return { title: "Post not found" };
  }

  return {
    title: post.title,
    description: post.body?.slice(0, 120) || "",
    openGraph: {
      title: post.title,
      description: post.body || "",
      images: [post.coverImage || ""],
    },
  };
}

// 🔥 Main page (Server Component)
// 
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const id = extractId(slug);
  const post = await getPost(id);

  if (!post) {
    return <div>Not found</div>;
  }

  const renderMedia = (media: any, key: number) => {
    if (!media?.url) return null;

    return media.kind === "video" ? (
      <video key={key} src={media.url} controls className={styles.media} />
    ) : (
      <img key={key} src={media.url} alt={post.title} className={styles.media} />
    );
  };

  return (
    <main className={styles.container}>
      {/* Back */}
      <a href="/" className={styles.back}>
        ← Back
      </a>

      <article className={styles.card}>
        <h1 className={styles.title}>{post.title}</h1>

        <div className={styles.author}>
          <strong>{post.name}</strong>
          <span>@{post.username}</span>
        </div>

        <span className={styles.time}>
          {post.relativeTimeLabel || ""}
        </span>

        {/* Media */}
        {post.media?.map((m: any, i: number) => renderMedia(m, i))}

        {/* Body */}
        <div className={styles.body}>
          {Array.isArray(post.bodyBlocks) && post.bodyBlocks.length > 0 ? (
            post.bodyBlocks.map((block: any, i: number) =>
              block.type === "media" ? (
                renderMedia(block.value, i)
              ) : (
                <p key={i} className={styles.text}>
                  {block.value}
                </p>
              )
            )
          ) : post.body ? (
            <p className={styles.text}>{post.body}</p>
          ) : (
            <p className={styles.muted}>Media-only post</p>
          )}
        </div>

        {/* 🔥 Actions (NO onClick — server-safe) */}
        <div className={styles.actions}>
          <a href={`/app/post/${post.id}`}>👍 {post.likes || 0}</a>
          <a href={`/app/post/${post.id}`}>💬 {post.comments || 0}</a>
          <a href={`/app/post/${post.id}`}>👎 {post.dislike || 0}</a>
        </div>

        {/* CTA */}
        <div className={styles.comments}>
          <h3>Comments</h3>
          <p>Open the app to view and interact</p>

          <a href={`/app/post/${post.id}`}>
            Open full experience
          </a>
        </div>
      </article>
    </main>
  );
}