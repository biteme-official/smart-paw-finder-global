import type { VercelRequest, VercelResponse } from '@vercel/node';

// ─── Meta Conversions API 프록시 ───────────────────────────────────────────────
// biteme.one은 커스텀 프론트엔드라 Shopify가 자동 주입하는 Meta 픽셀이 체크아웃
// 외 페이지(상품 상세 등)에서는 발화되지 않는다. 클라이언트가 이 엔드포인트를
// 호출하면 서버에서 실제 요청 IP/UA를 붙여 Meta Graph API로 이벤트를 전달한다.
// 광고 차단기의 영향을 받지 않아 Purchase(체크아웃 CAPI)와 동일한 신뢰도를 갖는다.

const PIXEL_ID = process.env.META_PIXEL_ID;
const ACCESS_TOKEN = process.env.META_CAPI_ACCESS_TOKEN;
const GRAPH_API_VERSION = 'v21.0';

const ALLOWED_EVENTS = new Set(['ViewContent', 'AddToCart']);

const ALLOWED_ORIGINS = [
  'https://biteme.one',
  'https://www.biteme.one',
  'http://localhost:5173',
];

function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (/^https:\/\/smart-paw-finder-global-[a-z0-9-]+\.vercel\.app$/.test(origin)) return true;
  return false;
}

function getCorsOrigin(req: VercelRequest): string {
  const origin = req.headers.origin || '';
  return isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0];
}

function getClientIp(req: VercelRequest): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  if (Array.isArray(forwarded)) return forwarded[0];
  return req.socket?.remoteAddress;
}

interface MetaCapiRequestBody {
  event_name?: string;
  event_id?: string;
  event_source_url?: string;
  content_ids?: string[];
  content_type?: string;
  content_name?: string;
  value?: number;
  currency?: string;
  fbc?: string;
  fbp?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const corsOrigin = getCorsOrigin(req);

  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  res.setHeader('Access-Control-Allow-Origin', corsOrigin);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!PIXEL_ID || !ACCESS_TOKEN) {
    console.error('[Meta CAPI] META_PIXEL_ID 또는 META_CAPI_ACCESS_TOKEN 환경변수 없음');
    return res.status(500).json({ error: 'Meta CAPI not configured' });
  }

  const body = (req.body || {}) as MetaCapiRequestBody;

  if (!body.event_name || !ALLOWED_EVENTS.has(body.event_name)) {
    return res.status(400).json({ error: 'Unsupported or missing event_name' });
  }
  if (!Array.isArray(body.content_ids) || body.content_ids.length === 0) {
    return res.status(400).json({ error: 'content_ids is required' });
  }
  if (!body.content_ids.every((id) => typeof id === 'string' && id.length > 0 && id.length < 50)) {
    return res.status(400).json({ error: 'Invalid content_ids' });
  }
  if (body.event_source_url && !body.event_source_url.startsWith('https://www.biteme.one')) {
    return res.status(400).json({ error: 'Invalid event_source_url' });
  }

  const payload = {
    data: [
      {
        event_name: body.event_name,
        event_time: Math.floor(Date.now() / 1000),
        event_id: body.event_id,
        action_source: 'website',
        event_source_url: body.event_source_url,
        user_data: {
          client_ip_address: getClientIp(req),
          client_user_agent: req.headers['user-agent'],
          ...(body.fbc ? { fbc: body.fbc } : {}),
          ...(body.fbp ? { fbp: body.fbp } : {}),
        },
        custom_data: {
          content_ids: body.content_ids,
          content_type: body.content_type || 'product',
          content_name: body.content_name,
          currency: body.currency,
          value: body.value,
        },
      },
    ],
  };

  try {
    const metaRes = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${PIXEL_ID}/events?access_token=${encodeURIComponent(ACCESS_TOKEN)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    const result = await metaRes.json();
    if (!metaRes.ok) {
      console.error('[Meta CAPI] Graph API error:', JSON.stringify(result).slice(0, 500));
      return res.status(502).json({ error: 'Meta CAPI request failed' });
    }

    return res.status(200).json({ success: true, events_received: result.events_received });
  } catch (error) {
    console.error('[Meta CAPI] Error:', error instanceof Error ? error.message : String(error));
    return res.status(500).json({ error: 'Failed to send event' });
  }
}
