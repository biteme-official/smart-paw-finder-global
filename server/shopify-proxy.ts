import type { Connect } from 'vite';

let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  // Refresh token 5 minutes before expiry
  if (cachedToken && now < tokenExpiresAt - 5 * 60 * 1000) {
    return cachedToken;
  }

  const shop = process.env.VITE_SHOPIFY_STORE_DOMAIN || 'lovable-project-lbgum.myshopify.com';
  const clientId = process.env.VITE_SHOPIFY_CLIENT_ID || '';
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET || '';

  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to get access token: ${response.status} ${text}`);
  }

  const data = await response.json();
  cachedToken = data.access_token;
  tokenExpiresAt = now + data.expires_in * 1000;

  console.log('[Shopify Proxy] Access token refreshed, expires in', data.expires_in, 'seconds');
  return cachedToken!;
}

export function shopifyProxyMiddleware(): Connect.NextHandleFunction {
  return async (req, res, next) => {
    if (req.method !== 'POST') return next();

    if (req.url === '/api/shopify' || req.url === '/api/shopify?api=admin') {
      const useAdmin = req.url?.includes('api=admin') ?? false;
      return handleStorefrontProxy(req, res, useAdmin);
    }
    if (req.url === '/api/cancel-order') {
      return handleCancelOrder(req, res);
    }

    return next();
  };
}

async function readBody(req: Connect.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

async function handleStorefrontProxy(req: Connect.IncomingMessage, res: any, useAdmin = false) {
  try {
    const body = await readBody(req);
    const token = await getAccessToken();
    const shop = process.env.VITE_SHOPIFY_STORE_DOMAIN || 'lovable-project-lbgum.myshopify.com';
    const endpoint = useAdmin
      ? `https://${shop}/admin/api/2025-07/graphql.json`
      : `https://${shop}/api/2025-07/graphql.json`;

    const shopifyResponse = await fetch(
      endpoint,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [useAdmin ? 'X-Shopify-Access-Token' : 'Shopify-Storefront-Private-Token']: token,
        },
        body,
      }
    );

    const responseData = await shopifyResponse.text();
    res.writeHead(shopifyResponse.status, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(responseData);
  } catch (error) {
    console.error('[Shopify Proxy] Error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Proxy error', message: (error as Error).message }));
  }
}

const VERIFY_CUSTOMER_ORDER_QUERY = `
  query VerifyCustomerOrder {
    customer {
      orders(first: 50, sortKey: PROCESSED_AT, reverse: true) {
        edges {
          node { id financialStatus fulfillmentStatus }
        }
      }
    }
  }
`;

const ORDER_CANCEL_MUTATION = `
  mutation orderCancel($orderId: ID!, $reason: OrderCancelReason!, $refund: Boolean!, $restock: Boolean!, $staffNote: String) {
    orderCancel(orderId: $orderId, reason: $reason, refund: $refund, restock: $restock, staffNote: $staffNote) {
      job { id done }
      orderCancelUserErrors { field message code }
    }
  }
`;

async function handleCancelOrder(req: Connect.IncomingMessage, res: any) {
  try {
    const body = JSON.parse(await readBody(req));
    const { orderId, customerAccountToken } = body;

    if (!orderId || !customerAccountToken) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: 'Missing orderId or customerAccountToken' }));
    }

    const shopId = process.env.VITE_SHOPIFY_SHOP_ID || '';
    const shop = process.env.VITE_SHOPIFY_STORE_DOMAIN || 'lovable-project-lbgum.myshopify.com';

    // Step 1: Verify order ownership via Customer Account API
    const verifyRes = await fetch(`https://shopify.com/${shopId}/account/customer/api/2025-07/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': customerAccountToken,
      },
      body: JSON.stringify({ query: VERIFY_CUSTOMER_ORDER_QUERY }),
    });

    if (!verifyRes.ok) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: 'Invalid or expired login. Please sign in again.' }));
    }

    const verifyData = await verifyRes.json();
    const orders = verifyData.data?.customer?.orders?.edges || [];
    const targetIdClean = orderId.split('?')[0];
    const match = orders.find((e: any) => e.node.id.split('?')[0] === targetIdClean);

    if (!match) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: 'Order not found for this account' }));
    }

    const cancellable =
      match.node.financialStatus === 'PAID' &&
      (!match.node.fulfillmentStatus || match.node.fulfillmentStatus === 'UNFULFILLED');

    if (!cancellable) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: 'This order cannot be cancelled. Only paid, unfulfilled orders are eligible.' }));
    }

    // Step 2: Cancel via Admin API
    const adminToken = await getAccessToken();
    const cancelRes = await fetch(`https://${shop}/admin/api/2025-07/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': adminToken,
      },
      body: JSON.stringify({
        query: ORDER_CANCEL_MUTATION,
        variables: {
          orderId: targetIdClean,
          reason: 'CUSTOMER',
          refund: true,
          restock: true,
          staffNote: 'Cancelled by customer via My Page',
        },
      }),
    });

    const cancelData = await cancelRes.json();
    const errors = cancelData.data?.orderCancel?.orderCancelUserErrors || [];

    if (errors.length > 0) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: errors.map((e: any) => e.message).join(', ') }));
    }

    if (cancelData.errors) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: cancelData.errors.map((e: any) => e.message).join(', ') }));
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
  } catch (error) {
    console.error('[Cancel Order] Error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Failed to cancel order. Please try again.' }));
  }
}
