export interface CuratedPanelDef {
  title: string;
  bgClass: string;
  /** Real collection handle when a confident match exists in the store; otherwise a search query fallback. */
  handle?: string;
  searchQuery?: string;
}

export const CURATED_PANELS: CuratedPanelDef[] = [
  { title: "Puzzle Toys",              bgClass: "bg-orange-100",  handle: "puzzle-toys" },
  { title: "Cooling Series",           bgClass: "bg-sky-100",     handle: "cooling-summer-series" },
  { title: "Chew & Durable",           bgClass: "bg-amber-100",   searchQuery: "chew" },
  { title: "Small Dog Favorites",      bgClass: "bg-rose-100",    searchQuery: "small dog" },
  { title: "Squeaky Favorites",        bgClass: "bg-emerald-100", searchQuery: "squeaky" },
  { title: "Comfort Harness & Wear",   bgClass: "bg-violet-100",  handle: "walk-outdoor-gear" },
];

export function curatedPanelHref({ handle, searchQuery }: CuratedPanelDef): string {
  if (handle) return `/?collection=${encodeURIComponent(handle)}`;
  return `/?q=${encodeURIComponent(searchQuery ?? "")}`;
}
