import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  LogOut, User, ShoppingBag, Heart, HelpCircle, ChevronRight,
  MapPin, Loader2, Search, Building2, Wallet,
} from 'lucide-react';
import { initiateLogin, isLoggedIn as isCustomerLoggedIn, logout as customerLogout } from '@/lib/customer-auth';
import { fetchCustomerAccount, fetchStoreCredit, CustomerAccountProfile, StoreCreditData } from '@/lib/customer-account';
import { formatPrice } from '@/lib/shopify';
import { useAuthStore } from '@/stores/authStore';
import { toast } from 'sonner';
import { useFavoritesStore, GUEST_FAVORITES_KEY } from '@/stores/favoritesStore';

function MenuLink({ icon: Icon, label, badge, onClick }: {
  icon: typeof ShoppingBag; label: string; badge?: string | number; onClick?: () => void;
}) {
  return (
    <button onClick={onClick} className="w-full flex items-center justify-between py-3.5 hover:bg-secondary/50 transition-colors">
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5 text-muted-foreground" />
        <span className="text-sm">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {badge !== undefined && (
          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{badge}</span>
        )}
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </button>
  );
}

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

  const authUser = useAuthStore((s) => s.user);
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
          }
        }
      })
      .catch((err) => {
        console.error(err);
        toast.error('Failed to load account. Please sign in again.', { position: 'top-center' });
      })
      .finally(() => setLoading(false));
  }, [loggedIn]);

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
              <MenuLink icon={Building2} label="B2B Application" onClick={() => navigate('/mypage/b2b-apply')} />
              <MenuLink icon={HelpCircle} label="Contact Us" onClick={() => navigate('/contact')} />
            </div>

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
