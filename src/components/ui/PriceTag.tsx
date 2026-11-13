import { formatPrice } from '@/lib/shopify';
import { useAuthStore } from '@/stores/authStore';
import { getDisplayDiscountRate } from '@/lib/autoDiscount';

interface PriceTagProps {
  amount: string;
  currencyCode: string;
  className?: string;
  originalClassName?: string;
  /** 옵션 ID — 자동 할인(블프 등) 표시용 */
  variantId?: string;
}

export function PriceTag({ amount, currencyCode, className = '', originalClassName = '', variantId }: PriceTagProps) {
  const isB2B = useAuthStore((s) => s.isB2B);
  const discountRate = useAuthStore((s) => s.b2bDiscountRate);

  // 일반 고객(비로그인 포함)은 자동 할인, 도매 고객은 도매 할인 + 자동 할인 합산
  const rate = getDisplayDiscountRate(isB2B, discountRate, variantId);

  if (!rate) {
    return <span className={className} translate="no">{formatPrice(amount, currencyCode)}</span>;
  }

  const discounted = (parseFloat(amount) * (1 - rate)).toFixed(2);
  const discountPercent = Math.round(rate * 100);

  return (
    <span className="inline-flex flex-wrap items-baseline gap-1.5">
      <span className={`${className} !text-red-500`} translate="no">
        {formatPrice(discounted, currencyCode)}
      </span>
      <span className={`line-through text-muted-foreground ${originalClassName}`} translate="no">
        {formatPrice(amount, currencyCode)}
      </span>
      <span className="inline-flex items-center rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
        -{discountPercent}%
      </span>
    </span>
  );
}

export function getB2BPrice(amount: string): string {
  const rate = useAuthStore.getState().b2bDiscountRate;
  return (parseFloat(amount) * (1 - rate)).toFixed(2);
}
