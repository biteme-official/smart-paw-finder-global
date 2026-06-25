import { defineConfig, loadEnv } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function mockApiPlugin(): Plugin {
  const today = new Date();
  const daily7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today); d.setDate(today.getDate() - 6 + i);
    const iso = d.toISOString().slice(0, 10);
    return { date: iso, orders: Math.round(3 + Math.random() * 5), revenue: Math.round((200 + Math.random() * 400) * 100) / 100 };
  });

  const mockData: Record<string, unknown> = {
    // ── 로그인 인증 ──
    overview: { ok: true },

    // ── 대시보드 (Shopify) ──
    dashboard: {
      summary: { totalOrders: 42, totalRevenue: 5831.50, averageOrderValue: 138.85, totalItemsSold: 89 },
      b2b: { totalOrders: 8, totalRevenue: 2240.00, averageOrderValue: 280.00 },
      b2c: { totalOrders: 34, totalRevenue: 3591.50, averageOrderValue: 105.63 },
      dailyOrders: daily7,
      topProducts: [
        { title: 'Smart Paw Finder Pro', quantity: 24, revenue: 2399.76 },
        { title: 'GPS Collar Tracker', quantity: 18, revenue: 1799.82 },
        { title: 'Paw Health Monitor', quantity: 12, revenue: 839.88 },
        { title: 'Smart Feeder Bundle', quantity: 9, revenue: 539.91 },
        { title: 'Pet Activity Band', quantity: 6, revenue: 179.94 },
      ],
      countryOrders: [
        { country: 'JP', orders: 18 },
        { country: 'KR', orders: 12 },
        { country: 'US', orders: 7 },
        { country: 'AU', orders: 3 },
        { country: 'SG', orders: 2 },
      ],
      lowStock: [
        { title: 'GPS Collar Tracker', variant: 'Black M', quantity: 2 },
        { title: 'Smart Paw Finder Pro', variant: 'Blue', quantity: 3 },
      ],
      currency: 'USD',
      brandSales: [
        { brand: 'Biteme', quantity: 48, revenue: 4799.52 },
        { brand: 'PawTech', quantity: 24, revenue: 839.88 },
        { brand: 'FurCare', quantity: 17, revenue: 191.83 },
      ],
      countryRevenue: [
        { country: 'JP', revenue: 2541.30 },
        { country: 'KR', revenue: 1659.60 },
        { country: 'US', revenue: 969.95 },
        { country: 'AU', revenue: 414.75 },
        { country: 'SG', revenue: 276.50 },
      ],
    },

    // ── GA4 Overview ──
    'ga-overview': {
      available: true,
      sessions: 6240,
      users: 4820,
      bounceRate: 0.481,
      avgSessionDuration: 142,
      conversionRate: 0.42,
      purchases: 26,
      funnel: [
        { step: 'view_item', label: '상품 조회', count: 4180 },
        { step: 'add_to_cart', label: '장바구니', count: 820 },
        { step: 'begin_checkout', label: '결제 시작', count: 303 },
        { step: 'add_payment_info', label: '결제 정보', count: 58 },
        { step: 'purchase', label: '구매 완료', count: 26 },
      ],
      daily: daily7.map(d => ({
        date: d.date,
        sessions: Math.round(700 + Math.random() * 300),
        users: Math.round(550 + Math.random() * 200),
      })),
    },

    // ── GA4 Traffic ──
    'ga-traffic': {
      available: true,
      sources: [
        { source: 'google / organic', sessions: 2100, users: 1840, bounceRate: 42.3, avgSessionDuration: 185, revenue: 1240.50 },
        { source: '(direct) / (none)', sessions: 1480, users: 1230, bounceRate: 51.2, avgSessionDuration: 98, revenue: 890.00 },
        { source: 'instagram / social', sessions: 980, users: 820, bounceRate: 68.4, avgSessionDuration: 72, revenue: 420.30 },
        { source: 'google / cpc', sessions: 640, users: 580, bounceRate: 38.7, avgSessionDuration: 210, revenue: 1820.80 },
        { source: 'facebook / paid', sessions: 420, users: 380, bounceRate: 44.1, avgSessionDuration: 130, revenue: 680.00 },
        { source: 'email / newsletter', sessions: 280, users: 260, bounceRate: 28.5, avgSessionDuration: 240, revenue: 560.00 },
        { source: 'twitter / social', sessions: 180, users: 160, bounceRate: 72.0, avgSessionDuration: 55, revenue: 0 },
        { source: 'yahoo / organic', sessions: 160, users: 148, bounceRate: 55.3, avgSessionDuration: 110, revenue: 120.00 },
      ],
      countries: [
        { countryId: 'JP', country: 'Japan', sessions: 2240, users: 1820 },
        { countryId: 'KR', country: 'South Korea', sessions: 1680, users: 1340 },
        { countryId: 'US', country: 'United States', sessions: 980, users: 760 },
        { countryId: 'AU', country: 'Australia', sessions: 420, users: 340 },
        { countryId: 'SG', country: 'Singapore', sessions: 280, users: 220 },
        { countryId: 'GB', country: 'United Kingdom', sessions: 220, users: 180 },
        { countryId: 'CA', country: 'Canada', sessions: 180, users: 148 },
        { countryId: 'DE', country: 'Germany', sessions: 120, users: 98 },
      ],
      pages: [
        { path: '/', views: 8420, users: 3210 },
        { path: '/product/smart-paw-finder', views: 3840, users: 2180 },
        { path: '/product/gps-collar', views: 2160, users: 1420 },
        { path: '/checkout', views: 640, users: 580 },
        { path: '/blog', views: 720, users: 510 },
        { path: '/new-products', views: 480, users: 340 },
      ],
    },

    // ── GA4 Funnel ──
    'ga-funnel': {
      available: true,
      funnelSteps: [
        { step: 'view_item', label: '상품 조회' },
        { step: 'add_to_cart', label: '장바구니' },
        { step: 'begin_checkout', label: '결제 시작' },
        { step: 'add_payment_info', label: '결제 정보' },
        { step: 'purchase', label: '구매 완료' },
      ],
      dailyFunnel: daily7.map(d => ({
        date: d.date,
        view_item: Math.round(400 + Math.random() * 200),
        add_to_cart: Math.round(80 + Math.random() * 40),
        begin_checkout: Math.round(28 + Math.random() * 16),
        add_payment_info: Math.round(7 + Math.random() * 5),
        purchase: Math.round(2 + Math.random() * 3),
      })),
      sources: [
        { source: 'google / organic', sessions: 2100, purchases: 9, revenue: 1240.50, conversionRate: 0.43 },
        { source: 'google / cpc', sessions: 640, purchases: 8, revenue: 1820.80, conversionRate: 1.25 },
        { source: 'email / newsletter', sessions: 280, purchases: 5, revenue: 560.00, conversionRate: 1.79 },
        { source: '(direct) / (none)', sessions: 1480, purchases: 4, revenue: 890.00, conversionRate: 0.27 },
      ],
      pages: [
        { path: '/', views: 8420, bounceRate: 48.3, avgEngagement: 142 },
        { path: '/product/smart-paw-finder', views: 3840, bounceRate: 35.1, avgEngagement: 215 },
        { path: '/product/gps-collar', views: 2160, bounceRate: 38.7, avgEngagement: 198 },
      ],
      newVsRetFunnel: {
        new: [
          { step: 'view_item', label: '상품 조회', count: 2840, pct: 100 },
          { step: 'add_to_cart', label: '장바구니', count: 524, pct: 18.5 },
          { step: 'begin_checkout', label: '결제 시작', count: 189, pct: 6.7 },
          { step: 'purchase', label: '구매 완료', count: 16, pct: 0.6 },
        ],
        returning: [
          { step: 'view_item', label: '상품 조회', count: 1340, pct: 100 },
          { step: 'add_to_cart', label: '장바구니', count: 296, pct: 22.1 },
          { step: 'begin_checkout', label: '결제 시작', count: 114, pct: 8.5 },
          { step: 'purchase', label: '구매 완료', count: 10, pct: 0.7 },
        ],
      },
      hourly: Array.from({ length: 24 }, (_, h) => {
        const peak = h >= 10 && h <= 22;
        const sessions = peak ? Math.round(180 + Math.random() * 120) : Math.round(20 + Math.random() * 40);
        const purchases = Math.round(sessions * (peak ? 0.008 + Math.random() * 0.012 : 0.001 + Math.random() * 0.004));
        return { hour: h, sessions, purchases, cvr: sessions > 0 ? Math.round((purchases / sessions) * 10000) / 100 : 0 };
      }),
      cohort: {
        data: [
          { cohortWeek: '06/02주', retention: [100, 12, 8, 5, 3, null, null] },
          { cohortWeek: '06/09주', retention: [100, 14, 9, 6, null, null, null] },
          { cohortWeek: '06/16주', retention: [100, 11, 7, null, null, null, null] },
          { cohortWeek: '06/23주', retention: [100, 13, null, null, null, null, null] },
        ],
        maxWeeks: 7,
      },
    },

    // ── GA4 Behavior ──
    'ga-behavior': {
      available: true,
      pages: [
        { path: '/', title: '홈', views: 8420, users: 3210, avgDuration: 142, bounceRate: 48.3 },
        { path: '/product/smart-paw-finder', title: 'Smart Paw Finder', views: 3840, users: 2180, avgDuration: 215, bounceRate: 35.1 },
        { path: '/product/gps-collar', title: 'GPS Collar Tracker', views: 2160, users: 1420, avgDuration: 198, bounceRate: 38.7 },
        { path: '/checkout', title: 'Order Summary', views: 640, users: 580, avgDuration: 87, bounceRate: 22.4 },
        { path: '/checkout-return', title: 'Order Complete', views: 98, users: 94, avgDuration: 32, bounceRate: 82.1 },
        { path: '/blog', title: '블로그', views: 720, users: 510, avgDuration: 168, bounceRate: 54.6 },
        { path: '/new-products', title: '신상품', views: 480, users: 340, avgDuration: 124, bounceRate: 51.2 },
      ],
      events: [
        { name: 'page_view', count: 15840, users: 4820 },
        { name: 'session_start', count: 6240, users: 4820 },
        { name: 'view_item', count: 4180, users: 2640 },
        { name: 'add_to_cart', count: 820, users: 680 },
        { name: 'begin_checkout', count: 303, users: 280 },
        { name: 'scroll', count: 12400, users: 3960 },
        { name: 'click', count: 9820, users: 3740 },
        { name: 'add_payment_info', count: 58, users: 54 },
        { name: 'purchase', count: 26, users: 26 },
        { name: 'share', count: 142, users: 98 },
      ],
      devices: [
        { device: 'mobile', sessions: 3840, users: 2960, transactions: 14, revenue: 1820.5 },
        { device: 'desktop', sessions: 1980, users: 1420, transactions: 10, revenue: 1340.0 },
        { device: 'tablet', sessions: 420, users: 310, transactions: 2, revenue: 280.0 },
      ],
      newVsReturning: [
        { type: 'new', sessions: 4120, users: 3840, transactions: 18 },
        { type: 'returning', sessions: 2120, users: 980, transactions: 8 },
      ],
    },
  };

  return {
    name: 'mock-api-dev',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api/admin-manage')) { next(); return; }
        const url = new URL(req.url, 'http://localhost');
        const section = url.searchParams.get('section') ?? '';
        if (!(section in mockData)) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 400;
          res.end(JSON.stringify({ error: `Unknown section: ${section}` }));
          return;
        }
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        res.end(JSON.stringify(mockData[section]));
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  if (env.LOCAL_DEV) {
    return {
      plugins: [react(), tailwindcss()],
      server: { proxy: { '/api': 'http://localhost:3000' } },
    }
  }
  return {
    plugins: [react(), tailwindcss(), mockApiPlugin()],
    css: { postcss: {} },
  }
})
