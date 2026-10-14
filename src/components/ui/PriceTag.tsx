import { formatPrice, type ShopifyProduct } from '@/lib/shopify';
import { useAuthStore } from '@/stores/authStore';

interface PriceTagProps {
  amount: string;
  currencyCode: string;
  // 해외 리테일가. 미국 외 B2B 고객에게 취소선 가격으로 표시 (도매가는 amount 기준 그대로)
  intlAmount?: string;
  className?: string;
  originalClassName?: string;
}

export function PriceTag({ amount, currencyCode, intlAmount, className = '', originalClassName = '' }: PriceTagProps) {
  const isB2B = useAuthStore((s) => s.isB2B);
  const discountRate = useAuthStore((s) => s.b2bDiscountRate);
  const b2bCountry = useAuthStore((s) => s.b2bCountry);

  if (!isB2B) {
    return <span className={className} translate="no">{formatPrice(amount, currencyCode)}</span>;
  }

  const discounted = (parseFloat(amount) * (1 - discountRate)).toFixed(2);
  const retail = getB2BRetailAmount(amount, intlAmount, b2bCountry, discounted);
  const discountPercent = Math.round((1 - parseFloat(discounted) / parseFloat(retail)) * 100);

  return (
    <span className="inline-flex flex-wrap items-baseline gap-1.5">
      <span className={`line-through text-muted-foreground ${originalClassName}`} translate="no">
        {formatPrice(retail, currencyCode)}
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

/**
 * B2B 화면의 취소선 리테일가.
 * 미국 외 국가 B2B 고객이고 해외 리테일가가 도매가보다 높을 때만 해외가, 그 외(미국·국가 미상·값 없음)는 기본가(미국가).
 */
export function getB2BRetailAmount(amount: string, intlAmount: string | undefined, country: string | null, discounted: string): string {
  const isIntl = !!country && country !== 'US';
  if (isIntl && intlAmount && parseFloat(intlAmount) > parseFloat(discounted)) return intlAmount;
  return amount;
}

/** 옵션의 해외 리테일가. variantId가 없으면 최저가 옵션 기준 (상품 카드·목록용) */
export function getIntlRetail(product: ShopifyProduct['node'], variantId?: string): string | undefined {
  const variants = product.variants?.edges ?? [];
  const minAmount = product.priceRange.minVariantPrice.amount;
  const v = variantId
    ? variants.find((e) => e.node.id === variantId)
    : variants.find((e) => parseFloat(e.node.price.amount) === parseFloat(minAmount));
  return v?.node.intlRetailPrice?.value ?? undefined;
}
