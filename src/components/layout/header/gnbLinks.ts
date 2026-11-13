import { IS_B2C_SITE } from "@/lib/site";

// Desktop GNB (top nav) link definitions.
// Product category browsing lives in the icon row below the GNB (see categoryData.ts) —
// the GNB itself is for primary page access, not category filtering.

export interface GnbBrandLink {
  label: string;
  /** Shopify collection handle for the brand's product listing. */
  handle: string;
}

export const GNB_BRAND_LINKS: GnbBrandLink[] = [
  { label: "BITE ME", handle: "bite-me" },
  { label: "SSFW", handle: "ssfw" },
  { label: "Comfy Ravioli", handle: "comfyravioli" },
  { label: "Apple Cider Recipe", handle: "apple-cider-recipe" },
  { label: "Livepet", handle: "livepet" },
];

export type GnbLinkDef =
  | { label: string; type: "collection"; handle: string }
  | { label: string; type: "route"; path: string }
  | { label: string; type: "dropdown"; children: GnbBrandLink[] };

export const GNB_LINKS: GnbLinkDef[] = [
  { label: "SHOP ALL", type: "collection", handle: "all" },
  { label: "BRAND", type: "dropdown", children: GNB_BRAND_LINKS },
  { label: "BLOG", type: "route", path: "/blog" },
  { label: "POP-UP", type: "route", path: "/popup-offline-stores" },
  { label: "ABOUT US", type: "route", path: "/about" },
  // B2C 사이트에는 예전 어필리에이트 신청서·도매 신청 메뉴를 두지 않는다 (B2C 어필리에이트는 상품 상세·마이페이지에서)
  ...(IS_B2C_SITE
    ? []
    : ([
        { label: "AFFILIATE", type: "route", path: "/affiliate" },
        { label: "WHOLESALE", type: "route", path: "/mypage/b2b-apply" },
      ] as const)),
];
