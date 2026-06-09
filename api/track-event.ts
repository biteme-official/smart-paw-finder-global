import type { VercelRequest, VercelResponse } from '@vercel/node';

const ALLOWED_ORIGINS = [
  'https://biteme.one',
  'https://www.biteme.one',
  'http://localhost:5173',
];

function getCorsOrigin(req: VercelRequest): string {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (/^https:\/\/smart-paw-finder[a-z0-9-]*\.vercel\.app$/.test(origin)) return origin;
  return ALLOWED_ORIGINS[0];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const corsOrigin = getCorsOrigin(req);
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { event_type, session_id, properties, page_path, referrer } = req.body ?? {};
  if (!event_type || typeof event_type !== 'string') {
    return res.status(400).json({ error: 'event_type required' });
  }
  if (!session_id || typeof session_id !== 'string') {
    return res.status(400).json({ error: 'session_id required' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('[track-event] Missing Supabase env vars');
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({
      event_type,
      session_id,
      properties: typeof properties === 'object' && properties !== null ? properties : {},
      page_path: page_path ?? null,
      referrer: referrer ?? null,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error('[track-event]', err);
    return res.status(500).json({ error: 'Failed to track' });
  }

  return res.status(200).json({ ok: true });
}
