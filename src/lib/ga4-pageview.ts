// GA4 SPA page_view tracker
// index.html sets send_page_view: false, so this is the single source of truth.

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

let lastTrackedPath = '';

function getStoredUtmParams(): Record<string, string> {
  try {
    const raw = sessionStorage.getItem('_bm_utm');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Send a GA4 page_view event for SPA route changes.
 * Called on every route change including the initial load.
 */
export function trackPageView(path: string, title?: string) {
  if (path === lastTrackedPath) return;
  lastTrackedPath = path;

  if (typeof window === 'undefined' || !window.gtag) return;

  const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const hasLiveUtm = ['utm_source', 'gclid'].some(k => params.get(k));

  const storedUtm = !hasLiveUtm ? getStoredUtmParams() : {};

  const pageLocation = hasLiveUtm
    ? window.location.href
    : window.location.origin + path;

  window.gtag('event', 'page_view', {
    page_path: path,
    page_location: pageLocation,
    page_title: title || document.title,
    page_referrer: document.referrer || undefined,
    ...storedUtm,
  });
}
