import { z } from "zod";
import {
  MousePointerClick,
  Mail,
  Link2,
  Gift,
  Users,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

export const SOCIAL_PLATFORMS = ["Instagram", "TikTok"] as const;

export const COUNTRIES = [
  "United States",
  "Canada",
  "United Kingdom",
  "Australia",
  "Germany",
  "France",
  "Netherlands",
  "Japan",
  "South Korea",
  "Singapore",
  "Hong Kong",
  "Macau",
  "Thailand",
  "Vietnam",
  "Indonesia",
  "India",
  "Other",
] as const;

export const ACQUISITION_SOURCES = [
  "Instagram",
  "TikTok",
  "Google Search",
  "Friend / Referral",
  "Offline Event",
  "Other",
] as const;

export interface StepDef {
  icon: LucideIcon;
  title: string;
  desc: string;
}

export const STEPS: StepDef[] = [
  { icon: MousePointerClick, title: "Apply", desc: "Submit your application" },
  { icon: Mail, title: "Get Invited", desc: "Receive your invitation by email" },
  { icon: Link2, title: "Share Your Link", desc: "Create and share your unique affiliate link" },
  { icon: Gift, title: "Earn Commission", desc: "Earn 10% on every eligible sale" },
];

export interface BenefitDef {
  icon?: LucideIcon;
  value?: string;
  bgClass: string;
  accentClass: string;
  title: string;
  desc: string;
}

export const BENEFITS: BenefitDef[] = [
  {
    value: "15%",
    bgClass: "bg-amber-100",
    accentClass: "text-amber-600",
    title: "OFF for Your Followers",
    desc: "Give your community an exclusive discount",
  },
  {
    value: "10%",
    bgClass: "bg-red-100",
    accentClass: "text-red-600",
    title: "Commission",
    desc: "Get rewarded for every eligible sale",
  },
  {
    icon: Users,
    bgClass: "bg-blue-100",
    accentClass: "text-blue-600",
    title: "Exclusive Collabs",
    desc: "Top creators get more opportunities",
  },
  {
    icon: TrendingUp,
    bgClass: "bg-purple-100",
    accentClass: "text-purple-600",
    title: "Higher Rates",
    desc: "Unlock higher rates as your sales grow",
  },
];

export const affiliateSchema = z
  .object({
    socialAccounts: z
      .array(
        z.object({
          platform: z.enum(SOCIAL_PLATFORMS),
          account: z
            .string()
            .min(1, "Account is required")
            .regex(/^[a-zA-Z0-9._@\s-]+$/, "Enter a valid account name"),
        }),
      )
      .min(1),
    email: z.string().min(1, "Email is required").email("Enter a valid email address"),
    petName: z
      .string()
      .min(1, "Pet's name is required")
      .regex(/^[\p{L}\p{N}\s'-]+$/u, "Enter a valid name"),
    // Every question is required (PC + mobile). z.enum rejects undefined / empty.
    country: z.enum(COUNTRIES, {
      errorMap: () => ({ message: "Please select your country / region" }),
    }),
    acquisitionSource: z.enum(ACQUISITION_SOURCES, {
      errorMap: () => ({ message: "Please let us know how you heard about us" }),
    }),
    acquisitionOther: z.string().optional(),
    confirmed: z.boolean().refine((v) => v === true, {
      message: "Please confirm the discount and commission terms",
    }),
  })
  .refine(
    (d) => d.acquisitionSource !== "Other" || !!d.acquisitionOther?.trim(),
    { message: "Please tell us how you heard about us", path: ["acquisitionOther"] },
  );

export type AffiliateFormData = z.infer<typeof affiliateSchema>;
