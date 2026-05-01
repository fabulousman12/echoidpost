const SITEMAP_SOURCE_URL = process.env.SITEMAP_SOURCE_URL || "https://echodatageneral.s3.ap-south-1.amazonaws.com/sitemaps/sitemap.xml";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const response = await fetch(SITEMAP_SOURCE_URL, {
    cache: "no-store",
    headers: {
      Accept: "application/xml,text/xml,*/*",
    },
  });

  if (!response.ok) {
    return new Response("Sitemap unavailable", {
      status: 502,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  const xml = await response.text();

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
