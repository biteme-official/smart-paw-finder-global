import type { VercelRequest, VercelResponse }  from '@vercel/node';
import { createSign } f rom 'crypto';

const GA4_PROPERTY_ID = proces s.env.GA4_PROPERTY_ID || '';
const GOOGLE_SER VICE_ACCOUNT_JSON = process.env.GOOGLE_SERVIC E_ACCOUNT_JSON || '';
const _VERCEL_ENV = pro cess.env.VERCEL_ENV || 'development';
const A DMIN_SECRET = process.env.ADMIN_SECRET || (_V ERCEL_ENV !== 'production' ? 'preview' : ''); 

const ALLOWED_ORIGINS = [
  'https://biteme .one',
  'https://www.biteme.one',
  'http:// localhost:5173',
];

// ─── GA4 Auth � �──

let ga4Token: string | null = null;
 let ga4TokenExpiresAt = 0;

async function ge tGA4AccessToken(): Promise<string> {
  const  now = Date.now();
  if (ga4Token && now < ga4 TokenExpiresAt - 60_000) return ga4Token;

   const sa = JSON.parse(GOOGLE_SERVICE_ACCOUNT_ JSON);
  const iat = Math.floor(now / 1000);
   const exp = iat + 3600;

  const header = B uffer.from(JSON.stringify({ alg: 'RS256', typ : 'JWT' })).toString('base64url');
  const pa yload = Buffer.from(JSON.stringify({
    iss:  sa.client_email,
    scope: 'https://www.goo gleapis.com/auth/analytics.readonly',
    aud : 'https://oauth2.googleapis.com/token',
     iat,
    exp,
  })).toString('base64url');

   const input = `${header}.${payload}`;
  cons t sign = createSign('RSA-SHA256');
  sign.upd ate(input);
  const jwt = `${input}.${sign.si gn(sa.private_key, 'base64url')}`;

  const r es = await fetch('https://oauth2.googleapis.c om/token', {
    method: 'POST',
    headers:  { 'Content-Type': 'application/x-www-form-ur lencoded' },
    body: new URLSearchParams({
       grant_type: 'urn:ietf:params:oauth:gran t-type:jwt-bearer',
      assertion: jwt,
     }),
  });

  if (!res.ok) throw new Error(`T oken error: ${(await res.text()).slice(0, 300 )}`);
  const data = await res.json();
  ga4T oken = data.access_token;
  ga4TokenExpiresAt  = now + data.expires_in * 1000;
  return ga4 Token!;
}

async function runReport(token: st ring, body: object) {
  const res = await fet ch(
    `https://analyticsdata.googleapis.com /v1beta/properties/${GA4_PROPERTY_ID}:runRepo rt`,
    {
      method: 'POST',
      header s: { Authorization: `Bearer ${token}`, 'Conte nt-Type': 'application/json' },
      body: J SON.stringify(body),
    }
  );
  if (!res.ok ) throw new Error(`GA4 error (${res.status}):  ${(await res.text()).slice(0, 300)}`);
  ret urn res.json();
}

interface GA4Report {
  di mensionHeaders: { name: string }[];
  metricH eaders: { name: string }[];
  rows?: { dimens ionValues?: { value: string }[]; metricValues ?: { value: string }[] }[];
}

function parse Rows(report: GA4Report): Record<string, strin g | number>[] {
  return (report.rows || []). map((row) => {
    const out: Record<string,  string | number> = {};
    row.dimensionValue s?.forEach((v, i) => { out[report.dimensionHe aders[i].name] = v.value; });
    row.metricV alues?.forEach((v, i) => { out[report.metricH eaders[i].name] = parseFloat(v.value) || 0; } );
    return out;
  });
}

// ─── Shop ify Admin Auth (shared by shopify + customer  handlers) ───

let shopifyToken: string  | null = null;
let shopifyTokenExpiresAt = 0 ;

async function getShopifyAccessToken(): Pr omise<string> {
  const now = Date.now();
  i f (shopifyToken && now < shopifyTokenExpiresA t - 5 * 60 * 1000) return shopifyToken;

  co nst shop = process.env.VITE_SHOPIFY_STORE_DOM AIN || '';
  const clientId = process.env.REP ORT_SHOPIFY_CLIENT_ID;
  const clientSecret =  process.env.REPORT_SHOPIFY_CLIENT_SECRET;
   if (!clientId || !clientSecret) throw new Err or('Missing REPORT_SHOPIFY_CLIENT_ID or REPOR T_SHOPIFY_CLIENT_SECRET');

  const res = awa it fetch(`https://${shop}/admin/oauth/access_ token`, {
    method: 'POST',
    headers: {  'Content-Type': 'application/x-www-form-urlen coded' },
    body: new URLSearchParams({ gra nt_type: 'client_credentials', client_id: cli entId, client_secret: clientSecret }),
  });
   if (!res.ok) throw new Error(`Token error ( ${res.status}): ${(await res.text()).slice(0,  300)}`);
  const data = await res.json();
   shopifyToken = data.access_token;
  shopifyTo kenExpiresAt = now + (data.expires_in || 3600 ) * 1000;
  return shopifyToken!;
}

async fu nction adminGraphQL(token: string, query: str ing, variables: Record<string, unknown> = {})  {
  const shop = process.env.VITE_SHOPIFY_ST ORE_DOMAIN || '';
  const res = await fetch(` https://${shop}/admin/api/2025-07/graphql.jso n`, {
    method: 'POST',
    headers: { 'Con tent-Type': 'application/json', 'X-Shopify-Ac cess-Token': token },
    body: JSON.stringif y({ query, variables }),
  });
  if (!res.ok)  throw new Error(`Admin API error (${res.stat us}): ${(await res.text()).slice(0, 300)}`);
   return res.json();
}

function toUTCDate(is oString: string): string {
  return new Date( isoString).toISOString().slice(0, 10);
}

fun ction getRangeStart(range: string): string {
   const now = new Date();
  const days: Recor d<string, number> = { today: 0, '7d': 6, '28d ': 27, '90d': 89 };
  const offset = days[ran ge] ?? 6;
  const start = new Date(Date.UTC(n ow.getUTCFullYear(), now.getUTCMonth(), now.g etUTCDate() - offset));
  return start.toISOS tring();
}

function parseDateRange(req: Verc elRequest) {
  const range = (req.query.range  as string) || '7d';
  const fromParam = req. query.from as string | undefined;
  const toP aram = req.query.to as string | undefined;
   const isCustom = range === 'custom' && !!from Param && !!toParam;
  return { range, fromPar am, toParam, isCustom };
}

// ─── GA4  Handler ───

async function handleGA4(r eq: VercelRequest, res: VercelResponse) {
  c onst { range, fromParam, toParam, isCustom }  = parseDateRange(req);

  let dateRange: { st artDate: string; endDate: string };
  if (isC ustom) {
    dateRange = { startDate: fromPar am!, endDate: toParam! };
  } else {
    cons t rangeMap: Record<string, string> = { today:  'today', '7d': '7daysAgo', '28d': '28daysAgo ', '90d': '90daysAgo' };
    const startDate  = rangeMap[range];
    if (!startDate) return  res.status(400).json({ error: 'Invalid range ' });
    dateRange = { startDate, endDate: ' today' };
  }

  if (!GA4_PROPERTY_ID || !GOO GLE_SERVICE_ACCOUNT_JSON) {
    return res.st atus(500).json({ error: 'GA4 not configured.  Set GA4_PROPERTY_ID and GOOGLE_SERVICE_ACCOUN T_JSON env vars.' });
  }

  const token = aw ait getGA4AccessToken();

  const [overviewRa w, funnelRaw, revenueRaw, pagesRaw, sourcesRa w, devicesRaw, itemViewsRaw, exitPagesRaw, so urcesByDateRaw, notSetLandingRaw, newVsReturn ingRaw] = await Promise.all([
    runReport(t oken, {
      dateRanges: [dateRange],
       metrics: [
        { name: 'sessions' }, { na me: 'activeUsers' }, { name: 'newUsers' },
         { name: 'bounceRate' }, { name: 'averag eSessionDuration' },
        { name: 'purchas eRevenue' }, { name: 'transactions' },
       ],
    }),
    runReport(token, {
      dateR anges: [dateRange],
      dimensions: [{ name : 'eventName' }],
      metrics: [{ name: 'ev entCount' }],
      dimensionFilter: {
         filter: { fieldName: 'eventName', inListFil ter: { values: ['view_item', 'add_to_cart', ' begin_checkout', 'purchase'] } },
      },
     }),
    runReport(token, {
      dateRanges : [dateRange],
      dimensions: [{ name: 'da te' }],
      metrics: [{ name: 'purchaseReve nue' }, { name: 'transactions' }, { name: 'se ssions' }, { name: 'activeUsers' }, { name: ' itemsViewed' }],
      orderBys: [{ dimension : { dimensionName: 'date' } }],
    }),
    r unReport(token, {
      dateRanges: [dateRang e],
      dimensions: [{ name: 'pagePath' }], 
      metrics: [{ name: 'screenPageViews' },  { name: 'activeUsers' }, { name: 'averageSes sionDuration' }],
      orderBys: [{ metric:  { metricName: 'screenPageViews' }, desc: true  }],
      limit: 10,
    }),
    runReport(t oken, {
      dateRanges: [dateRange],
       dimensions: [{ name: 'sessionSource' }, { nam e: 'sessionMedium' }],
      metrics: [{ name : 'sessions' }, { name: 'activeUsers' }, { na me: 'transactions' }, { name: 'purchaseRevenu e' }],
      orderBys: [{ metric: { metricNam e: 'sessions' }, desc: true }],
      limit:  15,
    }),
    runReport(token, {
      date Ranges: [dateRange],
      dimensions: [{ nam e: 'deviceCategory' }],
      metrics: [{ nam e: 'sessions' }],
      orderBys: [{ metric:  { metricName: 'sessions' }, desc: true }],
     }),
    runReport(token, {
      dateRanges : [dateRange],
      dimensions: [{ name: 'it emName' }],
      metrics: [{ name: 'itemsVie wed' }, { name: 'itemsAddedToCart' }],
       orderBys: [{ metric: { metricName: 'itemsView ed' }, desc: true }],
      limit: 50,
    }) ,
    runReport(token, {
      dateRanges: [d ateRange],
      dimensions: [{ name: 'pagePa th' }],
      metrics: [{ name: 'sessions' },  { name: 'bounceRate' }, { name: 'screenPageV iews' }, { name: 'averageSessionDuration' }], 
      orderBys: [{ metric: { metricName: 'se ssions' }, desc: true }],
      limit: 20,
     }),
    runReport(token, {
      dateRanges : [dateRange],
      dimensions: [{ name: 'da te' }, { name: 'sessionSource' }, { name: 'se ssionMedium' }],
      metrics: [{ name: 'ses sions' }, { name: 'activeUsers' }],
      ord erBys: [{ dimension: { dimensionName: 'date'  } }],
      limit: 2000,
    }),
    runRepor t(token, {
      dateRanges: [dateRange],
       dimensions: [{ name: 'date' }, { name: 'la ndingPage' }],
      metrics: [{ name: 'sessi ons' }, { name: 'activeUsers' }],
      dimen sionFilter: {
        andGroup: {
          e xpressions: [
            { filter: { fieldNa me: 'sessionSource', stringFilter: { matchTyp e: 'EXACT', value: '(not set)' } } },
             { filter: { fieldName: 'sessionMedium',  stringFilter: { matchType: 'EXACT', value: '( not set)' } } },
          ],
        },
       },
      orderBys: [{ dimension: { dimensio nName: 'date' } }],
      limit: 500,
    }), 
    runReport(token, {
      dateRanges: [da teRange],
      dimensions: [{ name: 'newVsRe turning' }],
      metrics: [{ name: 'activeU sers' }, { name: 'sessions' }],
    }),
  ]); 

  return res.status(200).json({
    overvie w: parseRows(overviewRaw)[0] || {},
    funne l: parseRows(funnelRaw),
    revenueOverTime:  parseRows(revenueRaw),
    topPages: parseRo ws(pagesRaw),
    trafficSources: parseRows(s ourcesRaw),
    devices: parseRows(devicesRaw ),
    itemViews: parseRows(itemViewsRaw),
     exitPages: parseRows(exitPagesRaw),
    tra fficSourcesOverTime: parseRows(sourcesByDateR aw),
    notSetLandingPages: parseRows(notSet LandingRaw),
    newVsReturning: parseRows(ne wVsReturningRaw),
  });
}

// ─── Shopi fy Orders Handler ───

const ORDERS_QUE RY = `
  query Orders($query: String!, $curso r: String) {
    orders(first: 250, query: $q uery, after: $cursor) {
      pageInfo { hasN extPage endCursor }
      edges {
        nod e {
          id
          createdAt
           totalPriceSet { shopMoney { amount currency Code } }
          lineItems(first: 50) {
             edges {
              node {
                 title
                quantity
                 product { id }
                ori ginalTotalSet { shopMoney { amount } }
               }
            }
          }
        } 
      }
    }
  }
`;

const LOW_STOCK_QUERY  = `
  query LowStock {
    productVariants(fi rst: 100, query: "inventory_quantity:<5 AND i nventory_quantity:>=0") {
      edges {
         node {
          title
          inventory Quantity
          product { title }
         }
      }
    }
  }
`;

interface OrderEdge { 
  node: {
    id: string;
    createdAt: str ing;
    totalPriceSet: { shopMoney: { amount : string; currencyCode?: string } };
    line Items: {
      edges: { node: { title: string ; quantity: number; product: { id: string } |  null; originalTotalSet: { shopMoney: { amoun t: string } } } }[];
    };
  };
}

async fun ction fetchAllOrders(token: string, rangeStar t: string): Promise<OrderEdge[]> {
  const fi lterQuery = `created_at:>='${rangeStart}' AND  financial_status:paid`;
  const all: OrderEd ge[] = [];
  let cursor: string | null = null ;

  do {
    const data = await adminGraphQL (token, ORDERS_QUERY, { query: filterQuery, c ursor });
    const edges: OrderEdge[] = data .data?.orders?.edges || [];
    all.push(...e dges);
    cursor = data.data?.orders?.pageIn fo?.hasNextPage
      ? data.data?.orders?.pa geInfo?.endCursor
      : null;
  } while (cu rsor && all.length < 1000);

  return all;
}
 
async function handleShopify(req: VercelRequ est, res: VercelResponse) {
  const { range,  fromParam, toParam, isCustom } = parseDateRan ge(req);

  if (!isCustom && !['today', '7d',  '28d', '90d'].includes(range)) {
    return  res.status(400).json({ error: 'Invalid range'  });
  }

  const token = await getShopifyAcc essToken();
  const rangeStart = isCustom ? n ew Date(`${fromParam}T00:00:00Z`).toISOString () : getRangeStart(range);

  const [orders,  lowStockData] = await Promise.all([
    fetch AllOrders(token, rangeStart),
    adminGraphQ L(token, LOW_STOCK_QUERY),
  ]);

  const dai lyMap = new Map<string, { orders: number; rev enue: number }>();
  const productMap = new M ap<string, { title: string; quantity: number;  revenue: number }>();
  let totalRevenue = 0 ;
  let totalItems = 0;

  for (const edge of  orders) {
    const date = toUTCDate(edge.no de.createdAt);
    const rev = parseFloat(edg e.node.totalPriceSet.shopMoney.amount);
    t otalRevenue += rev;

    const day = dailyMap .get(date) || { orders: 0, revenue: 0 };
     day.orders += 1;
    day.revenue += rev;
     dailyMap.set(date, day);

    for (const item  of edge.node.lineItems.edges) {
      const  productId = item.node.product?.id ?? `title:$ {item.node.title}`;
      const qty = item.no de.quantity;
      const itemRev = parseFloat (item.node.originalTotalSet.shopMoney.amount) ;
      totalItems += qty;
      const existi ng = productMap.get(productId) || { title: it em.node.title, quantity: 0, revenue: 0 };
       existing.quantity += qty;
      existing.r evenue += itemRev;
      productMap.set(produ ctId, existing);
    }
  }

  const now = new  Date();
  const todayStr = now.toISOString() .slice(0, 10);
  const dailyOrders: { date: s tring; orders: number; revenue: number }[] =  [];

  if (isCustom) {
    const cur = new Da te(fromParam!);
    const end = new Date(toPa ram! <= todayStr ? toParam! : todayStr);
     while (cur <= end) {
      const dateStr = cu r.toISOString().slice(0, 10);
      const ent ry = dailyMap.get(dateStr) || { orders: 0, re venue: 0 };
      dailyOrders.push({ date: da teStr, orders: entry.orders, revenue: Math.ro und(entry.revenue * 100) / 100 });
      cur. setDate(cur.getDate() + 1);
    }
  } else {
     const days: Record<string, number> = { to day: 0, '7d': 6, '28d': 27, '90d': 89 };
     const offset = days[range] ?? 6;
    for (let  i = offset; i >= 0; i--) {
      const d = n ew Date(Date.UTC(now.getUTCFullYear(), now.ge tUTCMonth(), now.getUTCDate() - i));
      co nst dateStr = d.toISOString().slice(0, 10);
       const entry = dailyMap.get(dateStr) || {  orders: 0, revenue: 0 };
      dailyOrders.p ush({ date: dateStr, orders: entry.orders, re venue: Math.round(entry.revenue * 100) / 100  });
    }
  }

  const topProducts = Array.fr om(productMap.entries())
    .map(([productId , d]) => ({ productId, title: d.title, quanti ty: d.quantity, revenue: Math.round(d.revenue  * 100) / 100 }))
    .sort((a, b) => b.reven ue - a.revenue)
    .slice(0, 10);

  const l owStock = (lowStockData.data?.productVariants ?.edges || [])
    .map((e: { node: { product : { title: string }; title: string; inventory Quantity: number } }) => ({
      title: e.no de.product.title,
      variant: e.node.title  === 'Default Title' ? '' : e.node.title,
       quantity: e.node.inventoryQuantity,
    }) )
    .sort((a: { quantity: number }, b: { qu antity: number }) => a.quantity - b.quantity) ;

  const currency = orders[0]?.node?.totalP riceSet?.shopMoney?.currencyCode || 'USD';

   return res.status(200).json({
    summary: { 
      totalOrders: orders.length,
      tota lRevenue: Math.round(totalRevenue * 100) / 10 0,
      averageOrderValue: orders.length > 0  ? Math.round((totalRevenue / orders.length)  * 100) / 100 : 0,
      totalItemsSold: total Items,
      currency,
    },
    dailyOrders ,
    topProducts,
    lowStock,
  });
}

//  ─── Customer Handler ───

const S EGMENT_COUNTS_QUERY = `
  query CustomerSegme nts {
    total: customersCount { count }
     noOrders: customersCount(query: "orders_coun t:=0") { count }
    oneOrder: customersCount (query: "orders_count:=1") { count }
    four PlusOrders: customersCount(query: "orders_cou nt:>=4") { count }
  }
`;

const NEW_CUSTOMER S_QUERY = `
  query NewCustomers($query: Stri ng!, $cursor: String) {
    customers(first:  250, query: $query, after: $cursor) {
      p ageInfo { hasNextPage endCursor }
      edges  {
        node {
          id
          crea tedAt
          numberOfOrders
          amou ntSpent { amount currencyCode }
        }
       }
    }
  }
`;

interface CustomerEdge {
   node: {
    id: string;
    createdAt: strin g;
    numberOfOrders: number;
    amountSpen t: { amount: string; currencyCode?: string }; 
  };
}

async function fetchNewCustomers(tok en: string, rangeStart: string): Promise<Cust omerEdge[]> {
  const filterQuery = `created_ at:>='${rangeStart}'`;
  const all: CustomerE dge[] = [];
  let cursor: string | null = nul l;

  do {
    const data = await adminGraphQ L(token, NEW_CUSTOMERS_QUERY, { query: filter Query, cursor });
    const edges: CustomerEd ge[] = data.data?.customers?.edges || [];
     all.push(...edges);
    cursor = data.data?. customers?.pageInfo?.hasNextPage
      ? data .data?.customers?.pageInfo?.endCursor
      :  null;
  } while (cursor && all.length < 2000 );

  return all;
}

async function handleCus tomer(req: VercelRequest, res: VercelResponse ) {
  const { range, fromParam, toParam, isCu stom } = parseDateRange(req);

  if (!isCusto m && !['today', '7d', '28d', '90d'].includes( range)) {
    return res.status(400).json({ e rror: 'Invalid range' });
  }

  const token  = await getShopifyAccessToken();
  const rang eStart = isCustom ? new Date(`${fromParam}T00 :00:00Z`).toISOString() : getRangeStart(range );

  const [segmentData, newCustomers] = awa it Promise.all([
    adminGraphQL(token, SEGM ENT_COUNTS_QUERY),
    fetchNewCustomers(toke n, rangeStart),
  ]);

  const total = segmen tData.data?.total?.count ?? 0;
  const noOrde rs = segmentData.data?.noOrders?.count ?? 0;
   const oneOrder = segmentData.data?.oneOrder ?.count ?? 0;
  const fourPlusOrders = segmen tData.data?.fourPlusOrders?.count ?? 0;
  con st twoThreeOrders = Math.max(0, total - noOrd ers - oneOrder - fourPlusOrders);
  const pur chasedCustomers = oneOrder + twoThreeOrders +  fourPlusOrders;
  const repeatCustomers = tw oThreeOrders + fourPlusOrders;

  const now =  new Date();
  const todayStr = now.toISOStri ng().slice(0, 10);
  const dailyMap = new Map <string, number>();
  for (const edge of newC ustomers) {
    const date = toUTCDate(edge.n ode.createdAt);
    dailyMap.set(date, (daily Map.get(date) || 0) + 1);
  }

  const dailyN ewCustomers: { date: string; count: number }[ ] = [];
  if (isCustom) {
    const cur = new  Date(fromParam!);
    const end = new Date(t oParam! <= todayStr ? toParam! : todayStr);
     while (cur <= end) {
      const dateStr =  cur.toISOString().slice(0, 10);
      dailyN ewCustomers.push({ date: dateStr, count: dail yMap.get(dateStr) || 0 });
      cur.setDate( cur.getDate() + 1);
    }
  } else {
    cons t days: Record<string, number> = { today: 0,  '7d': 6, '28d': 27, '90d': 89 };
    const of fset = days[range] ?? 6;
    for (let i = off set; i >= 0; i--) {
      const d = new Date( Date.UTC(now.getUTCFullYear(), now.getUTCMont h(), now.getUTCDate() - i));
      const date Str = d.toISOString().slice(0, 10);
      dai lyNewCustomers.push({ date: dateStr, count: d ailyMap.get(dateStr) || 0 });
    }
  }

  co nst purchasedNew = newCustomers.filter(e => e .node.numberOfOrders > 0);
  const avgNewLTV  = purchasedNew.length > 0
    ? Math.round(pu rchasedNew.reduce((s, e) => s + parseFloat(e. node.amountSpent.amount), 0) * 100 / purchase dNew.length) / 100
    : 0;

  const currency  = newCustomers[0]?.node?.amountSpent?.curren cyCode || 'USD';

  res.setHeader('Cache-Cont rol', 's-maxage=300, stale-while-revalidate') ;
  return res.status(200).json({
    totalCu stomers: total,
    newCustomersCount: newCus tomers.length,
    repeatCustomers,
    repea tRate: purchasedCustomers > 0 ? repeatCustome rs / purchasedCustomers : 0,
    segments: {  noOrders, oneOrder, twoThreeOrders, fourPlusO rders },
    avgNewLTV,
    dailyNewCustomers ,
    currency,
  });
}

// ─── Router  ───

export default async function hand ler(req: VercelRequest, res: VercelResponse)  {
  const origin = req.headers.origin || '';
   const corsOrigin = ALLOWED_ORIGINS.includes (origin) ? origin : ALLOWED_ORIGINS[0];
  res .setHeader('Access-Control-Allow-Origin', cor sOrigin);
  res.setHeader('Access-Control-All ow-Methods', 'GET, OPTIONS');
  res.setHeader ('Access-Control-Allow-Headers', 'Content-Typ e, Authorization');

  if (req.method === 'OP TIONS') return res.status(200).end();
  if (r eq.method !== 'GET') return res.status(405).j son({ error: 'Method not allowed' });

  if ( !ADMIN_SECRET || req.headers.authorization != = `Bearer ${ADMIN_SECRET}`) {
    return res. status(401).json({ error: 'Unauthorized' });
   }

  const type = req.query.type as string  | undefined;

  try {
    if (type === 'shopi fy') return await handleShopify(req, res);
     if (type === 'customer') return await handl eCustomer(req, res);
    return await handleG A4(req, res);
  } catch (error) {
    console .error(`[Analytics:${type || 'ga4'}]`, error) ;
    return res.status(500).json({
      err or: 'Failed to fetch analytics',
      messag e: error instanceof Error ? error.message : ' Unknown error',
    });
  }
}
 