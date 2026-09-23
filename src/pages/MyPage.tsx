import { useState, useEffect, useRef, type ReactNode, type Ref } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  LogOut, User, ShoppingBag, Heart, HelpCircle, ChevronRight,
  MapPin, Loader2, Search, Building2, Wallet, Mail,
} from 'lucide-react';
import { initiateLogin, isLoggedIn as isCustomerLoggedIn, logout as customerLogout } from '@/lib/customer-auth';
import {
  fetchCustomerAccount, fetchStoreCredit, updateEmailMarketingConsent,
  CustomerAccountProfile, StoreCreditData, EmailMarketingState,
} from '@/lib/customer-account';
import { formatPrice } from '@/lib/shopify';
import { useAuthStore } from '@/stores/authStore';
import { fetchB2BStatus, type B2BStatus } from '@/lib/b2b-status';
import { toast } from 'sonner';
import { useFavoritesStore, GUEST_FAVORITES_KEY } from '@/stores/favoritesStore';
import {
  PetProfileForm, PET_PROFILE_UPDATED_EVENT, PetProfileUpdate, consumePetHighlight,
} from '@/components/account/PetProfile';

function MenuLink({ icon: Icon, label, badge, badgeClassName = 'bg-primary/10 text-primary', onClick }: {
  icon: typeof ShoppingBag; label: string; badge?: string | number; badgeClassName?: string; onClick?: () => void;
}) {
  return (
    <button onClick={onClick} className="w-full flex items-center justify-between py-3.5 hover:bg-secondary/50 transition-colors">
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5 text-muted-foreground" />
        <span className="text-sm">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {badge !== undefined && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeClassName}`}>{badge}</span>
        )}
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </button>
  );
}

function MarketingConsent({ state, onChange, highlight, containerRef, children }: {
  state: EmailMarketingState | null;
  onChange: (next: EmailMarketingState) => void;
  highlight?: boolean;
  containerRef?: Ref<HTMLDivElement>;
  children?: ReactNode;
}) {
  const [saving, setSaving] = useState(false);
  const subscribed = state === 'SUBSCRIBED' || state === 'PENDING';

  const handleToggle = async (checked: boolean) => {
    setSaving(true);
    try {
      const next = await updateEmailMarketingConsent(checked);
      onChange(next);
      toast.success(
        checked ? 'Subscribed to marketing emails.' : 'Unsubscribed from marketing emails.',
        { position: 'top-center' },
      );
    } catch (err) {
      console.error(err);
      toast.error('Failed to update your preference. Please try again.', { position: 'top-center' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`bg-card rounded-xl p-4 scroll-mt-36 transition-shadow ${
        highlight ? 'border-2 border-primary ring-4 ring-primary/15' : 'border border-border'
      }`}
    >
      {highlight && (
        <span className="inline-block mb-3 text-xs font-semibold text-accent-foreground bg-accent rounded-full px-2.5 py-1">
          Welcome to BITE ME!
        </span>
      )}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Mail className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm">Marketing Emails</p>
            <p className="text-xs text-muted-foreground">
              Receive news, new arrivals and special offers.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <Switch
            checked={subscribed}
            disabled={saving}
            onCheckedChange={handleToggle}
            aria-label="Marketing email consent"
          />
        </div>
      </div>
      {highlight && !subscribed && (
        <p className="mt-3 rounded-lg bg-accent px-3 py-2 text-xs text-accent-foreground">
          Turn on to get offers and tell us about your pet.
        </p>
      )}
      {subscribed && children && (
        <div className="mt-4 pt-4 border-t border-border">{children}</div>
      )}
    </div>
  );
}

// Status colors follow the Order History status badges.
const B2B_MENU: Record<B2BStatus, { label: string; badge: string; cls: string }> = {
  none: { label: 'B2B Application', badge: 'Apply', cls: 'bg-gray-100 text-gray-600' },
  pending: { label: 'B2B Application', badge: 'Pending', cls: 'bg-yellow-100 text-yellow-700' },
  approved: { label: 'B2B Account', badge: 'Verified', cls: 'bg-orange-100 text-orange-700' },
  rejected: { label: 'B2B Application', badge: 'Not approved', cls: 'bg-red-100 text-red-600' },
};

function AuthScreen() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) setLoading(false);
    };
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, []);

  const handleLogin = async () => {
    setLoading(true);
    try {
      await initiateLogin('/mypage');
    } catch {
      toast.error('Failed to start login. Please try again.', { position: 'top-center' });
      setLoading(false);
    }
  };

  return (
    <main className="max-w-md mx-auto px-4 py-16 flex flex-col items-center text-center">
      <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mb-6">
        <User className="h-10 w-10 text-muted-foreground" />
      </div>
      <h1 className="text-xl font-bold mb-2">My Page</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Sign in to view your orders<br />and manage your account.
      </p>
      <div className="w-full space-y-3">
        <Button onClick={handleLogin} disabled={loading} className="w-full h-12 text-base font-semibold">
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Continue with Shopify
        </Button>
      </div>
      <div className="w-full mt-4 pt-4 border-t border-border space-y-3">
        <Button onClick={() => navigate('/')} variant="ghost" className="w-full h-12 text-base text-muted-foreground">
          Continue as Guest
        </Button>
        <Button onClick={() => navigate('/guest-order')} variant="outline" className="w-full h-12 text-base">
          <Search className="h-4 w-4 mr-2" />
          Guest Order Lookup
        </Button>
      </div>
    </main>
  );
}

export default function MyPage() {
  const navigate = useNavigate();
  const [loggedIn, setLoggedIn] = useState(() => isCustomerLoggedIn());
  const [customerData, setCustomerData] = useState<CustomerAccountProfile | null>(null);
  const [creditData, setCreditData] = useState<StoreCreditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [highlightConsent, setHighlightConsent] = useState(false);
  const consentRef = useRef<HTMLDivElement>(null);

  const authUser = useAuthStore((s) => s.user);
  const isB2B = useAuthStore((s) => s.isB2B);
  const [b2bStatus, setB2bStatus] = useState<B2BStatus | null>(null);
  const favoritesData = useFavoritesStore((s) => s.favorites);
  const favoritesKey = authUser?.userId || customerData?.emailAddress || customerData?.id || GUEST_FAVORITES_KEY;

  useEffect(() => {
    if (!loggedIn) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchCustomerAccount()
      .then((data) => {
        if (!data) {
          setLoggedIn(false);
          setCustomerData(null);
        } else {
          setCustomerData(data);
          if (data.emailAddress) {
            fetchStoreCredit(data.emailAddress).then(setCreditData);
            fetchB2BStatus(data.emailAddress).then((r) => setB2bStatus(r.status)).catch(() => {});
          }
        }
      })
      .catch((err) => {
        console.error(err);
        toast.error('Failed to load account. Please sign in again.', { position: 'top-center' });
      })
      .finally(() => setLoading(false));
  }, [loggedIn]);

  // New sign-ups returning to My Page get the consent card highlighted instead of the prompt.
  useEffect(() => {
    if (loading || !customerData?.id || !consumePetHighlight(customerData.id)) return;
    setHighlightConsent(true);
    requestAnimationFrame(() => consentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, [loading, customerData?.id]);

  // Keep My Page in sync when the first-login prompt saves.
  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const { emailMarketingState, ...pet } = (e as CustomEvent<PetProfileUpdate>).detail;
      setCustomerData((prev) => (prev ? {
        ...prev,
        ...pet,
        emailMarketingState: emailMarketingState ?? prev.emailMarketingState,
      } : prev));
    };
    window.addEventListener(PET_PROFILE_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(PET_PROFILE_UPDATED_EVENT, handleUpdate);
  }, []);

  const handleLogout = () => {
    useAuthStore.getState().logout();
    customerLogout();
  };

  if (!loggedIn) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <AuthScreen />
        <div className="max-w-md mx-auto px-4 mt-4 pb-24">
          <div className="bg-card rounded-xl border border-border px-4">
            <MenuLink icon={Building2} label="B2B Application"
              onClick={() => toast.info('Please sign in to use this feature.', { position: 'top-center' })} />
          </div>
        </div>
      </div>
    );
  }

  const orders = customerData?.orders || [];
  const favCount = favoritesKey ? (favoritesData[favoritesKey]?.length || 0) : 0;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-md mx-auto px-4 py-6 space-y-4 pb-24">
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
        ) : (
          <>
            <div className="bg-card rounded-xl border border-border p-5">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center ring-2 ring-border">
                  <User className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-bold truncate">
                    {customerData?.displayName || 'Customer'}
                  </h2>
                  {customerData?.emailAddress && (
                    <p className="text-xs text-muted-foreground truncate">{customerData.emailAddress}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <ShoppingBag className="h-3 w-3" />{orders.length} orders
                    </span>
                  </div>
                </div>
              </div>

              {customerData?.defaultAddress && (
                <div className="mt-3 pt-3 border-t border-border flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">
                    {[customerData.defaultAddress.zip, customerData.defaultAddress.province, customerData.defaultAddress.city, customerData.defaultAddress.address1]
                      .filter(Boolean).join(' ')}
                  </p>
                </div>
              )}
            </div>

            {(() => {
              const credit = creditData;
              const hasCredit = credit && parseFloat(credit.balance.amount) > 0;
              return (
                <button
                  onClick={() => navigate('/mypage/store-credit')}
                  className="w-full bg-card rounded-xl border border-border p-4 flex items-center justify-between hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Wallet className="h-5 w-5 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="text-xs text-muted-foreground">Store Credit</p>
                      <p className={`text-lg font-bold ${hasCredit ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {credit ? formatPrice(credit.balance.amount, credit.balance.currencyCode) : '$0.00'}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              );
            })()}

            <div className="bg-card rounded-xl border border-border divide-y divide-border px-4">
              <MenuLink
                icon={ShoppingBag}
                label="Order History"
                badge={orders.length > 0 ? orders.length : undefined}
                onClick={() => navigate('/mypage/order-history')}
              />
              <MenuLink
                icon={Heart}
                label="Favorites"
                badge={favCount > 0 ? favCount : undefined}
                onClick={() => navigate('/mypage/favorites')}
              />
              {(() => {
                // Until the status loads, fall back to the pricing flag so verified accounts don't flicker.
                const menu = b2bStatus ? B2B_MENU[b2bStatus] : isB2B ? B2B_MENU.approved : null;
                return (
                  <MenuLink
                    icon={Building2}
                    label={menu?.label ?? 'B2B Application'}
                    badge={menu?.badge}
                    badgeClassName={menu?.cls}
                    onClick={() => navigate('/mypage/b2b-apply')}
                  />
                );
              })()}
              <MenuLink icon={HelpCircle} label="Contact Us" onClick={() => navigate('/contact')} />
            </div>

            <MarketingConsent
              state={customerData?.emailMarketingState ?? null}
              onChange={(next) =>
                setCustomerData((prev) => (prev ? { ...prev, emailMarketingState: next } : prev))
              }
              highlight={highlightConsent}
              containerRef={consentRef}
            >
              {customerData && (
                <PetProfileForm
                  key={`${customerData.petType}-${customerData.petBirthday}`}
                  customerId={customerData.id}
                  initialType={customerData.petType}
                  initialBirthday={customerData.petBirthday}
                  onSaved={(pet) => {
                    setCustomerData((prev) => (prev ? { ...prev, ...pet } : prev));
                    setHighlightConsent(false);
                  }}
                />
              )}
            </MarketingConsent>

            <Button variant="outline" onClick={handleLogout} className="w-full h-12">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </>
        )}
      </main>
    </div>
  );
}
