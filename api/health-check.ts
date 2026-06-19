import type { VercelRequest, VercelResponse } from '@vercel/node';

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || '';
const SITE_URL = 'https://www.biteme.one';
const KV_KEY = 'health-check:history';
const KV_DAILY_SENT_KEY = 'health-check:daily-sent';

// ─── Shopify Token ───────────────────────────────────────────────────────────
let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt - 5 * 60 * 1000) return cachedToken;

  const shop = process.env.VITE_SHOPIFY_STORE_DOMAIN || '';
  const clientId = process.env.VITE_SHOPIFY_CLIENT_ID || '';
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET || '';

  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) throw new Error(`Token request failed: ${res.status}`);
  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiresAt = now + data.expires_in * 1000;
  return cachedToken!;
}

// ─── KV Helpers ──────────────────────────────────────────────────────────────
async function kvGet(key: string): Promise<any> {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  try {
    const res = await fetch(`${url}/get/${key}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    return data.result ? JSON.parse(data.result) : null;
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

// ─── Health Checks ───────────────────────────────────────────────────────────
interface CheckResult {
  name: string;
  ok: boolean;
  status?: number;
  latencyMs: number;
  error?: string;
}

async function checkStorefrontQuery(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const res = await fetch(`${SITE_URL}/api/shopify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: SITE_URL },
      body: JSON.stringify({
        query: 'query { products(first: 1) { edges { node { id title } } } }',
      }),
    });
    const data = await res.json();
    const hasProducts = data?.data?.products?.edges?.length > 0;
    return {
      name: 'Storefront Query',
      ok: res.ok && hasProducts,
      status: res.status,
      latencyMs: Date.now() - start,
      error: !res.ok ? `HTTP ${res.status}` : !hasProducts ? 'No products returned' : undefined,
    };
  } catch (e) {
    return { name: 'Storefront Query', ok: false, latencyMs: Date.now() - start, error: (e as Error).message };
  }
}

async function checkStorefrontMutation(): Promise<CheckResult> {
  const start = Date.now();
  try {
    // First get a valid variant ID
    const listRes = await fetch(`${SITE_URL}/api/shopify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: SITE_URL },
      body: JSON.stringify({
        query: 'query { products(first: 1) { edges { node { variants(first: 1) { edges { node { id } } } } } } }',
      }),
    });
    const listData = await listRes.json();
    const variantId = listData?.data?.products?.edges?.[0]?.node?.variants?.edges?.[0]?.node?.id;
    if (!variantId) {
      return { name: 'Storefront Mutation', ok: false, latencyMs: Date.now() - start, error: 'No variant ID found' };
    }

    const res = await fetch(`${SITE_URL}/api/shopify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: SITE_URL },
      body: JSON.stringify({
        query: `mutation cartCreate($input: CartInput!) { cartCreate(input: $input) { cart { id checkoutUrl } userErrors { field message } } }`,
        variables: { input: { lines: [{ quantity: 1, merchandiseId: variantId }] } },
      }),
    });
    const data = await res.json();
    const cart = data?.data?.cartCreate?.cart;
    const userErrors = data?.data?.cartCreate?.userErrors || [];
    return {
      name: 'Storefront Mutation',
      ok: res.ok && !!cart?.checkoutUrl && userErrors.length === 0,
      status: res.status,
      latencyMs: Date.now() - start,
      error: !res.ok ? `HTTP ${res.status}` : userErrors.length > 0 ? userErrors[0].message : !cart ? 'No cart created' : undefined,
    };
  } catch (e) {
    return { name: 'Storefront Mutation', ok: false, latencyMs: Date.now() - start, error: (e as Error).message };
  }
}

async function checkAdminApi(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const token = await getAccessToken();
    const shop = process.env.VITE_SHOPIFY_STORE_DOMAIN || '';
    const res = await fetch(`https://${shop}/admin/api/2025-07/graphql.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
      body: JSON.stringify({ query: '{ shop { name } }' }),
    });
    const data = await res.json();
    return {
      name: 'Admin API',
      ok: res.ok && !!data?.data?.shop?.name,
      status: res.status,
      latencyMs: Date.now() - start,
      error: !res.ok ? `HTTP ${res.status}` : undefined,
    };
  } catch (e) {
    return { name: 'Admin API', ok: false, latencyMs: Date.now() - start, error: (e as Error).message };
  }
}

async function checkSiteAccess(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const res = await fetch(SITE_URL, { method: 'GET', redirect: 'follow' });
    return {
      name: 'Site Access',
      ok: res.ok,
      status: res.status,
      latencyMs: Date.now() - start,
      error: !res.ok ? `HTTP ${res.status}` : undefined,
    };
  } catch (e) {
    return { name: 'Site Access', ok: false, latencyMs: Date.now() - start, error: (e as Error).message };
  }
}

// ─── Slack ────────────────────────────────────────────────────────────────────
async function sendSlackAlert(results: CheckResult[]) {
  if (!SLACK_WEBHOOK_URL) return;
  const failed = results.filter(r => !r.ok);
  const kstTime = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

  const blocks: any[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: '🚨 API Health Check 장애 감지', emoji: true },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*시각:* ${kstTime}\n*장애 항목:* ${failed.length}/${results.length}`,
      },
    },
  ];

  for (const r of failed) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `❌ *${r.name}*\n> Status: ${r.status || 'N/A'} | Error: ${r.error || 'Unknown'} | Latency: ${r.latencyMs}ms`,
      },
    });
  }

  for (const r of results.filter(r => r.ok)) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `✅ *${r.name}* — ${r.latencyMs}ms` },
    });
  }

  await fetch(SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blocks }),
  });
}

async function sendDailySummary(history: HistoryEntry[]) {
  if (!SLACK_WEBHOOK_URL) return;
  const kstDate = new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });

  const total = history.length;
  const allOk = history.filter(h => h.allOk).length;
  const failures = history.filter(h => !h.allOk);
  const uptimePercent = total > 0 ? ((allOk / total) * 100).toFixed(1) : '0';

  const avgLatency: Record<string, number[]> = {};
  for (const h of history) {
    for (const r of h.results) {
      if (!avgLatency[r.name]) avgLatency[r.name] = [];
      avgLatency[r.name].push(r.latencyMs);
    }
  }

  let latencyText = '';
  for (const [name, values] of Object.entries(avgLatency)) {
    const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    const max = Math.max(...values);
    latencyText += `• *${name}*: avg ${avg}ms / max ${max}ms\n`;
  }

  const failureSummary = failures.length > 0
    ? failures.slice(-5).map(f => {
        const time = new Date(f.timestamp).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul' });
        const failedNames = f.results.filter(r => !r.ok).map(r => r.name).join(', ');
        return `• ${time} — ${failedNames}`;
      }).join('\n')
    : '없음';

  const blocks: any[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `📊 Daily Health Report — ${kstDate}`, emoji: true },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Uptime:* ${uptimePercent}% (${allOk}/${total} checks passed)\n*총 체크:* ${total}회 (15분 간격)`,
      },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*평균 응답속도:*\n${latencyText}` },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*장애 이력 (최근 5건):*\n${failureSummary}` },
    },
  ];

  await fetch(SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blocks }),
  });
}

// ─── History ─────────────────────────────────────────────────────────────────
interface HistoryEntry {
  timestamp: number;
  allOk: boolean;
  results: CheckResult[];
}

async function appendHistory(entry: HistoryEntry): Promise<HistoryEntry[]> {
  const history: HistoryEntry[] = (await kvGet(KV_KEY)) || [];
  history.push(entry);
  // 24시간치만 유지 (96 entries at 15min interval)
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const trimmed = history.filter(h => h.timestamp > cutoff);
  await kvSet(KV_KEY, trimmed, 86400);
  return trimmed;
}

// ─── Handler ─────────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const results = await Promise.all([
    checkSiteAccess(),
    checkStorefrontQuery(),
    checkStorefrontMutation(),
    checkAdminApi(),
  ]);

  const allOk = results.every(r => r.ok);
  const entry: HistoryEntry = { timestamp: Date.now(), allOk, results };
  const history = await appendHistory(entry);

  // 장애 시 즉시 Slack 알림
  if (!allOk) {
    await sendSlackAlert(results);
  }

  // 매일 KST 09:00 (UTC 00:00)에 일일 요약 발송
  const kstHour = new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul', hour: 'numeric', hour12: false });
  const lastSent = await kvGet(KV_DAILY_SENT_KEY);
  const today = new Date().toISOString().slice(0, 10);
  if (parseInt(kstHour) === 9 && lastSent !== today) {
    await sendDailySummary(history);
    await kvSet(KV_DAILY_SENT_KEY, today, 86400);
  }

  return res.status(200).json({
    status: allOk ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    results: results.map(r => ({
      name: r.name,
      ok: r.ok,
      status: r.status,
      latencyMs: r.latencyMs,
      ...(r.error ? { error: r.error } : {}),
    })),
  });
}
