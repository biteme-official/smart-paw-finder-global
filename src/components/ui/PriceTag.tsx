import { formatPrice, type ShopifyProduct } from '@/lib/shopify';
import { useAuthStore } from '@/stores/authStore';
import { useVariantDiscount } from '@/stores/cartPreviewStore';

interface PriceTagProps {
  amount: string;
  currencyCode: string;
  className?: string;
  originalClassName?: string;
  /**
   * 자동 할인 금액(1개 기준). 호출하는 쪽이 Shopify 에서 받아 넘긴다.
   * 자동 할인은 상품 데이터에 반영되지 않아 amount 만으로는 알 수 없다.
   */
  discountAmount?: number;
}

export function PriceTag({ amount, currencyCode, className = '', originalClassName = '', discountAmount = 0 }: PriceTagProps) {
  const isB2B = useAuthStore((s) => s.isB2B);
  const discountRate = useAuthStore((s) => s.b2bDiscountRate);

  if (!isB2B) {
    // 일반 고객: Shopify 자동 할인이 붙어 있으면 정가 취소선 + 할인가
    const original = parseFloat(amount);
    if (discountAmount > 0 && original > 0) {
      const discounted = (original - discountAmount).toFixed(2);
      const percent = Math.round((discountAmount / original) * 100);
      return (
        <span className="inline-flex flex-wrap items-baseline gap-1.5">
          <span className={`line-through text-muted-foreground ${originalClassName}`} translate="no">
            {formatPrice(amount, currencyCode)}
          </span>
          <span className={className} translate="no">
            {formatPrice(discounted, currencyCode)}
          </span>
          <span className="inline-flex items-center rounded-sm bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-600">
            -{percent}%
          </span>
        </span>
      );
    }
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

/** 화면에 찍히는 가격이 어느 옵션의 값인지 찾는다. 할인도 그 옵션 기준으로 물어야 맞다. */
function pickPriceVariantId(product: ShopifyProduct | undefined, amount: string): string | null {
  const edges = product?.node.variants?.edges;
  if (!edges?.length) return null;
  return edges.find((e) => e.node.price.amount === amount)?.node.id ?? edges[0].node.id;
}

/**
 * 자동 할인까지 물어서 보여주는 PriceTag.
 *
 * 자동 할인(Open Sale 등)은 상품 데이터에 없고 카트에서만 계산되므로 따로 물어야 한다.
 * 목록에서 카드 수십 장이 동시에 써도 안전하다 — 50ms 안의 요청을 한 묶음으로 보낸다
 * (cartPreviewStore 의 useVariantDiscount 참고).
 */
export function AutoDiscountPriceTag({
  variantId,
  product,
  ...props
}: PriceTagProps & { variantId?: string | null; product?: ShopifyProduct }) {
  const resolvedId = variantId ?? pickPriceVariantId(product, props.amount);
  const discountAmount = useVariantDiscount(resolvedId);
  return <PriceTag {...props} discountAmount={discountAmount} />;
}

export function getB2BPrice(amount: string): string {
  const rate = useAuthStore.getState().b2bDiscountRate;
  return (parseFloat(amount) * (1 - rate)).toFixed(2);
}
