import { defineConfig, loadEnv } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function mockApiPlugin(): Plugin {
  const now = new Date();
  const dailyOrders = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - 6 + i);
    return {
      date: d.toISOString().slice(0, 10),
      orders: [18, 22, 15, 25, 20, 19, 23][i],
      revenue: [2310.5, 2890.0, 1850.75, 3120.0, 2650.25, 2480.0, 3148.5][i],
    };
  });

  const mockData: Record<string, unknown> = {
    overview: {
      today: { orders: 5, revenue: 645.0 },
      yesterday: { orders: 12, revenue: 1560.0 },
      week: { orders: 142, revenue: 18450.0 },
      counts: { all: 1243, pending: 8, todayAll: 5 },
      currency: 'USD',
    },
    dashboard: {
      summary: { totalOrders: 142, totalRevenue: 18450.0, averageOrderValue: 129.93, totalItemsSold: 389 },
      b2b: { totalOrders: 28, totalRevenue: 7200.0, averageOrderValue: 257.14 },
      b2c: { totalOrders: 114, totalRevenue: 11250.0, averageOrderValue: 98.68 },
      dailyOrders,
      topProducts: [
        { title: 'Smart Paw Finder Pro', quantity: 85, revenue: 8500.0 },
        { title: 'GPS Collar Tracker', quantity: 62, revenue: 4960.0 },
        { title: 'Pet Safety Bundle', quantity: 45, revenue: 2250.0 },
        { title: 'Rechargeable Beacon', quantity: 38, revenue: 1900.0 },
        { title: 'Premium Subscription', quantity: 28, revenue: 840.0 },
      ],
      lowStock: [
        { title: 'Smart Paw Finder Pro', variant: 'Black', quantity: 2 },
        { title: 'GPS Collar Tracker', variant: 'Small', quantity: 1 },
      ],
      currency: 'USD',
    },
    customers: {
      summary: { total: 530, noOrders: 177, oneOrder: 177, twoThree: 88, fourPlus: 88 },
      topCustomers: [
        { id: 'gid://shopify/Customer/1', name: 'Tanaka Yuki', email: 'tanaka@example.com', orders: 12, spent: '15600', currency: 'USD', createdAt: '2025-01-15T00:00:00Z', country: 'Japan', city: 'Tokyo', tags: ['vip'] },
        { id: 'gid://shopify/Customer/2', name: 'Kim Minsoo', email: 'kim@example.com', orders: 8, spent: '9840', currency: 'USD', createdAt: '2025-02-10T00:00:00Z', country: 'South Korea', city: 'Seoul', tags: [] },
        { id: 'gid://shopify/Customer/3', name: 'Chen Wei', email: 'chen@example.com', orders: 7, spent: '8470', currency: 'USD', createdAt: '2025-03-05T00:00:00Z', country: 'Taiwan', city: 'Taipei', tags: ['b2b'] },
      ],
      recentCustomers: [
        { id: 'gid://shopify/Customer/6', name: 'Sato Haruki', email: 'sato@example.com', orders: 1, spent: '1280', currency: 'USD', createdAt: '2026-06-14T10:00:00Z', country: 'Japan', city: 'Osaka', tags: [] },
      ],
    },
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
        const section = url.searchParams.get('section') ?? 'overview';
        const payload = mockData[section] ?? {};
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        res.end(JSON.stringify(payload));
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
