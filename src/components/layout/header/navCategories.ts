// Static nav categories mapped to verified real Shopify collection handles for this store.
export interface NavCategoryDef {
  label: string;
  handle: string | null; // null = Shop All (clears the collection filter)
}

export const NAV_CATEGORIES: NavCategoryDef[] = [
  { label: "Shop All", handle: null },
  { label: "Toys", handle: "toy" },
  { label: "Food", handle: "food" },
  { label: "Clothes", handle: "clothes" },
  { label: "Walk", handle: "walk" },
  { label: "Supplies", handle: "supplies" },
  { label: "Cat", handle: "cat" },
  { label: "Pet Parents", handle: "for-pet-parents" },
];
