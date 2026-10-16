import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { shopifyProxyMiddleware } from "./server/shopify-proxy";
import { b2bProxyMiddleware } from "./server/b2b-proxy";
import { krReviewsMiddleware } from "./server/kr-reviews";
import { instagramProxyMiddleware } from "./server/instagram-proxy";
import { customerProxyMiddleware } from "./server/customer-proxy";
import { affiliateProxyMiddleware } from "./server/affiliate-proxy";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env so server middleware can access SHOPIFY_CLIENT_SECRET
  const env = loadEnv(mode, process.cwd(), '');
  Object.assign(process.env, env);

  // B2C 사이트: index.html의 검색·공유 정보(canonical, og:url 등) 주소를 VITE_SITE_URL로 교체.
  // 값이 없으면(B2B 사이트) index.html을 그대로 둔다.
  const siteUrlPlugin: Plugin | false = !!env.VITE_SITE_URL && {
    name: 'site-url-html',
    transformIndexHtml: (html) => html.replaceAll('https://biteme.one', env.VITE_SITE_URL),
  };

  return {
    server: {
      host: "::",
      port: 5173,
    },
    plugins: [
      react(),
      siteUrlPlugin,
      mode === "development" && componentTagger(),
      {
        name: 'shopify-proxy',
        configureServer(server) {
          server.middlewares.use(customerProxyMiddleware());
          server.middlewares.use(shopifyProxyMiddleware());
          server.middlewares.use(b2bProxyMiddleware());
          server.middlewares.use(krReviewsMiddleware());
          server.middlewares.use(instagramProxyMiddleware());
          server.middlewares.use(affiliateProxyMiddleware());
        },
      },
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
