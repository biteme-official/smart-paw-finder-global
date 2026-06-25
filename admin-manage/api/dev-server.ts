import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const __dir = fileURLToPath(new URL('.', import.meta.url));

// ── .env 로드 ──
try {
  const envContent = readFileSync(resolve(__dir, '../.env'), 'utf-8');
  for (const line of envContent.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
} catch { /* .env 없으면 무시 */ }

// ── GA4 서비스 계정 JSON 로드 ──
if (!process.env.GA_SERVICE_ACCOUNT_JSON) {
  const jsonPath = process.env.GA_SA_JSON_PATH || '';
  try {
    process.env.GA_SERVICE_ACCOUNT_JSON = readFileSync(jsonPath, 'utf-8');
    console.log('[dev-server] GA 서비스 계정 로드됨');
  } catch {
    console.warn('[dev-server] ⚠ GA 서비스 계정 JSON 없음:', jsonPath);
  }
}

// ADMIN_SECRET은 프로덕션 secret 그대로 사용 (프록시 시 인증 유지)
// GA4 섹션은 Authorization 헤더를 로컬 ADMIN_SECRET으로 교체

const LOCAL_ADMIN_SECRET = process.env.ADMIN_SECRET || 'local-dev-secret';
process.env.ADMIN_SECRET = LOCAL_ADMIN_SECRET;

// ── 프로세스 크래시 방지 ──
process.on('uncaughtException', (err) => console.error('[dev-server] uncaughtException:', err));
process.on('unhandledRejection', (err) => console.error('[dev-server] unhandledRejection:', err));

// ── 핸들러 임포트 (env 설정 후) ──
const { default: handler } = await import('./admin-manage.js');

// GA4 섹션: 로컬 처리 / 나머지: 프로덕션 프록시
const GA_SECTIONS = new Set(['ga-behavior', 'ga-overview', 'ga-funnel', 'ga-traffic']);
const PROD_API = 'https://biteme-admin-manage.vercel.app';
const PORT = 3000;

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url!, `http://localhost:${PORT}`);
  const section = url.searchParams.get('section') || '';

  // ── overview: 로컬 auth-ping (Shopify 없이 인증 확인만) ──
  if (section === 'overview') {
    const authHeader = req.headers['authorization'] || '';
    if (authHeader === `Bearer ${LOCAL_ADMIN_SECRET}`) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } else {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
    }
    return;
  }

  // ── dashboard: Shopify 자격증명 있으면 실제 데이터, 없으면 range 비례 mock ──
  if (section === 'dashboard') {
    const hasShopify = !!(
      process.env.VITE_SHOPIFY_STORE_DOMAIN &&
      (process.env.REPORT_SHOPIFY_CLIENT_ID || process.env.VITE_SHOPIFY_CLIENT_ID) &&
      (process.env.REPORT_SHOPIFY_CLIENT_SECRET || process.env.SHOPIFY_CLIENT_SECRET)
    );

    if (hasShopify) {
      const query: Record<string, string> = {};
      url.searchParams.forEach((v, k) => { query[k] = v; });
      const vReq = {
        method: req.method, url: req.url, query,
        headers: { authorization: `Bearer ${LOCAL_ADMIN_SECRET}` }, body: null,
      } as unknown as VercelRequest;
      let statusCode = 200;
      const resHeaders: Record<string, string> = {};
      const vRes = {
        status(code: number) { statusCode = code; return this; },
        setHeader(k: string, v: string) { resHeaders[k] = v; return this; },
        json(data: unknown) {
          resHeaders['Content-Type'] ??= 'application/json';
          if (!res.headersSent) { res.writeHead(statusCode, resHeaders); res.end(JSON.stringify(data)); }
        },
        send(body: string) {
          if (!res.headersSent) { res.writeHead(statusCode, resHeaders); res.end(body); }
        },
      } as unknown as VercelResponse;
      try { await handler(vReq, vRes); } catch (err) {
        console.error('[dev-server] dashboard Shopify 오류:', err);
        if (!res.headersSent) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Shopify error' })); }
      }
      return;
    }

    // Shopify 자격증명 없음 → range 비례 mock (날짜 필터 동작 확인용)
    const range = url.searchParams.get('range') || '7d';
    const mult = range === 'today' ? 0.1 : range === '28d' ? 4 : range === '90d' ? 12 : 1;
    const numDays = range === 'today' ? 1 : range === '28d' ? 28 : range === '90d' ? 90 : 7;
    const todayDate = new Date();
    const dailyArr = Array.from({ length: numDays }, (_, i) => {
      const d = new Date(todayDate); d.setDate(todayDate.getDate() - (numDays - 1) + i);
      return {
        date: d.toISOString().slice(0, 10),
        orders: Math.max(1, Math.round((3 + (i % 5)) * (numDays / 7))),
        revenue: Math.round((200 + (i * 47) % 400) * (numDays / 7) * 100) / 100,
      };
    });
    const r = (base: number) => Math.round(base * mult * 100) / 100;
    const ri = (base: number) => Math.max(0, Math.round(base * mult));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      summary: { totalOrders: ri(42), totalRevenue: r(5831.50), averageOrderValue: 138.85, totalItemsSold: ri(89) },
      b2b: { totalOrders: ri(8), totalRevenue: r(2240), averageOrderValue: 280 },
      b2c: { totalOrders: ri(34), totalRevenue: r(3591.50), averageOrderValue: 105.63 },
      dailyOrders: dailyArr,
      topProducts: [
        { title: 'Smart Paw Finder Pro', quantity: ri(24), revenue: r(2399.76) },
        { title: 'GPS Collar Tracker', quantity: ri(18), revenue: r(1799.82) },
        { title: 'Paw Health Monitor', quantity: ri(12), revenue: r(839.88) },
        { title: 'Smart Feeder Bundle', quantity: ri(9), revenue: r(539.91) },
        { title: 'Pet Activity Band', quantity: ri(6), revenue: r(179.94) },
      ],
      countryOrders: [
        { country: 'JP', orders: ri(18) }, { country: 'KR', orders: ri(12) },
        { country: 'US', orders: ri(7) }, { country: 'AU', orders: ri(3) }, { country: 'SG', orders: ri(2) },
      ],
      lowStock: [
        { title: 'GPS Collar Tracker', variant: 'Black M', quantity: 2 },
        { title: 'Smart Paw Finder Pro', variant: 'Blue', quantity: 3 },
      ],
      currency: 'USD',
      brandSales: [
        { brand: 'Biteme', quantity: ri(48), revenue: r(4799.52) },
        { brand: 'PawTech', quantity: ri(24), revenue: r(839.88) },
        { brand: 'FurCare', quantity: ri(17), revenue: r(191.83) },
      ],
      countryRevenue: [
        { country: 'JP', revenue: r(2541.30) }, { country: 'KR', revenue: r(1659.60) },
        { country: 'US', revenue: r(969.95) }, { country: 'AU', revenue: r(414.75) }, { country: 'SG', revenue: r(276.50) },
      ],
    }));
    return;
  }

  // ── GA4 섹션: 로컬 핸들러 ──
  if (GA_SECTIONS.has(section)) {
    const query: Record<string, string> = {};
    url.searchParams.forEach((v, k) => { query[k] = v; });

    const vercelReq = {
      method: req.method,
      url: req.url,
      query,
      // ADMIN_SECRET과 일치하는 Authorization 주입
      headers: { authorization: `Bearer ${LOCAL_ADMIN_SECRET}` },
      body: null,
    } as unknown as VercelRequest;

    let statusCode = 200;
    const resHeaders: Record<string, string> = {};

    const vercelRes = {
      status(code: number) { statusCode = code; return this; },
      setHeader(k: string, v: string) { resHeaders[k] = v; return this; },
      json(data: unknown) {
        resHeaders['Content-Type'] = 'application/json';
        if (!res.headersSent) {
          res.writeHead(statusCode, resHeaders);
          res.end(JSON.stringify(data));
        }
      },
      send(body: string) {
        if (!res.headersSent) {
          res.writeHead(statusCode, resHeaders);
          res.end(body);
        }
      },
    } as unknown as VercelResponse;

    try {
      await handler(vercelReq, vercelRes);
    } catch (err) {
      console.error('[dev-server] GA 핸들러 오류:', err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    }
    return;
  }

  // ── 나머지 섹션: 프로덕션 프록시 ──
  try {
    const prodUrl = `${PROD_API}${req.url}`;
    const authHeader = req.headers['authorization'] || '';
    const proxyRes = await fetch(prodUrl, {
      headers: { authorization: authHeader as string },
    });
    const body = await proxyRes.text();
    res.writeHead(proxyRes.status, { 'Content-Type': 'application/json' });
    res.end(body);
  } catch (err) {
    console.error('[dev-server] 프록시 오류:', err);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Proxy error' }));
    }
  }
});

server.listen(PORT, () => {
  console.log(`\n[dev-server] ✅ 로컬 API 서버: http://localhost:${PORT}`);
  console.log(`[dev-server] GA4_PROPERTY_ID = ${process.env.GA4_PROPERTY_ID}`);
  console.log(`[dev-server] GA 서비스 계정  = ${process.env.GA_SERVICE_ACCOUNT_JSON ? '✓ 로드됨' : '✗ 없음'}`);
  console.log('[dev-server] GA4 섹션 + 로그인: 로컬 처리 / 나머지: 프로덕션 프록시');
  console.log(`[dev-server] 로컬 로그인 비밀번호: ${LOCAL_ADMIN_SECRET}\n`);
});
