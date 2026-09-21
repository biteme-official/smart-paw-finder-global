import { LayoutGrid, ToyBrick, Bone, Shirt, Footprints, ShoppingBasket, Cat, Heart, type LucideIcon } from "lucide-react";

export interface CategoryDef {
  label: string;
  icon: LucideIcon;
  bgClass: string;
  iconClass: string;
  /** One shade darker than bgClass, same hue — used for the active-selection border
   * so it reads as "selected" without breaking the category's own color tone. */
  activeBorderClass: string;
  /** "all" = "Shop All" (routes to the All Items page showing every product) */
  handle: string;
}

// Handles verified against the store's actual collection list. The desktop GNB (gnbLinks.ts)
// no longer mirrors this list — it links to primary pages, not product categories.
export const CATEGORY_DEFS: CategoryDef[] = [
  { label: "Shop All",     icon: LayoutGrid,     bgClass: "bg-orange-100",  iconClass: "text-primary",      activeBorderClass: "border-orange-300",  handle: "all" },
  { label: "Toys",         icon: ToyBrick,       bgClass: "bg-amber-100",   iconClass: "text-amber-600",    activeBorderClass: "border-amber-300",   handle: "toy" },
  { label: "Food",         icon: Bone,           bgClass: "bg-rose-100",    iconClass: "text-rose-500",     activeBorderClass: "border-rose-300",    handle: "food" },
  { label: "Clothes",      icon: Shirt,          bgClass: "bg-sky-100",     iconClass: "text-sky-600",      activeBorderClass: "border-sky-300",     handle: "clothes" },
  { label: "Walk",         icon: Footprints,     bgClass: "bg-emerald-100", iconClass: "text-emerald-600",  activeBorderClass: "border-emerald-300", handle: "walk" },
  { label: "Supplies",     icon: ShoppingBasket, bgClass: "bg-violet-100",  iconClass: "text-violet-600",   activeBorderClass: "border-violet-300",  handle: "supplies" },
  { label: "Cat",          icon: Cat,            bgClass: "bg-amber-100",   iconClass: "text-orange-500",   activeBorderClass: "border-amber-300",   handle: "cat" },
  { label: "Pet Parents",  icon: Heart,          bgClass: "bg-pink-100",    iconClass: "text-pink-500",     activeBorderClass: "border-pink-300",    handle: "for-pet-parents" },
];
