import { useState, useEffect } from "react";

interface ReviewSummary {
  avgRating: number;
  count: number;
}

// Module-level cache to avoid duplicate fetches across components
const cache = new Map<string, ReviewSummary>();
const pending = new Map<string, Promise<ReviewSummary>>();

// Tracks IDs currently in-flight in a batch request to prevent duplicate concurrent fetches
const batchInFlight = new Set<string>();

export async function fetchBatchReviewSummary(
  ids: string[]
): Promise<Record<string, ReviewSummary>> {
  if (!ids.length) return {};
  // Skip IDs already cached or currently being fetched
  const uncached = ids.filter(id => !cache.has(id) && !batchInFlight.has(id));
  if (uncached.length) {
    uncached.forEach(id => batchInFlight.add(id));
    try {
      const r = await fetch(`/api/kr-reviews-batch?ids=${uncached.join(',')}`);
      if (r.ok) {
        const data: Record<string, ReviewSummary> = await r.json();
        for (const [id, summary] of Object.entries(data)) {
          cache.set(id, summary);
        }
      }
    } catch {
      // fall through — cache stays empty for these ids
    } finally {
      uncached.forEach(id => batchInFlight.delete(id));
    }
  }
  return Object.fromEntries(ids.map(id => [id, cache.get(id) ?? { avgRating: 0, count: 0 }]));
}

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
      if (!reviews.length) return { avgRating: 0, count: 0 };
      const avg = reviews.reduce((sum, rv) => sum + rv.rating, 0) / reviews.length;
      return { avgRating: avg, count: reviews.length };
    } catch {
      return { avgRating: 0, count: 0 };
    } finally {
      pending.delete(numericId);
      release();
    }
  });

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
