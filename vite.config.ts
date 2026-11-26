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
import { popupSubscribeProxyMiddleware } from "./server/popup-subscribe-proxy";
import { affiliateProgramProxyMiddleware } from "./server/affiliate-program-proxy";

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

  // Google 태그 사이트별 분리: B2B와 B2C 데이터가 섞이지 않도록 한 사이트에 한 종류만 불러온다.
  // - B2B 사이트(biteme.one): index.html의 기존 GA4(G-H7171JQ75N)를 그대로 둔다.
  // - B2C 사이트(biteme-us.com, SITE_MODE=b2c): 그 구간을 지우고 GTM(GTM-KHK7DJ5R)만 넣는다.
  //   GA4(G-LKM994B6GS)는 GTM 컨테이너 안에서 설정한다.
  const B2C_GTM_ID = 'GTM-KHK7DJ5R';
  const googleTagPlugin: Plugin | false = env.SITE_MODE === 'b2c' && {
    name: 'b2c-google-tag',
    transformIndexHtml: (html) => {
      const b2bTag = /[ \t]*<!-- B2B_GOOGLE_TAG_START[\s\S]*?<!-- B2B_GOOGLE_TAG_END -->/;
      // 표시가 없으면 B2B GA4가 B2C에 그대로 남으므로 빌드를 멈춘다.
      if (!b2bTag.test(html) || !/<head[^>]*>/.test(html) || !/<body[^>]*>/.test(html)) {
        throw new Error('[b2c-google-tag] index.html에서 B2B_GOOGLE_TAG 구간 또는 <head>/<body>를 찾지 못했습니다.');
      }
      // Google Tag Manager 공식 설치 코드 (head 최대한 위쪽 스크립트 + body 바로 뒤 noscript)
      // gtag 함수만 정의 (GA4 config 없음): 코드의 gtag('event', ...) 호출이 dataLayer에 쌓이고,
      // GTM이 불러온 GA4(G-LKM994B6GS)가 처리한다. B2B GA4로는 가지 않는다.
      const gtmHead = `
    <!-- gtag 이벤트 전달용 (GA4 설정은 GTM 안에서) -->
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
    </script>
    <!-- Google Tag Manager -->
    <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
    new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
    j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
    'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
    })(window,document,'script','dataLayer','${B2C_GTM_ID}');</script>
    <!-- End Google Tag Manager -->`;
      const gtmBody = `
    <!-- Google Tag Manager (noscript) -->
    <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${B2C_GTM_ID}"
    height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
    <!-- End Google Tag Manager (noscript) -->`;
      return html
        .replace(b2bTag, '')
        .replace(/<head[^>]*>/, (tag) => tag + gtmHead)
        .replace(/<body[^>]*>/, (tag) => tag + gtmBody);
    },
  };

  return {
    server: {
      host: "::",
      port: 5173,
    },
    plugins: [
      react(),
      siteUrlPlugin,
      googleTagPlugin,
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
          server.middlewares.use(popupSubscribeProxyMiddleware());
          server.middlewares.use(affiliateProgramProxyMiddleware());
        },
      },
    ].filter(Boolean),
    // 서버와 같은 SITE_MODE 값을 화면 코드에서도 읽도록 노출 (src/lib/site.ts)
    define: {
      'import.meta.env.VITE_SITE_MODE': JSON.stringify(env.SITE_MODE || ''),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
