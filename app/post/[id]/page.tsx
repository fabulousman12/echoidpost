import { permanentRedirect } from "next/navigation";

type PageParams = Promise<{ id: string }>;

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 70) || "echo"
  );
}

function splitLegacyPostId(value: string) {
  const postId = String(value || "").trim();
  const lastDashIndex = postId.lastIndexOf("-");

  if (lastDashIndex <= 0) {
    return {
      id: postId,
      title: "echo",
    };
  }

  return {
    id: postId.slice(lastDashIndex + 1),
    title: postId.slice(0, lastDashIndex),
  };
}

export default async function Page({ params }: { params: PageParams }) {
  const { id: rawId } = await params;
  const { id, title } = splitLegacyPostId(rawId);

  permanentRedirect(`/post/${encodeURIComponent(id)}/${slugify(title)}`);
}
