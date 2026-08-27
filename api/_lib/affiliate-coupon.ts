// Shared by api/affiliate.ts and server/affiliate-proxy.ts so coupon codes are
// generated identically in production and local dev.
//
// Pet-name-only codes collide whenever two applicants share a name (e.g. two
// "Coco"s both get COCO15), and non-ASCII names strip down to an empty base.
// Appending a short slice of the application id keeps codes unique and
// non-empty regardless of the name's script.
export function generateCouponCode(petName: string, applicationId: string): string {
  const base = petName.toUpperCase().replace(/[^A-Z0-9]/g, '') || 'PET';
  const suffix = applicationId.slice(-4).toUpperCase().replace(/[^A-Z0-9]/g, '');
  return `${base}15${suffix}`;
}
