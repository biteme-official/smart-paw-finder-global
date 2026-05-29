import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

const SITE_URL = 'https://biteme.one';
const DEFAULT_IMAGE = `${SITE_URL}/og-image.jpg`;
const BRAND = 'BITE ME';
const KV_PRODUCT_TTL = 3600;
const KV_TOKEN_BUFFER_SEC = 300;

interface OGData {
  title: string;
  description: string;
  image: string;
  url: string;
  type?: string;
}

interface CachedProductOG {
  title: string;
  description: string;
  imageUrl: string;
}

interface CachedToken {
  token: string;
  expiresAt: number;
}

// ---- 모듈 레벨 메모리 캐시 (Lambda 컨테이너 재사용 시 KV 호출 절감) ----
let memToken: CachedToken | null = null;
const memProductCache = new Map<string, { data: CachedProductOG; ts: number }>();
const MEM_PRODUCT_TTL_MS = 5 * 60 * 1000;

// ---- 정적 페이지 OG ----
const STATIC_OG: Record<string, OGData> = {
  '/about': {
    title: `About ${BRAND} | Premium K-Pet Lifestyle Brand`,
    description: `Learn about BITE ME, a premium K-Pet lifestyle brand from Seoul, South Korea. Discover our story, values, and passion for pet wellness.`,
    image: DEFAULT_IMAGE,
    url: `${SITE_URL}/about`,
  },
  '/new-products': {
    title: `New Products | ${BRAND}`,
    description: `Explore the latest dog toys, healthy treats, and stylish accessories from BITE ME. Fresh arrivals with worldwide shipping.`,
    image: DEFAULT_IMAGE,
    url: `${SITE_URL}/new-products`,
  },
  '/popup-offline-stores': {
    title: `Popup & Offline Stores | ${BRAND}`,
    description: `Find BITE ME popup events and offline store locations. Experience our K-Pet lifestyle brand in person.`,
    image: DEFAULT_IMAGE,
    url: `${SITE_URL}/popup-offline-stores`,
  },
  '/contact': {
    title: `Contact Us | ${BRAND}`,
    description: `Have questions about orders or products? Reach out to BITE ME — we're happy to help.`,
    image: DEFAULT_IMAGE,
    url: `${SITE_URL}/contact`,
  },
  '/privacy': {
    title: `Privacy Policy | ${BRAND}`,
    description: `Read BITE ME's privacy policy and learn how we protect your personal information.`,
    image: DEFAULT_IMAGE,
    url: `${SITE_URL}/privacy`,
  },
  '/terms': {
    title: `Terms of Use | ${BRAND}`,
    description: `Read BITE ME's terms and conditions before using our website or placing an order.`,
    image: DEFAULT_IMAGE,
    url: `${SITE_URL}/terms`,
  },
  '/refund-policy': {
    title: `Refund Policy | ${BRAND}`,
    description: `BITE ME's hassle-free refund and return policy for premium K-Pet lifestyle products.`,
    image: DEFAULT_IMAGE,
    url: `${SITE_URL}/refund-policy`,
  },
  '/blog': {
    title: `Blog | ${BRAND} — K-Pet Lifestyle Tips & Guides`,
    description: `Expert guides on dog toys, treats, health, and K-Pet lifestyle trends from the BITE ME team.`,
    image: DEFAULT_IMAGE,
    url: `${SITE_URL}/blog`,
  },
};

// ---- 블로그 포스트 OG ----
const BLOG_POST_OG: Record<string, { title: string; description: string; image: string }> = {
  'how-to-choose-nosework-toy-dog-skill-level': {
    title: "How to Choose a Nosework Toy for Your Dog's Skill Level",
    description: "A 15-minute nosework session burns the same mental energy as a 45-minute walk. Here's how to pick the right difficulty level.",
    image: `${SITE_URL}/blog/nosework-guide-cover.jpg`,
  },
  'tug-toys-vs-fetch-toys-which-does-your-dog-need': {
    title: "Tug Toys vs. Fetch Toys: Which Does Your Dog Actually Need?",
    description: "Tug builds impulse control. Fetch burns cardio. Here's how to decide which your dog benefits from most — or whether you need both.",
    image: `${SITE_URL}/blog/tug-vs-fetch-cover.jpg`,
  },
  'summer-dog-toy-safety-materials-heat': {
    title: "Summer Toy Safety Guide: What Materials Hold Up in Heat?",
    description: "Some dog toys release chemicals in direct sunlight. Here's your summer safety checklist for every material type.",
    image: `${SITE_URL}/blog/summer-safety-cover.jpg`,
  },
  'why-korean-pet-toys-taking-over-instagram': {
    title: "Why Korean Pet Toys Are Taking Over Instagram",
    description: "Korean pet brands combine cafe-worthy aesthetics with serious enrichment design. Here's why global pet parents are paying attention.",
    image: `${SITE_URL}/blog/k-pet-trends-cover.jpg`,
  },
  'dog-dental-health-toys-that-actually-clean-teeth': {
    title: "Dog Dental Health: Toys That Actually Clean Teeth",
    description: "Not all 'dental toys' work. Here's the science behind mechanical plaque removal and which designs deliver real results.",
    image: `${SITE_URL}/blog/dental-health-cover.jpg`,
  },
  'rainy-day-indoor-activities-keep-dog-busy': {
    title: "10 Rainy Day Activities to Keep Your Dog Busy Indoors",
    description: "Stuck inside? A 15-minute nosework game burns more mental energy than a 30-minute walk. Here are 10 vet-approved indoor activities.",
    image: `${SITE_URL}/blog/rainy-day-cover.jpg`,
  },
  'how-to-choose-right-dog-harness-size-guide': {
    title: "How to Choose the Right Dog Harness: A Complete Size & Fit Guide",
    description: "Neck girth, chest girth, and body length — here's how to measure once and get the perfect harness fit without returns.",
    image: `${SITE_URL}/blog/harness-guide-cover.jpg`,
  },
  'traveling-with-your-dog-packing-essentials': {
    title: "Traveling with Your Dog: The Complete Packing Checklist",
    description: "Most dog travel checklists are 50 items long. We trimmed it to what actually matters, by trip type.",
    image: `${SITE_URL}/blog/travel-checklist-cover.jpg`,
  },
  'understanding-dog-play-styles-toy-matching': {
    title: "Understanding Your Dog's Play Style: A Toy Matching Guide",
    description: "Your dog isn't 'bad with toys' — they just have a play style you haven't matched yet. Here's how to decode it.",
    image: `${SITE_URL}/blog/play-style-cover.jpg`,
  },
  'first-time-dog-owner-toy-starter-kit': {
    title: "First-Time Dog Owner? Here's Your Toy Starter Kit",
    description: "New dog owners overbuy toys. You actually need one from each of these 5 categories — and nothing else for the first month.",
    image: `${SITE_URL}/blog/starter-kit-cover.jpg`,
  },
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildOGHtml(og: OGData): string {
  const title = escapeHtml(og.title);
  const desc = escapeHtml(og.description);
  const image = escapeHtml(og.image);
  const url = escapeHtml(og.url);
  const type = og.type ?? 'website';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <meta name="description" content="${desc}" />
  <link rel="canonical" href="${url}" />
  <meta property="og:site_name" content="${BRAND}" />
  <meta property="og:type" content="${type}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${desc}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:locale" content="en_US" />
  ${type === 'article' ? `<meta property="article:author" content="${BRAND}" />` : ''}
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${desc}" />
  <meta name="twitter:image" content="${image}" />
</head>
<body></body>
</html>`;
}

async function getShopifyToken(): Promise<string | null> {
  const now = Date.now();

  // 1) 메모리 캐시
  if (memToken && now < memToken.expiresAt - KV_TOKEN_BUFFER_SEC * 1000) {
    return memToken.token;
  }

  // 2) KV 캐시
  try {
    const cached = await kv.get<CachedToken>('shopify:og-token');
    if (cached && now < cached.expiresAt - KV_TOKEN_BUFFER_SEC * 1000) {
      memToken = cached;
      return cached.token;
    }
  } catch {
    // KV 미설정 시 패스
  }

  // 3) Shopify OAuth
  const shop = process.env.VITE_SHOPIFY_STORE_DOMAIN;
  const clientId = process.env.VITE_SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
  if (!shop || !clientId || !clientSecret) return null;

  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) return null;

  const data = await res.json() as { access_token: string; expires_in: number };
  const tokenData: CachedToken = {
    token: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };

  memToken = tokenData;
  try {
    await kv.set('shopify:og-token', tokenData, {
      ex: Math.max(data.expires_in - KV_TOKEN_BUFFER_SEC, 60),
    });
  } catch {
    // KV 저장 실패 무시
  }

  return tokenData.token;
}

async function getProductOG(handle: string): Promise<CachedProductOG | null> {
  const now = Date.now();

  // 1) 메모리 캐시
  const memHit = memProductCache.get(handle);
  if (memHit && now - memHit.ts < MEM_PRODUCT_TTL_MS) {
    return memHit.data;
  }

  // 2) KV 캐시
  try {
    const cached = await kv.get<CachedProductOG>(`og:product:${handle}`);
    if (cached) {
      memProductCache.set(handle, { data: cached, ts: now });
      return cached;
    }
  } catch {
    // KV 미설정 시 패스
  }

  // 3) Shopify API
  const shop = process.env.VITE_SHOPIFY_STORE_DOMAIN;
  if (!shop) return null;

  const token = await getShopifyToken();
  if (!token) return null;

  const query = `
    query GetProductOG($handle: String!) {
      productByHandle(handle: $handle) {
        title
        description(truncateAt: 200)
        images(first: 1) { edges { node { url } } }
      }
    }
  `;

  const res = await fetch(`https://${shop}/api/2025-07/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Shopify-Storefront-Private-Token': token,
    },
    body: JSON.stringify({ query, variables: { handle } }),
  });
  if (!res.ok) return null;

  const data = await res.json() as {
    data?: {
      productByHandle?: {
        title: string;
        description: string;
        images: { edges: { node: { url: string } }[] };
      };
    };
  };

  const product = data?.data?.productByHandle;
  if (!product) return null;

  const ogData: CachedProductOG = {
    title: product.title,
    description: product.description || '',
    imageUrl: product.images.edges[0]?.node.url ?? DEFAULT_IMAGE,
  };

  memProductCache.set(handle, { data: ogData, ts: now });
  try {
    await kv.set(`og:product:${handle}`, ogData, { ex: KV_PRODUCT_TTL });
  } catch {
    // KV 저장 실패 무시
  }

  return ogData;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const rawPath = req.query.path;
  const pathname = typeof rawPath === 'string' ? rawPath : '/';

  // 정적 페이지
  const staticOG = STATIC_OG[pathname];
  if (staticOG) {
    return res
      .setHeader('Content-Type', 'text/html; charset=utf-8')
      .setHeader('Cache-Control', 'no-store')
      .status(200)
      .send(buildOGHtml(staticOG));
  }

  // 블로그 포스트
  const blogMatch = pathname.match(/^\/blog\/([^/]+)$/);
  if (blogMatch) {
    const post = BLOG_POST_OG[blogMatch[1]];
    if (post) {
      const og: OGData = {
        title: `${post.title} | ${BRAND} Blog`,
        description: post.description,
        image: post.image,
        url: `${SITE_URL}/blog/${blogMatch[1]}`,
        type: 'article',
      };
      return res
        .setHeader('Content-Type', 'text/html; charset=utf-8')
        .setHeader('Cache-Control', 'no-store')
        .status(200)
        .send(buildOGHtml(og));
    }
  }

  // 상품 상세
  const productMatch = pathname.match(/^\/product\/([^/]+)$/);
  if (productMatch) {
    const handle = productMatch[1];
    const product = await getProductOG(handle);

    const og: OGData = product
      ? {
          title: `${product.title} | ${BRAND}`,
          description: product.description || `Shop ${product.title} at BITE ME. Premium K-Pet lifestyle products with worldwide shipping.`,
          image: product.imageUrl,
          url: `${SITE_URL}/product/${handle}`,
          type: 'product',
        }
      : {
          title: `${BRAND} | Premium K-Pet Lifestyle Product`,
          description: `Shop premium K-Pet lifestyle products at BITE ME. Dog toys, healthy treats, and stylish accessories. Worldwide shipping.`,
          image: DEFAULT_IMAGE,
          url: `${SITE_URL}/product/${handle}`,
          type: 'product',
        };

    return res
      .setHeader('Content-Type', 'text/html; charset=utf-8')
      .setHeader('Cache-Control', 'no-store')
      .status(200)
      .send(buildOGHtml(og));
  }

  // 매칭 없으면 404 (vercel.json 라우팅 오류 방지)
  return res.status(404).send('Not found');
}
