import { LayoutGrid, ToyBrick, Bone, Shirt, Footprints, ShoppingBasket, Cat, Heart, type LucideIcon } from "lucide-react";

export interface CategoryDef {
  label: string;
  icon: LucideIcon;
  bgClass: string;
  iconClass: string;
  /** null = "Shop All" (clears the collection filter) */
  handle: string | null;
}

// Handles verified against the store's actual collection list (see navCategories.ts for the header nav's copy).
export const CATEGORY_DEFS: CategoryDef[] = [
  { label: "Shop All",     icon: LayoutGrid,     bgClass: "bg-orange-100",  iconClass: "text-primary",      handle: null },
  { label: "Toys",         icon: ToyBrick,       bgClass: "bg-amber-100",   iconClass: "text-amber-600",    handle: "toy" },
  { label: "Food",         icon: Bone,           bgClass: "bg-rose-100",    iconClass: "text-rose-500",     handle: "food" },
  { label: "Clothes",      icon: Shirt,          bgClass: "bg-sky-100",     iconClass: "text-sky-600",      handle: "clothes" },
  { label: "Walk",         icon: Footprints,     bgClass: "bg-emerald-100", iconClass: "text-emerald-600",  handle: "walk" },
  { label: "Supplies",     icon: ShoppingBasket, bgClass: "bg-violet-100",  iconClass: "text-violet-600",   handle: "supplies" },
  { label: "Cat",          icon: Cat,            bgClass: "bg-amber-100",   iconClass: "text-orange-500",   handle: "cat" },
  { label: "Pet Parents",  icon: Heart,          bgClass: "bg-pink-100",    iconClass: "text-pink-500",     handle: "for-pet-parents" },
];
