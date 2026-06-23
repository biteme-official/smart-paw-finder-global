import { defineConfig, loadEnv } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function mockApiPlugin(): Plugin {
  const mockData: Record<string, unknown> = {
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
        if (!(section in mockData)) { next(); return; }
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
