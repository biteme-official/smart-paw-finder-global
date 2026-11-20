import type { VercelRequest, VercelResponse } from '@vercel/node';

// 방문자 국가 코드(ISO 3166-1 alpha-2)를 돌려준다. Vercel이 붙여 주는 x-vercel-ip-country 헤더 기준.
// 화면에서 동의가 필요한 지역(EU·EEA·영국·스위스)인지 판단할 때 쓴다 (src/lib/klaviyo.ts).
export default function handler(req: VercelRequest, res: VercelResponse) {
  const header = req.headers['x-vercel-ip-country'];
  const country = (Array.isArray(header) ? header[0] : header) || null;
  res.setHeader('Cache-Control', 'private, no-store');
  res.status(200).json({ country });
}
