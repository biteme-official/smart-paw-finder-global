import type { Connect } from 'vite';

const PRODUCTION_URL = 'https://www.biteme.one/api/instagram-reels';

export function instagramProxyMiddleware(): Connect.NextHandleFunction {
  return async (req, res, next) => {
    if (req.url !== '/api/instagram-reels') return next();

    try {
      const response = await fetch(PRODUCTION_URL);
      const data = await response.text();
      res.writeHead(response.status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(data);
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to proxy Instagram reels' }));
    }
  };
}
