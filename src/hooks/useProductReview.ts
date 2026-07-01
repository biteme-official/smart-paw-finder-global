import { useState, useEffect } from "react";

interface ReviewSummary {
  avgRating: number;
  count: number;
}

// Module-level cache to avoid duplicate fetches across components
const cache = new Map<string, ReviewSummary>();
const pending = new Map<string, Promise<ReviewSummary>>();

// Concurrency limiter — max 5 simultaneous /api/kr-reviews requests
const MAX_CONCURRENT = 5;
let activeCount = 0;
const waitQueue: Array<() => void> = [];

function acquire(): Promise<void> {
  if (activeCount < MAX_CONCURRENT) {
    activeCount++;
    return Promise.resolve();
  }
  return new Promise(resolve => waitQueue.push(resolve));
}

function release(): void {
  const next = waitQueue.shift();
  if (next) {
    next();
  } else {
    activeCount--;
  }
}

async function fetchReviewSummary(numericId: string): Promise<ReviewSummary> {
  if (cache.has(numericId)) return cache.get(numericId)!;
  if (pending.has(numericId)) return pending.get(numericId)!;

  const promise: Promise<ReviewSummary> = acquire().then(async () => {
    try {
      const r = await fetch(`/api/kr-reviews?shopify_product_id=${numericId}`);
      const data = r.ok ? await r.json() : { reviews: [] };
      const reviews: { rating: number }[] = data.reviews ?? [];
      const result: ReviewSummary = reviews.length
        ? { avgRating: reviews.reduce((sum, rv) => sum + rv.rating, 0) / reviews.length, count: reviews.length }
        : { avgRating: 0, count: 0 };
      cache.set(numericId, result);
      return result;
    } catch {
      // 에러 시 캐시하지 않아 다음 렌더에서 재시도 가능
      return { avgRating: 0, count: 0 };
    } finally {
      pending.delete(numericId);
      release();
    }
  });

  pending.set(numericId, promise);
  return promise;
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
