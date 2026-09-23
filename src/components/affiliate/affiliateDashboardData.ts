// Sample data for the My Page > Affiliate dashboard. There is no click/sale
// tracking backend yet (no per-affiliate link issuance, no attribution, no
// commission ledger) — this screen renders realistic placeholder numbers so
// the layout can be reviewed before that infrastructure is built.

export interface AffiliateLinkStat {
  handle: string;
  title: string;
  image?: string;
  clicks: number;
  orders: number;
  earningPerOrder: number;
}

export interface AffiliateSharedProduct {
  handle: string;
  title: string;
  image?: string;
  earnAmount: number;
}

export interface AffiliateDashboardData {
  code: string;
  linkUrl: string;
  discountPercent: number;
  commissionPercent: number;
  views: number;
  clicks: number;
  sales: number;
  earningsThisMonth: number;
  earningsAvailable: number;
  earningsPending: number;
  /** Every product link the affiliate has shared (All links page). */
  allLinks: AffiliateLinkStat[];
  /** Every product the affiliate has shared (Shared products page). */
  allSharedProducts: AffiliateSharedProduct[];
  /** Top 3 of allLinks by clicks, for the main page. */
  topLinks: AffiliateLinkStat[];
  /** First 3 of allSharedProducts, for the main page. */
  sharedProducts: AffiliateSharedProduct[];
}

const SAMPLE_LINKS: AffiliateLinkStat[] = [
  { handle: 'koala-rope-ball-toy', title: 'Koala Rope Ball Toy', clicks: 142, orders: 9, earningPerOrder: 1.09 },
  { handle: 'comfort-harness-v2', title: 'Comfort Harness v2', clicks: 96, orders: 4, earningPerOrder: 2.8 },
  { handle: 'hate-me-band-3-types', title: 'Hate Me Band (3 types)', clicks: 51, orders: 2, earningPerOrder: 0.85 },
  { handle: 'sample-product-4', title: 'Sample Product 4', clicks: 38, orders: 6, earningPerOrder: 1.45 },
  { handle: 'sample-product-5', title: 'Sample Product 5', clicks: 27, orders: 1, earningPerOrder: 3.2 },
  { handle: 'sample-product-6', title: 'Sample Product 6', clicks: 19, orders: 3, earningPerOrder: 0.99 },
  { handle: 'sample-product-7', title: 'Sample Product 7', clicks: 12, orders: 0, earningPerOrder: 1.6 },
  { handle: 'sample-product-8', title: 'Sample Product 8', clicks: 6, orders: 1, earningPerOrder: 2.1 },
];

/**
 * Dev-only: append ?devEmpty=1 locally to preview the empty states.
 * Statically false in production builds.
 */
function isDevEmptyPreview(): boolean {
  if (!import.meta.env.DEV) return false;
  return new URLSearchParams(window.location.search).get('devEmpty') === '1';
}

export function getMockAffiliateDashboard(displayName?: string): AffiliateDashboardData {
  const firstName = (displayName || 'Zoey').split(' ')[0];
  const code = firstName.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) + '123';
  const allLinks = isDevEmptyPreview() ? [] : SAMPLE_LINKS;
  const allSharedProducts: AffiliateSharedProduct[] = allLinks.map(({ handle, title, earningPerOrder }) => ({
    handle, title, earnAmount: earningPerOrder,
  }));
  return {
    code,
    linkUrl: `https://www.biteme.one/?ref=${code}`,
    discountPercent: 15,
    commissionPercent: 10,
    views: 1204,
    clicks: 289,
    sales: 15,
    earningsThisMonth: 18.7,
    earningsAvailable: 6.3,
    earningsPending: 12.4,
    allLinks,
    allSharedProducts,
    topLinks: [...allLinks].sort((a, b) => b.clicks - a.clicks).slice(0, 3),
    sharedProducts: allSharedProducts.slice(0, 3),
  };
}

/**
 * Stats are sample data, but thumbnails/titles/handles come from real catalog
 * products (matched by position) so rows look real and link to a real PDP.
 */
export function withCatalogProducts<T extends { handle: string; title: string; image?: string }>(
  items: T[],
  products: { node: { handle: string; title: string; images: { edges: { node: { url: string } }[] } } }[],
): T[] {
  return items.map((item, i) => {
    const p = products[i]?.node;
    return { ...item, title: p?.title ?? item.title, handle: p?.handle ?? item.handle, image: p?.images.edges[0]?.node.url };
  });
}
