import type { Connect } from 'vite';
import { subscribeEmail, EMAIL_RE } from '../api/popup-subscribe';

// 로컬 개발용 /api/popup-subscribe — api/popup-subscribe.ts의 subscribeEmail을 그대로 쓴다.
// 로컬도 운영 Shopify 스토어에 실제 고객을 만든다(테스트는 사내 이메일로만). 반복 제출 제한은 메모리로.

const hits = new Map<string, number[]>();

function readBody(req: Connect.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

function send(res: { writeHead: (s: number, h: Record<string, string>) => void; end: (b: string) => void }, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

export function popupSubscribeProxyMiddleware(): Connect.NextHandleFunction {
  return async (req, res, next) => {
    if (req.url !== '/api/popup-subscribe' || req.method !== 'POST') return next();

    if (process.env.SITE_MODE !== 'b2c') return send(res, 404, { error: 'Not found' });

    let body: { email?: unknown; website?: unknown };
    try {
      body = JSON.parse((await readBody(req)) || '{}');
    } catch {
      return send(res, 400, { error: 'Invalid email' });
    }
    try {
      if (typeof body.website === 'string' && body.website.trim()) return send(res, 200, { ok: true });

      const email = typeof body.email === 'string' ? body.email.trim() : '';
      if (!EMAIL_RE.test(email) || email.length > 254) return send(res, 400, { error: 'Invalid email' });

      const ip = req.socket.remoteAddress || 'local';
      const now = Date.now();
      const recent = (hits.get(ip) || []).filter((t) => now - t < 60_000);
      recent.push(now);
      hits.set(ip, recent);
      if (recent.length > 5) return send(res, 429, { error: 'Too many requests' });

      const result = await subscribeEmail(email);
      return send(res, 200, { ok: true, result });
    } catch (error) {
      console.error('[Popup Subscribe proxy] Error:', error);
      return send(res, 500, { error: 'Subscribe failed' });
    }
  };
}
