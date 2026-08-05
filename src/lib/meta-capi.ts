// Meta Conversions API (server-side) event dispatch
// biteme.one은 Shopify 테마가 아닌 커스텀 프론트엔드라, Shopify가 자동 주입하는
// Meta 픽셀이 체크아웃 이외의 페이지(상품 상세 등)에서는 발화되지 않는다.
// 이 헬퍼는 그 공백을 서버사이드 CAPI 호출(/api/meta-capi)로 채운다.

import { getFbc, getFbp } from './browser-utils';

function generateEventId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

interface ViewContentParams {
  contentId: string;
  contentName: string;
  value?: number;
  currency?: string;
}

export function trackViewContentCapi({ contentId, contentName, value, currency }: ViewContentParams): void {
  try {
    fetch('/api/meta-capi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_name: 'ViewContent',
        event_id: generateEventId(),
        event_source_url: window.location.href,
        content_ids: [contentId],
        content_type: 'product',
        content_name: contentName,
        value,
        currency,
        fbc: getFbc(),
        fbp: getFbp(),
      }),
    }).catch(() => {
      // 전환 추적 실패가 사용자 경험을 막아서는 안 됨 — 조용히 무시
    });
  } catch {
    // silent
  }
}
