import type { Connect } from 'vite';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import handler from '../api/restock';

// 로컬 개발용 /api/restock — api/restock.ts의 handler를 그대로 부른다.
// .env.local의 KV·Shopify 값을 쓰므로 로컬 신청도 운영 KV에 저장된다(테스트는 사내 이메일로만, 끝나면 지울 것).

function readBody(req: Connect.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

export function restockProxyMiddleware(): Connect.NextHandleFunction {
  return async (req, res, next) => {
    const url = new URL(req.url || '', 'http://localhost');
    if (url.pathname !== '/api/restock') return next();

    let body: unknown = {};
    if (req.method === 'POST') {
      try {
        body = JSON.parse((await readBody(req)) || '{}');
      } catch {
        body = {};
      }
    }
    const vreq = Object.assign(req, { query: Object.fromEntries(url.searchParams), body }) as unknown as VercelRequest;
    let statusCode = 200;
    const vres = {
      status(code: number) {
        statusCode = code;
        return vres;
      },
      json(payload: unknown) {
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(payload));
        return vres;
      },
    } as unknown as VercelResponse;
    await handler(vreq, vres);
  };
}
