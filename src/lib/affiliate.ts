// B2C 어필리에이트 (biteme-us.com) — 화면 공용 코드
// 링크 귀속: /a/{코드}?p=/product/{상품} 로 들어오면 코드를 브라우저에 30일 저장한다(마지막 클릭이 덮어씀).
// 결제 화면을 만들 때 저장된 코드를 주문 속성 _aff 로 붙이고, 서버 정기 수집이 커미션을 기록한다.
// 기존 biteme.one 어필리에이트(localStorage affiliate_discount, 15% 코드)와는 별개.

import { getAccessToken, refreshAccessToken } from '@/lib/customer-auth';
import { B2C_SITE_URL } from '@/lib/site';
import type { AffiliateJoinProfile } from '@/components/affiliate/joinProfile';

export const AFFILIATE_RATE = 0.1;
export const AFFILIATE_MIN_PAYOUT = 20;
export const AFFILIATE_TRACKING_DAYS = 30;
// D6 법무 검토 후 약관 주소로 교체
export const AFFILIATE_TERMS_URL = '/terms';

const STORAGE_KEY = 'biteme-aff';
const TTL_MS = AFFILIATE_TRACKING_DAYS * 24 * 60 * 60 * 1000;

export interface AffiliateAttribution {
  code: string;
  handle: string | null;
  at: string; // 클릭 시각 ISO
}

export function normalizeAffiliateCode(raw: string | null | undefined): string | null {
  const code = (raw || '').trim().toUpperCase();
  return /^[A-Z0-9]{6}$/.test(code) ? code : null;
}

export function saveAttribution(code: string, handle: string | null): void {
  try {
    const value: AffiliateAttribution = { code, handle, at: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // 저장 불가(사생활 보호 모드 등) — 귀속 없이 진행
  }
}

export function getAttribution(): AffiliateAttribution | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<AffiliateAttribution>;
    const code = normalizeAffiliateCode(value.code);
    const at = typeof value.at === 'string' ? Date.parse(value.at) : NaN;
    if (!code || Number.isNaN(at) || Date.now() - at > TTL_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return { code, handle: typeof value.handle === 'string' ? value.handle : null, at: value.at as string };
  } catch {
    return null;
  }
}

// 결제 생성(cartCreate) 시 붙일 주문 속성. 밑줄로 시작하는 키는 결제 화면에 보이지 않는다.
export function getAttributionCartAttributes(): { key: string; value: string }[] {
  const a = getAttribution();
  if (!a) return [];
  const attrs = [
    { key: '_aff', value: a.code },
    { key: '_aff_at', value: a.at },
  ];
  if (a.handle) attrs.push({ key: '_aff_p', value: a.handle });
  return attrs;
}

// 파트너 공유 링크 — 상품 handle이 없으면 홈. 미리보기 배포에서도 항상 운영 B2C 주소로 만든다
export function buildAffiliateLink(code: string, handle?: string | null): string {
  const base = `${B2C_SITE_URL}/a/${code}`;
  return handle ? `${base}?p=${encodeURIComponent(`/product/${handle}`)}` : base;
}

// 화면 표시용 짧은 링크 (https://www. 생략)
export function displayAffiliateLink(code: string): string {
  return buildAffiliateLink(code).replace(/^https?:\/\/(www\.)?/, '');
}

export function estimateCommission(price: number): number {
  return Math.round(price * AFFILIATE_RATE * 100) / 100;
}

export function formatUsd(n: number): string {
  return `$${n.toFixed(2)}`;
}

// ─── API ──────────────────────────────────────────────────────────────────────

export interface AffiliatePartner {
  code: string;
  status: 'active' | 'suspended' | 'removed';
  joinedAt: string;
  paypalEmail: string | null;
  paypalUpdatedAt: string | null;
}

export interface AffiliateLinkRow {
  handle: string;
  clicks: number;
  copies: number;
  orders: number;
  commission: number;
}

export interface AffiliateDashboard {
  partner: AffiliatePartner;
  range: { from: string; to: string };
  rate: number;
  performance: { clicks: number; orders: number; sales: number; commission: number };
  confirmDays: number;
  minPayout: number;
  // 기간과 상관없는 잔액: 대기 / 확정(미지급) / 지급 누계
  month: { pending: number; confirmed: number; paid: number; nextPayout: string };
  links: AffiliateLinkRow[];
}

export class AffiliateApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function call<T>(action: string, init: { method: 'GET' | 'POST'; body?: unknown; query?: Record<string, string>; auth?: boolean }): Promise<T> {
  const qs = new URLSearchParams({ action, ...(init.query || {}) });
  const send = (token: string | null) =>
    fetch(`/api/affiliate-program?${qs}`, {
      method: init.method,
      headers: {
        ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: token } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });

  let token = init.auth ? getAccessToken() || (await refreshAccessToken()) : null;
  if (init.auth && !token) throw new AffiliateApiError(401, 'Not logged in');
  let res = await send(token);
  // 고객 토큰이 막 만료된 경우 한 번 갱신해서 다시 시도
  if (res.status === 401 && init.auth) {
    token = await refreshAccessToken();
    if (!token) throw new AffiliateApiError(401, 'Not logged in');
    res = await send(token);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new AffiliateApiError(res.status, (data as { error?: string }).error || 'Request failed');
  return data as T;
}

export function fetchMyPartner(): Promise<{ partner: AffiliatePartner | null; removed?: boolean }> {
  return call('me', { method: 'GET', auth: true });
}

// profile(이름·거주 국가·주소)은 서버가 아직 저장하지 않는다 — api/affiliate-program.ts handleJoin에서 body.profile을 읽도록 연결 예정
export function joinAffiliate(profile: AffiliateJoinProfile): Promise<{ partner: AffiliatePartner; created: boolean }> {
  return call('join', { method: 'POST', auth: true, body: { age18: true, terms: true, profile } });
}

export function recordLinkCopy(handle: string | null): void {
  call('copy', { method: 'POST', auth: true, body: { handle } }).catch(() => {});
}

// 브라우저별 방문자 ID — 같은 와이파이(같은 IP)를 쓰는 다른 사람의 클릭도 각각 세기 위해
const VISITOR_KEY = 'biteme-aff-vid';
function getVisitorId(): string | null {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

export function recordAffiliateClick(code: string, handle: string | null): void {
  call('click', { method: 'POST', body: { code, handle, vid: getVisitorId() } }).catch(() => {});
}

export function fetchAffiliateDashboard(range: { from: string; to: string }): Promise<AffiliateDashboard> {
  return call('dashboard', { method: 'GET', auth: true, query: range });
}

export function savePaypalEmail(email: string): Promise<{ partner: AffiliatePartner }> {
  return call('paypal', { method: 'POST', auth: true, body: { email } });
}
