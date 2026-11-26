// Shopify 맞춤 픽셀: B2C(biteme-us.com) 주문의 결제 화면 이벤트 → B2C GA4(G-LKM994B6GS)
//
// 넣는 곳: Shopify 관리자 → 설정 → 고객 이벤트 → 맞춤 픽셀 추가 → 이 파일 내용을 통째로 붙여넣기
// (이 파일은 사이트 코드에서 쓰이지 않는다. Shopify 관리자에 넣을 코드의 원본 보관용)
//
// 보내는 이벤트 (begin_checkout은 사이트의 장바구니 Checkout / Buy Now 버튼에서 보낸다)
//   Shopify 신호                         → GA4 이벤트
//   checkout_shipping_info_submitted     → add_shipping_info (배송 방법 이름 = shipping_tier)
//   payment_info_submitted               → add_payment_info
//   checkout_completed                   → purchase (transaction_id = 주문 ID, value = 할인 후 상품 금액)
//
// 동작
// - 주문 속성 _site=b2c 가 있는 결제만 보낸다. (biteme-us.com 사이트가 장바구니를 만들 때 붙임: src/lib/shopify.ts)
//   B2B 사이트(biteme.one) 결제에는 이 표시가 없으므로 아무것도 하지 않는다. → B2B/B2C 데이터 분리
// - 위 3개 이벤트만 보낸다. page_view, scroll, session_start 같은 자동 이벤트는 보내지 않는다.
//   (gtag.js를 불러오지 않고, gtag.js가 쓰는 것과 같은 GA4 수집 주소로 이 3개 이벤트만 직접 보낸다.
//    gtag.js를 픽셀 안에서 불러오면 픽셀의 격리된 틀(sandbox)에서 페이지 조회·스크롤을 자동으로 보내고,
//    쿠키를 읽지 못해 매번 새 세션을 시작한다.)
// - 사이트 방문과 같은 사람·같은 세션으로 이어 붙인다:
//   _ga 쿠키 → 방문자 ID(cid), _ga_LKM994B6GS 쿠키 → 세션 ID(sid)·세션 횟수(sct)
//   (두 쿠키 모두 biteme-us.com 전체 공용이라 결제 화면 shop.biteme-us.com에서도 읽힌다)
//   → 구매가 사이트에 들어온 유입 경로(이메일, 광고 등) 세션에 그대로 붙는다.
//   세션 쿠키가 없을 때만(사이트를 거치지 않고 결제 화면에 바로 온 경우) 새 세션으로 보낸다.
// - 주문 ID를 transaction_id로 보내므로, 완료 화면 새로고침 등으로 다시 실행돼도 GA4가 중복 구매로 세지 않는다.
// - 배송·결제 정보는 같은 결제 화면에서 고객이 고쳐 다시 제출해도 한 번만 보낸다.
// - Shop Pay·Apple Pay 같은 간편결제는 배송·결제 입력 단계를 건너뛰므로 그 두 이벤트가 없는 구매도 정상이다.

const GA4_ID = 'G-LKM994B6GS';
const DEBUG = false; // true: 브라우저 콘솔에 [B2C GA4 pixel] 로그 + GA4 DebugView 표시. 테스트 끝나면 false로 바꿔 저장

const COLLECT_URL = 'https://www.google-analytics.com/g/collect';
const SESSION_COOKIE = `_ga_${GA4_ID.replace(/^G-/, '')}`; // _ga_LKM994B6GS

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

async function readCookie(name) {
  try {
    return (await browser.cookie.get(name)) || '';
  } catch (e) {
    return '';
  }
}

// _ga "GA1.1.123456789.1700000000" → 방문자 ID "123456789.1700000000"
function parseClientId(ga) {
  const parts = ga.split('.');
  return parts.length >= 4 ? parts.slice(2).join('.') : undefined;
}

// _ga_LKM994B6GS → { sid: 세션 ID, sct: 세션 횟수 }
//   새 형식 "GS2.1.s1700000000$o3$g1$t1700000100$j0$l0$h0"
//   옛 형식 "GS1.1.1700000000.3.1.1700000100.0.0.0"
function parseSession(value) {
  if (!value) return null;
  if (value.startsWith('GS2.')) {
    const fields = {};
    value.split('.').slice(2).join('.').split('$').forEach((f) => {
      if (f) fields[f[0]] = f.slice(1);
    });
    return fields.s ? { sid: fields.s, sct: fields.o || '1' } : null;
  }
  const parts = value.split('.');
  return parts.length >= 4 && parts[2] ? { sid: parts[2], sct: parts[3] || '1' } : null;
}

// 사이트 쿠키가 없을 때 만든 방문자·세션을 결제 탭 안에서 이어 쓰기 위한 저장소
// (결제 완료 화면은 새 페이지로 열리므로, 저장해 두지 않으면 완료 화면에서 세션이 또 새로 시작된다)
const FALLBACK_KEY = 'bm_b2c_ga4_fallback';
async function loadFallback() {
  try {
    const raw = await browser.sessionStorage.getItem(FALLBACK_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}
async function saveFallback(value) {
  try {
    await browser.sessionStorage.setItem(FALLBACK_KEY, JSON.stringify(value));
  } catch (e) {
    // 저장 못 해도 이벤트 전송은 계속
  }
}

// 방문자·세션 정보는 페이지마다 한 번만 정한다
let identityReady = null;
function getIdentity() {
  if (!identityReady) {
    identityReady = (async () => {
      const [ga, session] = await Promise.all([readCookie('_ga'), readCookie(SESSION_COOKIE)]);
      const clientId = parseClientId(ga);
      const s = parseSession(session);
      let identity;
      if (clientId && s) {
        // 보통의 경우: 사이트 방문자·세션을 그대로 이어 쓴다
        identity = { cid: clientId, sid: s.sid, sct: s.sct, newSession: false, newVisitor: false };
      } else {
        // 사이트를 거치지 않고 결제 화면에 온 경우: 이 결제 탭 전용 세션 (한 번만 시작)
        const saved = await loadFallback();
        if (saved && saved.cid && saved.sid) {
          identity = { cid: clientId || saved.cid, sid: saved.sid, sct: saved.sct || '1', newSession: false, newVisitor: false };
        } else {
          const now = Math.floor(Date.now() / 1000);
          identity = {
            cid: clientId || `${Math.floor(Math.random() * 2147483647)}.${now}`,
            sid: s ? s.sid : String(now),
            sct: s ? s.sct : '1',
            newSession: !s,
            newVisitor: !clientId,
          };
          await saveFallback({ cid: identity.cid, sid: identity.sid, sct: identity.sct });
        }
      }
      log('방문자·세션', { 사이트_방문자_ID: !!clientId, 사이트_세션_이어씀: !!(clientId && s), ...identity });
      return identity;
    })();
  }
  return identityReady;
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

// GA4 상품 형식: id…~nm…~br…~ca…~va…~pr…~qt… (값 안의 ~ 는 구분자와 겹치므로 뺀다)
function encodeItem(item) {
  const clean = (v) => String(v).replace(/~/g, ' ');
  const fields = [
    ['id', item.item_id], ['nm', item.item_name], ['br', item.item_brand],
    ['ca', item.item_category], ['va', item.item_variant], ['pr', item.price], ['qt', item.quantity],
  ];
  return fields.filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => k + clean(v)).join('~');
}

let hitCount = 0;
const pageId = String(Math.floor(Math.random() * 2147483647));

// 이벤트 1건을 GA4로 보낸다 (gtag.js가 보내는 것과 같은 수집 주소·형식)
async function send(name, event, { currency, items, ...params }) {
  const id = await getIdentity();
  const ctx = event.context || {};
  const doc = ctx.document || {};
  const nav = ctx.navigator || {};
  const screen = (ctx.window && ctx.window.screen) || {};

  const q = new URLSearchParams();
  q.set('v', '2');
  q.set('tid', GA4_ID);
  q.set('cid', id.cid);
  q.set('sid', id.sid);
  q.set('sct', id.sct);
  q.set('seg', '1'); // 참여 세션
  q.set('_p', pageId);
  q.set('_s', String(++hitCount));
  if (id.newSession && hitCount === 1) {
    q.set('_ss', '1'); // 사이트 세션이 없을 때만: 이 이벤트로 새 세션 시작
    q.set('_nsi', '1');
    if (id.newVisitor) q.set('_fv', '1');
  }
  if (doc.location && doc.location.href) q.set('dl', doc.location.href);
  if (doc.title) q.set('dt', doc.title);
  if (nav.language) q.set('ul', String(nav.language).toLowerCase());
  if (screen.width && screen.height) q.set('sr', `${screen.width}x${screen.height}`);
  // 유입 경로가 결제 화면으로 바뀌지 않도록 이전 페이지 주소(dr)는 보내지 않는다
  q.set('en', name);
  if (currency) q.set('cu', currency);
  if (DEBUG) {
    q.set('_dbg', '1'); // GA4 관리자 → DebugView에서 바로 보이게
    q.set('ep.debug_mode', 'true');
  }
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    q.set(typeof v === 'number' ? `epn.${k}` : `ep.${k}`, String(v));
  });
  (items || []).forEach((item, i) => q.set(`pr${i + 1}`, encodeItem(item)));

  try {
    await fetch(`${COLLECT_URL}?${q.toString()}`, { method: 'POST', mode: 'no-cors', keepalive: true });
    log(`${name} 전송`, { currency, ...params, items });
  } catch (e) {
    log(`${name} 전송 실패`, e);
  }
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
  if (!checkout || !once(checkout, 'purchase')) return;

  const transactionId = (checkout.order && checkout.order.id) || checkout.token;
  if (!transactionId) return;

  // value = 할인 후 상품 금액(배송비·세금 전) → Shopify 매출과 같은 기준. 배송비·세금은 shipping, tax로 따로 보낸다
  // (총액에서 배송비를 빼는 방식은 배송비 할인이 있을 때 할인 전 배송비가 빠져 매출이 적게 잡힐 수 있어 쓰지 않음)
  // 관세(Duties)는 GA4에 넣을 항목이 없어 보내지 않는다 → 총액과 value+tax+shipping의 차이 = 관세
  const payload = {
    transaction_id: String(transactionId),
    currency: checkout.currencyCode,
    value: toNumber(checkout.subtotalPrice),
    tax: toNumber(checkout.totalTax) || 0,
    shipping: toNumber(checkout.shippingLine && checkout.shippingLine.price) || 0,
    coupon: buildCoupon(checkout),
    items: buildItems(checkout),
  };
  const sum = payload.value !== undefined
    ? Math.round((payload.value + payload.tax + payload.shipping) * 100) / 100
    : undefined;
  const total = toNumber(checkout.totalPrice);
  log('purchase 금액 대조용 (GA4로는 안 보냄)', {
    총액_totalPrice: total,
    'value+tax+shipping': sum,
    '차이(관세 등)': total !== undefined && sum !== undefined ? Math.round((total - sum) * 100) / 100 : undefined,
  });
  await send('purchase', event, payload);
});
