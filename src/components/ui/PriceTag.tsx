import { formatPrice } from '@/lib/shopify';
import { useAuthStore } from '@/stores/authStore';

interface PriceTagProps {
  amount: string;
  currencyCode: string;
  className?: string;
  originalClassName?: string;
}

export function PriceTag({ amount, currencyCode, className = '', originalClassName = '' }: PriceTagProps) {
  const isB2B = useAuthStore((s) => s.isB2B);
  const discountRate = useAuthStore((s) => s.b2bDiscountRate);

  if (!isB2B) {
    return <span className={className} translate="no">{formatPrice(amount, currencyCode)}</span>;
  }

  const discounted = (parseFloat(amount) * (1 - discountRate)).toFixed(2);
  const discountPercent = Math.round(discountRate * 100);

  return (
    <span className="inline-flex flex-wrap items-baseline gap-1.5">
      <span className={`line-through text-muted-foreground ${originalClassName}`} translate="no">
        {formatPrice(amount, currencyCode)}
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

export function getB2BPrice(amount: string): string {
  const rate = useAuthStore.getState().b2bDiscountRate;
  return (parseFloat(amount) * (1 - rate)).toFixed(2);
}
