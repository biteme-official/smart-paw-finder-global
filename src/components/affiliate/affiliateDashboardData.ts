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
  topLinks: AffiliateLinkStat[];
  sharedProducts: AffiliateSharedProduct[];
}

export function getMockAffiliateDashboard(displayName?: string): AffiliateDashboardData {
  const code = (displayName || 'ZOEY').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) + '123';
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
    topLinks: [
      { handle: 'koala-rope-ball-toy', title: 'Koala Rope Ball Toy', clicks: 142, orders: 9, earningPerOrder: 1.09 },
      { handle: 'comfort-harness-v2', title: 'Comfort Harness v2', clicks: 96, orders: 4, earningPerOrder: 2.8 },
      { handle: 'hate-me-band-3-types', title: 'Hate Me Band (3 types)', clicks: 51, orders: 2, earningPerOrder: 0.85 },
    ],
    sharedProducts: [
      { handle: 'koala-rope-ball-toy', title: 'Koala Rope Ball Toy', earnAmount: 1.09 },
      { handle: 'comfort-harness-v2', title: 'Comfort Harness v2', earnAmount: 2.8 },
      { handle: 'hate-me-band-3-types', title: 'Hate Me Band (3 types)', earnAmount: 0.85 },
    ],
  };
}
