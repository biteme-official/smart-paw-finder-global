import type { VercelRequest, VercelResponse } from '@vercel/node';

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || '';
const SLACK_ALERT_WEBHOOK_URL = process.env.SLACK_ALERT_WEBHOOK_URL || SLACK_WEBHOOK_URL;

let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt - 5 * 60 * 1000) {
    return cachedToken;
  }

  const shop = process.env.VITE_SHOPIFY_STORE_DOMAIN || 'lovable-project-lbgum.myshopify.com';
  const clientId = process.env.REPORT_SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.REPORT_SHOPIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Missing REPORT_SHOPIFY_CLIENT_ID or REPORT_SHOPIFY_CLIENT_SECRET');
  }

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
    throw new Error(`Token request failed (${response.status}): ${text.substring(0, 300)}`);
  }

  const data = await response.json();
  cachedToken = data.access_token;
  tokenExpiresAt = now + (data.expires_in || 3600) * 1000;
  return cachedToken!;
}

async function adminGraphQL(token: string, query: string, variables: Record<string, unknown> = {}) {
  const shop = process.env.VITE_SHOPIFY_STORE_DOMAIN || 'lovable-project-lbgum.myshopify.com';
  const response = await fetch(`https://${shop}/admin/api/2025-07/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': token,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Admin API error (${response.status}): ${text.substring(0, 300)}`);
  }

  return response.json();
}

function toJST(date: Date): Date {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000);
}

function formatJPY(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`;
}

function getDateRanges() {
  const nowUTC = new Date();
  const nowJST = toJST(nowUTC);

  // Today (JST)
  const todayStart = new Date(Date.UTC(
    nowJST.getUTCFullYear(), nowJST.getUTCMonth(), nowJST.getUTCDate()
  ));
  todayStart.setTime(todayStart.getTime() - 9 * 60 * 60 * 1000); // Convert back to UTC

  // Yesterday (JST)
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);

  // This week (Monday start, JST)
  const dayOfWeek = nowJST.getUTCDay();
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(todayStart.getTime() - mondayOffset * 24 * 60 * 60 * 1000);

  // This month (JST)
  const monthStart = new Date(Date.UTC(nowJST.getUTCFullYear(), nowJST.getUTCMonth(), 1));
  monthStart.setTime(monthStart.getTime() - 9 * 60 * 60 * 1000);

  return {
    today: todayStart.toISOString(),
    yesterday: yesterdayStart.toISOString(),
    weekStart: weekStart.toISOString(),
    monthStart: monthStart.toISOString(),
    now: nowUTC.toISOString(),
  };
}

interface OrderMetrics {
  count: number;
  revenue: number;
}

async function fetchOrderMetrics(token: string, createdAtMin: string, createdAtMax: string): Promise<OrderMetrics> {
  const query = `
    query OrderMetrics($query: String!) {
      orders(first: 250, query: $query) {
        edges {
          node {
            id
            totalPriceSet {
              shopMoney {
                amount
              }
            }
          }
        }
      }
    }
  `;

  const filterQuery = `created_at:>='${createdAtMin}' AND created_at:<='${createdAtMax}' AND financial_status:paid`;
  const data = await adminGraphQL(token, query, { query: filterQuery });

  const orders = data.data?.orders?.edges || [];
  const revenue = orders.reduce((sum: number, edge: { node: { totalPriceSet: { shopMoney: { amount: string } } } }) => {
    return sum + parseFloat(edge.node.totalPriceSet.shopMoney.amount);
  }, 0);

  return { count: orders.length, revenue };
}

async function fetchTopProducts(token: string, createdAtMin: string): Promise<Array<{ title: string; quantity: number; revenue: number }>> {
  const query = `
    query TopProducts($query: String!) {
      orders(first: 250, query: $query) {
        edges {
          node {
            lineItems(first: 50) {
              edges {
                node {
                  title
                  quantity
                  originalTotalSet {
                    shopMoney {
                      amount
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  const filterQuery = `created_at:>='${createdAtMin}' AND financial_status:paid`;
  const data = await adminGraphQL(token, query, { query: filterQuery });

  const productMap = new Map<string, { quantity: number; revenue: number }>();
  const orders = data.data?.orders?.edges || [];

  for (const order of orders) {
    for (const item of order.node.lineItems.edges) {
      const title = item.node.title;
      const existing = productMap.get(title) || { quantity: 0, revenue: 0 };
      existing.quantity += item.node.quantity;
      existing.revenue += parseFloat(item.node.originalTotalSet.shopMoney.amount);
      productMap.set(title, existing);
    }
  }

  return Array.from(productMap.entries())
    .map(([title, data]) => ({ title, ...data }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);
}

async function fetchLowStockProducts(token: string): Promise<Array<{ title: string; variant: string; quantity: number }>> {
  const query = `
    query LowStock {
      productVariants(first: 100, query: "inventory_quantity:<5 AND inventory_quantity:>=0") {
        edges {
          node {
            title
            inventoryQuantity
            product {
              title
            }
          }
        }
      }
    }
  `;

  const data = await adminGraphQL(token, query);
  const variants = data.data?.productVariants?.edges || [];

  return variants.map((edge: { node: { product: { title: string }; title: string; inventoryQuantity: number } }) => ({
    title: edge.node.product.title,
    variant: edge.node.title === 'Default Title' ? '' : edge.node.title,
    quantity: edge.node.inventoryQuantity,
  }));
}

function buildSlackMessage(
  today: OrderMetrics,
  yesterday: OrderMetrics,
  week: OrderMetrics,
  month: OrderMetrics,
  topProducts: Array<{ title: string; quantity: number; revenue: number }>,
  lowStock: Array<{ title: string; variant: string; quantity: number }>,
) {
  const nowJST = toJST(new Date());
  const dateStr = `${nowJST.getUTCFullYear()}/${String(nowJST.getUTCMonth() + 1).padStart(2, '0')}/${String(nowJST.getUTCDate()).padStart(2, '0')}`;

  const blocks: unknown[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `BITEME JAPAN 日次レポート (${dateStr})` },
    },
    { type: 'divider' },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*本日*\n${today.count}件 / ${formatJPY(today.revenue)}` },
        { type: 'mrkdwn', text: `*昨日*\n${yesterday.count}件 / ${formatJPY(yesterday.revenue)}` },
      ],
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*今週*\n${week.count}件 / ${formatJPY(week.revenue)}` },
        { type: 'mrkdwn', text: `*今月*\n${month.count}件 / ${formatJPY(month.revenue)}` },
      ],
    },
  ];

  // Today vs yesterday comparison
  if (yesterday.revenue > 0) {
    const revenueChange = ((today.revenue - yesterday.revenue) / yesterday.revenue * 100).toFixed(1);
    const arrow = today.revenue >= yesterday.revenue ? ':chart_with_upwards_trend:' : ':chart_with_downwards_trend:';
    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `${arrow} 前日比 売上 *${revenueChange}%*` }],
    });
  }

  // Top products this month
  if (topProducts.length > 0) {
    blocks.push({ type: 'divider' });
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: '*今月の売れ筋 TOP5*' },
    });

    const productLines = topProducts.map((p, i) =>
      `${i + 1}. ${p.title} — ${p.quantity}個 / ${formatJPY(p.revenue)}`
    ).join('\n');

    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: productLines },
    });
  }

  // Low stock alerts
  if (lowStock.length > 0) {
    blocks.push({ type: 'divider' });
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: ':warning: *在庫アラート (5個未満)*' },
    });

    const stockLines = lowStock.slice(0, 10).map(p => {
      const name = p.variant ? `${p.title} (${p.variant})` : p.title;
      const emoji = p.quantity === 0 ? ':red_circle:' : ':large_orange_circle:';
      return `${emoji} ${name} — 残り *${p.quantity}個*`;
    }).join('\n');

    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: stockLines },
    });
  }

  return { blocks };
}

async function sendToSlack(message: { blocks: unknown[] }) {
  const response = await fetch(SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Slack webhook failed (${response.status}): ${text}`);
  }
}

// ─── Health Check ────────────────────────────────────────────────────────────
const SITE_URL = 'https://www.biteme.one';
const KV_KEY = 'health-check:history';
const KV_DAILY_SENT_KEY = 'health-check:daily-sent';

async function kvGet(key: string): Promise<any> {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  try {
    const r = await fetch(`${url}/get/${key}`, { headers: { Authorization: `Bearer ${token}` } });
    const d = await r.json();
    return d.result ? JSON.parse(d.result) : null;
  } catch { return null; }
}

async function kvSet(key: string, value: any, exSeconds?: number): Promise<void> {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return;
  const args = exSeconds ? `/${key}/EX/${exSeconds}` : `/${key}`;
  await fetch(`${url}/set${args}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(JSON.stringify(value)),
  });
}

interface CheckResult { name: string; ok: boolean; status?: number; latencyMs: number; error?: string; }
interface HistoryEntry { timestamp: number; allOk: boolean; results: CheckResult[]; }

async function checkSiteAccess(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const r = await fetch(SITE_URL, { method: 'GET', redirect: 'follow' });
    return { name: 'Site Access', ok: r.ok, status: r.status, latencyMs: Date.now() - start, error: r.ok ? undefined : `HTTP ${r.status}` };
  } catch (e) { return { name: 'Site Access', ok: false, latencyMs: Date.now() - start, error: (e as Error).message }; }
}

async function checkStorefrontQuery(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const r = await fetch(`${SITE_URL}/api/shopify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: SITE_URL },
      body: JSON.stringify({ query: 'query { products(first: 1) { edges { node { id } } } }' }),
    });
    const d = await r.json();
    const ok = r.ok && d?.data?.products?.edges?.length > 0;
    return { name: 'Storefront Query', ok, status: r.status, latencyMs: Date.now() - start, error: ok ? undefined : (!r.ok ? `HTTP ${r.status}` : 'No products') };
  } catch (e) { return { name: 'Storefront Query', ok: false, latencyMs: Date.now() - start, error: (e as Error).message }; }
}

async function checkStorefrontMutation(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const listR = await fetch(`${SITE_URL}/api/shopify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: SITE_URL },
      body: JSON.stringify({ query: 'query { products(first: 1) { edges { node { variants(first: 1) { edges { node { id } } } } } } }' }),
    });
    const listD = await listR.json();
    const variantId = listD?.data?.products?.edges?.[0]?.node?.variants?.edges?.[0]?.node?.id;
    if (!variantId) return { name: 'Storefront Mutation', ok: false, latencyMs: Date.now() - start, error: 'No variant ID' };

    const r = await fetch(`${SITE_URL}/api/shopify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: SITE_URL },
      body: JSON.stringify({
        query: 'mutation cartCreate($input: CartInput!) { cartCreate(input: $input) { cart { id checkoutUrl } userErrors { message } } }',
        variables: { input: { lines: [{ quantity: 1, merchandiseId: variantId }] } },
      }),
    });
    const d = await r.json();
    const cart = d?.data?.cartCreate?.cart;
    const errs = d?.data?.cartCreate?.userErrors || [];
    const ok = r.ok && !!cart?.checkoutUrl && errs.length === 0;
    return { name: 'Storefront Mutation', ok, status: r.status, latencyMs: Date.now() - start, error: ok ? undefined : (errs[0]?.message || `HTTP ${r.status}`) };
  } catch (e) { return { name: 'Storefront Mutation', ok: false, latencyMs: Date.now() - start, error: (e as Error).message }; }
}

async function getMainAccessToken(): Promise<string> {
  const shop = process.env.VITE_SHOPIFY_STORE_DOMAIN || '';
  const clientId = process.env.VITE_SHOPIFY_CLIENT_ID || '';
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET || '';
  if (!clientId || !clientSecret) throw new Error('Missing VITE_SHOPIFY_CLIENT_ID or SHOPIFY_CLIENT_SECRET');
  const r = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }),
  });
  if (!r.ok) throw new Error(`Token failed: ${r.status}`);
  const d = await r.json();
  return d.access_token;
}

async function checkAdminApi(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const token = await getMainAccessToken();
    const shop = process.env.VITE_SHOPIFY_STORE_DOMAIN || '';
    const r = await fetch(`https://${shop}/admin/api/2025-07/graphql.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
      body: JSON.stringify({ query: '{ shop { name } }' }),
    });
    const d = await r.json();
    const ok = r.ok && !!d?.data?.shop?.name;
    return { name: 'Admin API', ok, status: r.status, latencyMs: Date.now() - start, error: ok ? undefined : `HTTP ${r.status}` };
  } catch (e) { return { name: 'Admin API', ok: false, latencyMs: Date.now() - start, error: (e as Error).message }; }
}

async function sendHealthAlert(results: CheckResult[]) {
  if (!SLACK_ALERT_WEBHOOK_URL) return;
  const failed = results.filter(r => !r.ok);
  const kstTime = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  const blocks: any[] = [
    { type: 'header', text: { type: 'plain_text', text: '🚨 API Health Check 장애 감지', emoji: true } },
    { type: 'section', text: { type: 'mrkdwn', text: `*시각:* ${kstTime}\n*장애 항목:* ${failed.length}/${results.length}` } },
  ];
  for (const r of failed) {
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `❌ *${r.name}*\n> Status: ${r.status || 'N/A'} | Error: ${r.error || 'Unknown'} | Latency: ${r.latencyMs}ms` } });
  }
  for (const r of results.filter(r => r.ok)) {
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `✅ *${r.name}* — ${r.latencyMs}ms` } });
  }
  await fetch(SLACK_ALERT_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ blocks }) });
}

async function sendDailyHealthSummary(history: HistoryEntry[]) {
  if (!SLACK_WEBHOOK_URL) return;
  const kstDate = new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });
  const total = history.length;
  const allOk = history.filter(h => h.allOk).length;
  const failures = history.filter(h => !h.allOk);
  const uptimePercent = total > 0 ? ((allOk / total) * 100).toFixed(1) : '0';

  const avgLatency: Record<string, number[]> = {};
  for (const h of history) for (const r of h.results) {
    if (!avgLatency[r.name]) avgLatency[r.name] = [];
    avgLatency[r.name].push(r.latencyMs);
  }
  let latencyText = '';
  for (const [name, values] of Object.entries(avgLatency)) {
    const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    latencyText += `• *${name}*: avg ${avg}ms / max ${Math.max(...values)}ms\n`;
  }

  const failureSummary = failures.length > 0
    ? failures.slice(-5).map(f => {
        const time = new Date(f.timestamp).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul' });
        return `• ${time} — ${f.results.filter(r => !r.ok).map(r => r.name).join(', ')}`;
      }).join('\n')
    : '없음';

  const blocks: any[] = [
    { type: 'header', text: { type: 'plain_text', text: `📊 Daily Health Report — ${kstDate}`, emoji: true } },
    { type: 'section', text: { type: 'mrkdwn', text: `*Uptime:* ${uptimePercent}% (${allOk}/${total} checks)\n*총 체크:* ${total}회 (15분 간격)` } },
    { type: 'section', text: { type: 'mrkdwn', text: `*평균 응답속도:*\n${latencyText}` } },
    { type: 'section', text: { type: 'mrkdwn', text: `*장애 이력 (최근 5건):*\n${failureSummary}` } },
  ];
  await fetch(SLACK_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ blocks }) });
}

async function handleHealthCheck(res: VercelResponse, forceDailySummary = false) {
  const results = await Promise.all([checkSiteAccess(), checkStorefrontQuery(), checkStorefrontMutation(), checkAdminApi()]);
  const allOk = results.every(r => r.ok);
  const entry: HistoryEntry = { timestamp: Date.now(), allOk, results };

  const history: HistoryEntry[] = (await kvGet(KV_KEY)) || [];
  history.push(entry);
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const trimmed = history.filter(h => h.timestamp > cutoff);
  await kvSet(KV_KEY, trimmed, 86400);

  if (!allOk) await sendHealthAlert(results);

  const kstHour = parseInt(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul', hour: 'numeric', hour12: false }));
  const lastSent: string[] = (await kvGet(KV_DAILY_SENT_KEY)) || [];
  const todaySlot = `${new Date().toISOString().slice(0, 10)}-${kstHour}`;
  const isScheduledHour = kstHour === 9 || kstHour === 18;
  const shouldSend = forceDailySummary || (isScheduledHour && !lastSent.includes(todaySlot));
  if (shouldSend) {
    await sendDailyHealthSummary(trimmed);
    if (!forceDailySummary) {
      lastSent.push(todaySlot);
      await kvSet(KV_DAILY_SENT_KEY, lastSent, 86400);
    }
  }

  return res.status(200).json({
    status: allOk ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    results: results.map(r => ({ name: r.name, ok: r.ok, status: r.status, latencyMs: r.latencyMs, ...(r.error ? { error: r.error } : {}) })),
  });
}

// ─── Main Handler ────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    if (!req.headers['x-vercel-cron']) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  // action=health → health check, default → daily sales report
  if (req.query.action === 'health') {
    const forceDailySummary = req.query.daily === 'true';
    return handleHealthCheck(res, forceDailySummary);
  }

  try {
    const token = await getAccessToken();
    const dates = getDateRanges();

    const [today, yesterday, week, month, topProducts, lowStock] = await Promise.all([
      fetchOrderMetrics(token, dates.today, dates.now),
      fetchOrderMetrics(token, dates.yesterday, dates.today),
      fetchOrderMetrics(token, dates.weekStart, dates.now),
      fetchOrderMetrics(token, dates.monthStart, dates.now),
      fetchTopProducts(token, dates.monthStart),
      fetchLowStockProducts(token),
    ]);

    const message = buildSlackMessage(today, yesterday, week, month, topProducts, lowStock);
    await sendToSlack(message);

    return res.status(200).json({ ok: true, metrics: { today, yesterday, week, month } });
  } catch (error) {
    console.error('[Slack Report] Error:', error);
    return res.status(500).json({
      error: 'Report generation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
