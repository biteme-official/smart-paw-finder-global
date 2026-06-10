import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createSign } from 'crypto';

const GA4_PROPERTY_ID = process.env.GA4_PROPERTY_ID || '';
const GOOGLE_SERVICE_ACCOUNT_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '';
const _VERCEL_ENV = process.env.VERCEL_ENV || 'development';
const ADMIN_SECRET = process.env.ADMIN_SECRET || (_VERCEL_ENV !== 'production' ? '990113' : '');

const ALLOWED_ORIGINS = [
  'https://biteme.one',
  'https://www.biteme.one',
  'http://localhost:5173',
];

// ─── GA4 Auth ───

let ga4Token: string | null = null;
let ga4TokenExpiresAt = 0;

async function getGA4AccessToken(): Promise<string> {
  const now = Date.now();
  if (ga4Token && now < ga4TokenExpiresAt - 60_000) return ga4Token;

  const sa = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);
  const iat = Math.floor(now / 1000);
  const exp = iat + 3600;

  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat,
    exp,
  })).toString('base64url');

  const input = `${header}.${payload}`;
  const sign = createSign('RSA-SHA256');
  sign.update(input);
  const jwt = `${input}.${sign.sign(sa.private_key, 'base64url')}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!res.ok) throw new Error(`Token error: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  ga4Token = data.access_token;
  ga4TokenExpiresAt = now + data.expires_in * 1000;
  return ga4Token!;
}

async function runReport(token: string, body: object) {
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY_ID}:runReport`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) throw new Error(`GA4 error (${res.status}): ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

interface GA4Report {
  dimensionHeaders: { name: string }[];
  metricHeaders: { name: string }[];
  rows?: { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] }[];
}

function parseRows(report: GA4Report): Record<string, string | number>[] {
  return (report.rows || []).map((row) => {
    const out: Record<string, string | number> = {};
    row.dimensionValues?.forEach((v, i) => { out[report.dimensionHeaders[i].name] = v.value; });
    row.metricValues?.forEach((v, i) => { out[report.metricHeaders[i].name] = parseFloat(v.value) || 0; });
    return out;
  });
}

// ─── Shopify Admin Auth (shared by shopify + customer handlers) ───

let shopifyToken: string | null = null;
let shopifyTokenExpiresAt = 0;

async function getShopifyAccessToken(): Promise<string> {
  const now = Date.now();
  if (shopifyToken && now < shopifyTokenExpiresAt - 5 * 60 * 1000) return shopifyToken;

  const shop = process.env.VITE_SHOPIFY_STORE_DOMAIN || '';
  const clientId = process.env.REPORT_SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.REPORT_SHOPIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    shopifyToken = 'unconfigured';
    shopifyTokenExpiresAt = Date.now() + 86400_000;
    return 'unconfigured';
  }

  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }),
  });
  if (!res.ok) throw new Error(`Token error (${res.status}): ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  shopifyToken = data.access_token;
  shopifyTokenExpiresAt = now + (data.expires_in || 3600) * 1000;
  return shopifyToken!;
}

async function adminGraphQL(token: string, query: string, variables: Record<string, unknown> = {}) {
  const shop = process.env.VITE_SHOPIFY_STORE_DOMAIN || '';
  const res = await fetch(`https://${shop}/admin/api/2025-07/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Admin API error (${res.status}): ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

function toUTCDate(isoString: string): string {
  return new Date(isoString).toISOString().slice(0, 10);
}

function getRangeStart(range: string): string {
  const now = new Date();
  const days: Record<string, number> = { today: 0, '7d': 6, '28d': 27, '90d': 89 };
  const offset = days[range] ?? 6;
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - offset));
  return start.toISOString();
}

function parseDateRange(req: VercelRequest) {
  const range = (req.query.range as string) || '7d';
  const fromParam = req.query.from as string | undefined;
  const toParam = req.query.to as string | undefined;
  const isCustom = range === 'custom' && !!fromParam && !!toParam;
  return { range, fromParam, toParam, isCustom };
}

// ─── GA4 Handler ───

async function handleGA4(req: VercelRequest, res: VercelResponse) {
  const { range, fromParam, toParam, isCustom } = parseDateRange(req);

  let dateRange: { startDate: string; endDate: string };
  if (isCustom) {
    dateRange = { startDate: fromParam!, endDate: toParam! };
  } else {
    const rangeMap: Record<string, string> = { today: 'today', '7d': '7daysAgo', '28d': '28daysAgo', '90d': '90daysAgo' };
    const startDate = rangeMap[range];
    if (!startDate) return res.status(400).json({ error: 'Invalid range' });
    dateRange = { startDate, endDate: 'today' };
  }

  if (!GA4_PROPERTY_ID || !GOOGLE_SERVICE_ACCOUNT_JSON) {
    return res.status(200).json({ overview: {}, funnel: [], revenueOverTime: [], topPages: [], trafficSources: [], trafficSourcesOverTime: [], notSetLandingPages: [], devices: [], itemViews: [], exitPages: [], newVsReturning: [] });
  }

  const token = await getGA4AccessToken();

  const [overviewRaw, funnelRaw, revenueRaw, pagesRaw, sourcesRaw, devicesRaw, itemViewsRaw, exitPagesRaw, sourcesByDateRaw, notSetLandingRaw, newVsReturningRaw] = await Promise.all([
    runReport(token, {
      dateRanges: [dateRange],
      metrics: [
        { name: 'sessions' }, { name: 'activeUsers' }, { name: 'newUsers' },
        { name: 'bounceRate' }, { name: 'averageSessionDuration' },
        { name: 'purchaseRevenue' }, { name: 'transactions' },
      ],
    }),
    runReport(token, {
      dateRanges: [dateRange],
      dimensions: [{ name: 'eventName' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: {
        filter: { fieldName: 'eventName', inListFilter: { values: ['view_item', 'add_to_cart', 'begin_checkout', 'purchase'] } },
      },
    }),
    runReport(token, {
      dateRanges: [dateRange],
      dimensions: [{ name: 'date' }],
      metrics: [{ name: 'purchaseRevenue' }, { name: 'transactions' }, { name: 'sessions' }, { name: 'activeUsers' }, { name: 'itemsViewed' }],
      orderBys: [{ dimension: { dimensionName: 'date' } }],
    }),
    runReport(token, {
      dateRanges: [dateRange],
      dimensions: [{ name: 'pagePath' }],
      metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }, { name: 'averageSessionDuration' }],
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit: 10,
    }),
    runReport(token, {
      dateRanges: [dateRange],
      dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }],
      metrics: [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'transactions' }, { name: 'purchaseRevenue' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 15,
    }),
    runReport(token, {
      dateRanges: [dateRange],
      dimensions: [{ name: 'deviceCategory' }],
      metrics: [{ name: 'sessions' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    }),
    runReport(token, {
      dateRanges: [dateRange],
      dimensions: [{ name: 'itemName' }],
      metrics: [{ name: 'itemsViewed' }, { name: 'itemsAddedToCart' }],
      orderBys: [{ metric: { metricName: 'itemsViewed' }, desc: true }],
      limit: 50,
    }),
    runReport(token, {
      dateRanges: [dateRange],
      dimensions: [{ name: 'pagePath' }],
      metrics: [{ name: 'sessions' }, { name: 'bounceRate' }, { name: 'screenPageViews' }, { name: 'averageSessionDuration' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 20,
    }),
    runReport(token, {
      dateRanges: [dateRange],
      dimensions: [{ name: 'date' }, { name: 'sessionSource' }, { name: 'sessionMedium' }],
      metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
      orderBys: [{ dimension: { dimensionName: 'date' } }],
      limit: 2000,
    }),
    runReport(token, {
      dateRanges: [dateRange],
      dimensions: [{ name: 'date' }, { name: 'landingPage' }],
      metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
      dimensionFilter: {
        andGroup: {
          expressions: [
            { filter: { fieldName: 'sessionSource', stringFilter: { matchType: 'EXACT', value: '(not set)' } } },
            { filter: { fieldName: 'sessionMedium', stringFilter: { matchType: 'EXACT', value: '(not set)' } } },
          ],
        },
      },
      orderBys: [{ dimension: { dimensionName: 'date' } }],
      limit: 500,
    }),
    runReport(token, {
      dateRanges: [dateRange],
      dimensions: [{ name: 'newVsReturning' }],
      metrics: [{ name: 'activeUsers' }, { name: 'sessions' }],
    }),
  ]);

  return res.status(200).json({
    overview: parseRows(overviewRaw)[0] || {},
    funnel: parseRows(funnelRaw),
    revenueOverTime: parseRows(revenueRaw),
    topPages: parseRows(pagesRaw),
    trafficSources: parseRows(sourcesRaw),
    devices: parseRows(devicesRaw),
    itemViews: parseRows(itemViewsRaw),
    exitPages: parseRows(exitPagesRaw),
    trafficSourcesOverTime: parseRows(sourcesByDateRaw),
    notSetLandingPages: parseRows(notSetLandingRaw),
    newVsReturning: parseRows(newVsReturningRaw),
  });
}

// ─── Shopify Orders Handler ───

const ORDERS_QUERY = `
  query Orders($query: String!, $cursor: String) {
    orders(first: 250, query: $query, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          createdAt
          totalPriceSet { shopMoney { amount currencyCode } }
          lineItems(first: 50) {
            edges {
              node {
                title
                quantity
                product { id }
                originalTotalSet { shopMoney { amount } }
              }
            }
          }
        }
      }
    }
  }
`;

const LOW_STOCK_QUERY = `
  query LowStock {
    productVariants(first: 100, query: "inventory_quantity:<5 AND inventory_quantity:>=0") {
      edges {
        node {
          title
          inventoryQuantity
          product { title }
        }
      }
    }
  }
`;

interface OrderEdge {
  node: {
    id: string;
    createdAt: string;
    totalPriceSet: { shopMoney: { amount: string; currencyCode?: string } };
    lineItems: {
      edges: { node: { title: string; quantity: number; product: { id: string } | null; originalTotalSet: { shopMoney: { amount: string } } } }[];
    };
  };
}

async function fetchAllOrders(token: string, rangeStart: string): Promise<OrderEdge[]> {
  const filterQuery = `created_at:>='${rangeStart}' AND financial_status:paid`;
  const all: OrderEdge[] = [];
  let cursor: string | null = null;

  do {
    const data = await adminGraphQL(token, ORDERS_QUERY, { query: filterQuery, cursor });
    const edges: OrderEdge[] = data.data?.orders?.edges || [];
    all.push(...edges);
    cursor = data.data?.orders?.pageInfo?.hasNextPage
      ? data.data?.orders?.pageInfo?.endCursor
      : null;
  } while (cursor && all.length < 1000);

  return all;
}

const EMPTY_SHOPIFY = { summary: { totalOrders: 0, totalRevenue: 0, averageOrderValue: 0, totalItemsSold: 0, currency: 'USD' }, dailyOrders: [], topProducts: [], lowStock: [] };

async function handleShopify(req: VercelRequest, res: VercelResponse) {
  const { range, fromParam, toParam, isCustom } = parseDateRange(req);

  if (!isCustom && !['today', '7d', '28d', '90d'].includes(range)) {
    return res.status(400).json({ error: 'Invalid range' });
  }

  const token = await getShopifyAccessToken();
  if (token === 'unconfigured') return res.status(200).json(EMPTY_SHOPIFY);
  const rangeStart = isCustom ? new Date(`${fromParam}T00:00:00Z`).toISOString() : getRangeStart(range);

  const [orders, lowStockData] = await Promise.all([
    fetchAllOrders(token, rangeStart),
    adminGraphQL(token, LOW_STOCK_QUERY),
  ]);

  const dailyMap = new Map<string, { orders: number; revenue: number }>();
  const productMap = new Map<string, { title: string; quantity: number; revenue: number }>();
  let totalRevenue = 0;
  let totalItems = 0;

  for (const edge of orders) {
    const date = toUTCDate(edge.node.createdAt);
    const rev = parseFloat(edge.node.totalPriceSet.shopMoney.amount);
    totalRevenue += rev;

    const day = dailyMap.get(date) || { orders: 0, revenue: 0 };
    day.orders += 1;
    day.revenue += rev;
    dailyMap.set(date, day);

    for (const item of edge.node.lineItems.edges) {
      const productId = item.node.product?.id ?? `title:${item.node.title}`;
      const qty = item.node.quantity;
      const itemRev = parseFloat(item.node.originalTotalSet.shopMoney.amount);
      totalItems += qty;
      const existing = productMap.get(productId) || { title: item.node.title, quantity: 0, revenue: 0 };
      existing.quantity += qty;
      existing.revenue += itemRev;
      productMap.set(productId, existing);
    }
  }

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const dailyOrders: { date: string; orders: number; revenue: number }[] = [];

  if (isCustom) {
    const cur = new Date(fromParam!);
    const end = new Date(toParam! <= todayStr ? toParam! : todayStr);
    while (cur <= end) {
      const dateStr = cur.toISOString().slice(0, 10);
      const entry = dailyMap.get(dateStr) || { orders: 0, revenue: 0 };
      dailyOrders.push({ date: dateStr, orders: entry.orders, revenue: Math.round(entry.revenue * 100) / 100 });
      cur.setDate(cur.getDate() + 1);
    }
  } else {
    const days: Record<string, number> = { today: 0, '7d': 6, '28d': 27, '90d': 89 };
    const offset = days[range] ?? 6;
    for (let i = offset; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
      const dateStr = d.toISOString().slice(0, 10);
      const entry = dailyMap.get(dateStr) || { orders: 0, revenue: 0 };
      dailyOrders.push({ date: dateStr, orders: entry.orders, revenue: Math.round(entry.revenue * 100) / 100 });
    }
  }

  const topProducts = Array.from(productMap.entries())
    .map(([productId, d]) => ({ productId, title: d.title, quantity: d.quantity, revenue: Math.round(d.revenue * 100) / 100 }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  const lowStock = (lowStockData.data?.productVariants?.edges || [])
    .map((e: { node: { product: { title: string }; title: string; inventoryQuantity: number } }) => ({
      title: e.node.product.title,
      variant: e.node.title === 'Default Title' ? '' : e.node.title,
      quantity: e.node.inventoryQuantity,
    }))
    .sort((a: { quantity: number }, b: { quantity: number }) => a.quantity - b.quantity);

  const currency = orders[0]?.node?.totalPriceSet?.shopMoney?.currencyCode || 'USD';

  return res.status(200).json({
    summary: {
      totalOrders: orders.length,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      averageOrderValue: orders.length > 0 ? Math.round((totalRevenue / orders.length) * 100) / 100 : 0,
      totalItemsSold: totalItems,
      currency,
    },
    dailyOrders,
    topProducts,
    lowStock,
  });
}

// ─── Customer Handler ───

const SEGMENT_COUNTS_QUERY = `
  query CustomerSegments {
    total: customersCount { count }
    noOrders: customersCount(query: "orders_count:=0") { count }
    oneOrder: customersCount(query: "orders_count:=1") { count }
    fourPlusOrders: customersCount(query: "orders_count:>=4") { count }
  }
`;

const NEW_CUSTOMERS_QUERY = `
  query NewCustomers($query: String!, $cursor: String) {
    customers(first: 250, query: $query, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          createdAt
          numberOfOrders
          amountSpent { amount currencyCode }
        }
      }
    }
  }
`;

interface CustomerEdge {
  node: {
    id: string;
    createdAt: string;
    numberOfOrders: number;
    amountSpent: { amount: string; currencyCode?: string };
  };
}

async function fetchNewCustomers(token: string, rangeStart: string): Promise<CustomerEdge[]> {
  const filterQuery = `created_at:>='${rangeStart}'`;
  const all: CustomerEdge[] = [];
  let cursor: string | null = null;

  do {
    const data = await adminGraphQL(token, NEW_CUSTOMERS_QUERY, { query: filterQuery, cursor });
    const edges: CustomerEdge[] = data.data?.customers?.edges || [];
    all.push(...edges);
    cursor = data.data?.customers?.pageInfo?.hasNextPage
      ? data.data?.customers?.pageInfo?.endCursor
      : null;
  } while (cursor && all.length < 2000);

  return all;
}

async function handleCustomer(req: VercelRequest, res: VercelResponse) {
  const { range, fromParam, toParam, isCustom } = parseDateRange(req);

  if (!isCustom && !['today', '7d', '28d', '90d'].includes(range)) {
    return res.status(400).json({ error: 'Invalid range' });
  }

  const token = await getShopifyAccessToken();
  if (token === 'unconfigured') return res.status(200).json(EMPTY_SHOPIFY);
  const rangeStart = isCustom ? new Date(`${fromParam}T00:00:00Z`).toISOString() : getRangeStart(range);

  const [segmentData, newCustomers] = await Promise.all([
    adminGraphQL(token, SEGMENT_COUNTS_QUERY),
    fetchNewCustomers(token, rangeStart),
  ]);

  const total = segmentData.data?.total?.count ?? 0;
  const noOrders = segmentData.data?.noOrders?.count ?? 0;
  const oneOrder = segmentData.data?.oneOrder?.count ?? 0;
  const fourPlusOrders = segmentData.data?.fourPlusOrders?.count ?? 0;
  const twoThreeOrders = Math.max(0, total - noOrders - oneOrder - fourPlusOrders);
  const purchasedCustomers = oneOrder + twoThreeOrders + fourPlusOrders;
  const repeatCustomers = twoThreeOrders + fourPlusOrders;

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const dailyMap = new Map<string, number>();
  for (const edge of newCustomers) {
    const date = toUTCDate(edge.node.createdAt);
    dailyMap.set(date, (dailyMap.get(date) || 0) + 1);
  }

  const dailyNewCustomers: { date: string; count: number }[] = [];
  if (isCustom) {
    const cur = new Date(fromParam!);
    const end = new Date(toParam! <= todayStr ? toParam! : todayStr);
    while (cur <= end) {
      const dateStr = cur.toISOString().slice(0, 10);
      dailyNewCustomers.push({ date: dateStr, count: dailyMap.get(dateStr) || 0 });
      cur.setDate(cur.getDate() + 1);
    }
  } else {
    const days: Record<string, number> = { today: 0, '7d': 6, '28d': 27, '90d': 89 };
    const offset = days[range] ?? 6;
    for (let i = offset; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
      const dateStr = d.toISOString().slice(0, 10);
      dailyNewCustomers.push({ date: dateStr, count: dailyMap.get(dateStr) || 0 });
    }
  }

  const purchasedNew = newCustomers.filter(e => e.node.numberOfOrders > 0);
  const avgNewLTV = purchasedNew.length > 0
    ? Math.round(purchasedNew.reduce((s, e) => s + parseFloat(e.node.amountSpent.amount), 0) * 100 / purchasedNew.length) / 100
    : 0;

  const currency = newCustomers[0]?.node?.amountSpent?.currencyCode || 'USD';

  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
  return res.status(200).json({
    totalCustomers: total,
    newCustomersCount: newCustomers.length,
    repeatCustomers,
    repeatRate: purchasedCustomers > 0 ? repeatCustomers / purchasedCustomers : 0,
    segments: { noOrders, oneOrder, twoThreeOrders, fourPlusOrders },
    avgNewLTV,
    dailyNewCustomers,
    currency,
  });
}

// ─── Router ───

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin || '';
  const corsOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!ADMIN_SECRET || req.headers.authorization !== `Bearer ${ADMIN_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const type = req.query.type as string | undefined;

  try {
    if (type === 'shopify') return await handleShopify(req, res);
    if (type === 'customer') return await handleCustomer(req, res);
    return await handleGA4(req, res);
  } catch (error) {
    console.error(`[Analytics:${type || 'ga4'}]`, error);
    return res.status(500).json({
      error: 'Failed to fetch analytics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
