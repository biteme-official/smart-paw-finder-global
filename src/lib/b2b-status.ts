import { getAccessToken, refreshAccessToken } from '@/lib/customer-auth';

export type B2BStatus = 'none' | 'pending' | 'approved' | 'rejected';

/**
 * The signed-in customer's B2B state, shared by My Page and the B2B application page.
 * Verified follows the same `B2B` tag that unlocks wholesale pricing (see B2BDiscountSync),
 * so nothing says "verified" while prices are still retail.
 */
export async function fetchB2BStatus(email: string): Promise<{ status: B2BStatus; rejectionReason: string | null }> {
  const [tagsRes, statusRes] = await Promise.all([
    fetch('/api/customer-tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    }),
    fetch('/api/b2b-status', { headers: { Authorization: getAccessToken() || (await refreshAccessToken()) || '' } }),
  ]);

  const tags: string[] = (await tagsRes.json()).tags || [];
  const statusData = await statusRes.json();
  const hasTag = (tag: string) => tags.some((t) => t.toUpperCase() === tag);

  if (hasTag('B2B')) return { status: 'approved', rejectionReason: null };
  if (statusData.status === 'rejected') return { status: 'rejected', rejectionReason: statusData.rejectionReason || null };
  // KV `approved` without the `B2B` tag means tagging failed on approval — pricing isn't live yet.
  if (hasTag('B2B-PENDING') || statusData.status === 'pending' || statusData.status === 'approved') {
    return { status: 'pending', rejectionReason: null };
  }
  return { status: 'none', rejectionReason: null };
}
