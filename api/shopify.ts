import type { VercelRequest, VercelResponse } from '@vercel/node';

// ─── OG Tag Generation ────────────────────────────────────────────────────────
const OG_SITE_URL = 'https://www.biteme.one';
const OG_DEFAULT_IMAGE = `${OG_SITE_URL}/og-image.jpg`;
const OG_BRAND = 'BITE ME';
const OG_PRODUCT_CACHE_TTL_MS = 60 * 60 * 1000; // 1시간

const ogProductCache = new Map<string, { title: string; description: string; imageUrl: string; ts: number }>();

const OG_STATIC: Record<string, { title: string; description: string; image: string }> = {
  '/about': {
    title: `About ${OG_BRAND} | Premium K-Pet Lifestyle Brand`,
    description: `Learn about BITE ME, a premium K-Pet lifestyle brand from Seoul, South Korea.`,
    image: OG_DEFAULT_IMAGE,
  },
  '/new-products': {
    title: `New Products | ${OG_BRAND}`,
    description: `Explore the latest dog toys, healthy treats, and accessories from BITE ME. Worldwide shipping.`,
    image: OG_DEFAULT_IMAGE,
  },
  '/popup-offline-stores': {
    title: `Popup & Offline Stores | ${OG_BRAND}`,
    description: `Find BITE ME popup events and offline store locations near you.`,
    image: OG_DEFAULT_IMAGE,
  },
  '/contact': {
    title: `Contact Us | ${OG_BRAND}`,
    description: `Have questions about orders or products? Reach out to BITE ME.`,
    image: OG_DEFAULT_IMAGE,
  },
  '/privacy': {
    title: `Privacy Policy | ${OG_BRAND}`,
    description: `Read BITE ME's privacy policy and how we protect your data.`,
    image: OG_DEFAULT_IMAGE,
  },
  '/terms': {
    title: `Terms of Use | ${OG_BRAND}`,
    description: `Read BITE ME's terms and conditions before placing an order.`,
    image: OG_DEFAULT_IMAGE,
  },
  '/refund-policy': {
    title: `Refund Policy | ${OG_BRAND}`,
    description: `BITE ME's hassle-free refund and return policy for pet products.`,
    image: OG_DEFAULT_IMAGE,
  },
  '/blog': {
    title: `Blog | ${OG_BRAND} — K-Pet Lifestyle Tips & Guides`,
    description: `Expert guides on dog toys, treats, health, and K-Pet lifestyle trends.`,
    image: OG_DEFAULT_IMAGE,
  },
};

const OG_BLOG_POSTS: Record<string, { title: string; description: string; image: string }> = {
  'how-to-choose-nosework-toy-dog-skill-level': {
    title: "How to Choose a Nosework Toy for Your Dog's Skill Level",
    description: "A 15-minute nosework session burns the same mental energy as a 45-minute walk. Here's how to pick the right difficulty level.",
    image: `${OG_SITE_URL}/blog/nosework-guide-cover.jpg`,
  },
  'tug-toys-vs-fetch-toys-which-does-your-dog-need': {
    title: "Tug Toys vs. Fetch Toys: Which Does Your Dog Actually Need?",
    description: "Tug builds impulse control. Fetch burns cardio. Here's how to decide which your dog benefits from most.",
    image: `${OG_SITE_URL}/blog/tug-vs-fetch-cover.jpg`,
  },
  'summer-dog-toy-safety-materials-heat': {
    title: "Summer Toy Safety Guide: What Materials Hold Up in Heat?",
    description: "Some dog toys release chemicals in direct sunlight. Here's your summer safety checklist.",
    image: `${OG_SITE_URL}/blog/summer-safety-cover.jpg`,
  },
  'why-korean-pet-toys-taking-over-instagram': {
    title: "Why Korean Pet Toys Are Taking Over Instagram",
    description: "Korean pet brands combine cafe-worthy aesthetics with serious enrichment design.",
    image: `${OG_SITE_URL}/blog/k-pet-trends-cover.jpg`,
  },
  'dog-dental-health-toys-that-actually-clean-teeth': {
    title: "Dog Dental Health: Toys That Actually Clean Teeth",
    description: "Not all 'dental toys' work. Here's the science behind mechanical plaque removal.",
    image: `${OG_SITE_URL}/blog/dental-health-cover.jpg`,
  },
  'rainy-day-indoor-activities-keep-dog-busy': {
    title: "10 Rainy Day Activities to Keep Your Dog Busy Indoors",
    description: "Stuck inside? A 15-minute nosework game burns more energy than a 30-minute walk.",
    image: `${OG_SITE_URL}/blog/rainy-day-cover.jpg`,
  },
  'how-to-choose-right-dog-harness-size-guide': {
    title: "How to Choose the Right Dog Harness: A Complete Size & Fit Guide",
    description: "Neck girth, chest girth, and body length — here's how to measure once and get the perfect fit.",
    image: `${OG_SITE_URL}/blog/harness-guide-cover.jpg`,
  },
  'traveling-with-your-dog-packing-essentials': {
    title: "Traveling with Your Dog: The Complete Packing Checklist",
    description: "Most dog travel checklists are 50 items long. We trimmed it to what actually matters.",
    image: `${OG_SITE_URL}/blog/travel-checklist-cover.jpg`,
  },
  'understanding-dog-play-styles-toy-matching': {
    title: "Understanding Your Dog's Play Style: A Toy Matching Guide",
    description: "Your dog isn't 'bad with toys' — they just have a play style you haven't matched yet.",
    image: `${OG_SITE_URL}/blog/play-style-cover.jpg`,
  },
  'first-time-dog-owner-toy-starter-kit': {
    title: "First-Time Dog Owner? Here's Your Toy Starter Kit",
    description: "New dog owners overbuy toys. You actually need one from each of these 5 categories.",
    image: `${OG_SITE_URL}/blog/starter-kit-cover.jpg`,
  },
};

function ogEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function resizeShopifyImage(url: string, size = 800): string {
  try {
    const u = new URL(url);
    // Shopify CDN: replace existing size suffix and set _800x800 for predictable dimensions
    u.pathname = u.pathname.replace(/(_\d+x\d*)?\.(jpe?g|png|gif|webp)$/i, `_${size}x${size}.$2`);
    return u.toString();
  } catch {
    return url;
  }
}

function buildOGHtml(title: string, description: string, image: string, url: string, type = 'website', twitterCard = 'summary_large_image', imgWidth = 1200, imgHeight = 630): string {
  const t = ogEscape(title), d = ogEscape(description), i = ogEscape(image), u = ogEscape(url);
  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"/>
<title>${t}</title>
<meta name="description" content="${d}"/>
<link rel="canonical" href="${u}"/>
<meta property="og:site_name" content="${OG_BRAND}"/>
<meta property="og:type" content="${type}"/>
<meta property="og:url" content="${u}"/>
<meta property="og:title" content="${t}"/>
<meta property="og:description" content="${d}"/>
<meta property="og:image" content="${i}"/>
<meta property="og:image:width" content="${imgWidth}"/>
<meta property="og:image:height" content="${imgHeight}"/>
<meta property="og:locale" content="en_US"/>
<meta name="twitter:card" content="${twitterCard}"/>
<meta name="twitter:title" content="${t}"/>
<meta name="twitter:description" content="${d}"/>
<meta name="twitter:image" content="${i}"/>
<meta name="twitter:image:width" content="${imgWidth}"/>
<meta name="twitter:image:height" content="${imgHeight}"/>
</head><body></body></html>`;
}

async function handleOG(req: VercelRequest, res: VercelResponse): Promise<void> {
  const rawPath = req.query.path;
  const pathname = typeof rawPath === 'string' ? (rawPath.startsWith('/') ? rawPath : '/' + rawPath) : '/';

  // 정적 페이지
  const staticData = OG_STATIC[pathname];
  if (staticData) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(buildOGHtml(staticData.title, staticData.description, staticData.image, `${OG_SITE_URL}${pathname}`));
    return;
  }

  // 블로그 포스트
  const blogMatch = pathname.match(/^\/blog\/([^/]+)$/);
  if (blogMatch) {
    const post = OG_BLOG_POSTS[blogMatch[1]];
    if (post) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).send(buildOGHtml(
        `${post.title} | ${OG_BRAND} Blog`,
        post.description, post.image,
        `${OG_SITE_URL}${pathname}`, 'article'
      ));
      return;
    }
  }

  // 상품 상세 — Shopify API 조회
  const productMatch = pathname.match(/^\/product\/([^/]+)$/);
  if (productMatch) {
    const handle = productMatch[1];
    const now = Date.now();
    const cached = ogProductCache.get(handle);

    let productTitle = '', productDesc = '', productImage = OG_DEFAULT_IMAGE;

    if (cached && now - cached.ts < OG_PRODUCT_CACHE_TTL_MS) {
      productTitle = cached.title;
      productDesc = cached.description;
      productImage = cached.imageUrl;
    } else {
      try {
        const token = await getAccessToken();
        const shop = process.env.VITE_SHOPIFY_STORE_DOMAIN || '';
        if (!shop) {
          console.error('[OG] VITE_SHOPIFY_STORE_DOMAIN 환경변수 없음');
        } else {
          const gqlRes = await fetch(`https://${shop}/api/2025-07/graphql.json`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Shopify-Storefront-Private-Token': token,
            },
            body: JSON.stringify({
              query: `query OG($h:String!){product(handle:$h){title description(truncateAt:200) featuredImage{url} images(first:1){edges{node{url}}}}}`,
              variables: { h: handle },
            }),
          });

          if (!gqlRes.ok) {
            const errBody = await gqlRes.text();
            console.error(`[OG] Shopify HTTP ${gqlRes.status} — handle:"${handle}" — ${errBody.slice(0, 300)}`);
          } else {
            const gqlData = await gqlRes.json() as {
              data?: {
                product?: {
                  title: string;
                  description: string;
                  featuredImage?: { url: string };
                  images: { edges: { node: { url: string } }[] };
                };
              };
              errors?: { message: string }[];
            };

            if (gqlData.errors?.length) {
              console.error(`[OG] GraphQL errors — handle:"${handle}" —`, JSON.stringify(gqlData.errors));
            }

            const p = gqlData?.data?.product;
            if (p) {
              productTitle = p.title;
              productDesc = p.description || '';
              productImage =
                p.featuredImage?.url ??
                p.images?.edges?.[0]?.node?.url ??
                OG_DEFAULT_IMAGE;
              ogProductCache.set(handle, { title: productTitle, description: productDesc, imageUrl: productImage, ts: now });
            } else {
              console.error(`[OG] product null — handle:"${handle}" — data:`, JSON.stringify(gqlData?.data));
            }
          }
        }
      } catch (err) {
        console.error(`[OG] 예외 — handle:"${handle}" —`, err instanceof Error ? err.message : String(err));
      }
    }

    const title = productTitle ? `${productTitle} | ${OG_BRAND}` : `${OG_BRAND} | Premium K-Pet Lifestyle Product`;
    const finalImage = productImage !== OG_DEFAULT_IMAGE ? resizeShopifyImage(productImage) : productImage;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(buildOGHtml(title, productDesc, finalImage, `${OG_SITE_URL}${pathname}`, 'product', 'summary_large_image', 800, 800));
    return;
  }

  res.status(404).send('Not found');
}
// ─── End OG Tag Generation ────────────────────────────────────────────────────

let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt - 5 * 60 * 1000) {
    return cachedToken;
  }

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
    throw new Error(`Token request failed (${response.status}): ${text.substring(0, 200)}`);
  }

  const data = await response.json();
  cachedToken = data.access_token;
  tokenExpiresAt = now + data.expires_in * 1000;
  return cachedToken!;
}

const ALLOWED_ORIGINS = [
  'https://biteme.one',
  'https://www.biteme.one',
  'http://localhost:5173',
];

function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (/^https:\/\/smart-paw-finder[a-z0-9-]*\.vercel\.app$/.test(origin)) return true;
  return false;
}

function getCorsOrigin(req: VercelRequest): string {
  const origin = req.headers.origin || '';
  return isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // OG 크롤러 요청 처리 (action=og)
  if (req.query.action === 'og') {
    return handleOG(req, res);
  }

  const corsOrigin = getCorsOrigin(req);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Customer-Account-Token');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const token = await getAccessToken();
    const shop = process.env.VITE_SHOPIFY_STORE_DOMAIN || 'lovable-project-lbgum.myshopify.com';
    const apiVersion = '2025-07';

    const shopifyHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Shopify-Storefront-Private-Token': token,
    };
    const customerAccountToken = req.headers['x-customer-account-token'];
    if (typeof customerAccountToken === 'string' && customerAccountToken) {
      shopifyHeaders['Authorization'] = customerAccountToken;
    }

    const shopifyResponse = await fetch(
      `https://${shop}/api/${apiVersion}/graphql.json`,
      {
        method: 'POST',
        headers: shopifyHeaders,
        body: JSON.stringify(req.body),
      }
    );

    const data = await shopifyResponse.text();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    return res.status(shopifyResponse.status).send(data);
  } catch (error) {
    console.error('[Shopify Proxy] Error:', error);
    return res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
}
