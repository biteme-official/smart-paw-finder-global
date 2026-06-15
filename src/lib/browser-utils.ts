// Detect if running in an in-app browser (TikTok, Instagram, Facebook, etc.)
export function isInAppBrowser(): boolean {
  const ua = navigator.userAgent || navigator.vendor || '';
  
  // Common in-app browser patterns
  const inAppPatterns = [
    /FBAN|FBAV/i,           // Facebook
    /Instagram/i,            // Instagram
    /Twitter/i,              // Twitter/X
    /Line\//i,               // LINE
    /KAKAOTALK/i,            // KakaoTalk
    /NAVER/i,                // Naver
    /WhatsApp/i,             // WhatsApp
    /Snapchat/i,             // Snapchat
    /TikTok/i,               // TikTok
    /BytedanceWebview/i,     // TikTok (alternative)
    /musical_ly/i,           // TikTok (old name)
    /WeChat|MicroMessenger/i, // WeChat
    /Pinterest/i,            // Pinterest
    /LinkedIn/i,             // LinkedIn
  ];
  
  return inAppPatterns.some(pattern => pattern.test(ua));
}

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;
const UTM_STORAGE_KEY = 'bm_utm';

// Save UTM params from current URL to sessionStorage (call once on app init)
export function saveUtmParams(): void {
  try {
    const params = new URLSearchParams(window.location.search);
    const utm: Record<string, string> = {};
    UTM_KEYS.forEach((k) => {
      const v = params.get(k);
      if (v) utm[k] = v;
    });
    if (Object.keys(utm).length > 0) {
      sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(utm));
    }
  } catch {
    // silent
  }
}

// Append saved UTM params to a destination URL (Shopify checkout URL)
export function appendUtmToUrl(url: string): string {
  try {
    const stored = sessionStorage.getItem(UTM_STORAGE_KEY);
    const utm: Record<string, string> = stored ? JSON.parse(stored) : {};
    // Current page URL params take precedence over stored
    const currentParams = new URLSearchParams(window.location.search);
    UTM_KEYS.forEach((k) => {
      const v = currentParams.get(k);
      if (v) utm[k] = v;
    });
    if (Object.keys(utm).length === 0) return url;
    const u = new URL(url);
    Object.entries(utm).forEach(([k, v]) => u.searchParams.set(k, v));
    return u.toString();
  } catch {
    return url;
  }
}

// Manually decorate a URL with GA4 cross-domain linker (_gl parameter)
// GA4 auto-decorates <a> clicks but NOT programmatic navigations (window.location.href).
// We create a hidden <a>, let GA4 decorate it, then extract the _gl param.
export function decorateWithGaLinker(url: string): string {
  try {
    // Method 1: Create a temporary <a> element and let GA4 linker auto-decorate it
    const tempLink = document.createElement('a');
    tempLink.href = url;
    document.body.appendChild(tempLink);

    // GA4 linker uses MutationObserver or decorates synchronously on append.
    // Trigger a manual click event dispatch to force decoration.
    // Some GA4 implementations decorate on mousedown/click events.
    tempLink.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    tempLink.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    // Read the (possibly decorated) href
    const decoratedHref = tempLink.href;
    document.body.removeChild(tempLink);

    if (decoratedHref && decoratedHref !== url) {
      const decoratedUrl = new URL(decoratedHref);
      const glParam = decoratedUrl.searchParams.get('_gl');
      if (glParam) {
        const finalUrl = new URL(url);
        finalUrl.searchParams.set('_gl', glParam);
        return finalUrl.toString();
      }
    }
  } catch {
    // silent
  }

  try {
    // Method 2: Read from google_tag_data (internal GA4 state)
    // @ts-ignore
    const glBridge = window?.google_tag_data?.glBridgeState;
    if (glBridge?.generate) {
      // @ts-ignore
      const linkerParam = glBridge.generate();
      if (linkerParam) {
        const u = new URL(url);
        u.searchParams.set('_gl', linkerParam);
        return u.toString();
      }
    }
  } catch {
    // silent
  }

  try {
    // Method 3: Forward existing _gl from current page URL
    const glFromSearch = new URLSearchParams(window.location.search).get('_gl');
    if (glFromSearch) {
      const u = new URL(url);
      u.searchParams.set('_gl', glFromSearch);
      return u.toString();
    }
  } catch {
    // silent
  }

  // Method 4: Build _gl from _ga cookie (client_id based)
  try {
    const gaCookie = document.cookie.split('; ').find(c => c.startsWith('_ga='));
    if (gaCookie) {
      const gaValue = gaCookie.split('=')[1]; // GA1.1.XXXXXXXXXX.XXXXXXXXXX
      const parts = gaValue?.split('.');
      if (parts && parts.length >= 4) {
        const clientId = parts.slice(2).join('.');
        // Construct a basic _gl parameter with client_id
        // Format: 1~<version>~<client_id_hash>
        const u = new URL(url);
        u.searchParams.set('_ga', clientId);
        return u.toString();
      }
    }
  } catch {
    // silent
  }

  return url;
}

// Safe navigation that works in in-app browsers
export function safeNavigate(url: string, options?: { newTab?: boolean }): void {
  const { newTab = true } = options || {};
  
  // Decorate with GA4 _gl parameter for cross-domain tracking
  const decoratedUrl = decorateWithGaLinker(url);
  
  if (isInAppBrowser()) {
    // In-app browsers often block window.open, use direct navigation
    window.location.href = decoratedUrl;
  } else if (newTab) {
    // Regular browsers - open in new tab
    const newWindow = window.open(decoratedUrl, '_blank');
    // Fallback if popup was blocked
    if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
      window.location.href = decoratedUrl;
    }
  } else {
    window.location.href = decoratedUrl;
  }
}
