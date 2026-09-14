import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { fetchCartPreview, fetchVariantDiscounts, type CartPreview } from '@/lib/shopify';

/**
 * 장바구니의 **실제 결제 금액**을 들고 있는 스토어.
 *
 * 자동 할인(Open Sale 등)은 Shopify 가 카트 단계에서 계산하므로, 정가를 합산하는 화면에서는
 * 할인이 보이지 않는다. 여기서 Shopify 에 카트를 만들어 계산 결과를 받아 두고 화면이 그 값을 쓴다.
 *
 * cartStore 와 분리한 이유: cartStore 는 localStorage 에 persist 된다. 할인 스냅샷이 거기 남으면
 * 할인이 끝난 뒤에도 다음 방문에 옛 금액이 먼저 보인다. 이 스토어는 새로고침하면 사라진다.
 */

/** 수량 버튼 연타를 한 번의 호출로 묶는 간격 */
const DEBOUNCE_MS = 600;

/** 카트 내용이 같으면 다시 부르지 않기 위한 서명 */
function signature(items: { variantId: string; quantity: number }[]): string {
  return items
    .map((i) => `${i.variantId}:${i.quantity}`)
    .sort()
    .join('|');
}

interface CartPreviewStore {
  preview: CartPreview | null;
  isLoading: boolean;
  /** preview 가 어느 카트에 대한 값인지. 지금 카트와 다르면 화면은 이 값을 쓰지 않는다. */
  signature: string | null;
  /**
   * 카트가 바뀌었을 때 호출한다. 디바운스·중복 제거·순서 역전 방지를 여기서 책임진다.
   * 실패하면 preview 가 null 이 되고 화면은 정가로 돌아간다.
   */
  refresh: (items: { variantId: string; quantity: number }[]) => void;
  clear: () => void;
}

let timer: ReturnType<typeof setTimeout> | null = null;
/** 마지막으로 띄운 요청. 응답이 늦게 온 이전 요청은 버린다. */
let requestId = 0;

export const useCartPreviewStore = create<CartPreviewStore>((set, get) => ({
  preview: null,
  isLoading: false,
  signature: null,

  refresh: (items) => {
    const sig = signature(items);

    if (items.length === 0) {
      if (timer) clearTimeout(timer);
      requestId += 1;
      set({ preview: null, isLoading: false, signature: null });
      return;
    }

    // 이미 같은 카트로 받아 둔 값이 있으면 다시 부르지 않는다.
    if (get().signature === sig && get().preview) return;

    if (timer) clearTimeout(timer);
    set({ isLoading: true });

    timer = setTimeout(() => {
      const id = ++requestId;
      fetchCartPreview(items)
        .then((preview) => {
          if (id !== requestId) return; // 더 새로운 요청이 떴으면 이 응답은 버린다
          set({ preview, isLoading: false, signature: preview ? sig : null });
        })
        .catch(() => {
          if (id !== requestId) return;
          set({ preview: null, isLoading: false, signature: null });
        });
    }, DEBOUNCE_MS);
  },

  clear: () => {
    if (timer) clearTimeout(timer);
    requestId += 1;
    set({ preview: null, isLoading: false, signature: null });
  },
}));

/**
 * 지금 카트에 대해 유효한 미리보기만 돌려준다.
 * 서명이 어긋나면(= 카트가 방금 바뀌어 아직 못 받아온 상태) null 이다.
 */
export function usePreviewFor(items: { variantId: string; quantity: number }[]): CartPreview | null {
  const preview = useCartPreviewStore((s) => s.preview);
  const sig = useCartPreviewStore((s) => s.signature);
  if (!preview || sig !== signature(items)) return null;
  return preview;
}

/** variantId → 1개 기준 할인 금액. 같은 상품을 다시 볼 때 재호출하지 않는다. */
const variantDiscountCache = new Map<string, number>();
/** 같은 상품을 두 군데서 동시에 물었을 때 호출이 겹치지 않게 묶는다. */
const variantDiscountInflight = new Map<string, Promise<number>>();

/**
 * 화면에 카드가 여러 장 뜨면 각자 호출하지 않고 한 묶음으로 모아 보낸다.
 * 상품 목록이 상품 수만큼 요청을 쏘는 것이 JP 에서 rate limit 에 걸린 원인이었다.
 */
const BATCH_WINDOW_MS = 50;
/** 한 요청에 담는 최대 상품 수. 요청 비용(상품당 약 20)이 한도에 닿지 않게 끊는다. */
const BATCH_MAX = 25;

let pending = new Map<string, ((amount: number) => void)[]>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function flushPending() {
  flushTimer = null;
  const batch = pending;
  pending = new Map();

  const ids = [...batch.keys()];
  for (let i = 0; i < ids.length; i += BATCH_MAX) {
    const chunk = ids.slice(i, i + BATCH_MAX);
    fetchVariantDiscounts(chunk).then((map) => {
      for (const id of chunk) {
        const amount = map[id] ?? 0;
        variantDiscountCache.set(id, amount);
        variantDiscountInflight.delete(id);
        batch.get(id)?.forEach((resolve) => resolve(amount));
      }
    });
  }
}

function loadVariantDiscount(variantId: string): Promise<number> {
  const cached = variantDiscountCache.get(variantId);
  if (cached !== undefined) return Promise.resolve(cached);

  const inflight = variantDiscountInflight.get(variantId);
  if (inflight) return inflight;

  const request = new Promise<number>((resolve) => {
    const waiters = pending.get(variantId) ?? [];
    waiters.push(resolve);
    pending.set(variantId, waiters);
  });

  variantDiscountInflight.set(variantId, request);
  if (!flushTimer) flushTimer = setTimeout(flushPending, BATCH_WINDOW_MS);
  return request;
}

/**
 * 상품 상세용 — 이 옵션 **1개만** 담았을 때 붙는 할인 금액을 돌려준다.
 *
 * 위의 카트 미리보기 스토어와 일부러 분리했다. 그 스토어는 "지금 장바구니" 하나만 들고 있어서,
 * 상세 페이지가 거기에 자기 상품을 밀어 넣으면 드로어를 열었을 때 서로 값을 덮어쓴다.
 *
 * 수량 1짜리 단독 카트로 묻는 것이 화면 문구("이 상품을 사면 얼마")와도 정확히 맞는다 —
 * 최소 구매 조건이 붙은 할인은 이 카트에서 자연히 빠진다.
 *
 * 목록에서 카드 수십 장이 동시에 불러도 안전하다 — 50ms 안에 들어온 요청을 한 묶음으로 보낸다.
 * 상품마다 요청을 쏘는 것이 JP 에서 rate limit 에 걸린 원인이었다.
 */
export function useVariantDiscount(variantId: string | null | undefined): number {
  const [discount, setDiscount] = useState(() =>
    variantId ? variantDiscountCache.get(variantId) ?? 0 : 0
  );

  useEffect(() => {
    if (!variantId) {
      setDiscount(0);
      return;
    }

    const cached = variantDiscountCache.get(variantId);
    if (cached !== undefined) {
      setDiscount(cached);
      return;
    }

    let alive = true;
    setDiscount(0);
    loadVariantDiscount(variantId).then((amount) => {
      if (alive) setDiscount(amount);
    });

    return () => {
      alive = false;
    };
  }, [variantId]);

  return discount;
}
