export interface PromoDef {
  eyebrow: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  href: string;
  bgClass: string;
  imageUrl?: string;
}

export const PROMO_DEFS: PromoDef[] = [
  {
    eyebrow: "PERK",
    title: "First Purchase 15% Off",
    subtitle: "Sign up and get 15% off your first order",
    ctaLabel: "Shop Now",
    href: "/mypage",
    bgClass: "bg-orange-200",
  },
  {
    eyebrow: "PERK",
    title: "Free Shipping $75+",
    subtitle: "Free worldwide shipping on orders over $75",
    ctaLabel: "Shop Now",
    href: "/refund-policy",
    bgClass: "bg-sky-200",
  },
  {
    eyebrow: "PERK",
    title: "Affiliate Program",
    subtitle: "Share your content and earn commission",
    ctaLabel: "Apply Now",
    href: "/contact",
    bgClass: "bg-emerald-200",
  },
];
