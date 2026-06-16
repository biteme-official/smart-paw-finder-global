// Shopify Customer Account API OAuth 2.0 (PKCE flow)
// Docs: https://shopify.dev/docs/api/customer

const SHOP_ID = import.meta.env.VITE_SHOPIFY_SHOP_ID;
const CLIENT_ID = import.meta.env.VITE_SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID;

const AUTHORIZATION_ENDPOINT = `https://shopify.com/authentication/${SHOP_ID}/oauth/authorize`;
const LOGOUT_ENDPOINT = `https://shopify.com/authentication/${SHOP_ID}/logout`;
const TOKEN_PROXY = '/api/customer-token';

const STORAGE_KEYS = {
  accessToken: 'sca_access_token',
  refreshToken: 'sca_refresh_token',
  idToken: 'sca_id_token',
  expiresAt: 'sca_expires_at',
  codeVerifier: 'sca_code_verifier',
  state: 'sca_state',
  nonce: 'sca_nonce',
  returnTo: 'sca_return_to',
};

function getRedirectUri(): string {
  return `${window.location.origin}/auth/callback`;
}

function randomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

function base64urlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256(input: string): Promise<ArrayBuffer> {
  const data = new TextEncoder().encode(input);
  return crypto.subtle.digest('SHA-256', data);
}

export async function initiateLogin(returnTo?: string): Promise<void> {
  const codeVerifier = randomString(64);
  const codeChallenge = base64urlEncode(await sha256(codeVerifier));
  const state = randomString(32);
  const nonce = randomString(32);

  sessionStorage.setItem(STORAGE_KEYS.codeVerifier, codeVerifier);
  sessionStorage.setItem(STORAGE_KEYS.state, state);
  sessionStorage.setItem(STORAGE_KEYS.nonce, nonce);
  if (returnTo) sessionStorage.setItem(STORAGE_KEYS.returnTo, returnTo);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    scope: 'openid email customer-account-api:full',
    response_type: 'code',
    redirect_uri: getRedirectUri(),
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  window.location.href = `${AUTHORIZATION_ENDPOINT}?${params.toString()}`;
}

export async function handleCallback(code: string, state: string): Promise<{ success: boolean; error?: string; returnTo?: string }> {
  const savedState = sessionStorage.getItem(STORAGE_KEYS.state);
  const codeVerifier = sessionStorage.getItem(STORAGE_KEYS.codeVerifier);
  const returnTo = sessionStorage.getItem(STORAGE_KEYS.returnTo) || '/mypage';

  if (!savedState || savedState !== state) {
    return { success: false, error: 'Invalid state parameter (possible CSRF attack)' };
  }
  if (!codeVerifier) {
    return { success: false, error: 'Missing code verifier' };
  }

  try {
    const response = await fetch(TOKEN_PROXY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: getRedirectUri(),
        code_verifier: codeVerifier,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return { success: false, error: `Token exchange failed: ${text.slice(0, 200)}` };
    }

    const data = await response.json();
    const expiresAt = Date.now() + data.expires_in * 1000;

    localStorage.setItem(STORAGE_KEYS.accessToken, data.access_token);
    localStorage.setItem(STORAGE_KEYS.expiresAt, expiresAt.toString());
    if (data.refresh_token) localStorage.setItem(STORAGE_KEYS.refreshToken, data.refresh_token);
    if (data.id_token) localStorage.setItem(STORAGE_KEYS.idToken, data.id_token);

    sessionStorage.removeItem(STORAGE_KEYS.codeVerifier);
    sessionStorage.removeItem(STORAGE_KEYS.state);
    sessionStorage.removeItem(STORAGE_KEYS.nonce);
    sessionStorage.removeItem(STORAGE_KEYS.returnTo);

    return { success: true, returnTo };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export function getAccessToken(): string | null {
  const token = localStorage.getItem(STORAGE_KEYS.accessToken);
  const expiresAt = localStorage.getItem(STORAGE_KEYS.expiresAt);
  if (!token || !expiresAt) return null;
  if (Date.now() >= parseInt(expiresAt, 10)) return null;
  return token;
}

export async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem(STORAGE_KEYS.refreshToken);
  if (!refreshToken) return null;

  try {
    const response = await fetch(TOKEN_PROXY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const expiresAt = Date.now() + data.expires_in * 1000;

    localStorage.setItem(STORAGE_KEYS.accessToken, data.access_token);
    localStorage.setItem(STORAGE_KEYS.expiresAt, expiresAt.toString());
    if (data.refresh_token) localStorage.setItem(STORAGE_KEYS.refreshToken, data.refresh_token);

    return data.access_token;
  } catch {
    return null;
  }
}

export function isLoggedIn(): boolean {
  return getAccessToken() !== null;
}

export function logout(): void {
  const idToken = localStorage.getItem(STORAGE_KEYS.idToken);

  localStorage.removeItem(STORAGE_KEYS.accessToken);
  localStorage.removeItem(STORAGE_KEYS.refreshToken);
  localStorage.removeItem(STORAGE_KEYS.idToken);
  localStorage.removeItem(STORAGE_KEYS.expiresAt);
  localStorage.removeItem('sca_storefront_token');
  localStorage.removeItem('sca_storefront_token_expires');

  const params = new URLSearchParams({
    post_logout_redirect_uri: `${window.location.origin}/`,
  });
  if (idToken) params.set('id_token_hint', idToken);

  window.location.href = `${LOGOUT_ENDPOINT}?${params.toString()}`;
}
