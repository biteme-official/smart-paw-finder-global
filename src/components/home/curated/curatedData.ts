import puzzleToys from "@/assets/curated/puzzle-toys.jpg";
import coolingSeries from "@/assets/curated/cooling-series.jpg";
import petLiving from "@/assets/curated/pet-living.jpg";
import smallDogFavorites from "@/assets/curated/small-dog-favorites.jpg";
import squeakyFavorites from "@/assets/curated/squeaky-favorites.jpg";
import comfortHarnessWear from "@/assets/curated/comfort-harness-wear.jpg";

export interface CuratedPanelDef {
  title: string;
  bgClass: string;
  /** Real collection handle when a confident match exists in the store; otherwise a search query fallback. */
  handle?: string;
  searchQuery?: string;
  /** Square photo — see WhatYouMightLikeDesktop/Mobile for the exact recommended px size. Falls back to bgClass when unset. */
  imageUrl?: string;
}

export const CURATED_PANELS: CuratedPanelDef[] = [
  { title: "Puzzle Toys",              bgClass: "bg-orange-100",  handle: "puzzle-toys",           imageUrl: puzzleToys },
  { title: "Cooling Series",           bgClass: "bg-sky-100",     handle: "cooling-summer-series",  imageUrl: coolingSeries },
  { title: "Pet Living",               bgClass: "bg-amber-100",   handle: "cushion-living",         imageUrl: petLiving },
  { title: "Small Dog Favorites",      bgClass: "bg-rose-100",    searchQuery: "small dog",         imageUrl: smallDogFavorites },
  { title: "Squeaky Favorites",        bgClass: "bg-emerald-100", searchQuery: "squeaky",           imageUrl: squeakyFavorites },
  { title: "Comfort Harness & Wear",   bgClass: "bg-violet-100",  handle: "walk-outdoor-gear",      imageUrl: comfortHarnessWear },
];

export function curatedPanelHref({ handle, searchQuery }: CuratedPanelDef): string {
  if (handle) return `/?collection=${encodeURIComponent(handle)}`;
  return `/?q=${encodeURIComponent(searchQuery ?? "")}`;
}
