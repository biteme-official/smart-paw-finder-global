import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

interface ProductMappingEntry {
  global_numeric_id: string;
  kr_product_cd: string | null;
  confidence: string;
}

interface ScrapedReview {
  rating: number;
  content_en?: string;
}

function loadJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

const ALLOWED_ORIGINS = [
  'https://biteme.one',
  'https://www.biteme.one',
  'http://localhost:5173',
];

function getCorsOrigin(req: VercelRequest): string {
  const origin = req.headers.origin ?? '';
  const isAllowed =
    ALLOWED_ORIGINS.includes(origin) ||
    /^https:\/\/smart-paw-finder[a-z0-9-]*\.vercel\.app$/.test(origin);
  return isAllowed ? origin : ALLOWED_ORIGINS[0];
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  const corsOrigin = getCorsOrigin(req);
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const limit = Math.min(Number(req.query.limit ?? 10), 20);

  const mapping = loadJson<ProductMappingEntry[]>(join(DATA_DIR, 'product-mapping.json'));
  if (!mapping) return res.status(200).json({ products: [] });

  const TRUSTED = new Set(['sheet_exact', 'confirmed']);

  const results: { numericId: string; avgRating: number; count: number }[] = [];

  for (const entry of mapping) {
    if (!entry.kr_product_cd || !TRUSTED.has(entry.confidence)) continue;
    const reviewData = loadJson<{ reviews: ScrapedReview[] }>(
      join(DATA_DIR, 'reviews', `${entry.kr_product_cd}.json`)
    );
    if (!reviewData?.reviews?.length) continue;
    const translated = reviewData.reviews.filter(r => r.content_en);
    if (!translated.length) continue;
    const avg = translated.reduce((s, r) => s + r.rating, 0) / translated.length;
    results.push({ numericId: entry.global_numeric_id, avgRating: avg, count: translated.length });
  }

  results.sort((a, b) => b.avgRating - a.avgRating || b.count - a.count);

  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
  return res.status(200).json({ products: results.slice(0, limit) });
}
