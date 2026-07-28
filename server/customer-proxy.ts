import type { Connect } from 'vite';

function readBody(req: Connect.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

export function customerProxyMiddleware(): Connect.NextHandleFunction {
  return async (req, res, next) => {
    if (req.method === 'OPTIONS' && (req.url === '/api/customer-token' || req.url === '/api/customer-account')) {
      res.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      });
      return res.end();
    }

    if (req.method !== 'POST') return next();

    if (req.url === '/api/customer-token') return handleToken(req, res);
    if (req.url === '/api/customer-account') return handleAccount(req, res);

    return next();
  };
}

async function handleToken(req: Connect.IncomingMessage, res: any) {
  const shopId = process.env.VITE_SHOPIFY_SHOP_ID || '';
  const clientId = process.env.VITE_SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID || '';
  const tokenEndpoint = `https://shopify.com/authentication/${shopId}/oauth/token`;

  try {
    const body = JSON.parse(await readBody(req));
    const params = new URLSearchParams({ client_id: clientId, grant_type: body.grant_type });

    if (body.grant_type === 'authorization_code') {
      params.set('code', body.code);
      params.set('redirect_uri', body.redirect_uri);
      params.set('code_verifier', body.code_verifier);
    } else if (body.grant_type === 'refresh_token') {
      params.set('refresh_token', body.refresh_token);
    }

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });

    const data = await response.text();
    res.writeHead(response.status, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(data);
  } catch (error) {
    console.error('[Customer Token Proxy] Error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Token exchange failed' }));
  }
}

async function handleAccount(req: Connect.IncomingMessage, res: any) {
  const shopId = process.env.VITE_SHOPIFY_SHOP_ID || '';
  const apiEndpoint = `https://shopify.com/${shopId}/account/customer/api/2025-07/graphql`;
  const authHeader = req.headers.authorization || '';

  try {
    const body = await readBody(req);
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body,
    });

    const data = await response.text();
    res.writeHead(response.status, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(data);
  } catch (error) {
    console.error('[Customer Account Proxy] Error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Customer Account API request failed' }));
  }
}
