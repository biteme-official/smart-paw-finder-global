import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';
import { randomInt } from 'crypto';

// B2C 어필리에이트 (biteme-us.com) — 가입·클릭·파트너 대시보드·관리자·주문 수집을 한 함수에서 처리한다.
// 기존 biteme.one 어필리에이트 신청 폼(api/affiliate.ts, 15% 코드)과는 별개이며 KV 키도 affp: 로 분리한다.
//
// 규칙 (이슈 본문 D1~D8)
// - 커미션 = 주문 전체 상품의 할인 후 금액(배송비·세금 제외) × 10%, 요율은 주문 시점 값으로 고정
// - 귀속 = 링크만. 화면이 결제 생성 시 주문 속성 _aff(코드)·_aff_p(상품)·_aff_at(클릭 시각)을 붙인다
// - 본인 구매(고객 ID·이메일·기본 배송지 일치)와 B2B 태그 고객 주문은 커미션 0 (excluded)
// - 날짜 집계는 한국 시간(KST)
//
// 실행 위치: 고객용(me/join/copy/click/dashboard/paypal)은 B2C 사이트에서만, 관리자·주문 수집은 어느 사이트든
// 같은 KV를 보므로 동작한다(관리자 화면은 biteme.one /manage, 정기 수집은 biteme.one cron).

const API_VERSION = '2025-07';
const SHOP_ID = process.env.VITE_SHOPIFY_SHOP_ID;
const CUSTOMER_ACCOUNT_ENDPOINT = `https://shopify.com/${SHOP_ID}/account/customer/api/${API_VERSION}/graphql`;

export const COMMISSION_RATE = 0.1;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 헷갈리는 0/O/1/I 제외
const CLICK_DEDUPE_SECONDS = 30 * 60; // 같은 사람이 같은 링크를 30분 안에 다시 눌러도 1번
const BOT_UA = /bot|crawl|spider|slurp|facebookexternalhit|embedly|preview|headless|lighthouse|pingdom|monitor/i;
const SYNC_START = '2026-11-01T00:00:00Z'; // 첫 수집 시작 시점
const SYNC_OVERLAP_MS = 10 * 60 * 1000; // 직전 수집과 10분 겹쳐 읽어 경계에 걸친 주문을 놓치지 않는다
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ─── 타입 ─────────────────────────────────────────────────────────────────────

export type PartnerStatus = 'active' | 'suspended' | 'removed';

export interface Partner {
  code: string;
  customerId: string;
  email: string;
  name: string;
  country: string | null; // 가입 시 기본 배송지 국가
  status: PartnerStatus;
  joinedAt: string;
  consent: { age18: boolean; terms: boolean; at: string };
  paypalEmail: string | null;
  paypalUpdatedAt: string | null;
  statusHistory: { at: string; from: PartnerStatus; to: PartnerStatus }[];
}

export type CommissionStatus = 'pending' | 'excluded' | 'void';

export interface Commission {
  orderId: string;
  orderName: string;
  createdAt: string;
  code: string;
  handle: string | null; // 고객이 들어온 링크의 상품
  clickedAt: string | null;
  customerEmail: string | null;
  guest: boolean; // 비회원 주문
  baseAmount: number; // 할인 후 상품 금액 (배송비·세금 제외, 환불 반영)
  currency: string;
  rate: number;
  commission: number;
  status: CommissionStatus;
  reason: string | null; // excluded: self | b2b | partner-suspended / void: cancelled | manual
  manualVoid: boolean;
  updatedAt: string;
  history: { at: string; change: string }[];
}

// ─── KV 키 ────────────────────────────────────────────────────────────────────

const K = {
  partner: (code: string) => `affp:partner:${code}`,
  byCustomer: (customerId: string) => `affp:customer:${customerId}`,
  partners: 'affp:partners',
  clicks: (code: string) => `affp:clicks:${code}`, // hash  "YYYY-MM-DD|handle" → count
  copies: (code: string) => `affp:copies:${code}`, // hash  "YYYY-MM-DD|handle" → count
  clickDedupe: (code: string, handle: string, ip: string) => `affp:clk:${code}:${handle}:${ip}`,
  order: (orderId: string) => `affp:order:${orderId}`,
  orders: 'affp:orders', // zset score = 주문 시각(ms)
  partnerOrders: (code: string) => `affp:partner-orders:${code}`,
  paypalHistory: (code: string) => `affp:paypal-history:${code}`,
  syncCursor: 'affp:sync:cursor',
  syncLock: 'affp:sync:lock',
};

// ─── 날짜 (KST) ───────────────────────────────────────────────────────────────

export function kstDate(d: Date | string | number = new Date()): string {
  return new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
}

// KST 날짜 YYYY-MM-DD의 시작 시각(ms)
function kstStartMs(date: string): number {
  return new Date(`${date}T00:00:00+09:00`).getTime();
}

function isDate(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

// 기간 파라미터 (기본: 이번 달 1일 ~ 오늘, KST)
function readRange(req: VercelRequest): { from: string; to: string } {
  const today = kstDate();
  const from = isDate(req.query.from) ? req.query.from : `${today.slice(0, 7)}-01`;
  const to = isDate(req.query.to) ? req.query.to : today;
  return from <= to ? { from, to } : { from: to, to: from };
}

function inRange(date: string, r: { from: string; to: string }): boolean {
  return date >= r.from && date <= r.to;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// ─── Shopify ──────────────────────────────────────────────────────────────────

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
  const data = (await res.json()) as { access_token: string; expires_in: number };
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
  const json = (await res.json().catch(() => null)) as { data?: unknown; errors?: unknown } | null;
  if (!res.ok || !json || json.errors) {
    throw new Error(`Admin API error (${res.status}): ${JSON.stringify(json?.errors ?? json)}`);
  }
  return json.data as T;
}

interface CustomerIdentity {
  id: string;
  email: string;
  name: string;
  country: string | null;
}

// 고객 토큰으로 본인 확인 — 화면이 보낸 이메일·ID는 믿지 않는다
async function getCustomer(req: VercelRequest): Promise<CustomerIdentity | null> {
  const auth = req.headers.authorization;
  if (!auth) return null;
  const res = await fetch(CUSTOMER_ACCOUNT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: auth },
    body: JSON.stringify({ query: '{ customer { id firstName displayName emailAddress { emailAddress } defaultAddress { territoryCode } } }' }),
  });
  if (!res.ok) return null;
  type CustomerResponse = {
    data?: {
      customer?: {
        id: string;
        firstName: string | null;
        displayName: string | null;
        emailAddress: { emailAddress: string | null } | null;
        defaultAddress: { territoryCode: string | null } | null;
      } | null;
    };
  };
  const data = (await res.json().catch(() => null)) as CustomerResponse | null;
  const c = data?.data?.customer;
  if (!c?.id) return null;
  return {
    id: c.id,
    email: String(c.emailAddress?.emailAddress || '').toLowerCase(),
    name: c.firstName || c.displayName || '',
    country: c.defaultAddress?.territoryCode || null,
  };
}

// ─── 공통 ─────────────────────────────────────────────────────────────────────

function isAdmin(req: VercelRequest): boolean {
  const expected = process.env.B2B_ADMIN_PASSWORD;
  if (!expected) return false;
  return req.headers['x-admin-key'] === expected;
}

function clientIp(req: VercelRequest): string {
  return String(req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || '').split(',')[0].trim();
}

// 다른 사이트 브라우저에서 보낸 요청 거절 (Origin이 있으면 우리 주소와 같아야 함)
function isCrossOrigin(req: VercelRequest): boolean {
  const origin = String(req.headers.origin || '');
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '');
  if (!origin || !host) return false;
  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const [user, domain] = email.split('@');
  if (!domain) return '***';
  return `${user.slice(0, 1)}***@${domain}`;
}

function normalizeHandle(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const h = raw.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9-]{0,199}$/.test(h) ? h : null;
}

function normalizeCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const c = raw.trim().toUpperCase();
  return /^[A-Z0-9]{6}$/.test(c) ? c : null;
}

async function getPartner(code: string): Promise<Partner | null> {
  return (await kv.get<Partner>(K.partner(code))) ?? null;
}

async function getPartnerByCustomer(customerId: string): Promise<Partner | null> {
  const code = await kv.get<string>(K.byCustomer(customerId));
  return code ? getPartner(code) : null;
}

async function getAllPartners(): Promise<Partner[]> {
  const codes = await kv.smembers(K.partners);
  if (!codes.length) return [];
  const list = await kv.mget<(Partner | null)[]>(...codes.map((c) => K.partner(String(c))));
  return list.filter((p): p is Partner => !!p);
}

async function getOrders(ids: string[]): Promise<Commission[]> {
  if (!ids.length) return [];
  const out: Commission[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const rows = await kv.mget<(Commission | null)[]>(...chunk.map((id) => K.order(id)));
    rows.forEach((r) => r && out.push(r));
  }
  return out;
}

// 기간(KST 날짜) 안의 주문 — zset 점수(주문 시각)로 범위 조회
async function getOrdersInRange(key: string, r: { from: string; to: string }): Promise<Commission[]> {
  const min = kstStartMs(r.from);
  const max = kstStartMs(r.to) + 24 * 60 * 60 * 1000 - 1;
  const ids = await kv.zrange<string[]>(key, min, max, { byScore: true });
  return getOrders(ids.map(String));
}

// hash "YYYY-MM-DD|handle" → count 를 기간으로 걸러 합산
function sumCounts(hash: Record<string, unknown> | null, r: { from: string; to: string }) {
  const byHandle: Record<string, number> = {};
  const byDate: Record<string, number> = {};
  let total = 0;
  for (const [field, value] of Object.entries(hash || {})) {
    const [date, handle] = field.split('|');
    if (!inRange(date, r)) continue;
    const n = Number(value) || 0;
    total += n;
    byHandle[handle] = (byHandle[handle] || 0) + n;
    byDate[date] = (byDate[date] || 0) + n;
  }
  return { total, byHandle, byDate };
}

// 커미션이 실제로 생기는 주문 (대기). 제외·무효는 금액 0
const counts = (o: Commission) => o.status === 'pending';

function summarizeOrders(orders: Commission[]) {
  const live = orders.filter(counts);
  return {
    orders: live.length,
    sales: round2(live.reduce((s, o) => s + o.baseAmount, 0)),
    commission: round2(live.reduce((s, o) => s + o.commission, 0)),
  };
}

// ─── 고객: 가입·내 정보 ───────────────────────────────────────────────────────

function publicPartner(p: Partner) {
  return {
    code: p.code,
    status: p.status,
    joinedAt: p.joinedAt,
    paypalEmail: maskEmail(p.paypalEmail),
    paypalUpdatedAt: p.paypalUpdatedAt,
  };
}

async function handleMe(req: VercelRequest, res: VercelResponse) {
  const customer = await getCustomer(req);
  if (!customer) return res.status(401).json({ error: 'Unauthorized' });
  const partner = await getPartnerByCustomer(customer.id);
  return res.status(200).json({ partner: partner && partner.status !== 'removed' ? publicPartner(partner) : null });
}

async function handleJoin(req: VercelRequest, res: VercelResponse) {
  const customer = await getCustomer(req);
  if (!customer) return res.status(401).json({ error: 'Unauthorized' });
  const body = (req.body ?? {}) as { age18?: unknown; terms?: unknown };
  if (body.age18 !== true || body.terms !== true) return res.status(400).json({ error: 'Consent required' });

  const existing = await getPartnerByCustomer(customer.id);
  if (existing) {
    if (existing.status === 'removed') return res.status(403).json({ error: 'Not available' });
    return res.status(200).json({ partner: publicPartner(existing), created: false });
  }

  // 같은 고객이 동시에 두 번 눌러도 코드 하나만 — 고객 키를 먼저 잡는다
  const lockKey = `${K.byCustomer(customer.id)}:lock`;
  if (!(await kv.set(lockKey, '1', { nx: true, ex: 30 }))) return res.status(409).json({ error: 'Try again' });

  try {
    const now = new Date().toISOString();
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
      const partner: Partner = {
        code,
        customerId: customer.id,
        email: customer.email,
        name: customer.name,
        country: customer.country,
        status: 'active',
        joinedAt: now,
        consent: { age18: true, terms: true, at: now },
        paypalEmail: null,
        paypalUpdatedAt: null,
        statusHistory: [],
      };
      if (!(await kv.set(K.partner(code), partner, { nx: true }))) continue; // 코드 중복 → 다시 뽑기
      await kv.set(K.byCustomer(customer.id), code);
      await kv.sadd(K.partners, code);
      return res.status(200).json({ partner: publicPartner(partner), created: true });
    }
    throw new Error('code generation failed');
  } finally {
    await kv.del(lockKey);
  }
}

async function handleCopy(req: VercelRequest, res: VercelResponse) {
  const customer = await getCustomer(req);
  if (!customer) return res.status(401).json({ error: 'Unauthorized' });
  const partner = await getPartnerByCustomer(customer.id);
  if (!partner || partner.status !== 'active') return res.status(403).json({ error: 'Not a partner' });
  const handle = normalizeHandle((req.body ?? {}).handle) || '_home';
  await kv.hincrby(K.copies(partner.code), `${kstDate()}|${handle}`, 1);
  return res.status(200).json({ ok: true });
}

async function handlePaypal(req: VercelRequest, res: VercelResponse) {
  const customer = await getCustomer(req);
  if (!customer) return res.status(401).json({ error: 'Unauthorized' });
  const partner = await getPartnerByCustomer(customer.id);
  if (!partner || partner.status === 'removed') return res.status(403).json({ error: 'Not a partner' });
  const email = String((req.body ?? {}).email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) return res.status(400).json({ error: 'Invalid email' });

  const now = new Date().toISOString();
  await kv.lpush(K.paypalHistory(partner.code), { at: now, from: maskEmail(partner.paypalEmail), to: maskEmail(email) });
  const updated: Partner = { ...partner, paypalEmail: email, paypalUpdatedAt: now };
  await kv.set(K.partner(partner.code), updated);
  return res.status(200).json({ partner: publicPartner(updated) });
}

// ─── 고객: 링크 클릭 ──────────────────────────────────────────────────────────

async function handleClick(req: VercelRequest, res: VercelResponse) {
  const body = (req.body ?? {}) as { code?: unknown; handle?: unknown };
  const code = normalizeCode(body.code);
  if (!code) return res.status(400).json({ error: 'Invalid code' });
  const handle = normalizeHandle(body.handle) || '_home';

  // 봇·미리보기는 집계하지 않는다 (코드 저장은 화면에서 이미 끝남)
  const ua = String(req.headers['user-agent'] || '');
  if (!ua || BOT_UA.test(ua)) return res.status(200).json({ ok: true, counted: false });

  const partner = await getPartner(code);
  if (!partner || partner.status !== 'active') return res.status(200).json({ ok: true, valid: false });

  const ip = clientIp(req) || 'unknown';
  const fresh = await kv.set(K.clickDedupe(code, handle, ip), '1', { nx: true, ex: CLICK_DEDUPE_SECONDS });
  if (fresh) await kv.hincrby(K.clicks(code), `${kstDate()}|${handle}`, 1);
  return res.status(200).json({ ok: true, valid: true, counted: !!fresh });
}

// ─── 고객: 파트너 대시보드 ────────────────────────────────────────────────────

// 이번 달 커미션은 다음 달 1일 마감 → 다음 달 말일까지 지급 (2차에서 실제 정산)
function nextPayoutDate(today = kstDate()): string {
  const [y, m] = today.split('-').map(Number);
  const lastDayNextMonth = new Date(Date.UTC(y, m + 1, 0)); // m은 1부터라 m+1 = 다음 달, 0일 = 그 달 말일
  return lastDayNextMonth.toISOString().slice(0, 10);
}

function linkRows(clicks: Record<string, number>, copies: Record<string, number>, orders: Commission[]) {
  const rows: Record<string, { handle: string; clicks: number; copies: number; orders: number; commission: number }> = {};
  const row = (h: string) => (rows[h] ||= { handle: h, clicks: 0, copies: 0, orders: 0, commission: 0 });
  Object.entries(clicks).forEach(([h, n]) => (row(h).clicks += n));
  Object.entries(copies).forEach(([h, n]) => (row(h).copies += n));
  orders.filter(counts).forEach((o) => {
    const r = row(o.handle || '_home');
    r.orders += 1;
    r.commission = round2(r.commission + o.commission);
  });
  return Object.values(rows).sort((a, b) => b.clicks - a.clicks || b.orders - a.orders || b.copies - a.copies);
}

async function handleDashboard(req: VercelRequest, res: VercelResponse) {
  const customer = await getCustomer(req);
  if (!customer) return res.status(401).json({ error: 'Unauthorized' });
  const partner = await getPartnerByCustomer(customer.id);
  if (!partner || partner.status === 'removed') return res.status(403).json({ error: 'Not a partner' });

  const range = readRange(req);
  const today = kstDate();
  const month = { from: `${today.slice(0, 7)}-01`, to: today };

  const [clickHash, copyHash, orders, monthOrders] = await Promise.all([
    kv.hgetall<Record<string, number>>(K.clicks(partner.code)),
    kv.hgetall<Record<string, number>>(K.copies(partner.code)),
    getOrdersInRange(K.partnerOrders(partner.code), range),
    getOrdersInRange(K.partnerOrders(partner.code), month),
  ]);
  const clicks = sumCounts(clickHash, range);
  const copies = sumCounts(copyHash, range);
  const perf = summarizeOrders(orders);

  return res.status(200).json({
    partner: publicPartner(partner),
    range,
    rate: COMMISSION_RATE,
    performance: { clicks: clicks.total, orders: perf.orders, sales: perf.sales, commission: perf.commission },
    month: {
      pending: summarizeOrders(monthOrders).commission,
      confirmed: 0, // 2차: 30일 후 승인
      paid: 0, // 2차: 월 정산
      nextPayout: nextPayoutDate(today),
    },
    links: linkRows(clicks.byHandle, copies.byHandle, orders),
  });
}

// ─── 관리자 ───────────────────────────────────────────────────────────────────

function adminOrder(o: Commission, partners: Map<string, Partner>) {
  const p = partners.get(o.code);
  return { ...o, partnerName: p?.name || '', partnerEmail: p?.email || '' };
}

async function handleAdminSummary(req: VercelRequest, res: VercelResponse) {
  const range = readRange(req);
  const [partners, orders] = await Promise.all([getAllPartners(), getOrdersInRange(K.orders, range)]);

  let clicks = 0;
  let copies = 0;
  let clickingPartners = 0;
  const clicksByDate: Record<string, number> = {};
  await Promise.all(
    partners.map(async (p) => {
      const [c, cp] = await Promise.all([
        kv.hgetall<Record<string, number>>(K.clicks(p.code)),
        kv.hgetall<Record<string, number>>(K.copies(p.code)),
      ]);
      const cs = sumCounts(c, range);
      clicks += cs.total;
      if (cs.total > 0) clickingPartners += 1;
      copies += sumCounts(cp, range).total;
      Object.entries(cs.byDate).forEach(([d, n]) => (clicksByDate[d] = (clicksByDate[d] || 0) + n));
    }),
  );

  // 일별 매출(GMV)·주문 수 — 기간의 모든 날짜를 0으로 채운다
  const daily: { date: string; gmv: number; orders: number; commission: number; clicks: number }[] = [];
  for (let t = kstStartMs(range.from); t <= kstStartMs(range.to); t += 24 * 60 * 60 * 1000) {
    const date = kstDate(t);
    daily.push({ date, gmv: 0, orders: 0, commission: 0, clicks: clicksByDate[date] || 0 });
  }
  const byDate = new Map(daily.map((d) => [d.date, d]));
  orders.filter(counts).forEach((o) => {
    const d = byDate.get(kstDate(o.createdAt));
    if (!d) return;
    d.gmv = round2(d.gmv + o.baseAmount);
    d.orders += 1;
    d.commission = round2(d.commission + o.commission);
  });

  const perf = summarizeOrders(orders);
  const activeCodes = new Set(orders.filter(counts).map((o) => o.code));
  return res.status(200).json({
    range,
    totals: {
      gmv: perf.sales,
      orders: perf.orders,
      commission: perf.commission,
      clicks,
      copies,
      conversion: clicks ? round2((perf.orders / clicks) * 100) : 0,
      partners: partners.filter((p) => p.status !== 'removed').length,
      newPartners: partners.filter((p) => inRange(kstDate(p.joinedAt), range)).length,
      clickingPartners, // 기간 안에 링크 클릭이 1번 이상
      activePartners: activeCodes.size, // 기간 안에 커미션 주문이 1건 이상
      excluded: orders.filter((o) => o.status === 'excluded').length,
      excludedAmount: round2(orders.filter((o) => o.status === 'excluded').reduce((t, o) => t + o.baseAmount, 0)),
      void: orders.filter((o) => o.status === 'void').length,
    },
    daily,
  });
}

async function handleAdminOrders(req: VercelRequest, res: VercelResponse) {
  const range = readRange(req);
  const [partners, orders] = await Promise.all([getAllPartners(), getOrdersInRange(K.orders, range)]);
  const map = new Map(partners.map((p) => [p.code, p]));
  orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return res.status(200).json({ range, orders: orders.map((o) => adminOrder(o, map)) });
}

async function partnerStats(p: Partner, range: { from: string; to: string }) {
  const [c, cp, orders] = await Promise.all([
    kv.hgetall<Record<string, number>>(K.clicks(p.code)),
    kv.hgetall<Record<string, number>>(K.copies(p.code)),
    getOrdersInRange(K.partnerOrders(p.code), range),
  ]);
  const clicks = sumCounts(c, range);
  const copies = sumCounts(cp, range);
  return { clicks, copies, orders, perf: summarizeOrders(orders) };
}

function adminPartner(p: Partner) {
  return {
    code: p.code,
    name: p.name,
    email: p.email,
    country: p.country ?? null,
    status: p.status,
    joinedAt: p.joinedAt,
    paypalEmail: p.paypalEmail,
    paypalUpdatedAt: p.paypalUpdatedAt,
  };
}

async function handleAdminPartners(req: VercelRequest, res: VercelResponse) {
  const range = readRange(req);
  const partners = await getAllPartners();
  const rows = await Promise.all(
    partners.map(async (p) => {
      const s = await partnerStats(p, range);
      return {
        ...adminPartner(p),
        clicks: s.clicks.total,
        copies: s.copies.total,
        orders: s.perf.orders,
        sales: s.perf.sales,
        commission: s.perf.commission,
      };
    }),
  );
  rows.sort((a, b) => b.sales - a.sales || b.clicks - a.clicks || b.joinedAt.localeCompare(a.joinedAt));
  return res.status(200).json({ range, partners: rows });
}

async function handleAdminPartner(req: VercelRequest, res: VercelResponse) {
  const code = normalizeCode(req.query.code);
  const partner = code ? await getPartner(code) : null;
  if (!partner) return res.status(404).json({ error: 'Not found' });
  const range = readRange(req);
  const s = await partnerStats(partner, range);
  const [paypalHistory, allIds] = await Promise.all([
    kv.lrange(K.paypalHistory(partner.code), 0, 19),
    kv.zrange<string[]>(K.partnerOrders(partner.code), 0, -1),
  ]);
  const allOrders = await getOrders(allIds.map(String));
  allOrders.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return res.status(200).json({
    range,
    partner: { ...adminPartner(partner), consent: partner.consent, statusHistory: partner.statusHistory },
    performance: { clicks: s.clicks.total, copies: s.copies.total, ...s.perf },
    links: linkRows(s.clicks.byHandle, s.copies.byHandle, s.orders),
    orders: allOrders, // 전체 기간
    paypalHistory,
  });
}

async function handleAdminPartnerStatus(req: VercelRequest, res: VercelResponse) {
  const body = (req.body ?? {}) as { code?: unknown; status?: unknown };
  const code = normalizeCode(body.code);
  const status = body.status;
  if (!code || (status !== 'active' && status !== 'suspended' && status !== 'removed')) {
    return res.status(400).json({ error: 'Invalid request' });
  }
  const partner = await getPartner(code);
  if (!partner) return res.status(404).json({ error: 'Not found' });
  if (partner.status === status) return res.status(200).json({ partner: adminPartner(partner) });
  const updated: Partner = {
    ...partner,
    status,
    statusHistory: [...partner.statusHistory, { at: new Date().toISOString(), from: partner.status, to: status }],
  };
  await kv.set(K.partner(code), updated);
  return res.status(200).json({ partner: adminPartner(updated) });
}

// 관리자 수동 무효(Void)·되돌리기
async function handleAdminVoid(req: VercelRequest, res: VercelResponse) {
  const body = (req.body ?? {}) as { orderId?: unknown; void?: unknown };
  const orderId = typeof body.orderId === 'string' ? body.orderId : '';
  const existing = orderId ? await kv.get<Commission>(K.order(orderId)) : null;
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const now = new Date().toISOString();
  let updated: Commission;
  if (body.void === true) {
    if (existing.manualVoid) return res.status(200).json({ order: existing });
    updated = {
      ...existing,
      manualVoid: true,
      status: 'void',
      reason: 'manual',
      commission: 0,
      updatedAt: now,
      history: [...existing.history, { at: now, change: `관리자 무효 (${existing.status} → void)` }],
    };
  } else {
    if (!existing.manualVoid) return res.status(200).json({ order: existing });
    // 되돌리면 다음 수집 때 상태·금액을 다시 계산한다. 그 전까지는 대기로 표시
    updated = {
      ...existing,
      manualVoid: false,
      status: 'pending',
      reason: null,
      commission: round2(existing.baseAmount * existing.rate),
      updatedAt: now,
      history: [...existing.history, { at: now, change: '관리자 무효 취소 (void → pending, 다음 수집 때 재계산)' }],
    };
  }
  await kv.set(K.order(orderId), updated);
  return res.status(200).json({ order: updated });
}

// ─── 주문 수집 (정기 작업) ────────────────────────────────────────────────────

interface ShopifyOrderNode {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
  email: string | null;
  customAttributes: { key: string; value: string | null }[];
  currentSubtotalPriceSet: { shopMoney: { amount: string; currencyCode: string } };
  customer: { id: string; tags: string[] } | null;
  shippingAddress: { address1: string | null; zip: string | null } | null;
}

const ORDERS_QUERY = `
  query($q: String!, $after: String) {
    orders(first: 100, after: $after, query: $q, sortKey: UPDATED_AT) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id name createdAt updatedAt cancelledAt email
        customAttributes { key value }
        currentSubtotalPriceSet { shopMoney { amount currencyCode } }
        customer { id tags }
        shippingAddress { address1 zip }
      }
    }
  }
`;

const addressKey = (a: { address1: string | null; zip: string | null } | null | undefined) => {
  const line = (a?.address1 || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const zip = (a?.zip || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return line && zip ? `${line}|${zip}` : '';
};

// 파트너 기본 배송지 (본인 구매 판별용) — 수집 1회 안에서만 캐시
async function partnerAddressKey(p: Partner, cache: Map<string, string>): Promise<string> {
  if (cache.has(p.customerId)) return cache.get(p.customerId)!;
  let key = '';
  try {
    const data = await adminGraphql<{ customer: { defaultAddress: { address1: string | null; zip: string | null } | null } | null }>(
      `query($id: ID!) { customer(id: $id) { defaultAddress { address1 zip } } }`,
      { id: p.customerId },
    );
    key = addressKey(data.customer?.defaultAddress);
  } catch {
    key = '';
  }
  cache.set(p.customerId, key);
  return key;
}

function attr(node: ShopifyOrderNode, key: string): string | null {
  return node.customAttributes.find((a) => a.key === key)?.value ?? null;
}

// 주문 1건 → 커미션 1줄. 같은 주문을 다시 읽으면 바뀐 값만 이력에 남기고 덮는다
async function upsertCommission(node: ShopifyOrderNode, addrCache: Map<string, string>): Promise<'new' | 'updated' | 'same' | 'skip'> {
  const code = normalizeCode(attr(node, '_aff'));
  if (!code) return 'skip';
  const partner = await getPartner(code);
  if (!partner) return 'skip'; // 없는 코드 (조작·오타)

  const existing = await kv.get<Commission>(K.order(node.id));
  const baseAmount = round2(Number(node.currentSubtotalPriceSet.shopMoney.amount) || 0);
  const rate = existing?.rate ?? COMMISSION_RATE; // 요율은 처음 기록한 값으로 고정

  // 상태 판정 (우선순위: 취소 > 관리자 무효 > 본인 구매 > B2B > 파트너 정지 > 대기)
  const orderEmail = (node.email || '').toLowerCase();
  const isSelf =
    node.customer?.id === partner.customerId ||
    (!!orderEmail && orderEmail === partner.email) ||
    (!!addressKey(node.shippingAddress) && addressKey(node.shippingAddress) === (await partnerAddressKey(partner, addrCache)));
  const isB2B = (node.customer?.tags || []).some((t) => t.trim().toUpperCase() === 'B2B');

  let status: CommissionStatus = 'pending';
  let reason: string | null = null;
  if (node.cancelledAt) [status, reason] = ['void', 'cancelled'];
  else if (existing?.manualVoid) [status, reason] = ['void', 'manual'];
  else if (isSelf) [status, reason] = ['excluded', 'self'];
  else if (isB2B) [status, reason] = ['excluded', 'b2b'];
  else if (partner.status !== 'active' && !existing) [status, reason] = ['excluded', 'partner-suspended'];
  else if (existing?.reason === 'partner-suspended') [status, reason] = ['excluded', 'partner-suspended'];

  const commission = status === 'pending' ? round2(baseAmount * rate) : 0;
  const now = new Date().toISOString();

  if (!existing) {
    const record: Commission = {
      orderId: node.id,
      orderName: node.name,
      createdAt: node.createdAt,
      code,
      handle: normalizeHandle(attr(node, '_aff_p')),
      clickedAt: attr(node, '_aff_at'),
      customerEmail: orderEmail || null,
      guest: !node.customer,
      baseAmount,
      currency: node.currentSubtotalPriceSet.shopMoney.currencyCode,
      rate,
      commission,
      status,
      reason,
      manualVoid: false,
      updatedAt: now,
      history: [{ at: now, change: `수집: ${status}${reason ? `(${reason})` : ''} · 기준 ${baseAmount} · 커미션 ${commission}` }],
    };
    const score = new Date(node.createdAt).getTime();
    await kv.set(K.order(node.id), record);
    await kv.zadd(K.orders, { score, member: node.id });
    await kv.zadd(K.partnerOrders(code), { score, member: node.id });
    return 'new';
  }

  const changes: string[] = [];
  if (existing.baseAmount !== baseAmount) changes.push(`기준 금액 ${existing.baseAmount} → ${baseAmount}`);
  if (existing.status !== status || existing.reason !== reason) {
    changes.push(`상태 ${existing.status}${existing.reason ? `(${existing.reason})` : ''} → ${status}${reason ? `(${reason})` : ''}`);
  }
  if (existing.commission !== commission) changes.push(`커미션 ${existing.commission} → ${commission}`);
  if (!changes.length) return 'same';

  await kv.set(K.order(node.id), {
    ...existing,
    baseAmount,
    status,
    reason,
    commission,
    updatedAt: now,
    history: [...existing.history, { at: now, change: changes.join(' · ') }],
  } satisfies Commission);
  return 'updated';
}

async function runSync(): Promise<Record<string, number | string>> {
  // 겹쳐 실행되지 않게 잠금 (최대 5분)
  if (!(await kv.set(K.syncLock, '1', { nx: true, ex: 300 }))) return { skipped: 'locked' };
  try {
    const startedAt = new Date();
    const cursor = (await kv.get<string>(K.syncCursor)) || SYNC_START;
    const since = new Date(new Date(cursor).getTime() - SYNC_OVERLAP_MS).toISOString();
    const q = `updated_at:>='${since}'`;

    const stats = { scanned: 0, new: 0, updated: 0, same: 0, skip: 0 };
    const addrCache = new Map<string, string>();
    let after: string | null = null;
    do {
      const data: { orders: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: ShopifyOrderNode[] } } =
        await adminGraphql(ORDERS_QUERY, { q, after });
      for (const node of data.orders.nodes) {
        stats.scanned += 1;
        stats[await upsertCommission(node, addrCache)] += 1;
      }
      after = data.orders.pageInfo.hasNextPage ? data.orders.pageInfo.endCursor : null;
    } while (after);

    await kv.set(K.syncCursor, startedAt.toISOString());
    return { since, ...stats };
  } finally {
    await kv.del(K.syncLock);
  }
}

async function handleSync(req: VercelRequest, res: VercelResponse) {
  const isCron = !!req.headers['x-vercel-cron'];
  const cronSecret = process.env.CRON_SECRET;
  const bearerOk = !!cronSecret && req.headers.authorization === `Bearer ${cronSecret}`;
  // CRON_SECRET이 있으면 Vercel이 정기 작업에 Bearer로 붙여 보낸다 — 그때는 헤더만으로는 통과시키지 않는다
  const cronOk = cronSecret ? bearerOk : isCron;
  if (!cronOk && !isAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });
  // 두 프로젝트가 vercel.json cron을 공유한다 — 자동 수집은 B2B 사이트(biteme.one)에서만
  if (isCron && process.env.SITE_MODE === 'b2c') return res.status(200).json({ skipped: 'cron runs on biteme.one' });
  const result = await runSync();
  return res.status(200).json({ ok: true, ...result });
}

// ─── 라우터 ───────────────────────────────────────────────────────────────────

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<unknown>;

const CUSTOMER_ROUTES: Record<string, { method: 'GET' | 'POST'; fn: Handler }> = {
  me: { method: 'GET', fn: handleMe },
  join: { method: 'POST', fn: handleJoin },
  copy: { method: 'POST', fn: handleCopy },
  click: { method: 'POST', fn: handleClick },
  dashboard: { method: 'GET', fn: handleDashboard },
  paypal: { method: 'POST', fn: handlePaypal },
};

const ADMIN_ROUTES: Record<string, { method: 'GET' | 'POST'; fn: Handler }> = {
  'admin-summary': { method: 'GET', fn: handleAdminSummary },
  'admin-orders': { method: 'GET', fn: handleAdminOrders },
  'admin-partners': { method: 'GET', fn: handleAdminPartners },
  'admin-partner': { method: 'GET', fn: handleAdminPartner },
  'admin-partner-status': { method: 'POST', fn: handleAdminPartnerStatus },
  'admin-void': { method: 'POST', fn: handleAdminVoid },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = String(req.query.action || '');
  try {
    if (action === 'sync') return await handleSync(req, res);

    const adminRoute = ADMIN_ROUTES[action];
    if (adminRoute) {
      if (req.method !== adminRoute.method) return res.status(405).json({ error: 'Method not allowed' });
      if (!isAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });
      return await adminRoute.fn(req, res);
    }

    const route = CUSTOMER_ROUTES[action];
    if (!route) return res.status(404).json({ error: 'Not found' });
    // 고객용 기능은 B2C 사이트 전용
    if (process.env.SITE_MODE !== 'b2c') return res.status(404).json({ error: 'Not found' });
    if (req.method !== route.method) return res.status(405).json({ error: 'Method not allowed' });
    if (req.method === 'POST' && isCrossOrigin(req)) return res.status(403).json({ error: 'Forbidden' });
    return await route.fn(req, res);
  } catch (error) {
    console.error(`[Affiliate Program] ${action} error:`, error);
    return res.status(500).json({ error: 'Server error' });
  }
}
