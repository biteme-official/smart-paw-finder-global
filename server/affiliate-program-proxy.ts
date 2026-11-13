import type { Connect } from 'vite';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import handler from '../api/affiliate-program';

// 로컬 개발용 /api/affiliate-program — api/affiliate-program.ts 핸들러를 그대로 호출한다.
// 로컬도 운영 KV·Shopify를 쓴다(테스트는 사내 계정으로만). B2C 화면은 `SITE_MODE=b2c npm run dev`.

function readBody(req: Connect.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

export function affiliateProgramProxyMiddleware(): Connect.NextHandleFunction {
  return async (req, res, next) => {
    if (!req.url?.startsWith('/api/affiliate-program')) return next();

    const url = new URL(req.url, 'http://localhost');
    let body: unknown = undefined;
    if (req.method === 'POST') {
      try {
        body = JSON.parse((await readBody(req)) || '{}');
      } catch {
        body = {};
      }
    }

    const vreq = {
      method: req.method,
      url: req.url,
      headers: req.headers,
      query: Object.fromEntries(url.searchParams.entries()),
      body,
    } as unknown as VercelRequest;

    let statusCode = 200;
    const vres = {
      status(code: number) {
        statusCode = code;
        return vres;
      },
      json(data: unknown) {
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
        return vres;
      },
    } as unknown as VercelResponse;

    try {
      await handler(vreq, vres);
    } catch (error) {
      console.error('[Affiliate Program proxy] Error:', error);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Server error' }));
      }
    }
  };
}
