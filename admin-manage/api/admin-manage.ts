import { createSign } from 'crypto';
import t ype { VercelRequest, VercelResponse } from '@ vercel/node';

const _VERCEL_ENV = process.en v.VERCEL_ENV || 'development';
const ADMIN_SE CRET = process.env.ADMIN_SECRET || (_VERCEL_E NV !== 'production' ? 'preview' : '');

const  ALLOWED_ORIGINS = [
  'https://biteme.one',
   'https://www.biteme.one',
  'http://localho st:5173',
  'http://localhost:3000',
];

// � ��── Shopify Auth ───

let shopifyT oken: string | null = null;
let shopifyTokenE xpiresAt = 0;

async function getShopifyAcces sToken(): Promise<string> {
  const now = Dat e.now();
  if (shopifyToken && now < shopifyT okenExpiresAt - 5 * 60 * 1000) return shopify Token;

  const shop = process.env.VITE_SHOPI FY_STORE_DOMAIN || '';
  const clientId = pro cess.env.REPORT_SHOPIFY_CLIENT_ID || process. env.VITE_SHOPIFY_CLIENT_ID;
  const clientSec ret = process.env.REPORT_SHOPIFY_CLIENT_SECRE T || process.env.SHOPIFY_CLIENT_SECRET;
  if  (!clientId || !clientSecret) throw new Error( 'Missing Shopify credentials');

  const res  = await fetch(`https://${shop}/admin/oauth/ac cess_token`, {
    method: 'POST',
    header s: { 'Content-Type': 'application/x-www-form- urlencoded' },
    body: new URLSearchParams( { grant_type: 'client_credentials', client_id : clientId, client_secret: clientSecret }),
   });
  if (!res.ok) throw new Error(`Token er ror (${res.status})`);
  const data = await r es.json();
  shopifyToken = data.access_token ;
  shopifyTokenExpiresAt = now + (data.expir es_in || 3600) * 1000;
  return shopifyToken! ;
}

async function adminGraphQL(token: strin g, query: string, variables: Record<string, u nknown> = {}) {
  const shop = process.env.VI TE_SHOPIFY_STORE_DOMAIN || '';
  const res =  await fetch(`https://${shop}/admin/api/2025-0 7/graphql.json`, {
    method: 'POST',
    he aders: { 'Content-Type': 'application/json',  'X-Shopify-Access-Token': token },
    body:  JSON.stringify({ query, variables }),
  });
   if (!res.ok) throw new Error(`Admin API erro r (${res.status}): ${(await res.text()).slice (0, 300)}`);
  return res.json();
}

// ─� �─ Google Analytics Auth ───

let gaA ccessToken: string | null = null;
let gaAcces sTokenExpiresAt = 0;

async function getGAAcc essToken(): Promise<string | null> {
  const  saJson = process.env.GA_SERVICE_ACCOUNT_JSON; 
  if (!saJson) return null;
  const now = Da te.now();
  if (gaAccessToken && now < gaAcce ssTokenExpiresAt - 300_000) return gaAccessTo ken;
  try {
    const sa = JSON.parse(saJson ) as { client_email: string; private_key: str ing };
    const iat = Math.floor(now / 1000) ;
    const header = Buffer.from(JSON.stringi fy({ alg: 'RS256', typ: 'JWT' })).toString('b ase64url');
    const payload = Buffer.from(J SON.stringify({
      iss: sa.client_email,
       scope: 'https://www.googleapis.com/auth/ analytics.readonly',
      aud: 'https://oaut h2.googleapis.com/token',
      iat,
      ex p: iat + 3600,
    })).toString('base64url'); 
    const sign = createSign('RSA-SHA256');
     sign.update(`${header}.${payload}`);
    c onst sig = sign.sign(sa.private_key, 'base64u rl');
    const jwt = `${header}.${payload}.$ {sig}`;
    const res = await fetch('https:// oauth2.googleapis.com/token', {
      method:  'POST',
      headers: { 'Content-Type': 'ap plication/x-www-form-urlencoded' },
      bod y: new URLSearchParams({ grant_type: 'urn:iet f:params:oauth:grant-type:jwt-bearer', assert ion: jwt }),
    });
    if (!res.ok) throw n ew Error(`GA OAuth ${res.status}: ${await res .text()}`);
    const data = await res.json()  as { access_token: string; expires_in: numbe r };
    gaAccessToken = data.access_token;
     gaAccessTokenExpiresAt = now + data.expire s_in * 1000;
    return gaAccessToken;
  } ca tch (err) {
    console.error('[GA Auth]', er r);
    return null;
  }
}

async function ga Report(token: string, body: Record<string, un known>): Promise<Record<string, unknown> | nu ll> {
  const pid = process.env.GA4_PROPERTY_ ID;
  if (!pid) return null;
  const res = aw ait fetch(`https://analyticsdata.googleapis.c om/v1beta/properties/${pid}:runReport`, {
     method: 'POST',
    headers: { 'Content-Type ': 'application/json', Authorization: `Bearer  ${token}` },
    body: JSON.stringify(body), 
  });
  if (!res.ok) { console.error('[GA Re port]', res.status, await res.text()); return  null; }
  return res.json() as Promise<Recor d<string, unknown>>;
}

function gaRows(repor t: Record<string, unknown> | null): Record<st ring, string>[] {
  if (!report) return [];
   const rows = (report.rows || []) as Array<{  dimensionValues?: Array<{ value: string }>; m etricValues?: Array<{ value: string }> }>;
   const dimHdrs = ((report.dimensionHeaders ||  []) as Array<{ name: string }>).map(h => h.na me);
  const metHdrs = ((report.metricHeaders  || []) as Array<{ name: string }>).map(h =>  h.name);
  return rows.map(row => {
    const  obj: Record<string, string> = {};
    (row.d imensionValues || []).forEach((v, i) => { obj [dimHdrs[i]] = v.value; });
    (row.metricVa lues || []).forEach((v, i) => { obj[metHdrs[i ]] = v.value; });
    return obj;
  });
}

fu nction gaDateRange(range: string): { startDat e: string; endDate: string } {
  if (range == = 'today') return { startDate: 'today', endDa te: 'today' };
  if (range === '7d') return {  startDate: '7daysAgo', endDate: 'yesterday'  };
  if (range === '28d') return { startDate:  '28daysAgo', endDate: 'yesterday' };
  retur n { startDate: '90daysAgo', endDate: 'yesterd ay' };
}

// ─── Shopify Queries ── ─

const RECENT_ORDERS_QUERY = `
  query Re centOrders($first: Int!, $query: String!, $cu rsor: String) {
    orders(first: $first, que ry: $query, after: $cursor, sortKey: CREATED_ AT, reverse: true) {
      pageInfo { hasNext Page endCursor }
      edges {
        node { 
          id name createdAt displayFinancial Status displayFulfillmentStatus cancelledAt
           totalPriceSet { shopMoney { amount c urrencyCode } }
          subtotalPriceSet {  shopMoney { amount } }
          totalShippin gPriceSet { shopMoney { amount } }
           totalTaxSet { shopMoney { amount } }
           totalRefundedSet { shopMoney { amount } }
           customer { id displayName email }
           shippingAddress { country city }
           lineItems(first: 10) {
            edge s { node { title quantity variant { title } o riginalTotalSet { shopMoney { amount } } } }
           }
        }
      }
    }
  }
`;

c onst ORDER_COUNTS_QUERY = `
  query OrderCoun ts {
    all: ordersCount { count }
    pendi ng: ordersCount(query: "fulfillment_status:un fulfilled financial_status:paid") { count }
     todayAll: ordersCount(query: "created_at:> =today") { count }
  }
`;

const PRODUCTS_QUE RY = `
  query Products($first: Int!, $cursor : String, $query: String) {
    products(firs t: $first, after: $cursor, query: $query, sor tKey: TITLE) {
      pageInfo { hasNextPage e ndCursor }
      edges {
        node {
           id title status totalInventory tracksInv entory
          priceRangeV2 { maxVariantPri ce { amount currencyCode } minVariantPrice {  amount currencyCode } }
          variants(fi rst: 20) { edges { node { id title price inve ntoryQuantity sku } } }
          totalVarian ts
          featuredMedia { preview { image  { url } } }
        }
      }
    }
  }
`;

c onst CUSTOMER_SUMMARY_QUERY = `
  query Custo merSummary {
    total: customersCount { coun t }
    noOrders: customersCount(query: "orde rs_count:=0") { count }
    oneOrder: custome rsCount(query: "orders_count:=1") { count }
     fourPlus: customersCount(query: "orders_co unt:>=4") { count }
  }
`;

const TOP_CUSTOME RS_QUERY = `
  query TopCustomers {
    custo mers(first: 20, sortKey: TOTAL_SPENT, reverse : true, query: "orders_count:>0") {
      edg es {
        node {
          id displayName  email numberOfOrders
          amountSpent {  amount currencyCode }
          createdAt tag s
          defaultAddress { country city }
         }
      }
    }
  }
`;

const RECENT_C USTOMERS_QUERY = `
  query RecentCustomers($q uery: String!) {
    customers(first: 20, sor tKey: CREATED_AT, reverse: true, query: $quer y) {
      edges {
        node {
          i d displayName email numberOfOrders
           amountSpent { amount currencyCode }
           createdAt
          defaultAddress { country  city }
        }
      }
    }
  }
`;

const  DASHBOARD_ORDERS_QUERY = `
  query Dashboard Orders($query: String!) {
    orders(first: 2 50, query: $query, sortKey: CREATED_AT) {
       edges {
        node {
          createdAt 
          totalPriceSet { shopMoney { amount  currencyCode } }
          customer { tags } 
          lineItems(first: 5) {
             edges { node { title quantity originalTotalSe t { shopMoney { amount } } } }
          }
         }
      }
    }
  }
`;

const LOW_STOCK _PRODUCTS_QUERY = `
  query LowStockProducts  {
    products(first: 30, query: "status:acti ve inventory_total:<5", sortKey: INVENTORY_TO TAL) {
      edges {
        node {
           title totalInventory
          variants(firs t: 10) { edges { node { title inventoryQuanti ty } } }
        }
      }
    }
  }
`;

// � ��── Shopify Handlers ───

async fu nction handleOverview(token: string, res: Ver celResponse) {
  const now = new Date();
  co nst todayStart = new Date(Date.UTC(now.getUTC FullYear(), now.getUTCMonth(), now.getUTCDate ())).toISOString();
  const yesterdayStart =  new Date(Date.UTC(now.getUTCFullYear(), now.g etUTCMonth(), now.getUTCDate() - 1)).toISOStr ing();
  const weekStart = new Date(Date.UTC( now.getUTCFullYear(), now.getUTCMonth(), now. getUTCDate() - 7)).toISOString();

  const or dersQuery = `
    query DailyOrders($todayQue ry: String!, $yesterdayQuery: String!, $weekQ uery: String!) {
      today: orders(first: 2 50, query: $todayQuery) {
        edges { nod e { totalPriceSet { shopMoney { amount curren cyCode } } } }
      }
      yesterday: order s(first: 250, query: $yesterdayQuery) {
         edges { node { totalPriceSet { shopMoney {  amount } } } }
      }
      week: orders(fi rst: 250, query: $weekQuery) {
        edges  { node { totalPriceSet { shopMoney { amount }  } createdAt } }
      }
    }
  `;

  const  [ordersData, countsData] = await Promise.all( [
    adminGraphQL(token, ordersQuery, {
       todayQuery: `created_at:>='${todayStart}' f inancial_status:paid`,
      yesterdayQuery:  `created_at:>='${yesterdayStart}' created_at: <'${todayStart}' financial_status:paid`,
       weekQuery: `created_at:>='${weekStart}' fin ancial_status:paid`,
    }),
    adminGraphQL (token, ORDER_COUNTS_QUERY),
  ]);

  const s umRevenue = (edges: { node: { totalPriceSet:  { shopMoney: { amount: string } } } }[]) =>
     edges.reduce((s, e) => s + parseFloat(e.no de.totalPriceSet.shopMoney.amount), 0);

  co nst todayEdges = ordersData.data?.today?.edge s || [];
  const yesterdayEdges = ordersData. data?.yesterday?.edges || [];
  const weekEdg es = ordersData.data?.week?.edges || [];

  c onst todayRevenue = sumRevenue(todayEdges);
   const yesterdayRevenue = sumRevenue(yesterda yEdges);
  const weekRevenue = sumRevenue(wee kEdges);

  const currency = todayEdges[0]?.n ode?.totalPriceSet?.shopMoney?.currencyCode
     || weekEdges[0]?.node?.totalPriceSet?.shop Money?.currencyCode || 'USD';

  return res.s tatus(200).json({
    today: { orders: todayE dges.length, revenue: Math.round(todayRevenue  * 100) / 100 },
    yesterday: { orders: yes terdayEdges.length, revenue: Math.round(yeste rdayRevenue * 100) / 100 },
    week: { order s: weekEdges.length, revenue: Math.round(week Revenue * 100) / 100 },
    counts: {
      a ll: countsData.data?.all?.count ?? 0,
      p ending: countsData.data?.pending?.count ?? 0, 
      todayAll: countsData.data?.todayAll?.c ount ?? 0,
    },
    currency,
  });
}

asyn c function handleOrders(token: string, req: V ercelRequest, res: VercelResponse) {
  const  status = (req.query.status as string) || 'all ';
  const cursor = (req.query.cursor as stri ng) || undefined;

  let filterQuery = '';
   if (status === 'pending') filterQuery = 'fulf illment_status:unfulfilled financial_status:p aid';
  else if (status === 'fulfilled') filt erQuery = 'fulfillment_status:shipped';
  els e if (status === 'cancelled') filterQuery = ' status:cancelled';

  const data = await admi nGraphQL(token, RECENT_ORDERS_QUERY, { first:  50, query: filterQuery, cursor: cursor || nu ll });

  const orders = (data.data?.orders?. edges || []).map((e: Record<string, unknown>)  => {
    const n = e.node as Record<string,  unknown>;
    const customer = n.customer as  { displayName: string; email: string } | null ;
    const shipping = n.shippingAddress as {  country: string; city: string } | null;
     const lineItems = (n.lineItems as { edges: {  node: { title: string; quantity: number; vari ant: { title: string } | null; originalTotalS et: { shopMoney: { amount: string } } } }[] } )?.edges || [];

    return {
      id: n.id,  name: n.name, createdAt: n.createdAt,
       financialStatus: n.displayFinancialStatus, fu lfillmentStatus: n.displayFulfillmentStatus,
       cancelled: !!n.cancelledAt,
      total : (n.totalPriceSet as { shopMoney: { amount:  string; currencyCode: string } }).shopMoney.a mount,
      subtotal: (n.subtotalPriceSet as  { shopMoney: { amount: string } }).shopMoney .amount,
      shipping: (n.totalShippingPric eSet as { shopMoney: { amount: string } }).sh opMoney.amount,
      tax: (n.totalTaxSet as  { shopMoney: { amount: string } }).shopMoney. amount,
      refunded: (n.totalRefundedSet a s { shopMoney: { amount: string } }).shopMone y.amount,
      currency: (n.totalPriceSet as  { shopMoney: { currencyCode: string } }).sho pMoney.currencyCode,
      customerName: cust omer?.displayName || 'Guest', customerEmail:  customer?.email || '',
      country: shippin g?.country || '', city: shipping?.city || '', 
      items: lineItems.map((li: { node: { ti tle: string; quantity: number; variant: { tit le: string } | null; originalTotalSet: { shop Money: { amount: string } } } }) => ({
         title: li.node.title, quantity: li.node.qua ntity,
        variant: li.node.variant?.titl e !== 'Default Title' ? li.node.variant?.titl e : null,
        amount: li.node.originalTot alSet.shopMoney.amount,
      })),
    };
  } );

  return res.status(200).json({ orders, p ageInfo: data.data?.orders?.pageInfo || { has NextPage: false, endCursor: null } });
}

asy nc function handleProducts(token: string, req : VercelRequest, res: VercelResponse) {
  con st filter = (req.query.filter as string) || ' all';
  const cursor = (req.query.cursor as s tring) || undefined;

  let query = 'status:a ctive';
  if (filter === 'low-stock') query =  'status:active inventory_total:<5';
  else i f (filter === 'out-of-stock') query = 'status :active inventory_total:<=0';

  const data =  await adminGraphQL(token, PRODUCTS_QUERY, {  first: 50, cursor: cursor || null, query });
 
  const products = (data.data?.products?.edg es || []).map((e: Record<string, unknown>) =>  {
    const n = e.node as Record<string, unk nown>;
    const variants = ((n.variants as {  edges: { node: Record<string, unknown> }[] } )?.edges || []).map(
      (v: { node: Record <string, unknown> }) => ({
        id: v.node .id,
        title: v.node.title !== 'Default  Title' ? v.node.title : null,
        price:  v.node.price, inventory: v.node.inventoryQua ntity, sku: v.node.sku,
      })
    );
    c onst priceRange = n.priceRangeV2 as { minVari antPrice: { amount: string; currencyCode: str ing }; maxVariantPrice: { amount: string } }; 
    const media = n.featuredMedia as { previ ew: { image: { url: string } } } | null;

     return {
      id: n.id, title: n.title, sta tus: n.status, totalInventory: n.totalInvento ry,
      tracksInventory: n.tracksInventory, 
      minPrice: priceRange?.minVariantPrice? .amount, maxPrice: priceRange?.maxVariantPric e?.amount,
      currency: priceRange?.minVar iantPrice?.currencyCode || 'USD',
      varia nts, totalVariants: n.totalVariants,
      im ageUrl: media?.preview?.image?.url || null,
     };
  });

  return res.status(200).json({  products, pageInfo: data.data?.products?.page Info || { hasNextPage: false, endCursor: null  } });
}

async function handleCustomers(toke n: string, req: VercelRequest, res: VercelRes ponse) {
  const view = (req.query.view as st ring) || 'top';
  const now = new Date();
  c onst thirtyDaysAgo = new Date(Date.UTC(now.ge tUTCFullYear(), now.getUTCMonth(), now.getUTC Date() - 30)).toISOString();

  const [summar yData, topData, recentData] = await Promise.a ll([
    adminGraphQL(token, CUSTOMER_SUMMARY _QUERY),
    view === 'top' || view === 'all'  ? adminGraphQL(token, TOP_CUSTOMERS_QUERY) :  Promise.resolve(null),
    view === 'recent'  || view === 'all' ? adminGraphQL(token, RECE NT_CUSTOMERS_QUERY, { query: `created_at:>='$ {thirtyDaysAgo}'` }) : Promise.resolve(null), 
  ]);

  const total = summaryData.data?.tot al?.count ?? 0;
  const noOrders = summaryDat a.data?.noOrders?.count ?? 0;
  const oneOrde r = summaryData.data?.oneOrder?.count ?? 0;
   const fourPlus = summaryData.data?.fourPlus? .count ?? 0;
  const twoThree = Math.max(0, t otal - noOrders - oneOrder - fourPlus);

  co nst mapCustomer = (e: { node: Record<string,  unknown> }) => {
    const n = e.node;
    co nst addr = n.defaultAddress as { country: str ing; city: string } | null;
    const spent =  n.amountSpent as { amount: string; currencyC ode: string };
    return {
      id: n.id, n ame: n.displayName, email: n.email, orders: n .numberOfOrders,
      spent: spent?.amount,  currency: spent?.currencyCode || 'USD',
       createdAt: n.createdAt, country: addr?.count ry || '', city: addr?.city || '',
      tags:  (n as { tags?: string[] }).tags || [],
    } ;
  };

  return res.status(200).json({
    s ummary: { total, noOrders, oneOrder, twoThree , fourPlus },
    topCustomers: topData?.data ?.customers?.edges?.map(mapCustomer) || [],
     recentCustomers: recentData?.data?.custome rs?.edges?.map(mapCustomer) || [],
  });
}

a sync function handleDashboard(token: string,  req: VercelRequest, res: VercelResponse) {
   const range = (req.query.range as string) ||  '7d';
  const now = new Date();
  const days  = range === 'today' ? 0 : range === '7d' ? 7  : range === '28d' ? 28 : 90;
  const startDat e = new Date(Date.UTC(now.getUTCFullYear(), n ow.getUTCMonth(), now.getUTCDate() - days));
 
  const [ordersData, lowStockData] = await P romise.all([
    adminGraphQL(token, DASHBOAR D_ORDERS_QUERY, {
      query: `created_at:>= '${startDate.toISOString()}' financial_status :paid`,
    }),
    adminGraphQL(token, LOW_S TOCK_PRODUCTS_QUERY),
  ]);

  interface Orde rNode {
    createdAt: string;
    totalPrice Set: { shopMoney: { amount: string; currencyC ode: string } };
    customer: { tags: string [] } | null;
    lineItems: { edges: { node:  { title: string; quantity: number; originalTo talSet: { shopMoney: { amount: string } } } } [] };
  }

  const edges = ordersData.data?.o rders?.edges || [];
  let totalRevenue = 0, t otalOrders = 0, totalItemsSold = 0;
  let cur rency = 'USD';
  let b2bRevenue = 0, b2bOrder s = 0, b2cRevenue = 0, b2cOrders = 0;

  cons t dailyMap = new Map<string, { date: string;  orders: number; revenue: number }>();
  const  productMap = new Map<string, { title: string ; quantity: number; revenue: number }>();

   for (const edge of edges) {
    const n = edg e.node as OrderNode;
    const amount = parse Float(n.totalPriceSet.shopMoney.amount);
     currency = n.totalPriceSet.shopMoney.currency Code || currency;
    totalRevenue += amount; 
    totalOrders++;

    const isB2B = (n.cus tomer?.tags || []).some((t: string) => t.toLo werCase().includes('b2b'));
    if (isB2B) {  b2bRevenue += amount; b2bOrders++; }
    else  { b2cRevenue += amount; b2cOrders++; }

     const date = n.createdAt.slice(0, 10);
    co nst day = dailyMap.get(date) || { date, order s: 0, revenue: 0 };
    day.orders++;
    day .revenue += amount;
    dailyMap.set(date, da y);

    for (const li of (n.lineItems?.edges  || [])) {
      const item = li.node;
       totalItemsSold += item.quantity;
      const  existing = productMap.get(item.title) || { ti tle: item.title, quantity: 0, revenue: 0 };
       existing.quantity += item.quantity;
       existing.revenue += parseFloat(item.origina lTotalSet.shopMoney.amount);
      productMap .set(item.title, existing);
    }
  }

  cons t averageOrderValue = totalOrders > 0 ? total Revenue / totalOrders : 0;
  const dailyOrder s = Array.from(dailyMap.values()).sort((a, b)  => a.date.localeCompare(b.date));
  const to pProducts = Array.from(productMap.values()).s ort((a, b) => b.revenue - a.revenue).slice(0,  10);

  interface ProductNode {
    title: s tring;
    variants: { edges: { node: { title : string; inventoryQuantity: number } }[] };
   }

  const lowStock: { title: string; varia nt: string; quantity: number }[] = [];
  for  (const edge of (lowStockData.data?.products?. edges || [])) {
    const p = edge.node as Pr oductNode;
    for (const v of (p.variants?.e dges || [])) {
      if (v.node.inventoryQuan tity < 5) {
        lowStock.push({
           title: p.title,
          variant: v.node.ti tle !== 'Default Title' ? v.node.title : '',
           quantity: v.node.inventoryQuantity, 
        });
      }
    }
  }
  lowStock.sor t((a, b) => a.quantity - b.quantity);

  retu rn res.status(200).json({
    summary: {
       totalOrders, totalRevenue: Math.round(total Revenue * 100) / 100,
      averageOrderValue : Math.round(averageOrderValue * 100) / 100,  totalItemsSold,
    },
    b2b: {
      total Orders: b2bOrders, totalRevenue: Math.round(b 2bRevenue * 100) / 100,
      averageOrderVal ue: b2bOrders > 0 ? Math.round(b2bRevenue / b 2bOrders * 100) / 100 : 0,
    },
    b2c: {
       totalOrders: b2cOrders, totalRevenue: M ath.round(b2cRevenue * 100) / 100,
      aver ageOrderValue: b2cOrders > 0 ? Math.round(b2c Revenue / b2cOrders * 100) / 100 : 0,
    },
     dailyOrders, topProducts, lowStock, curre ncy,
  });
}

// ─── GA Handlers ── ─

async function handleGAOverview(req: Ver celRequest, res: VercelResponse) {
  const ra nge = (req.query.range as string) || '7d';
   const dr = gaDateRange(range);

  const token  = await getGAAccessToken();
  if (!token) re turn res.status(200).json({ configured: false  });

  const [overviewReport, funnelReport,  channelReport, deviceReport] = await Promise. all([
    gaReport(token, {
      dateRanges:  [dr],
      metrics: [
        { name: 'sess ions' }, { name: 'totalUsers' }, { name: 'new Users' },
        { name: 'bounceRate' }, { n ame: 'userEngagementDuration' }, { name: 'con versions' },
      ],
    }),
    gaReport(to ken, {
      dateRanges: [dr],
      dimensio ns: [{ name: 'eventName' }],
      metrics: [ { name: 'eventCount' }],
      dimensionFilte r: {
        filter: {
          fieldName: ' eventName',
          inListFilter: { values:  ['view_item', 'add_to_cart', 'begin_checkout ', 'purchase'] },
        },
      },
    }), 
    gaReport(token, {
      dateRanges: [dr] ,
      dimensions: [{ name: 'sessionDefaultC hannelGroup' }],
      metrics: [{ name: 'ses sions' }],
      orderBys: [{ metric: { metri cName: 'sessions' }, desc: true }],
      lim it: 7,
    }),
    gaReport(token, {
      da teRanges: [dr],
      dimensions: [{ name: 'd eviceCategory' }],
      metrics: [{ name: 's essions' }],
    }),
  ]);

  const ov = gaRo ws(overviewReport)[0] || {};
  const sessions  = parseInt(ov.sessions || '0');
  const tota lUsers = parseInt(ov.totalUsers || '0');
  co nst newUsers = parseInt(ov.newUsers || '0');
   const bounceRate = Math.round(parseFloat(ov .bounceRate || '0') * 1000) / 10;
  const eng agementSec = Math.round(parseFloat(ov.userEng agementDuration || '0') / Math.max(sessions,  1));
  const conversions = parseInt(ov.conver sions || '0');
  const conversionRate = sessi ons > 0 ? Math.round(conversions / sessions *  1000) / 10 : 0;

  const funnelMap: Record<s tring, number> = {};
  for (const r of gaRows (funnelReport)) funnelMap[r.eventName] = pars eInt(r.eventCount || '0');

  const baseCount  = funnelMap.view_item || funnelMap.add_to_ca rt || 1;
  const funnelSteps = [
    { name:  'PDP 조회', count: funnelMap.view_item || 0 , rate: 1 },
    { name: '장바구니 추가 ', count: funnelMap.add_to_cart || 0, rate: b aseCount > 0 ? funnelMap.add_to_cart / baseCo unt : 0 },
    { name: '결제 시작', count : funnelMap.begin_checkout || 0, rate: baseCo unt > 0 ? funnelMap.begin_checkout / baseCoun t : 0 },
    { name: '구매 완료', count:  funnelMap.purchase || 0, rate: baseCount > 0  ? funnelMap.purchase / baseCount : 0 },
  ];
 
  const channelRows = gaRows(channelReport); 
  const deviceRows = gaRows(deviceReport);
   const totalDevSessions = deviceRows.reduce(( s, r) => s + parseInt(r.sessions || '0'), 0); 

  return res.status(200).json({
    configu red: true,
    sessions, totalUsers, newUsers , bounceRate, avgEngagementTime: engagementSe c,
    conversionRate, funnelSteps,
    topCh annels: channelRows.map(r => ({
      channel : r.sessionDefaultChannelGroup || '(direct)', 
      sessions: parseInt(r.sessions || '0'), 
    })),
    deviceBreakdown: deviceRows.map (r => ({
      device: r.deviceCategory,
       sessions: parseInt(r.sessions || '0'),
       percentage: totalDevSessions > 0 ? Math.rou nd(parseInt(r.sessions || '0') / totalDevSess ions * 100) : 0,
    })),
  });
}

async func tion handleGAFunnel(req: VercelRequest, res:  VercelResponse) {
  const range = (req.query. range as string) || '7d';
  const dr = gaDate Range(range);

  const token = await getGAAcc essToken();
  if (!token) return res.status(2 00).json({ configured: false });

  const [by DateReport, bySourceReport] = await Promise.a ll([
    gaReport(token, {
      dateRanges:  [dr],
      dimensions: [{ name: 'date' }, {  name: 'eventName' }],
      metrics: [{ name:  'eventCount' }],
      dimensionFilter: {
         filter: {
          fieldName: 'eventNa me',
          inListFilter: { values: ['view _item', 'add_to_cart', 'begin_checkout', 'pur chase'] },
        },
      },
      orderBys : [{ dimension: { dimensionName: 'date' } }], 
    }),
    gaReport(token, {
      dateRang es: [dr],
      dimensions: [{ name: 'session Source' }, { name: 'sessionMedium' }],
       metrics: [{ name: 'sessions' }, { name: 'conv ersions' }],
      orderBys: [{ metric: { met ricName: 'sessions' }, desc: true }],
      l imit: 10,
    }),
  ]);

  const dateEventMap  = new Map<string, Record<string, number>>(); 
  for (const row of gaRows(byDateReport)) {
     const d = row.date;
    const ex = dateEv entMap.get(d) || {};
    ex[row.eventName] =  parseInt(row.eventCount || '0');
    dateEven tMap.set(d, ex);
  }

  const byDate = Array. from(dateEventMap.entries())
    .sort(([a],  [b]) => a.localeCompare(b))
    .map(([date,  ev]) => ({
      date: `${date.slice(4, 6)}/$ {date.slice(6, 8)}`,
      views: ev.view_ite m || 0,
      addToCart: ev.add_to_cart || 0, 
      checkout: ev.begin_checkout || 0,
       purchases: ev.purchase || 0,
    }));

  co nst bySource = gaRows(bySourceReport).map(r = > ({
    source: r.sessionSource,
    medium:  r.sessionMedium,
    sessions: parseInt(r.se ssions || '0'),
    conversions: parseInt(r.c onversions || '0'),
    rate: parseInt(r.sess ions || '1') > 0
      ? Math.round(parseInt( r.conversions || '0') / parseInt(r.sessions | | '1') * 1000) / 10
      : 0,
  }));

  retu rn res.status(200).json({ configured: true, b yDate, bySource });
}

async function handleG ABehavior(req: VercelRequest, res: VercelResp onse) {
  const range = (req.query.range as s tring) || '7d';
  const dr = gaDateRange(rang e);

  const token = await getGAAccessToken() ;
  if (!token) return res.status(200).json({  configured: false });

  const [pagesReport,  eventsReport, deviceReport, landingReport] =  await Promise.all([
    gaReport(token, {
       dateRanges: [dr],
      dimensions: [{ na me: 'pagePath' }],
      metrics: [
        {  name: 'screenPageViews' }, { name: 'sessions ' },
        { name: 'bounceRate' }, { name:  'averageSessionDuration' },
      ],
      or derBys: [{ metric: { metricName: 'screenPageV iews' }, desc: true }],
      limit: 20,
     }),
    gaReport(token, {
      dateRanges: [ dr],
      dimensions: [{ name: 'eventName' } ],
      metrics: [{ name: 'eventCount' }, {  name: 'totalUsers' }],
      orderBys: [{ met ric: { metricName: 'eventCount' }, desc: true  }],
      limit: 15,
      dimensionFilter:  {
        notExpression: {
          filter:  {
            fieldName: 'eventName',
             inListFilter: { values: ['page_view', 's ession_start', 'user_engagement', 'first_visi t'] },
          },
        },
      },
    } ),
    gaReport(token, {
      dateRanges: [d r],
      dimensions: [{ name: 'deviceCategor y' }],
      metrics: [{ name: 'sessions' },  { name: 'bounceRate' }, { name: 'averageSessi onDuration' }],
    }),
    gaReport(token, { 
      dateRanges: [dr],
      dimensions: [{  name: 'landingPagePlusQueryString' }],
       metrics: [{ name: 'sessions' }, { name: 'bou nceRate' }],
      orderBys: [{ metric: { met ricName: 'sessions' }, desc: true }],
      l imit: 10,
    }),
  ]);

  const deviceRows =  gaRows(deviceReport);
  const totalDevSessio ns = deviceRows.reduce((s, r) => s + parseInt (r.sessions || '0'), 0);

  const truncate =  (s: string, n = 60) => s.length > n ? s.slice (0, n) + '…' : s;

  return res.status(200) .json({
    configured: true,
    topPages: g aRows(pagesReport).map(r => ({
      path: tr uncate(r.pagePath),
      views: parseInt(r.s creenPageViews || '0'),
      sessions: parse Int(r.sessions || '0'),
      bounceRate: Mat h.round(parseFloat(r.bounceRate || '0') * 100 0) / 10,
      avgTime: Math.round(parseFloat (r.averageSessionDuration || '0')),
    })),
     topEvents: gaRows(eventsReport).map(r =>  ({
      name: r.eventName,
      count: pars eInt(r.eventCount || '0'),
      users: parse Int(r.totalUsers || '0'),
    })),
    device Breakdown: deviceRows.map(r => ({
      devic e: r.deviceCategory,
      sessions: parseInt (r.sessions || '0'),
      bounceRate: Math.r ound(parseFloat(r.bounceRate || '0') * 1000)  / 10,
      avgTime: Math.round(parseFloat(r. averageSessionDuration || '0')),
      percen tage: totalDevSessions > 0
        ? Math.rou nd(parseInt(r.sessions || '0') / totalDevSess ions * 100) : 0,
    })),
    topLandingPages : gaRows(landingReport).map(r => ({
      pat h: truncate(r.landingPagePlusQueryString),
       sessions: parseInt(r.sessions || '0'),
       bounceRate: Math.round(parseFloat(r.bounc eRate || '0') * 1000) / 10,
    })),
  });
}
 
async function handleGAWeekly(shopifyToken:  string, res: VercelResponse) {
  const now =  new Date();
  const dow = now.getUTCDay();
   const daysFromMon = dow === 0 ? 6 : dow - 1;
 
  const thisMonday = new Date(Date.UTC(now.g etUTCFullYear(), now.getUTCMonth(), now.getUT CDate() - daysFromMon));
  const lastMonday =  new Date(thisMonday);
  lastMonday.setUTCDat e(lastMonday.getUTCDate() - 7);
  const lastS unday = new Date(thisMonday);
  lastSunday.se tUTCDate(lastSunday.getUTCDate() - 1);

  con st fmt = (d: Date) => d.toISOString().slice(0 , 10);

  const [shopifyCurrent, shopifyPrev,  gaToken] = await Promise.all([
    adminGrap hQL(shopifyToken, DASHBOARD_ORDERS_QUERY, {
       query: `created_at:>='${thisMonday.toISO String()}' financial_status:paid`,
    }),
     adminGraphQL(shopifyToken, DASHBOARD_ORDERS _QUERY, {
      query: `created_at:>='${lastM onday.toISOString()}' created_at:<'${thisMond ay.toISOString()}' financial_status:paid`,
     }),
    getGAAccessToken(),
  ]);

  const  calcShopify = (edges: { node: { createdAt: st ring; totalPriceSet: { shopMoney: { amount: s tring; currencyCode: string } } } }[]) => {
     const revenue = edges.reduce((s, e) => s +  parseFloat(e.node.totalPriceSet.shopMoney.am ount), 0);
    const currency = edges[0]?.nod e?.totalPriceSet?.shopMoney?.currencyCode ||  'USD';
    const dailyMap = new Map<string, {  date: string; revenue: number; orders: numbe r }>();
    for (const e of edges) {
      co nst d = e.node.createdAt.slice(0, 10);
       const ex = dailyMap.get(d) || { date: d, reve nue: 0, orders: 0 };
      ex.revenue += pars eFloat(e.node.totalPriceSet.shopMoney.amount) ;
      ex.orders++;
      dailyMap.set(d, ex );
    }
    return {
      orders: edges.len gth,
      revenue: Math.round(revenue * 100)  / 100,
      currency,
      daily: Array.fr om(dailyMap.values()).sort((a, b) => a.date.l ocaleCompare(b.date)),
    };
  };

  const c urrShopify = calcShopify(shopifyCurrent.data? .orders?.edges || []);
  const prevShopify =  calcShopify(shopifyPrev.data?.orders?.edges | | []);

  let gaConfigured = false;
  let gaC urrentWeek = { sessions: 0, newUsers: 0, conv ersions: 0, conversionRate: 0 };
  let gaPrev Week = { sessions: 0, newUsers: 0, conversion s: 0, conversionRate: 0 };

  if (gaToken) {
     gaConfigured = true;
    const [gaCurr, g aPrev] = await Promise.all([
      gaReport(g aToken, {
        dateRanges: [{ startDate: f mt(thisMonday), endDate: 'today' }],
         metrics: [{ name: 'sessions' }, { name: 'newU sers' }, { name: 'conversions' }],
      }),
       gaReport(gaToken, {
        dateRanges:  [{ startDate: fmt(lastMonday), endDate: fmt( lastSunday) }],
        metrics: [{ name: 'se ssions' }, { name: 'newUsers' }, { name: 'con versions' }],
      }),
    ]);

    const cr  = gaRows(gaCurr)[0] || {};
    const pr = ga Rows(gaPrev)[0] || {};

    const cSess = par seInt(cr.sessions || '0');
    const pSess =  parseInt(pr.sessions || '0');
    gaCurrentWe ek = {
      sessions: cSess, newUsers: parse Int(cr.newUsers || '0'),
      conversions: p arseInt(cr.conversions || '0'),
      convers ionRate: cSess > 0 ? Math.round(parseInt(cr.c onversions || '0') / cSess * 1000) / 10 : 0,
     };
    gaPrevWeek = {
      sessions: pSe ss, newUsers: parseInt(pr.newUsers || '0'),
       conversions: parseInt(pr.conversions ||  '0'),
      conversionRate: pSess > 0 ? Math. round(parseInt(pr.conversions || '0') / pSess  * 1000) / 10 : 0,
    };
  }

  const pct =  (cur: number, prev: number): number | null => 
    prev === 0 ? null : Math.round((cur - pr ev) / prev * 1000) / 10;

  return res.status (200).json({
    gaConfigured,
    currentWee k: {
      start: fmt(thisMonday), end: fmt(n ow), currency: currShopify.currency,
      re venue: currShopify.revenue, orders: currShopi fy.orders,
      sessions: gaCurrentWeek.sess ions, newUsers: gaCurrentWeek.newUsers,
       conversions: gaCurrentWeek.conversions, conv ersionRate: gaCurrentWeek.conversionRate,
       daily: currShopify.daily,
    },
    previ ousWeek: {
      start: fmt(lastMonday), end:  fmt(lastSunday), currency: prevShopify.curre ncy,
      revenue: prevShopify.revenue, orde rs: prevShopify.orders,
      sessions: gaPre vWeek.sessions, newUsers: gaPrevWeek.newUsers ,
      conversions: gaPrevWeek.conversions,  conversionRate: gaPrevWeek.conversionRate,
     },
    delta: {
      revenue: pct(currShop ify.revenue, prevShopify.revenue),
      orde rs: pct(currShopify.orders, prevShopify.order s),
      sessions: pct(gaCurrentWeek.session s, gaPrevWeek.sessions),
      newUsers: pct( gaCurrentWeek.newUsers, gaPrevWeek.newUsers), 
      conversionRate: pct(gaCurrentWeek.conv ersionRate, gaPrevWeek.conversionRate),
    } ,
  });
}


// ─── GA Retention Handler  ───

async function handleGARetention( req: VercelRequest, res: VercelResponse) {
   const range = (req.query.range as string) ||  '7d';
  const dr = gaDateRange(range);

  con st token = await getGAAccessToken();
  if (!t oken) return res.status(200).json({ configure d: false });

  const [breakdownReport, trend Report] = await Promise.all([
    gaReport(to ken, {
      dateRanges: [dr],
      dimensio ns: [{ name: 'newVsReturning' }],
      metri cs: [{ name: 'sessions' }, { name: 'totalUser s' }, { name: 'conversions' }],
    }),
    g aReport(token, {
      dateRanges: [dr],
       dimensions: [{ name: 'date' }, { name: 'new VsReturning' }],
      metrics: [{ name: 'ses sions' }],
      orderBys: [{ dimension: { di mensionName: 'date' } }],
    }),
  ]);

  co nst breakdownRows = gaRows(breakdownReport);
   const totalSessions = breakdownRows.reduce( (s, r) => s + parseInt(r.sessions || '0'), 0) ;

  const breakdown = breakdownRows.map(r =>  ({
    type: r.newVsReturning === 'new' ? '� ��규' : '재방문',
    sessions: parseInt( r.sessions || '0'),
    users: parseInt(r.tot alUsers || '0'),
    conversions: parseInt(r. conversions || '0'),
    percentage: totalSes sions > 0 ? Math.round(parseInt(r.sessions ||  '0') / totalSessions * 100) : 0,
    convers ionRate: parseInt(r.sessions || '0') > 0
       ? Math.round(parseInt(r.conversions || '0')  / parseInt(r.sessions || '0') * 1000) / 10
       : 0,
  }));

  const dateMap = new Map<s tring, { new: number; returning: number }>(); 
  for (const row of gaRows(trendReport)) {
     const d = row.date;
    const ex = dateMap .get(d) || { new: 0, returning: 0 };
    if ( row.newVsReturning === 'new') ex.new += parse Int(row.sessions || '0');
    else ex.returni ng += parseInt(row.sessions || '0');
    date Map.set(d, ex);
  }

  const trend = Array.fr om(dateMap.entries())
    .sort(([a], [b]) =>  a.localeCompare(b))
    .map(([date, v]) =>  ({
      date: `${date.slice(4, 6)}/${date.sl ice(6, 8)}`,
      신규: v.new,
      재� �문: v.returning,
    }));

  return res.sta tus(200).json({ configured: true, breakdown,  trend });
}
// ─── Router ───

ex port default async function handler(req: Verc elRequest, res: VercelResponse) {
  const ori gin = req.headers.origin || '';
  const corsO rigin = ALLOWED_ORIGINS.includes(origin) ? or igin : ALLOWED_ORIGINS[0];
  res.setHeader('A ccess-Control-Allow-Origin', corsOrigin);
  r es.setHeader('Access-Control-Allow-Methods',  'GET, OPTIONS');
  res.setHeader('Access-Cont rol-Allow-Headers', 'Content-Type, Authorizat ion');

  if (req.method === 'OPTIONS') retur n res.status(200).end();
  if (req.method !==  'GET') return res.status(405).json({ error:  'Method not allowed' });

  if (!ADMIN_SECRET  || req.headers.authorization !== `Bearer ${A DMIN_SECRET}`) {
    return res.status(401).j son({ error: 'Unauthorized' });
  }

  const  section = (req.query.section as string) || 'o verview';

  try {
    if (section === 'ga-ov erview') return await handleGAOverview(req, r es);
    if (section === 'ga-funnel') return  await handleGAFunnel(req, res);
    if (secti on === 'ga-behavior') return await handleGABe havior(req, res);
    if (section === 'ga-ret ention') return await handleGARetention(req,  res);

    const token = await getShopifyAcce ssToken();

    if (section === 'overview') r eturn await handleOverview(token, res);
    i f (section === 'dashboard') return await hand leDashboard(token, req, res);
    if (section  === 'orders') return await handleOrders(toke n, req, res);
    if (section === 'products')  return await handleProducts(token, req, res) ;
    if (section === 'customers') return awa it handleCustomers(token, req, res);
    if ( section === 'ga-weekly') return await handleG AWeekly(token, res);

    return res.status(4 00).json({ error: `Unknown section: ${section }` });
  } catch (error) {
    console.error( `[AdminManage:${section}]`, error);
    retur n res.status(500).json({
      error: 'Failed  to fetch data',
      message: error instanc eof Error ? error.message : 'Unknown error',
     });
  }
}

 