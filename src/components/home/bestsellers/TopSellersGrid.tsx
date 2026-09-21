import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShopifyProduct, fetchBestSellingProducts, fetchProductsByIds } from "@/lib/shopify";

const DESKTOP_COUNT = 10;
const MOBILE_COUNT = 8;

interface ViewedItem {
  productId: string;
  views: number;
}

async function fetchTopViewedProductIds(): Promise<string[]> {
  const res = await fetch("/api/top-viewed-products?limit=40");
  if (!res.ok) throw new Error(`top-viewed-products ${res.status}`);
  const data: { items: ViewedItem[] } = await res.json();
  return data.items.map((item) => item.productId);
}

// Top 10 products by GA4 page-view count (view_item events, keyed by Shopify product
// GID), excluding anything already shown in the Popular Products (best-selling) carousel
// above. Falls back to best-sellers if the view-count endpoint has no/insufficient data —
// the section should never render an empty or half-filled row.
export function TopSellersGrid() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<ShopifyProduct["node"][]>([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Fetch a larger pool so there's a same-source fallback list (rank 13+) that
      // doesn't just collapse back to the same 12 products Popular Products excludes.
      const bestSellingPool = await fetchBestSellingProducts(30).catch(() => []);
      const availablePool = bestSellingPool.filter((p) =>
        p.node.variants.edges.some((v) => v.node.availableForSale)
      );
      const excludeIds = new Set(availablePool.slice(0, 12).map((p) => p.node.id));
      const fallbackCandidates = availablePool.filter((p) => !excludeIds.has(p.node.id));

      let rankedIds: string[] = [];
      try {
        rankedIds = await fetchTopViewedProductIds();
      } catch (err) {
        console.error("[TopSellersGrid] view-count fetch failed, falling back to next-best-sellers", err);
      }

      const candidateIds = rankedIds
        .filter((id) => !excludeIds.has(id))
        .slice(0, DESKTOP_COUNT);

      let picked: (ShopifyProduct["node"] | null)[] = [];
      if (candidateIds.length) {
        picked = await fetchProductsByIds(candidateIds).catch(() => []);
      }
      const result = picked.filter((p): p is ShopifyProduct["node"] => !!p && p.availableForSale !== false);

      // Backfill with the next-best-sellers (rank 13+) if view data was missing/thin
      if (result.length < DESKTOP_COUNT) {
        const pickedIds = new Set(result.map((p) => p.id));
        for (const p of fallbackCandidates) {
          if (result.length >= DESKTOP_COUNT) break;
          if (pickedIds.has(p.node.id)) continue;
          result.push(p.node);
          pickedIds.add(p.node.id);
        }
      }

      if (!cancelled) setProducts(result.slice(0, DESKTOP_COUNT));
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (products.length === 0) return null;

  return (
    <section className="md:mt-24 mb-12 md:mb-24 px-4">
      <h2 className="text-lg font-bold text-foreground mb-8 text-center md:text-xl md:mb-8">
        Trending Now
      </h2>
      <div className="grid grid-cols-4 md:grid-cols-5 gap-2 md:gap-4 max-w-7xl mx-auto">
        {products.map((product, i) => (
          <button
            key={product.id}
            onClick={() => navigate(`/product/${product.handle}`)}
            className={`block aspect-square overflow-hidden rounded-md ${i >= MOBILE_COUNT ? "hidden md:block" : ""}`}
          >
            <img
              src={product.images.edges[0]?.node.url}
              alt={product.title}
              className="h-full w-full object-cover transition-transform hover:scale-105"
              loading="lazy"
            />
          </button>
        ))}
      </div>
    </section>
  );
}
