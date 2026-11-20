// Klaviyo 사이트 추적 — 상품 조회(Viewed Product)·장바구니 담기(Added to Cart)·고객 식별(identify).
// 장바구니 담기 이탈·최근 본 상품 자동 메일용. 주문·고객·결제 시작(Checkout Started)은
// Klaviyo↔Shopify 연동으로 이미 들어오므로 여기서 보내지 않는다.
//
// - 공개키(VITE_KLAVIYO_PUBLIC_KEY)만 사용한다. 값이 없으면 아무것도 하지 않는다.
// - EU(EEA)·영국·스위스 방문자는 동의 배너가 없으므로 스크립트를 로드하지 않는다 (api/geo로 국가 확인).
// - 두 사이트(B2B biteme.one / B2C biteme-us.com)가 같은 Klaviyo 계정을 쓰므로 모든 이벤트에 site 값을 넣는다.

import { IS_B2C_SITE, SITE_URL } from '@/lib/site';

type KlaviyoCommand = [string, ...unknown[]];

declare global {
  interface Window {
    _klOnsite?: KlaviyoCommand[];
  }
}

const PUBLIC_KEY: string = import.meta.env.VITE_KLAVIYO_PUBLIC_KEY || '';
const SITE = IS_B2C_SITE ? 'b2c' : 'b2b';
const GEO_CACHE_KEY = 'bm_klaviyo_geo_v1';

// EU 27개국 + EEA(아이슬란드·리히텐슈타인·노르웨이) + 영국 + 스위스
const CONSENT_REQUIRED_COUNTRIES = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE',
  'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  'IS', 'LI', 'NO', 'GB', 'CH',
]);

// pending: 국가 확인 중(명령은 큐에 쌓임) / enabled: 로드됨 / disabled: 키 없음·동의 필요 지역·확인 실패
let state: 'pending' | 'enabled' | 'disabled' = PUBLIC_KEY ? 'pending' : 'disabled';

function push(command: KlaviyoCommand) {
  if (state === 'disabled' || typeof window === 'undefined') return;
  window._klOnsite = window._klOnsite || [];
  window._klOnsite.push(command);
}

// 방문 국가가 동의가 필요한 지역인지 확인. 확인에 실패하면 로드하지 않는다(안전한 쪽).
async function isConsentRequiredRegion(): Promise<boolean> {
  // 로컬 개발 서버에는 api/geo가 없다
  if (import.meta.env.DEV) return false;
  try {
    const cached = sessionStorage.getItem(GEO_CACHE_KEY);
    let country = cached;
    if (cached === null) {
      const res = await fetch('/api/geo');
      if (!res.ok) return true;
      const data: { country?: string | null } = await res.json();
      country = (data.country || '').toUpperCase();
      sessionStorage.setItem(GEO_CACHE_KEY, country);
    }
    // 국가를 알 수 없으면(헤더 없음) 동의 필요 지역으로 간주
    return !country || CONSENT_REQUIRED_COUNTRIES.has(country);
  } catch {
    return true;
  }
}

// 앱 시작 시 한 번 호출 (src/main.tsx)
export async function initKlaviyo(): Promise<void> {
  if (state !== 'pending') return;
  if (await isConsentRequiredRegion()) {
    state = 'disabled';
    window._klOnsite = [];
    return;
  }
  state = 'enabled';
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://static.klaviyo.com/onsite/js/klaviyo.js?company_id=${encodeURIComponent(PUBLIC_KEY)}`;
  document.head.appendChild(script);
}

function numericId(gid: string): string {
  return gid.split('/').pop() || gid;
}

function productUrl(handle: string): string {
  return `${SITE_URL}/product/${handle}`;
}

export interface KlaviyoProduct {
  id: string; // Shopify 상품 GID
  title: string;
  handle: string;
  vendor?: string;
  productType?: string;
  imageUrl?: string;
}

// 상품 상세 진입 시 — Viewed Product 이벤트 + 최근 본 상품(trackViewedItem)
export function klaviyoViewedProduct(product: KlaviyoProduct, price?: { amount: string; currencyCode: string }) {
  const productId = numericId(product.id);
  const url = productUrl(product.handle);
  const categories = product.productType ? [product.productType] : [];
  const priceValue = price ? parseFloat(price.amount) : undefined;

  push(['track', 'Viewed Product', {
    ProductName: product.title,
    ProductID: productId,
    Categories: categories,
    ImageURL: product.imageUrl,
    URL: url,
    Brand: product.vendor,
    Price: priceValue,
    Currency: price?.currencyCode,
    site: SITE,
  }]);

  push(['trackViewedItem', {
    Title: product.title,
    ItemId: productId,
    Categories: categories,
    ImageUrl: product.imageUrl,
    Url: url,
    Metadata: {
      Brand: product.vendor,
      Price: priceValue,
      Currency: price?.currencyCode,
      site: SITE,
    },
  }]);
}

export interface KlaviyoCartLine {
  product: KlaviyoProduct;
  quantity: number;
  price: { amount: string; currencyCode: string };
}

// 장바구니 담기 시 — 담은 상품 + 장바구니 전체 목록·합계
export function klaviyoAddedToCart(added: KlaviyoCartLine, cart: KlaviyoCartLine[]) {
  const items = cart.map((line) => {
    const itemPrice = parseFloat(line.price.amount);
    return {
      ProductID: numericId(line.product.id),
      ProductName: line.product.title,
      Quantity: line.quantity,
      ItemPrice: itemPrice,
      RowTotal: itemPrice * line.quantity,
      ProductURL: productUrl(line.product.handle),
      ImageURL: line.product.imageUrl,
      ProductCategories: line.product.productType ? [line.product.productType] : [],
      Brand: line.product.vendor,
    };
  });
  const total = items.reduce((sum, item) => sum + item.RowTotal, 0);

  push(['track', 'Added to Cart', {
    $value: total,
    Currency: added.price.currencyCode,
    AddedItemProductName: added.product.title,
    AddedItemProductID: numericId(added.product.id),
    AddedItemCategories: added.product.productType ? [added.product.productType] : [],
    AddedItemImageURL: added.product.imageUrl,
    AddedItemURL: productUrl(added.product.handle),
    AddedItemPrice: parseFloat(added.price.amount),
    AddedItemQuantity: added.quantity,
    AddedItemBrand: added.product.vendor,
    ItemNames: items.map((item) => item.ProductName),
    Items: items,
    site: SITE,
  }]);
}

// 이메일을 아는 순간(쿠폰 팝업 제출·로그인 완료) Klaviyo에 고객을 알려준다
export function klaviyoIdentify(email: string) {
  const value = email.trim();
  if (!value) return;
  push(['identify', { email: value }]);
}
