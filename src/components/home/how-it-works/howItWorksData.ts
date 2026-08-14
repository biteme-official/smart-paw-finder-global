import { Tag, Truck, Heart, Gift, type LucideIcon } from "lucide-react";

export interface StepDef {
  icon: LucideIcon;
  lines: [string, string];
}

export const STEP_DEFS: StepDef[] = [
  { icon: Tag,   lines: ["First Purchase", "15% Coupon"] },
  { icon: Truck, lines: ["$75+", "Free Shipping"] },
  { icon: Heart, lines: ["Upload Content", "(Affiliate Apply)"] },
  { icon: Gift,  lines: ["Earn", "Commission"] },
];
