import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { shortcode } = req.query;
  if (!shortcode || typeof shortcode !== "string") {
    return res.status(400).json({ error: "missing shortcode" });
  }

  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  const igId = process.env.INSTAGRAM_ACCOUNT_ID;

  if (!token || !igId) {
    return res.status(200).json({ thumbnail_url: null });
  }

  try {
    const fields = "id,media_type,thumbnail_url,media_url,permalink";
    const base = `https://graph.facebook.com/v21.0/${igId}`;

    // instagram-reels.ts 와 동일한 방식: own media + tagged media 모두 검색
    const [mediaRes, tagsRes] = await Promise.all([
      fetch(`${base}/media?fields=${fields}&limit=100&access_token=${token}`),
      fetch(`${base}/tags?fields=${fields}&limit=100&access_token=${token}`),
    ]);

    interface IGItem { media_type: string; thumbnail_url?: string; media_url?: string; permalink?: string; }
    const [media, tags] = await Promise.all([mediaRes.json(), tagsRes.json()]) as [{ data?: IGItem[] }, { data?: IGItem[] }];

    const all: IGItem[] = [...(media.data ?? []), ...(tags.data ?? [])];
    const post = all.find(p => p.permalink?.includes(`/p/${shortcode}/`));

    // REELS/VIDEO → thumbnail_url(커버), IMAGE → media_url
    const thumbnail_url =
      post?.thumbnail_url ??
      (post?.media_type === "IMAGE" ? post?.media_url : null) ??
      null;

    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    return res.json({ thumbnail_url });
  } catch {
    res.setHeader("Cache-Control", "public, s-maxage=300");
    return res.json({ thumbnail_url: null });
  }
}
