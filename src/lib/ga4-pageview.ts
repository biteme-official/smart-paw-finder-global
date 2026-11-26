// GA4 SPA page_view tracker
// GA4's automatic page_view only fires on initial full page load.
// For SPA route changes, we must manually send page_view events
// so that every subsequent event inherits the correct page context
// and user source/medium attribution is preserved.
//
// B2C 사이트(biteme-us.com)는 보내지 않는다: GTM으로 불러온 GA4(G-LKM994B6GS)의
// 향상된 측정 "브라우저 기록 기반 페이지 변경"이 화면 이동마다 page_view를 보내므로,
// 여기서도 보내면 페이지 조회가 두 번 잡힌다.

import { IS_B2C_SITE } from './site';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

let lastTrackedPath = '';

/**
 * Send a GA4 page_view event for SPA route changes.
 * Should be called on every route change BEFORE any other GA4 events.
 */
export function trackPageView(path: string, title?: string) {
  if (IS_B2C_SITE) return;
  // Deduplicate: don't fire if same path (e.g. re-renders)
  if (path === lastTrackedPath) return;
  lastTrackedPath = path;

  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'page_view', {
      page_path: path,
      page_location: window.location.origin + path,
      page_title: title || document.title,
    });
  }
}
