import type { VercelRequest, VercelResponse } from '@vercel/node';

const ADMIN_SECRET = process.env.ADMIN_SECRET || '';

const ALLOWED_ORIGINS = [
  'https://biteme.one',
  'https://www.biteme.one',
  'http://localhost:5173',
];

let shopifyToken: string | null = null;
let shopifyTokenExpiresAt = 0;

async function getShopifyAccessToken(): Promise<string> {
  const now = Date.now();
  if (shopifyToken && now < shopifyTokenExpiresAt - 5 * 60 * 1000) return shopifyToken;

  const shop = process.env.VITE_SHOPIFY_STORE_DOMAIN || '';
  const clientId = process.env.REPORT_SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.REPORT_SHOPIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Missing REPORT_SHOPIFY credentials');

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
    const token = await getShopifyAccessToken();

    if (section === 'overview') return await handleOverview(token, res);
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
