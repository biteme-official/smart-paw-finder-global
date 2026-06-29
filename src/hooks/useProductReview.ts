import { useState, useEffect } from "react";

interface ReviewSummary {
  avgRating: number;
  count: number;
}

// Module-level cache to avoid duplicate fetches across components
const cache = new Map<string, ReviewSummary>();
const pending = new Map<string, Promise<ReviewSummary>>();

async function fetchReviewSummary(numericId: string): Promise<ReviewSummary> {
  if (cache.has(numericId)) return cache.get(numericId)!;
  if (pending.has(numericId)) return pending.get(numericId)!;

  const promise = fetch(`/api/kr-reviews?shopify_product_id=${numericId}`)
    .then(r => r.ok ? r.json() : { reviews: [] })
    .then((data): ReviewSummary => {
      const reviews: { rating: number }[] = data.reviews ?? [];
      if (!reviews.length) return { avgRating: 0, count: 0 };
      const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
      return { avgRating: avg, count: reviews.length };
    })
    .catch((): ReviewSummary => ({ avgRating: 0, count: 0 }))
    .finally(() => pending.delete(numericId));

  pending.set(numericId, promise);
  const result = await promise;
  cache.set(numericId, result);
  return result;
}

export function useProductReviewSummary(numericId: string): ReviewSummary & { loading: boolean } {
  const [summary, setSummary] = useState<ReviewSummary>(() => cache.get(numericId) ?? { avgRating: 0, count: 0 });
  const [loading, setLoading] = useState(!cache.has(numericId));

  useEffect(() => {
    if (!numericId) return;
    if (cache.has(numericId)) {
      setSummary(cache.get(numericId)!);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchReviewSummary(numericId).then(s => {
      setSummary(s);
      setLoading(false);
    });
  }, [numericId]);

  return { ...summary, loading };
}
