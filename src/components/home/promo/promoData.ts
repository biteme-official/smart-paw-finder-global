import promo1Pc from "@/assets/promo/promo-1-pc.jpg";
import promo1Mobile from "@/assets/promo/promo-1-mobile.jpg";
import promo2Pc from "@/assets/promo/promo-2-pc.jpg";
import promo2Mobile from "@/assets/promo/promo-2-mobile.jpg";
import promo3Pc from "@/assets/promo/promo-3-pc.jpg";
import promo3Mobile from "@/assets/promo/promo-3-mobile.jpg";

export interface PromoDef {
  /** Not rendered — used only for the image's alt text */
  title: string;
  href: string;
  pcImage: string;
  mobileImage: string;
}

export const isExternalHref = (href: string) => /^https?:\/\//.test(href);

export const PROMO_DEFS: PromoDef[] = [
  {
    title: "First Purchase 15% Off",
    href: "/mypage",
    pcImage: promo1Pc,
    mobileImage: promo1Mobile,
  },
  {
    title: "Free Shipping $75+",
    href: "/refund-policy",
    pcImage: promo2Pc,
    mobileImage: promo2Mobile,
  },
  {
    title: "Affiliate Program",
    href: "https://www.biteme.one/affiliate",
    pcImage: promo3Pc,
    mobileImage: promo3Mobile,
  },
];
