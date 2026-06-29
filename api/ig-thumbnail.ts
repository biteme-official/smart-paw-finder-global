import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { shortcode } = req.query;
  if (!shortcode || typeof shortcode !== "string") {
    return res.status(400).json({ error: "missing shortcode" });
  }

  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!token) {
    return res.status(200).json({ thumbnail_url: null });
  }

  try {
    // Facebook Graph API instagram_oembed → thumbnail_url 반환 (토큰 필요, 공개 게시물 지원)
    const apiUrl = `https://graph.facebook.com/v21.0/instagram_oembed?url=${encodeURIComponent(`https://www.instagram.com/p/${shortcode}/`)}&fields=thumbnail_url&access_token=${token}`;
    const r = await fetch(apiUrl);
    if (!r.ok) throw new Error(`graph api status ${r.status}`);
    const data = await r.json() as { thumbnail_url?: string; error?: { message: string } };
    if (data.error) throw new Error(data.error.message);

    res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
    return res.json({ thumbnail_url: data.thumbnail_url ?? null });
  } catch {
    res.setHeader("Cache-Control", "public, s-maxage=300");
    return res.json({ thumbnail_url: null });
  }
}
