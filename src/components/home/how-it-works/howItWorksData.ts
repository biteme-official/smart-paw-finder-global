import { Tag, Truck, Heart, Gift, type LucideIcon } from "lucide-react";

export interface StepDef {
  icon: LucideIcon;
  lines: [string, string];
}

export const STEP_DEFS: StepDef[] = [
  { icon: Tag,   lines: ["Welcome 15% Off", "First-time customers"] },
  { icon: Truck, lines: ["Free Shipping", "Over $75+ only"] },
  { icon: Heart, lines: ["Review Content", "Apply Affiliate"] },
  { icon: Gift,  lines: ["Earn Commission", "10% on all sales!"] },
];
