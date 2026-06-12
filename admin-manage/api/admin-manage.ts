import { createSign } from 'crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const ADMIN_SECRET = process.env.ADMIN_SECRET || '';

// ─── Google Analytics Auth ───

let gaAccessToken: string | null = null;
let gaAccessTokenExpiresAt = 0;

async function getGAAccessToken(): Promise<string | null> {
  const saJson = process.env.GA_SERVICE_ACCOUNT_JSON;
  if (!saJson) return null;
  const now = Date.now();
  if (gaAccessToken && now < gaAccessTokenExpiresAt - 300_000) return gaAccessToken;
  try {
    const sa = JSON.parse(saJson) as { client_email: string; private_key: string };
    const iat = Math.floor(now / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/analytics.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      iat,
      exp: iat + 3600,
    })).toString('base64url');
    const sign = createSign('RSA-SHA256');
    sign.update(`${header}.${payload}`);
    const sig = sign.sign(sa.private_key, 'base64url');
    const jwt = `${header}.${payload}.${sig}`;
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
    });
    if (!res.ok) throw new Error(`GA OAuth ${res.status}: ${await res.text()}`);
    const data = await res.json() as { access_token: string; expires_in: number };
    gaAccessToken = data.access_token;
    gaAccessTokenExpiresAt = now + data.expires_in * 1000;
    return gaAccessToken;
  } catch (err) {
    console.error('[GA Auth]', err);
    return null;
  }
}

async function gaReport(token: string, body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  const pid = process.env.GA4_PROPERTY_ID;
  if (!pid) return null;
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${pid}:runReport`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) { console.error('[GA Report]', res.status, await res.text()); return null; }
  return res.json() as Promise<Record<string, unknown>>;
}

type GaRow = Record<string, string>;
function gaRows(report: Record<string, unknown> | null): GaRow[] {
  if (!report) return [];
  const rows = (report.rows || []) as Array<{ dimensionValues?: Array<{ value: string }>; metricValues?: Array<{ value: string }> }>;
  const dimHdrs = ((report.dimensionHeaders || []) as Array<{ name: string }>).map(h => h.name);
  const metHdrs = ((report.metricHeaders || []) as Array<{ name: string }>).map(h => h.name);
  return rows.map(row => {
    const obj: GaRow = {};
    (row.dimensionValues || []).forEach((v, i) => { obj[dimHdrs[i]] = v.value; });
    (row.metricValues || []).forEach((v, i) => { obj[metHdrs[i]] = v.value; });
    return obj;
  });
}

function gaDateRange(range: string): { startDate: string; endDate: string } {
  if (range === 'today') return { startDate: 'today', endDate: 'today' };
  if (range === '7d') return { startDate: '7daysAgo', endDate: 'yesterday' };
  if (range === '28d') return { startDate: '28daysAgo', endDate: 'yesterday' };
  if (range === '90d') return { startDate: '90daysAgo', endDate: 'yesterday' };
  if (range.startsWith('custom:')) {
    const parts = range.split(':');
    if (parts.length === 3) return { startDate: parts[1], endDate: parts[2] };
  }
  return { startDate: '7daysAgo', endDate: 'yesterday' };
}

const ALLOWED_ORIGINS = [
  'https://biteme.one',
  'https://www.biteme.one',
  'http://localhost:5173',
  'http://localhost:3000',
];

let shopifyToken: string | null = null;
let shopifyTokenExpiresAt = 0;

async function getShopifyAccessToken(): Promise<string> {
  const now = Date.now();
  if (shopifyToken && now < shopifyTokenExpiresAt - 5 * 60 * 1000) return shopifyToken;

  const shop = process.env.VITE_SHOPIFY_STORE_DOMAIN || '';
  const clientId = process.env.REPORT_SHOPIFY_CLIENT_ID || process.env.VITE_SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.REPORT_SHOPIFY_CLIENT_SECRET || process.env.SHOPIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Missing Shopify credentials');

  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }),
  });
  if (!res.ok) throw new Error(`Token error (${res.status})`);
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

// ─── Queries ───

const RECENT_ORDERS_QUERY = `
  query RecentOrders($first: Int!, $query: String!, $cursor: String) {
    orders(first: $first, query: $query, after: $cursor, sortKey: CREATED_AT, reverse: true) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          name
          createdAt
          displayFinancialStatus
          displayFulfillmentStatus
          cancelledAt
          totalPriceSet { shopMoney { amount currencyCode } }
          subtotalPriceSet { shopMoney { amount } }
          totalShippingPriceSet { shopMoney { amount } }
          totalTaxSet { shopMoney { amount } }
          totalRefundedSet { shopMoney { amount } }
          customer { id displayName email }
          shippingAddress { country city }
          lineItems(first: 10) {
            edges {
              node {
                title
                quantity
                variant { title }
                originalTotalSet { shopMoney { amount } }
              }
            }
          }
        }
      }
    }
  }
`;

const ORDER_COUNTS_QUERY = `
  query OrderCounts {
    all: ordersCount { count }
    pending: ordersCount(query: "fulfillment_status:unfulfilled financial_status:paid") { count }
    todayAll: ordersCount(query: "created_at:>=today") { count }
  }
`;

const PRODUCTS_QUERY = `
  query Products($first: Int!, $cursor: String, $query: String) {
    products(first: $first, after: $cursor, query: $query, sortKey: TITLE) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          title
          status
          totalInventory
          tracksInventory
          priceRangeV2 { maxVariantPrice { amount currencyCode } minVariantPrice { amount currencyCode } }
          variants(first: 20) {
            edges {
              node {
                id
                title
                price
                inventoryQuantity
                sku
              }
            }
          }
          totalVariants
          featuredMedia { preview { image { url } } }
        }
      }
    }
  }
`;

const CUSTOMER_SUMMARY_QUERY = `
  query CustomerSummary {
    total: customersCount { count }
    noOrders: customersCount(query: "orders_count:=0") { count }
    oneOrder: customersCount(query: "orders_count:=1") { count }
    fourPlus: customersCount(query: "orders_count:>=4") { count }
  }
`;

const TOP_CUSTOMERS_QUERY = `
  query TopCustomers {
    customers(first: 20, sortKey: TOTAL_SPENT, reverse: true, query: "orders_count:>0") {
      edges {
        node {
          id
          displayName
          email
          numberOfOrders
          amountSpent { amount currencyCode }
          createdAt
          tags
          defaultAddress { country city }
        }
      }
    }
  }
`;

const RECENT_CUSTOMERS_QUERY = `
  query RecentCustomers($query: String!) {
    customers(first: 20, sortKey: CREATED_AT, reverse: true, query: $query) {
      edges {
        node {
          id
          displayName
          email
          numberOfOrders
          amountSpent { amount currencyCode }
          createdAt
          defaultAddress { country city }
        }
      }
    }
  }
`;

const DASHBOARD_ORDERS_QUERY = `
  query DashboardOrders($query: String!) {
    orders(first: 250, query: $query, sortKey: CREATED_AT) {
      edges {
        node {
          createdAt
          totalPriceSet { shopMoney { amount currencyCode } }
          customer { tags }
          shippingAddress { countryCodeV2 }
          lineItems(first: 5) {
            edges {
              node {
                title
                quantity
                originalTotalSet { shopMoney { amount } }
              }
            }
          }
        }
      }
    }
  }
`;

const LOW_STOCK_PRODUCTS_QUERY = `
  query LowStockProducts {
    products(first: 30, query: "status:active inventory_total:<5", sortKey: INVENTORY_TOTAL) {
      edges {
        node {
          title
          totalInventory
          variants(first: 10) {
            edges {
              node {
                title
                inventoryQuantity
              }
            }
          }
        }
      }
    }
  }
`;

// ─── Handlers ───

async function handleOverview(token: string, res: VercelResponse) {
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  const yesterdayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1)).toISOString();
  const weekStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 7)).toISOString();

  const ordersQuery = `
    query DailyOrders($todayQuery: String!, $yesterdayQuery: String!, $weekQuery: String!) {
      today: orders(first: 250, query: $todayQuery) {
        edges { node { totalPriceSet { shopMoney { amount currencyCode } } } }
      }
      yesterday: orders(first: 250, query: $yesterdayQuery) {
        edges { node { totalPriceSet { shopMoney { amount } } } }
      }
      week: orders(first: 250, query: $weekQuery) {
        edges { node { totalPriceSet { shopMoney { amount } } createdAt } }
      }
    }
  `;

  const [ordersData, countsData] = await Promise.all([
    adminGraphQL(token, ordersQuery, {
      todayQuery: `created_at:>='${todayStart}' financial_status:paid`,
      yesterdayQuery: `created_at:>='${yesterdayStart}' created_at:<'${todayStart}' financial_status:paid`,
      weekQuery: `created_at:>='${weekStart}' financial_status:paid`,
    }),
    adminGraphQL(token, ORDER_COUNTS_QUERY),
  ]);

  const sumRevenue = (edges: { node: { totalPriceSet: { shopMoney: { amount: string } } } }[]) =>
    edges.reduce((s, e) => s + parseFloat(e.node.totalPriceSet.shopMoney.amount), 0);

  const todayEdges = ordersData.data?.today?.edges || [];
  const yesterdayEdges = ordersData.data?.yesterday?.edges || [];
  const weekEdges = ordersData.data?.week?.edges || [];

  const todayRevenue = sumRevenue(todayEdges);
  const yesterdayRevenue = sumRevenue(yesterdayEdges);
  const weekRevenue = sumRevenue(weekEdges);

  const currency = todayEdges[0]?.node?.totalPriceSet?.shopMoney?.currencyCode
    || weekEdges[0]?.node?.totalPriceSet?.shopMoney?.currencyCode || 'USD';

  return res.status(200).json({
    today: { orders: todayEdges.length, revenue: Math.round(todayRevenue * 100) / 100 },
    yesterday: { orders: yesterdayEdges.length, revenue: Math.round(yesterdayRevenue * 100) / 100 },
    week: { orders: weekEdges.length, revenue: Math.round(weekRevenue * 100) / 100 },
    counts: {
      all: countsData.data?.all?.count ?? 0,
      pending: countsData.data?.pending?.count ?? 0,
      todayAll: countsData.data?.todayAll?.count ?? 0,
    },
    currency,
  });
}

async function handleOrders(token: string, req: VercelRequest, res: VercelResponse) {
  const status = (req.query.status as string) || 'all';
  const cursor = (req.query.cursor as string) || undefined;

  let filterQuery = '';
  if (status === 'pending') filterQuery = 'fulfillment_status:unfulfilled financial_status:paid';
  else if (status === 'fulfilled') filterQuery = 'fulfillment_status:shipped';
  else if (status === 'cancelled') filterQuery = 'status:cancelled';

  const data = await adminGraphQL(token, RECENT_ORDERS_QUERY, {
    first: 50,
    query: filterQuery,
    cursor: cursor || null,
  });

  const orders = (data.data?.orders?.edges || []).map((e: Record<string, unknown>) => {
    const n = e.node as Record<string, unknown>;
    const customer = n.customer as { displayName: string; email: string } | null;
    const shipping = n.shippingAddress as { country: string; city: string } | null;
    const lineItems = (n.lineItems as { edges: { node: { title: string; quantity: number; variant: { title: string } | null; originalTotalSet: { shopMoney: { amount: string } } } }[] })?.edges || [];

    return {
      id: n.id,
      name: n.name,
      createdAt: n.createdAt,
      financialStatus: n.displayFinancialStatus,
      fulfillmentStatus: n.displayFulfillmentStatus,
      cancelled: !!n.cancelledAt,
      total: (n.totalPriceSet as { shopMoney: { amount: string; currencyCode: string } }).shopMoney.amount,
      subtotal: (n.subtotalPriceSet as { shopMoney: { amount: string } }).shopMoney.amount,
      shipping: (n.totalShippingPriceSet as { shopMoney: { amount: string } }).shopMoney.amount,
      tax: (n.totalTaxSet as { shopMoney: { amount: string } }).shopMoney.amount,
      refunded: (n.totalRefundedSet as { shopMoney: { amount: string } }).shopMoney.amount,
      currency: (n.totalPriceSet as { shopMoney: { currencyCode: string } }).shopMoney.currencyCode,
      customerName: customer?.displayName || 'Guest',
      customerEmail: customer?.email || '',
      country: shipping?.country || '',
      city: shipping?.city || '',
      items: lineItems.map((li: { node: { title: string; quantity: number; variant: { title: string } | null; originalTotalSet: { shopMoney: { amount: string } } } }) => ({
        title: li.node.title,
        quantity: li.node.quantity,
        variant: li.node.variant?.title !== 'Default Title' ? li.node.variant?.title : null,
        amount: li.node.originalTotalSet.shopMoney.amount,
      })),
    };
  });

  return res.status(200).json({
    orders,
    pageInfo: data.data?.orders?.pageInfo || { hasNextPage: false, endCursor: null },
  });
}

async function handleProducts(token: string, req: VercelRequest, res: VercelResponse) {
  const filter = (req.query.filter as string) || 'all';
  const cursor = (req.query.cursor as string) || undefined;

  let query = 'status:active';
  if (filter === 'low-stock') query = 'status:active inventory_total:<5';
  else if (filter === 'out-of-stock') query = 'status:active inventory_total:<=0';

  const data = await adminGraphQL(token, PRODUCTS_QUERY, {
    first: 50,
    cursor: cursor || null,
    query,
  });

  const products = (data.data?.products?.edges || []).map((e: Record<string, unknown>) => {
    const n = e.node as Record<string, unknown>;
    const variants = ((n.variants as { edges: { node: Record<string, unknown> }[] })?.edges || []).map(
      (v: { node: Record<string, unknown> }) => ({
        id: v.node.id,
        title: v.node.title !== 'Default Title' ? v.node.title : null,
        price: v.node.price,
        inventory: v.node.inventoryQuantity,
        sku: v.node.sku,
      })
    );

    const priceRange = n.priceRangeV2 as { minVariantPrice: { amount: string; currencyCode: string }; maxVariantPrice: { amount: string } };
    const media = n.featuredMedia as { preview: { image: { url: string } } } | null;

    return {
      id: n.id,
      title: n.title,
      status: n.status,
      totalInventory: n.totalInventory,
      tracksInventory: n.tracksInventory,
      minPrice: priceRange?.minVariantPrice?.amount,
      maxPrice: priceRange?.maxVariantPrice?.amount,
      currency: priceRange?.minVariantPrice?.currencyCode || 'USD',
      variants,
      totalVariants: n.totalVariants,
      imageUrl: media?.preview?.image?.url || null,
    };
  });

  return res.status(200).json({
    products,
    pageInfo: data.data?.products?.pageInfo || { hasNextPage: false, endCursor: null },
  });
}

async function handleCustomers(token: string, req: VercelRequest, res: VercelResponse) {
  const view = (req.query.view as string) || 'top';

  const now = new Date();
  const thirtyDaysAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 30)).toISOString();

  const [summaryData, topData, recentData] = await Promise.all([
    adminGraphQL(token, CUSTOMER_SUMMARY_QUERY),
    view === 'top' || view === 'all' ? adminGraphQL(token, TOP_CUSTOMERS_QUERY) : Promise.resolve(null),
    view === 'recent' || view === 'all' ? adminGraphQL(token, RECENT_CUSTOMERS_QUERY, { query: `created_at:>='${thirtyDaysAgo}'` }) : Promise.resolve(null),
  ]);

  const total = summaryData.data?.total?.count ?? 0;
  const noOrders = summaryData.data?.noOrders?.count ?? 0;
  const oneOrder = summaryData.data?.oneOrder?.count ?? 0;
  const fourPlus = summaryData.data?.fourPlus?.count ?? 0;
  const twoThree = Math.max(0, total - noOrders - oneOrder - fourPlus);

  const mapCustomer = (e: { node: Record<string, unknown> }) => {
    const n = e.node;
    const addr = n.defaultAddress as { country: string; city: string } | null;
    const spent = n.amountSpent as { amount: string; currencyCode: string };
    return {
      id: n.id,
      name: n.displayName,
      email: n.email,
      orders: n.numberOfOrders,
      spent: spent?.amount,
      currency: spent?.currencyCode || 'USD',
      createdAt: n.createdAt,
      country: addr?.country || '',
      city: addr?.city || '',
      tags: (n as { tags?: string[] }).tags || [],
    };
  };

  return res.status(200).json({
    summary: { total, noOrders, oneOrder, twoThree, fourPlus },
    topCustomers: topData?.data?.customers?.edges?.map(mapCustomer) || [],
    recentCustomers: recentData?.data?.customers?.edges?.map(mapCustomer) || [],
  });
}

async function handleDashboard(token: string, req: VercelRequest, res: VercelResponse) {
  const range = (req.query.range as string) || '7d';
  const now = new Date();
  const days = range === 'today' ? 0 : range === '7d' ? 7 : range === '28d' ? 28 : 90;
  const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - days));

  const [ordersData, lowStockData] = await Promise.all([
    adminGraphQL(token, DASHBOARD_ORDERS_QUERY, {
      query: `created_at:>='${startDate.toISOString()}' financial_status:paid`,
    }),
    adminGraphQL(token, LOW_STOCK_PRODUCTS_QUERY),
  ]);

  interface OrderNode {
    createdAt: string;
    totalPriceSet: { shopMoney: { amount: string; currencyCode: string } };
    customer: { tags: string[] } | null;
    shippingAddress: { countryCodeV2: string } | null;
    lineItems: { edges: { node: { title: string; quantity: number; originalTotalSet: { shopMoney: { amount: string } } } }[] };
  }

  const edges = ordersData.data?.orders?.edges || [];
  let totalRevenue = 0;
  let totalOrders = 0;
  let totalItemsSold = 0;
  let currency = 'USD';
  let b2bRevenue = 0;
  let b2bOrders = 0;
  let b2cRevenue = 0;
  let b2cOrders = 0;

  const dailyMap = new Map<string, { date: string; orders: number; revenue: number }>();
  const productMap = new Map<string, { title: string; quantity: number; revenue: number }>();
  const countryMap = new Map<string, number>();

  for (const edge of edges) {
    const n = edge.node as OrderNode;
    const amount = parseFloat(n.totalPriceSet.shopMoney.amount);
    currency = n.totalPriceSet.shopMoney.currencyCode || currency;
    totalRevenue += amount;
    totalOrders++;

    const isB2B = (n.customer?.tags || []).some((t: string) => t.toLowerCase().includes('b2b'));
    if (isB2B) { b2bRevenue += amount; b2bOrders++; }
    else { b2cRevenue += amount; b2cOrders++; }

    const date = n.createdAt.slice(0, 10);
    const day = dailyMap.get(date) || { date, orders: 0, revenue: 0 };
    day.orders++;
    day.revenue += amount;
    dailyMap.set(date, day);

    const cc = n.shippingAddress?.countryCodeV2 || '';
    if (cc) countryMap.set(cc, (countryMap.get(cc) || 0) + 1);

    for (const li of (n.lineItems?.edges || [])) {
      const item = li.node;
      totalItemsSold += item.quantity;
      const existing = productMap.get(item.title) || { title: item.title, quantity: 0, revenue: 0 };
      existing.quantity += item.quantity;
      existing.revenue += parseFloat(item.originalTotalSet.shopMoney.amount);
      productMap.set(item.title, existing);
    }
  }

  const countryOrders = Array.from(countryMap.entries())
    .map(([country, orders]) => ({ country, orders }))
    .sort((a, b) => b.orders - a.orders)
    .slice(0, 15);

  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const dailyOrders = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  const topProducts = Array.from(productMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

  interface ProductNode {
    title: string;
    variants: { edges: { node: { title: string; inventoryQuantity: number } }[] };
  }

  const lowStock: { title: string; variant: string; quantity: number }[] = [];
  for (const edge of (lowStockData.data?.products?.edges || [])) {
    const p = edge.node as ProductNode;
    for (const v of (p.variants?.edges || [])) {
      if (v.node.inventoryQuantity < 5) {
        lowStock.push({
          title: p.title,
          variant: v.node.title !== 'Default Title' ? v.node.title : '',
          quantity: v.node.inventoryQuantity,
        });
      }
    }
  }
  lowStock.sort((a, b) => a.quantity - b.quantity);

  return res.status(200).json({
    summary: {
      totalOrders,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      averageOrderValue: Math.round(averageOrderValue * 100) / 100,
      totalItemsSold,
    },
    b2b: {
      totalOrders: b2bOrders,
      totalRevenue: Math.round(b2bRevenue * 100) / 100,
      averageOrderValue: b2bOrders > 0 ? Math.round(b2bRevenue / b2bOrders * 100) / 100 : 0,
    },
    b2c: {
      totalOrders: b2cOrders,
      totalRevenue: Math.round(b2cRevenue * 100) / 100,
      averageOrderValue: b2cOrders > 0 ? Math.round(b2cRevenue / b2cOrders * 100) / 100 : 0,
    },
    dailyOrders,
    topProducts,
    lowStock,
    countryOrders,
    currency,
  });
}

// ─── GA4 Handler ───

async function handleGaOverview(req: VercelRequest, res: VercelResponse) {
  const gaToken = await getGAAccessToken();
  if (!gaToken) return res.status(200).json({ available: false });

  const range = (req.query.range as string) || '7d';
  const dr = gaDateRange(range);

  const [overviewReport, funnelReport, dailyReport] = await Promise.all([
    gaReport(gaToken, {
      dateRanges: [dr],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'bounceRate' },
        { name: 'averageSessionDuration' },
        { name: 'ecommercePurchases' },
        { name: 'purchaseRevenue' },
      ],
    }),
    gaReport(gaToken, {
      dateRanges: [dr],
      dimensions: [{ name: 'eventName' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          inListFilter: {
            values: ['view_item', 'add_to_cart', 'begin_checkout', 'add_payment_info', 'purchase'],
          },
        },
      },
    }),
    gaReport(gaToken, {
      dateRanges: [dr],
      dimensions: [{ name: 'date' }],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
      ],
      orderBys: [{ dimension: { dimensionName: 'date' } }],
    }),
  ]);

  const ovRows = gaRows(overviewReport);
  const sessions = ovRows[0] ? parseInt(ovRows[0].sessions || '0') : 0;
  const users = ovRows[0] ? parseInt(ovRows[0].totalUsers || '0') : 0;
  const bounceRate = ovRows[0] ? parseFloat(ovRows[0].bounceRate || '0') : 0;
  const avgDuration = ovRows[0] ? parseFloat(ovRows[0].averageSessionDuration || '0') : 0;
  const purchases = ovRows[0] ? parseInt(ovRows[0].ecommercePurchases || '0') : 0;
  const conversionRate = sessions > 0 ? (purchases / sessions) * 100 : 0;

  const funnelRows = gaRows(funnelReport);
  const funnelMap: Record<string, number> = {};
  for (const row of funnelRows) {
    funnelMap[row.eventName] = parseInt(row.eventCount || '0');
  }
  const funnel = [
    { step: 'view_item', label: '상품 조회', count: funnelMap['view_item'] || 0 },
    { step: 'add_to_cart', label: '장바구니', count: funnelMap['add_to_cart'] || 0 },
    { step: 'begin_checkout', label: '결제 시작', count: funnelMap['begin_checkout'] || 0 },
    { step: 'add_payment_info', label: '결제 정보', count: funnelMap['add_payment_info'] || 0 },
    { step: 'purchase', label: '구매 완료', count: funnelMap['purchase'] || 0 },
  ];

  const dailyRows = gaRows(dailyReport);
  const daily = dailyRows.map(r => ({
    date: `${r.date.slice(0, 4)}-${r.date.slice(4, 6)}-${r.date.slice(6, 8)}`,
    sessions: parseInt(r.sessions || '0'),
    users: parseInt(r.totalUsers || '0'),
  }));

  return res.status(200).json({
    available: true,
    sessions,
    users,
    bounceRate: Math.round(bounceRate * 1000) / 1000,
    avgSessionDuration: Math.round(avgDuration),
    conversionRate: Math.round(conversionRate * 100) / 100,
    purchases,
    funnel,
    daily,
  });
}

async function handleGaTraffic(req: VercelRequest, res: VercelResponse) {
  const gaToken = await getGAAccessToken();
  if (!gaToken) return res.status(200).json({ available: false });

  const range = (req.query.range as string) || '7d';
  const dr = gaDateRange(range);

  const [sourceReport, countryReport, pageReport] = await Promise.all([
    gaReport(gaToken, {
      dateRanges: [dr],
      dimensions: [{ name: 'sessionSourceMedium' }],
      metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'bounceRate' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 10,
    }),
    gaReport(gaToken, {
      dateRanges: [dr],
      dimensions: [{ name: 'countryId' }, { name: 'country' }],
      metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 15,
    }),
    gaReport(gaToken, {
      dateRanges: [dr],
      dimensions: [{ name: 'pagePath' }],
      metrics: [{ name: 'screenPageViews' }, { name: 'totalUsers' }],
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit: 10,
    }),
  ]);

  const sources = gaRows(sourceReport).map(r => ({
    source: r.sessionSourceMedium || '(unknown)',
    sessions: parseInt(r.sessions || '0'),
    users: parseInt(r.totalUsers || '0'),
    bounceRate: Math.round(parseFloat(r.bounceRate || '0') * 10000) / 100,
  }));

  const countries = gaRows(countryReport).map(r => ({
    countryId: r.countryId || '',
    country: r.country || '',
    sessions: parseInt(r.sessions || '0'),
    users: parseInt(r.totalUsers || '0'),
  }));

  const pages = gaRows(pageReport).map(r => ({
    path: r.pagePath || '/',
    views: parseInt(r.screenPageViews || '0'),
    users: parseInt(r.totalUsers || '0'),
  }));

  return res.status(200).json({ available: true, sources, countries, pages });
}

async function handleGaFunnel(req: VercelRequest, res: VercelResponse) {
  const gaToken = await getGAAccessToken();
  if (!gaToken) return res.status(200).json({ available: false });

  const range = (req.query.range as string) || '7d';
  const dr = gaDateRange(range);

  const [funnelByDateReport, sourceReport, pageReport] = await Promise.all([
    gaReport(gaToken, {
      dateRanges: [dr],
      dimensions: [{ name: 'date' }, { name: 'eventName' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          inListFilter: {
            values: ['view_item', 'add_to_cart', 'begin_checkout', 'add_payment_info', 'purchase'],
          },
        },
      },
      orderBys: [{ dimension: { dimensionName: 'date' } }],
    }),
    gaReport(gaToken, {
      dateRanges: [dr],
      dimensions: [{ name: 'sessionSourceMedium' }],
      metrics: [
        { name: 'sessions' },
        { name: 'ecommercePurchases' },
        { name: 'purchaseRevenue' },
      ],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 15,
    }),
    gaReport(gaToken, {
      dateRanges: [dr],
      dimensions: [{ name: 'pagePath' }],
      metrics: [
        { name: 'screenPageViews' },
        { name: 'bounceRate' },
        { name: 'userEngagementDuration' },
      ],
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit: 20,
    }),
  ]);

  const funnelSteps = ['view_item', 'add_to_cart', 'begin_checkout', 'add_payment_info', 'purchase'];
  const funnelLabels: Record<string, string> = {
    view_item: '상품 조회', add_to_cart: '장바구니',
    begin_checkout: '결제 시작', add_payment_info: '결제 정보', purchase: '구매 완료',
  };

  const dailyFunnelMap = new Map<string, Record<string, number>>();
  for (const row of gaRows(funnelByDateReport)) {
    const date = `${row.date.slice(0, 4)}-${row.date.slice(4, 6)}-${row.date.slice(6, 8)}`;
    const entry = dailyFunnelMap.get(date) || {};
    entry[row.eventName] = parseInt(row.eventCount || '0');
    dailyFunnelMap.set(date, entry);
  }
  const dailyFunnel = Array.from(dailyFunnelMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, events]) => ({
      date,
      ...Object.fromEntries(funnelSteps.map(s => [s, events[s] || 0])),
    }));

  const sources = gaRows(sourceReport).map(row => {
    const sessions = parseInt(row.sessions || '0');
    const purchases = parseInt(row.ecommercePurchases || '0');
    return {
      source: row.sessionSourceMedium || '(unknown)',
      sessions,
      purchases,
      revenue: Math.round(parseFloat(row.purchaseRevenue || '0') * 100) / 100,
      conversionRate: sessions > 0 ? Math.round((purchases / sessions) * 10000) / 100 : 0,
    };
  });

  const pages = gaRows(pageReport).map(row => ({
    path: row.pagePath || '/',
    views: parseInt(row.screenPageViews || '0'),
    bounceRate: Math.round(parseFloat(row.bounceRate || '0') * 10000) / 100,
    avgEngagement: Math.round(parseFloat(row.userEngagementDuration || '0')),
  }));

  return res.status(200).json({
    available: true,
    funnelSteps: funnelSteps.map(s => ({ step: s, label: funnelLabels[s] })),
    dailyFunnel,
    sources,
    pages,
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

  const section = (req.query.section as string) || 'overview';

  try {
    if (section === 'ga-overview') return await handleGaOverview(req, res);
    if (section === 'ga-funnel') return await handleGaFunnel(req, res);
    if (section === 'ga-traffic') return await handleGaTraffic(req, res);

    const token = await getShopifyAccessToken();
    if (section === 'overview') return await handleOverview(token, res);
    if (section === 'dashboard') return await handleDashboard(token, req, res);
    if (section === 'orders') return await handleOrders(token, req, res);
    if (section === 'products') return await handleProducts(token, req, res);
    if (section === 'customers') return await handleCustomers(token, req, res);
    return res.status(400).json({ error: `Unknown section: ${section}` });
  } catch (error) {
    console.error(`[AdminManage:${section}]`, error);
    return res.status(500).json({
      error: 'Failed to fetch data',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
