// Dev-only preview bypass for pages gated behind Shopify Customer Account login.
// `import.meta.env.DEV` is statically false in production builds, so this whole
// module is dead-code-eliminated from prod bundles — it can never activate there.
//
// Local dev can't complete the real Shopify OAuth login without
// VITE_SHOPIFY_SHOP_ID / VITE_SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID in .env.local
// (see customer-auth.ts) and a matching localhost redirect URI registered on
// the Shopify app. Until that's set up, append ?devPreview=1 to any logged-in
// page's URL locally to view it with a mock customer instead of hitting the
// real login flow.

import type { CustomerAccountProfile } from './customer-account';

export function isDevPreviewActive(): boolean {
  if (!import.meta.env.DEV) return false;
  return new URLSearchParams(window.location.search).get('devPreview') === '1';
}

export const DEV_PREVIEW_CUSTOMER: CustomerAccountProfile = {
  id: 'dev-preview-customer',
  creationDate: new Date().toISOString(),
  displayName: 'Zoey (Dev Preview)',
  firstName: 'Zoey',
  lastName: null,
  emailAddress: 'dev-preview@example.com',
  emailMarketingState: null,
  petType: null,
  petBirthday: null,
  phoneNumber: null,
  defaultAddress: null,
  orders: [],
  storeCredit: null,
};
