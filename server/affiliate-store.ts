export interface AffiliateApplication {
  id: string;
  email: string;
  petName: string;
  socialAccounts: { platform: string; account: string }[];
  country: string;
  acquisitionSource: string;
  couponCode: string;
  status: 'pending';
  createdAt: string;
}

const applications = new Map<string, AffiliateApplication>();
const idsByEmail = new Map<string, string>();

export function addApplication(app: AffiliateApplication): void {
  applications.set(app.id, app);
  idsByEmail.set(app.email.toLowerCase(), app.id);
}

export function getApplicationByEmail(email: string): AffiliateApplication | undefined {
  const id = idsByEmail.get(email.toLowerCase());
  return id ? applications.get(id) : undefined;
}

export function getAllApplications(): AffiliateApplication[] {
  return Array.from(applications.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}
