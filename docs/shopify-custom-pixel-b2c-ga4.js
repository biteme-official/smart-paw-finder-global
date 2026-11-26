// Shopify 맞춤 픽셀: B2C(biteme-us.com) 주문의 결제 화면 이벤트 → B2C GA4(G-LKM994B6GS)
//
// 넣는 곳: Shopify 관리자 → 설정 → 고객 이벤트 → 맞춤 픽셀 추가 → 이 파일 내용을 통째로 붙여넣기
// (이 파일은 사이트 코드에서 쓰이지 않는다. Shopify 관리자에 넣을 코드의 원본 보관용)
//
// 보내는 이벤트 (begin_checkout은 사이트의 장바구니 Checkout / Buy Now 버튼에서 보낸다)
//   Shopify 신호                         → GA4 이벤트
//   checkout_shipping_info_submitted     → add_shipping_info (배송 방법 이름 = shipping_tier)
//   payment_info_submitted               → add_payment_info
//   checkout_completed                   → purchase (transaction_id = 주문 ID)
//
// 동작
// - 주문 속성 _site=b2c 가 있는 결제만 보낸다. (biteme-us.com 사이트가 장바구니를 만들 때 붙임: src/lib/shopify.ts)
//   B2B 사이트(biteme.one) 결제에는 이 표시가 없으므로 아무것도 하지 않는다. → B2B/B2C 데이터 분리
// - 같은 방문자로 이어지도록 사이트에서 만든 _ga 쿠키(biteme-us.com 전체 공용)의 방문자 ID를 그대로 쓴다.
// - 주문 ID를 transaction_id로 보내므로, 완료 화면 새로고침 등으로 다시 실행돼도 GA4가 중복 구매로 세지 않는다.
// - 배송·결제 정보는 같은 결제 화면에서 고객이 고쳐 다시 제출해도 한 번만 보낸다.
// - Shop Pay·Apple Pay 같은 간편결제는 배송·결제 입력 단계를 건너뛰므로 그 두 이벤트가 없는 구매도 정상이다.

const GA4_ID = 'G-LKM994B6GS';
const DEBUG = false; // true: 브라우저 콘솔에 [B2C GA4 pixel] 로그 + GA4 DebugView 표시. 테스트 끝나면 false로 바꿔 저장

function log(...args) {
  if (DEBUG) console.log('[B2C GA4 pixel]', ...args);
}

function toNumber(money) {
  const n = parseFloat(money && money.amount);
  return Number.isFinite(n) ? n : undefined;
}

// 앞 금액이 없으면 다음 금액
function firstNumber(...moneys) {
  for (const m of moneys) {
    const n = toNumber(m);
    if (n !== undefined) return n;
  }
  return undefined;
}

// 사이트의 item_id(상품 GID: gid://shopify/Product/123)와 같은 형식으로 맞춘다
function toProductGid(id) {
  if (!id) return undefined;
  const s = String(id);
  return s.startsWith('gid://') ? s : `gid://shopify/Product/${s}`;
}

// _ga 쿠키 "GA1.1.123456789.1700000000" → 방문자 ID "123456789.1700000000"
async function getClientId() {
  try {
    const ga = await browser.cookie.get('_ga');
    const parts = (ga || '').split('.');
    return parts.length >= 4 ? parts.slice(2).join('.') : undefined;
  } catch (e) {
    return undefined;
  }
}

// gtag는 한 번만 불러오고 설정한다 (결제 화면 안에서 여러 이벤트가 이어서 나가므로)
let gtagReady = null;
function getGtag() {
  if (!gtagReady) {
    gtagReady = getClientId().then((clientId) => {
      window.dataLayer = window.dataLayer || [];
      window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments); };
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`;
      document.head.appendChild(script);
      window.gtag('js', new Date());
      window.gtag('config', GA4_ID, {
        send_page_view: false,
        client_id: clientId,
        // 결제 사이트 이동·결제 대행사에서 돌아올 때 새 유입으로 잡히지 않게
        ignore_referrer: true,
      });
      log('gtag 준비', { clientId });
      return window.gtag;
    });
  }
  return gtagReady;
}

// _site=b2c 표시가 있는 결제면 checkout을, 아니면 null을 돌려준다
function getB2CCheckout(event) {
  const checkout = event.data && event.data.checkout;
  if (!checkout) return null;
  const attrs = checkout.attributes || [];
  const isB2C = attrs.some((a) => a && a.key === '_site' && a.value === 'b2c');
  if (!isB2C) {
    log(`${event.name}: B2C 표시 없음 → 보내지 않음`);
    return null;
  }
  return checkout;
}

function buildItems(checkout) {
  return (checkout.lineItems || []).map((li) => {
    const v = li.variant || {};
    const p = v.product || {};
    return {
      item_id: toProductGid(p.id),
      item_name: p.title || li.title,
      item_brand: p.vendor || undefined,
      item_category: p.type || undefined,
      item_variant: v.title && v.title !== 'Default Title' ? v.title : undefined,
      price: toNumber(v.price),
      quantity: li.quantity,
    };
  });
}

function buildCoupon(checkout) {
  return (checkout.discountApplications || [])
    .filter((d) => d && d.type === 'DISCOUNT_CODE' && d.title)
    .map((d) => d.title)
    .join(',') || undefined;
}

function pageLocation(event) {
  const doc = event.context && event.context.document;
  return doc && doc.location ? doc.location.href : undefined;
}

// 같은 결제(checkout.token)에서 같은 이벤트는 한 번만
const sent = new Set();
function once(checkout, name) {
  const key = `${checkout.token || ''}:${name}`;
  if (sent.has(key)) {
    log(`${name}: 이미 보냄 → 건너뜀`);
    return false;
  }
  sent.add(key);
  return true;
}

async function send(name, event, payload) {
  const gtag = await getGtag();
  const full = {
    send_to: GA4_ID,
    page_location: pageLocation(event),
    ...payload,
  };
  if (DEBUG) full.debug_mode = true; // GA4 관리자 → DebugView에서 바로 보이게
  gtag('event', name, full);
  log(`${name} 전송`, full);
}

// 배송 정보 입력 완료 → add_shipping_info
analytics.subscribe('checkout_shipping_info_submitted', async (event) => {
  const checkout = getB2CCheckout(event);
  if (!checkout || !once(checkout, 'add_shipping_info')) return;

  const delivery = checkout.delivery && checkout.delivery.selectedDeliveryOptions;
  const shippingTier = (delivery && delivery[0] && delivery[0].title) || undefined;

  await send('add_shipping_info', event, {
    currency: checkout.currencyCode,
    value: firstNumber(checkout.subtotalPrice, checkout.totalPrice), // 상품 금액 기준
    coupon: buildCoupon(checkout),
    shipping_tier: shippingTier,
    items: buildItems(checkout),
  });
});

// 결제 수단 입력 완료 → add_payment_info
analytics.subscribe('payment_info_submitted', async (event) => {
  const checkout = getB2CCheckout(event);
  if (!checkout || !once(checkout, 'add_payment_info')) return;

  // 결제 수단 이름은 Shopify가 이 시점에 넘겨줄 때만 들어간다 (없으면 비워 둠)
  const tx = (checkout.transactions || [])[0];
  const paymentType = (tx && ((tx.paymentMethod && tx.paymentMethod.name) || tx.gateway)) || undefined;

  await send('add_payment_info', event, {
    currency: checkout.currencyCode,
    value: firstNumber(checkout.subtotalPrice, checkout.totalPrice),
    coupon: buildCoupon(checkout),
    payment_type: paymentType,
    items: buildItems(checkout),
  });
});

// 결제 완료 → purchase
analytics.subscribe('checkout_completed', async (event) => {
  const checkout = getB2CCheckout(event);
  if (!checkout) return;

  const transactionId = (checkout.order && checkout.order.id) || checkout.token;
  if (!transactionId) return;

  await send('purchase', event, {
    transaction_id: String(transactionId),
    currency: checkout.currencyCode,
    value: toNumber(checkout.totalPrice), // 고객이 실제 결제한 총액(배송비·세금 포함)
    tax: toNumber(checkout.totalTax),
    shipping: toNumber(checkout.shippingLine && checkout.shippingLine.price),
    coupon: buildCoupon(checkout),
    items: buildItems(checkout),
  });
});
