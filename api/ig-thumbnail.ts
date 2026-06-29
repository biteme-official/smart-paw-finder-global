import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { shortcode } = req.query;
  if (!shortcode || typeof shortcode !== "string") {
    return res.status(400).json({ error: "missing shortcode" });
  }

  try {
    const url = `https://api.instagram.com/oembed?url=https://www.instagram.com/p/${shortcode}/&maxwidth=400`;
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!r.ok) throw new Error(`oembed status ${r.status}`);
    const data = await r.json() as { thumbnail_url?: string };
    res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
    return res.json({ thumbnail_url: data.thumbnail_url ?? null });
  } catch {
    return res.status(200).json({ thumbnail_url: null });
  }
}
