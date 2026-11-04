import type { VercelRequest, VercelResponse } from '@vercel/node';

// ─── Meta/Google 상품 피드 — biteme.one 도메인 기준 ────────────────────────────
// Shopify 스토어 기본 도메인(lovable-project-lbgum.myshopify.com)과 실제 서비스
// 도메인(biteme.one)이 달라, Shopify 앱 연동 카탈로그의 상품 URL이 광고 소스
// URL과 불일치하는 문제를 해결하기 위해 자체 피드를 생성한다.
// RSS 2.0 + g: 네임스페이스 포맷 — Meta 커머스 매니저 / Google Merchant Center 공통 지원.

// B2C 사이트는 Vercel 환경변수 VITE_SITE_URL로 자기 도메인 지정 (없으면 B2B 사이트 biteme.one)
const SITE_URL = process.env.VITE_SITE_URL || 'https://biteme.one';
const DEFAULT_BRAND = 'BITE ME';
const PRODUCTS_PER_PAGE = 100;
const MAX_PAGES = 30; // 안전장치 — 최대 3,000개 상품까지 수집

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt - 5 * 60 * 1000) return cachedToken;

  const shop = process.env.VITE_SHOPIFY_STORE_DOMAIN;
  const clientId = process.env.VITE_SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
  if (!shop || !clientId || !clientSecret) {
    throw new Error(`Missing env vars: shop=${!!shop}, clientId=${!!clientId}, secret=${!!clientSecret}`);
  }

  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token request failed (${response.status}): ${text.slice(0, 200)}`);
  }

  const data = await response.json();
  cachedToken = data.access_token;
  tokenExpiresAt = now + data.expires_in * 1000;
  return cachedToken!;
}

async function adminGraphQL(token: string, query: string, variables: Record<string, unknown> = {}) {
  const shop = process.env.VITE_SHOPIFY_STORE_DOMAIN;
  const res = await fetch(`https://${shop}/admin/api/2025-07/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Admin API error (${res.status}): ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(`Admin API GraphQL errors: ${JSON.stringify(json.errors)}`);
  return json;
}

interface ShopifyVariant {
  id: string;
  sku: string | null;
  availableForSale: boolean;
  price: string;
  compareAtPrice: string | null;
  image: { url: string } | null;
  selectedOptions: { name: string; value: string }[];
}

interface ShopifyProduct {
  id: string;
  handle: string;
  title: string;
  descriptionHtml: string;
  vendor: string;
  productType: string;
  featuredImage: { url: string } | null;
  variants: { edges: { node: ShopifyVariant }[] };
}

const PRODUCT_FEED_QUERY = `
  query ProductFeed($cursor: String, $perPage: Int!) {
    products(first: $perPage, after: $cursor, query: "status:active") {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          handle
          title
          descriptionHtml
          vendor
          productType
          featuredImage { url }
          variants(first: 100) {
            edges {
              node {
                id
                sku
                availableForSale
                price
                compareAtPrice
                image { url }
                selectedOptions { name value }
              }
            }
          }
        }
      }
    }
  }
`;

async function fetchShopCurrency(token: string): Promise<string> {
  const json = await adminGraphQL(token, `query { shop { currencyCode } }`);
  return json.data?.shop?.currencyCode || 'USD';
}

async function fetchAllProducts(token: string): Promise<ShopifyProduct[]> {
  const products: ShopifyProduct[] = [];
  let cursor: string | null = null;
  let hasNextPage = true;
  let page = 0;

  while (hasNextPage && page < MAX_PAGES) {
    const json = await adminGraphQL(token, PRODUCT_FEED_QUERY, { cursor, perPage: PRODUCTS_PER_PAGE });
    const connection = json.data?.products;
    for (const edge of connection?.edges ?? []) {
      products.push(edge.node);
    }
    hasNextPage = connection?.pageInfo?.hasNextPage ?? false;
    cursor = connection?.pageInfo?.endCursor ?? null;
    page += 1;
  }

  return products;
}

function numericId(gid: string): string {
  return gid.split('/').pop() || gid;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 5000);
}

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function cdata(s: string): string {
  return `<![CDATA[${s.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;
}

function buildVariantTitle(productTitle: string, options: { name: string; value: string }[]): string {
  const meaningful = options.filter((o) => o.name.toLowerCase() !== 'title');
  if (meaningful.length === 0) return productTitle;
  return `${productTitle} - ${meaningful.map((o) => o.value).join(' / ')}`;
}

function buildFeedItem(product: ShopifyProduct, variant: ShopifyVariant, currency: string): string {
  const productNumericId = numericId(product.id);
  const variantNumericId = numericId(variant.id);
  const link = `${SITE_URL}/product/${product.handle}`;
  const image = variant.image?.url || product.featuredImage?.url || '';
  const title = buildVariantTitle(product.title, variant.selectedOptions);
  const description = stripHtml(product.descriptionHtml) || product.title;
  const availability = variant.availableForSale ? 'in stock' : 'out of stock';
  const brand = product.vendor || DEFAULT_BRAND;

  const price = parseFloat(variant.price);
  const compareAtPrice = variant.compareAtPrice ? parseFloat(variant.compareAtPrice) : null;
  const onSale = compareAtPrice !== null && compareAtPrice > price;

  const priceFields = onSale
    ? `<g:price>${compareAtPrice!.toFixed(2)} ${currency}</g:price>\n    <g:sale_price>${price.toFixed(2)} ${currency}</g:sale_price>`
    : `<g:price>${price.toFixed(2)} ${currency}</g:price>`;

  return `  <item>
    <g:id>${xmlEscape(variantNumericId)}</g:id>
    <g:item_group_id>${xmlEscape(productNumericId)}</g:item_group_id>
    <title>${cdata(title)}</title>
    <description>${cdata(description)}</description>
    <g:link>${xmlEscape(link)}</g:link>
    <g:image_link>${xmlEscape(image)}</g:image_link>
    <g:availability>${availability}</g:availability>
    ${priceFields}
    <g:condition>new</g:condition>
    <g:brand>${cdata(brand)}</g:brand>
    <g:product_type>${cdata(product.productType || '')}</g:product_type>
    ${variant.sku ? `<g:mpn>${xmlEscape(variant.sku)}</g:mpn>` : ''}
  </item>`;
}

function buildFeedXml(products: ShopifyProduct[], currency: string): string {
  const items = products
    .flatMap((product) =>
      product.variants.edges
        .map((edge) => edge.node)
        .filter((variant) => !!variant.price)
        .map((variant) => buildFeedItem(product, variant, currency))
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
  <title>BITE ME Product Feed</title>
  <link>${SITE_URL}</link>
  <description>BITE ME global product catalog feed for Meta Commerce Manager</description>
${items}
</channel>
</rss>`;
}

// ─── 사이트맵 / robots.txt — 검색엔진에 공개 페이지 주소 목록 제공 ─────────────────
// /sitemap.xml, /robots.txt 가 vercel.json rewrite로 이 함수(type=sitemap|robots)에 연결된다.
// SITE_URL 기준이라 B2B·B2C 사이트가 각자 자기 주소로 출력한다.

// 블로그 글 목록 — src/data/blog/posts.ts 와 동일하게 유지 (api 함수는 src를 import하지 않는 구조)
const BLOG_POSTS: { slug: string; publishedAt: string }[] = [
  { slug: 'how-to-choose-nosework-toy-dog-skill-level', publishedAt: '2026-06-02' },
  { slug: 'tug-toys-vs-fetch-toys-which-does-your-dog-need', publishedAt: '2026-06-09' },
  { slug: 'summer-dog-toy-safety-materials-heat', publishedAt: '2026-06-16' },
  { slug: 'why-korean-pet-toys-taking-over-instagram', publishedAt: '2026-06-23' },
  { slug: 'dog-dental-health-toys-that-actually-clean-teeth', publishedAt: '2026-06-30' },
  { slug: 'rainy-day-indoor-activities-keep-dog-busy', publishedAt: '2026-07-07' },
  { slug: 'how-to-choose-right-dog-harness-size-guide', publishedAt: '2026-07-14' },
  { slug: 'traveling-with-your-dog-packing-essentials', publishedAt: '2026-07-21' },
  { slug: 'understanding-dog-play-styles-toy-matching', publishedAt: '2026-07-28' },
  { slug: 'first-time-dog-owner-toy-starter-kit', publishedAt: '2026-08-04' },
];

const STATIC_PATHS = ['/', '/about', '/blog', '/new-products', '/popup-offline-stores', '/contact', '/refund-policy', '/privacy', '/terms'];

const SITEMAP_QUERY = `
  query SitemapProducts($cursor: String) {
    products(first: 250, after: $cursor, query: "status:active") {
      pageInfo { hasNextPage endCursor }
      edges { node { handle updatedAt } }
    }
  }
`;

async function fetchSitemapProducts(token: string): Promise<{ handle: string; updatedAt: string }[]> {
  const items: { handle: string; updatedAt: string }[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const json = await adminGraphQL(token, SITEMAP_QUERY, { cursor });
    const connection = json.data?.products;
    for (const edge of connection?.edges ?? []) items.push(edge.node);
    if (!connection?.pageInfo?.hasNextPage) break;
    cursor = connection.pageInfo.endCursor;
  }
  return items;
}

function buildSitemapXml(products: { handle: string; updatedAt: string }[]): string {
  const url = (loc: string, lastmod?: string) =>
    `  <url><loc>${xmlEscape(loc)}</loc>${lastmod ? `<lastmod>${lastmod.slice(0, 10)}</lastmod>` : ''}</url>`;
  const lines = [
    ...STATIC_PATHS.map((p) => url(`${SITE_URL}${p === '/' ? '/' : p}`)),
    ...BLOG_POSTS.map((post) => url(`${SITE_URL}/blog/${post.slug}`, post.publishedAt)),
    ...products.map((p) => url(`${SITE_URL}/product/${p.handle}`, p.updatedAt)),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${lines.join('\n')}
</urlset>`;
}

function buildRobotsTxt(): string {
  return ['Googlebot', 'Bingbot', 'Twitterbot', 'facebookexternalhit', '*']
    .map((agent) => `User-agent: ${agent}\nAllow: /`)
    .join('\n\n') + `\n\nSitemap: ${SITE_URL}/sitemap.xml\n`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (req.query.type === 'robots') {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).send(buildRobotsTxt());
  }

  if (req.query.type === 'sitemap') {
    try {
      const token = await getAccessToken();
      const xml = buildSitemapXml(await fetchSitemapProducts(token));
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
      return res.status(200).send(xml);
    } catch (error) {
      console.error('[Sitemap] Error:', error);
      return res.status(500).json({ error: 'Failed to generate sitemap' });
    }
  }

  try {
    const token = await getAccessToken();
    const [currency, products] = await Promise.all([fetchShopCurrency(token), fetchAllProducts(token)]);
    const xml = buildFeedXml(products, currency);

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    return res.status(200).send(xml);
  } catch (error) {
    console.error('[Product Feed] Error:', error);
    return res.status(500).json({ error: 'Failed to generate product feed' });
  }
}
