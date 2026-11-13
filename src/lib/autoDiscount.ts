import autoDiscounts from '@/data/autoDiscounts.json';

// Shopify 자동 할인(상품 할인)은 Storefront 상품 가격에 반영되지 않아 결제 단계에서만 붙는다.
// 진행 중인 할인을 옵션 ID별 할인율(%) 목록으로 들고 있다가 상품 화면에 표시한다.
// 목록은 Shopify 할인 설정에서 뽑은 값 — 할인을 바꾸면 이 파일도 다시 만들어야 한다.
const variants: Record<string, number> = autoDiscounts.variants;
const endsAt = new Date(autoDiscounts.endsAt).getTime();

/** 옵션의 자동 할인율(0~1). 할인이 없거나 기간이 끝났으면 0 */
export function getAutoDiscountRate(variantId: string | undefined): number {
  if (!variantId || Date.now() > endsAt) return 0;
  const pct = variants[variantId.split('/').pop() ?? ''];
  return pct ? pct / 100 : 0;
}

/** 화면 표시 할인율. 도매 고객은 도매 할인만 표시 (자동 할인 합산 표시는 보류) */
export function getDisplayDiscountRate(isB2B: boolean, b2bRate: number, variantId: string | undefined): number {
  return isB2B ? b2bRate : getAutoDiscountRate(variantId);
}
