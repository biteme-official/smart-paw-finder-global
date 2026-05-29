import { formatPrice } from '@/lib/shopify';
import { useAuthStore, B2B_DISCOUNT_RATE } from '@/stores/authStore';

interface PriceTagProps {
  amount: string;
  currencyCode: string;
  compareAtAmount?: string | null;
  className?: string;
  originalClassName?: string;
}

export function PriceTag({ amount, currencyCode, compareAtAmount, className = '', originalClassName = '' }: PriceTagProps) {
  const isB2B = useAuthStore((s) => s.isB2B);
  const hasCompareAt = compareAtAmount && parseFloat(compareAtAmount) > parseFloat(amount);

  if (isB2B) {
    const baseAmount = parseFloat(amount);
    const discounted = (baseAmount * (1 - B2B_DISCOUNT_RATE)).toFixed(2);
    const originalDisplay = hasCompareAt ? compareAtAmount! : amount;
    const discountPercent = Math.round(
      (1 - parseFloat(discounted) / parseFloat(originalDisplay)) * 100
    );

    return (
      <span className="inline-flex flex-wrap items-baseline gap-1.5">
        <span className={`line-through text-muted-foreground ${originalClassName}`} translate="no">
          {formatPrice(originalDisplay, currencyCode)}
        </span>
        <span className={className} translate="no">
          {formatPrice(discounted, currencyCode)}
        </span>
        <span className="inline-flex items-center rounded-sm bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-600">
          -{discountPercent}%
        </span>
      </span>
    );
  }

  if (hasCompareAt) {
    const discountPercent = Math.round(
      (1 - parseFloat(amount) / parseFloat(compareAtAmount!)) * 100
    );

    return (
      <span className="inline-flex flex-wrap items-baseline gap-1.5">
        <span className={`line-through text-muted-foreground ${originalClassName}`} translate="no">
          {formatPrice(compareAtAmount!, currencyCode)}
        </span>
        <span className={className} translate="no">
          {formatPrice(amount, currencyCode)}
        </span>
        <span className="inline-flex items-center rounded-sm bg-orange-100 px-1.5 py-0.5 text-xs font-semibold text-orange-600">
          -{discountPercent}%
        </span>
      </span>
    );
  }

  return <span className={className} translate="no">{formatPrice(amount, currencyCode)}</span>;
}

export function getB2BPrice(amount: string): string {
  return (parseFloat(amount) * (1 - B2B_DISCOUNT_RATE)).toFixed(2);
}
