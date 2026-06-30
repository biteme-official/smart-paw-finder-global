import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

const ALLOWED_ORIGINS = [
  'https://biteme.one',
  'https://www.biteme.one',
  'http://localhost:5173',
];

interface ProductMapping {
  global_numeric_id: string;
  kr_product_cd: string | null;
  confidence: string;
}

interface ScrapedReview {
  rating: number;
  content_en?: string;
}

function getCorsOrigin(req: VercelRequest): string {
  const origin = req.headers.origin || '';
  const isAllowed =
    ALLOWED_ORIGINS.includes(origin) ||
    /^https:\/\/smart-paw-finder[a-z0-9-]*\.vercel\.app$/.test(origin);
  return isAllowed ? origin : ALLOWED_ORIGINS[0];
}

function loadJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

const TRUSTED_CONFIDENCE = new Set(['sheet_exact', 'confirmed']);

export default function handler(req: VercelRequest, res: VercelResponse) {
  const corsOrigin = getCorsOrigin(req);
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { ids } = req.query;
  if (!ids) return res.status(400).json({ error: 'ids is required' });

  const idList = String(ids).split(',').map(s => s.trim()).filter(Boolean).slice(0, 100);
  const result: Record<string, { avgRating: number; count: number }> = {};

  const mapping = loadJson<ProductMapping[]>(join(DATA_DIR, 'product-mapping.json'));
  if (!mapping) {
    for (const id of idList) result[id] = { avgRating: 0, count: 0 };
    return res.status(200).json(result);
  }

  for (const id of idList) {
    const match = mapping.find(m => m.global_numeric_id === id);
    if (!match?.kr_product_cd || !TRUSTED_CONFIDENCE.has(match.confidence)) {
      result[id] = { avgRating: 0, count: 0 };
      continue;
    }

    const reviewData = loadJson<{ reviews: ScrapedReview[] }>(
      join(DATA_DIR, 'reviews', `${match.kr_product_cd}.json`)
    );
    if (!reviewData) {
      result[id] = { avgRating: 0, count: 0 };
      continue;
    }

    const translated = reviewData.reviews.filter(r => r.content_en);
    if (!translated.length) {
      result[id] = { avgRating: 0, count: 0 };
      continue;
    }

    const avg = translated.reduce((s, r) => s + r.rating, 0) / translated.length;
    result[id] = { avgRating: avg, count: translated.length };
  }

  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
  return res.status(200).json(result);
}
