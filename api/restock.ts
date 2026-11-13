import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

/**
 * /api/restock — 품절 상품 재입고 이메일 알림 (#202)
 *
 *   - POST                 신청. 이메일 + 상품 handle + 품절 옵션 id. 로그인 불필요
 *   - GET  ?action=list    관리자 목록 (x-admin-key). 아직 안 보낸 신청엔 지금 재고를 붙인다
 *   - POST ?action=send    관리자 발송 (x-admin-key). confirm 없으면 미리보기만, confirm: true 일 때만 보낸다
 *
 * 🔴 자동 발송은 하지 않는다. 일본몰(LINE)에서 크론 자동 발송이 재고 수정 실수·소량 입고에도 나가버려
 *    운영자가 골라 보내는 방식으로 바꾼 사례를 따른다.
 *
 * 저장: KV 해시 `restock:subs` — 필드 `<옵션 숫자 id>:<이메일>`, 값 RestockSub.
 * 신청 한 건에 메일 한 통. 보낸 뒤 같은 옵션을 다시 신청하면 새 신청으로 본다.
 * 발송은 Resend API (RESEND_API_KEY + RESTOCK_FROM_EMAIL). 둘 중 하나라도 없으면 미리보기만 된다.
 * Self-contained like every other function in api/ — server/restock-proxy.ts가 handler를 재사용한다.
 */

const API_VERSION = '2025-07';
const SUBS_KEY = 'restock:subs';
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RATE_LIMIT = 10; // 같은 IP 1분에 10회까지
const RATE_WINDOW_SECONDS = 60;
const MAX_VARIANTS_PER_REQUEST = 20;

export interface RestockSub {
  email: string;
  productId: string;
  handle: string;
  productTitle: string;
  variantId: string;
  variantTitle: string;
  /** 신청한 사이트 주소 (메일 속 상품 링크) */
  origin: string;
  createdAt: string;
  sentAt?: string;
}

type Status = 'waiting' | 'ready' | 'sent' | 'gone';

interface VariantStock {
  id: string;
  availableForSale: boolean;
  inventoryQuantity: number | null;
  productStatus: string;
}

let cachedAdminToken: string | null = null;
let adminTokenExpiresAt = 0;

async function getAdminToken(): Promise<string> {
  const now = Date.now();
  if (cachedAdminToken && now < adminTokenExpiresAt - 5 * 60 * 1000) return cachedAdminToken;
  const shop = process.env.VITE_SHOPIFY_STORE_DOMAIN;
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.VITE_SHOPIFY_CLIENT_ID!,
      client_secret: process.env.SHOPIFY_CLIENT_SECRET!,
    }),
  });
  if (!res.ok) throw new Error(`Token request failed (${res.status})`);
  const data = await res.json();
  cachedAdminToken = data.access_token;
  adminTokenExpiresAt = now + data.expires_in * 1000;
  return cachedAdminToken!;
}

async function adminGraphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const shop = process.env.VITE_SHOPIFY_STORE_DOMAIN;
  const res = await fetch(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': await getAdminToken() },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json || json.errors) {
    throw new Error(`Admin API error (${res.status}): ${JSON.stringify(json?.errors ?? json)}`);
  }
  return json.data as T;
}

const numId = (gid: string) => gid.split('/').pop() ?? '';

function checkAdmin(req: VercelRequest): boolean {
  const expected = process.env.B2B_ADMIN_PASSWORD;
  if (!expected) return false; // never treat "both undefined" as a match
  return (req.headers['x-admin-key'] as string) === expected;
}

async function isRateLimited(ip: string): Promise<boolean> {
  if (!ip) return false;
  try {
    const key = `restock:ip:${ip}`;
    const count = await kv.incr(key);
    if (count === 1) await kv.expire(key, RATE_WINDOW_SECONDS);
    return count > RATE_LIMIT;
  } catch {
    return false; // KV 장애 시 제한 없이 진행
  }
}

function requestOrigin(req: VercelRequest): string {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '');
  const proto = host.startsWith('localhost') ? 'http' : 'https';
  return `${proto}://${host}`;
}

async function readSubs(): Promise<Record<string, RestockSub>> {
  return (await kv.hgetall<Record<string, RestockSub>>(SUBS_KEY)) ?? {};
}

async function fetchStock(variantIds: string[]): Promise<Map<string, VariantStock>> {
  const out = new Map<string, VariantStock>();
  const ids = [...new Set(variantIds)];
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100).map((id) => `gid://shopify/ProductVariant/${id}`);
    const data = await adminGraphql<{
      nodes: ({ id: string; availableForSale: boolean; inventoryQuantity: number | null; product: { status: string } } | null)[];
    }>(
      `query($ids: [ID!]!) { nodes(ids: $ids) { ... on ProductVariant { id availableForSale inventoryQuantity product { status } } } }`,
      { ids: chunk },
    );
    for (const n of data.nodes) {
      if (!n?.id) continue;
      out.set(numId(n.id), {
        id: numId(n.id),
        availableForSale: n.availableForSale,
        inventoryQuantity: n.inventoryQuantity,
        productStatus: n.product.status,
      });
    }
  }
  return out;
}

function statusOf(sub: RestockSub, stock: VariantStock | undefined): Status {
  if (sub.sentAt) return 'sent';
  if (!stock || stock.productStatus !== 'ACTIVE') return 'gone';
  return stock.availableForSale ? 'ready' : 'waiting';
}

// ---------- 신청 ----------

async function handleSubscribe(req: VercelRequest, res: VercelResponse) {
  // 다른 사이트의 브라우저에서 보낸 요청은 거절 (Origin이 있으면 우리 사이트 주소와 같아야 함)
  const origin = String(req.headers.origin || '');
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '');
  if (origin && host) {
    let originHost = '';
    try {
      originHost = new URL(origin).host;
    } catch {
      // "null" 등 잘못된 Origin
    }
    if (originHost !== host) return res.status(403).json({ error: 'Forbidden' });
  }

  const body = (req.body ?? {}) as { email?: unknown; handle?: unknown; variantIds?: unknown; website?: unknown };
  // 봇용 숨김 칸이 채워졌으면 저장하지 않고 성공처럼 응답
  if (typeof body.website === 'string' && body.website.trim()) return res.status(200).json({ ok: true });

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!EMAIL_RE.test(email) || email.length > 254) return res.status(400).json({ error: 'Invalid email' });
  const handle = typeof body.handle === 'string' ? body.handle.trim() : '';
  const variantIds = Array.isArray(body.variantIds)
    ? [...new Set(body.variantIds.filter((v): v is string => typeof v === 'string').map(numId).filter(Boolean))]
    : [];
  if (!handle || variantIds.length === 0 || variantIds.length > MAX_VARIANTS_PER_REQUEST) {
    return res.status(400).json({ error: 'Invalid product' });
  }

  const ip = String(req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  if (await isRateLimited(ip)) return res.status(429).json({ error: 'Too many requests' });

  // 상품명·옵션명은 클라이언트 값을 믿지 않고 Shopify에서 다시 읽는다
  const data = await adminGraphql<{
    products: { nodes: { id: string; title: string; handle: string; variants: { nodes: { id: string; title: string }[] } }[] };
  }>(
    `query($q: String!) { products(first: 1, query: $q) { nodes { id title handle variants(first: 100) { nodes { id title } } } } }`,
    { q: `handle:"${handle.replace(/"/g, '')}"` },
  );
  const product = data.products.nodes.find((p) => p.handle === handle);
  if (!product) return res.status(400).json({ error: 'Invalid product' });
  const variants = product.variants.nodes.filter((v) => variantIds.includes(numId(v.id)));
  if (variants.length !== variantIds.length) return res.status(400).json({ error: 'Invalid product' });

  const existing = await kv.hmget<Record<string, RestockSub | null>>(
    SUBS_KEY,
    ...variants.map((v) => `${numId(v.id)}:${email}`),
  );
  const now = new Date().toISOString();
  const updates: Record<string, RestockSub> = {};
  for (const v of variants) {
    const field = `${numId(v.id)}:${email}`;
    // 아직 안 보낸 같은 신청이 있으면 그대로 둔다 (중복 신청은 한 건)
    if (existing?.[field] && !existing[field]!.sentAt) continue;
    updates[field] = {
      email,
      productId: numId(product.id),
      handle: product.handle,
      productTitle: product.title,
      variantId: numId(v.id),
      variantTitle: v.title,
      origin: requestOrigin(req),
      createdAt: now,
    };
  }
  if (Object.keys(updates).length) await kv.hset(SUBS_KEY, updates);
  return res.status(200).json({ ok: true });
}

// ---------- 관리자 목록 ----------

async function handleList(_req: VercelRequest, res: VercelResponse) {
  const subs = await readSubs();
  const entries = Object.entries(subs);
  const stock = await fetchStock(entries.filter(([, s]) => !s.sentAt).map(([, s]) => s.variantId));
  const rows = entries
    .map(([key, s]) => ({
      key,
      ...s,
      status: statusOf(s, stock.get(s.variantId)),
      inventoryQuantity: stock.get(s.variantId)?.inventoryQuantity ?? null,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return res.status(200).json({ rows, mailConfigured: mailConfigured() });
}

// ---------- 관리자 발송 ----------

function mailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESTOCK_FROM_EMAIL);
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const itemLabel = (s: RestockSub) =>
  s.variantTitle && s.variantTitle !== 'Default Title' ? `${s.productTitle} (${s.variantTitle})` : s.productTitle;

export function buildEmail(items: RestockSub[]): { subject: string; text: string; html: string } {
  const subject =
    items.length === 1 ? `Back in stock: ${itemLabel(items[0])}` : 'Items you asked about are back in stock';
  const links = items.map((s) => ({ label: itemLabel(s), url: `${s.origin}/product/${s.handle}` }));
  const text = [
    'Good news! The item(s) you asked us to notify you about are back in stock:',
    '',
    ...links.map((l) => `- ${l.label}\n  ${l.url}`),
    '',
    'Stock is limited, so grab yours soon.',
    '',
    'BITE ME',
    'You received this email because you requested a restock alert. This is a one-time notification.',
  ].join('\n');
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#222;line-height:1.6;max-width:520px">
<p>Good news! The item(s) you asked us to notify you about are back in stock:</p>
<ul style="padding-left:18px">${links
    .map((l) => `<li><a href="${escapeHtml(l.url)}" style="color:#f26b21;font-weight:bold">${escapeHtml(l.label)}</a></li>`)
    .join('')}</ul>
<p>Stock is limited, so grab yours soon.</p>
<p style="margin-top:24px">BITE ME</p>
<p style="font-size:11px;color:#888">You received this email because you requested a restock alert. This is a one-time notification.</p>
</div>`;
  return { subject, text, html };
}

async function sendMail(to: string, mail: { subject: string; text: string; html: string }): Promise<boolean> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    body: JSON.stringify({ from: process.env.RESTOCK_FROM_EMAIL, to: [to], ...mail }),
  });
  if (!res.ok) console.error(`[Restock] 메일 실패 ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.ok;
}

async function handleSend(req: VercelRequest, res: VercelResponse) {
  const body = (req.body ?? {}) as { keys?: unknown; confirm?: unknown };
  const keys = Array.isArray(body.keys) ? body.keys.filter((k): k is string => typeof k === 'string') : [];
  if (keys.length === 0) return res.status(400).json({ error: 'No keys' });

  const subs = await readSubs();
  const picked = keys.map((k) => [k, subs[k]] as const).filter(([, s]) => s && !s.sentAt) as [string, RestockSub][];
  // 보내기 직전에 재고를 다시 확인 — 지금 살 수 있는 옵션만 보낸다
  const stock = await fetchStock(picked.map(([, s]) => s.variantId));
  const ready = picked.filter(([, s]) => statusOf(s, stock.get(s.variantId)) === 'ready');
  const skipped = keys.length - ready.length;

  // 한 사람에게는 한 통으로 묶는다
  const byEmail = new Map<string, [string, RestockSub][]>();
  for (const r of ready) byEmail.set(r[1].email, [...(byEmail.get(r[1].email) ?? []), r]);
  const first = byEmail.values().next().value as [string, RestockSub][] | undefined;
  const preview = first ? buildEmail(first.map(([, s]) => s)) : null;

  if (body.confirm !== true) {
    return res.status(200).json({
      preview: true,
      recipients: byEmail.size,
      items: ready.length,
      skipped,
      sample: preview && { to: first![0][1].email, ...preview },
      mailConfigured: mailConfigured(),
    });
  }
  if (!mailConfigured()) return res.status(503).json({ error: 'Mail not configured' });

  let sent = 0;
  let failed = 0;
  for (const [email, rows] of byEmail) {
    const ok = await sendMail(email, buildEmail(rows.map(([, s]) => s)));
    if (!ok) {
      failed += 1;
      continue;
    }
    const sentAt = new Date().toISOString();
    await kv.hset(SUBS_KEY, Object.fromEntries(rows.map(([k, s]) => [k, { ...s, sentAt }])));
    sent += 1;
  }
  return res.status(200).json({ sent, failed, skipped });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = String(req.query.action || '');
  try {
    if (req.method === 'POST' && !action) return await handleSubscribe(req, res);
    if (action === 'list' || action === 'send') {
      if (!checkAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });
      if (req.method === 'GET' && action === 'list') return await handleList(req, res);
      if (req.method === 'POST' && action === 'send') return await handleSend(req, res);
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('[Restock] Error:', error);
    return res.status(500).json({ error: 'Restock request failed' });
  }
}
