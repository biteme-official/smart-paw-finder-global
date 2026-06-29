import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { shortcode } = req.query;
  if (!shortcode || typeof shortcode !== "string") {
    return res.status(400).json({ error: "missing shortcode" });
  }

  try {
    // Instagram embed 페이지에서 og:image / video poster 추출 (oembed API는 인증 필요로 deprecated)
    const r = await fetch(`https://www.instagram.com/p/${shortcode}/embed/captioned/`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!r.ok) throw new Error(`status ${r.status}`);
    const html = await r.text();

    const posterMatch = html.match(/poster="(https:\/\/[^"]+)"/);
    const imgMatch = html.match(/src="(https:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i);
    const ogMatch = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/);

    const thumbnail_url = posterMatch?.[1] ?? imgMatch?.[1] ?? ogMatch?.[1] ?? null;

    res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
    return res.json({ thumbnail_url });
  } catch {
    res.setHeader("Cache-Control", "public, s-maxage=300");
    return res.json({ thumbnail_url: null });
  }
}
