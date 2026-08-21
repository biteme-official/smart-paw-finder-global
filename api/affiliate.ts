import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

const ALLOWED_ORIGINS = ['https://biteme.one', 'https://www.biteme.one', 'http://localhost:5173'];
function getCorsOrigin(req: VercelRequest): string {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (/^https:\/\/smart-paw-finder[a-z0-9-]*\.vercel\.app$/.test(origin)) return origin;
  return ALLOWED_ORIGINS[0];
}

function checkAdmin(req: VercelRequest): boolean {
  return (req.headers['x-admin-key'] as string) === process.env.B2B_ADMIN_PASSWORD;
}

const SOCIAL_PLATFORMS = ['Instagram', 'TikTok'];

async function handleApply(req: VercelRequest, res: VercelResponse) {
  const { socialAccounts, email, petName } = req.body || {};
  if (!Array.isArray(socialAccounts) || socialAccounts.length === 0 || !email || !petName) {
    return res.status(400).json({ error: 'At least one social account, email, and pet name are required.' });
  }

  const normalizedAccounts = [];
  for (const entry of socialAccounts) {
    const platform = String(entry?.platform || '');
    const account = String(entry?.account || '').replace(/^@/, '').trim();
    if (!SOCIAL_PLATFORMS.includes(platform) || !account) {
      return res.status(400).json({ error: 'Each social account needs a valid platform and account name.' });
    }
    normalizedAccounts.push({ platform, account });
  }

  const normalizedEmail = String(email).toLowerCase().trim();
  const normalizedPetName = String(petName).trim();
  if (!normalizedEmail || !normalizedPetName) {
    return res.status(400).json({ error: 'At least one social account, email, and pet name are required.' });
  }

  const existingId = await kv.get<string>(`affiliate:email:${normalizedEmail}`);
  if (existingId) return res.status(409).json({ error: 'An application with this email already exists.' });

  const id = `aff_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  const couponCode = `${normalizedPetName.toUpperCase().replace(/[^A-Z0-9]/g, '')}15`;
  await Promise.all([
    kv.set(`affiliate:app:${id}`, {
      id,
      socialAccounts: normalizedAccounts,
      email: normalizedEmail,
      petName: normalizedPetName,
      couponCode,
      status: 'pending',
      createdAt: now,
    }),
    kv.set(`affiliate:email:${normalizedEmail}`, id),
    kv.sadd('affiliate:ids', id),
  ]);

  return res.status(200).json({ success: true, id, couponCode });
}

async function handleList(req: VercelRequest, res: VercelResponse) {
  if (!checkAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });
  const ids = await kv.smembers('affiliate:ids');
  const apps = await Promise.all(ids.map((id) => kv.get(`affiliate:app:${id}`)));
  return res.status(200).json({ applications: apps.filter(Boolean) });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cors = getCorsOrigin(req);
  res.setHeader('Access-Control-Allow-Origin', cors);
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-key');
    return res.status(200).end();
  }

  const action = req.query.action as string;
  try {
    switch (action) {
      case 'apply':
        return handleApply(req, res);
      case 'list':
        return handleList(req, res);
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (e) {
    console.error('[Affiliate] Error:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
