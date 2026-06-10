import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, Loader2, Truck, CreditCard, AlertTriangle, PartyPopper } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCartStore } from '@/stores/cartStore';
import { useAuthStore } from '@/stores/authStore';
import { formatPrice } from '@/lib/shopify';
import { isLoggedIn as isCustomerLoggedIn } from '@/lib/customer-auth';
import { fetchCustomerAccount } from '@/lib/customer-account';
import { toast } from 'sonner';

const B2B_MIN_ORDER = 300;
const SHIPPING_THRESHOLD = 75;
const SHIPPING_OVER = 0;
const SHIPPING_UNDER = 30;

export default function Checkout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { items: allItems, isLoading, createCheckout } = useCartStore();
  const isB2B = useAuthStore((s) => s.isB2B);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);

  const selectedVariantIds: string[] | undefined = location.state?.selectedVariantIds;
  const items = useMemo(() => {
    if (!selectedVariantIds || selectedVariantIds.length === 0) return allItems;
    return allItems.filter(item => selectedVariantIds.includes(item.variantId));
  }, [allItems, selectedVariantIds]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customerCountry, setCustomerCountry] = useState<string | null>(null);
  const [countryLoading, setCountryLoading] = useState(true);

  useEffect(() => {
    if (isLoggedIn && isCustomerLoggedIn()) {
      fetchCustomerAccount()
        .then((data) => {
          setCustomerCountry(data?.defaultAddress?.country || null);
        })
        .catch(() => setCustomerCountry(null))
        .finally(() => setCountryLoading(false));
    } else {
      setCountryLoading(false);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (allItems.length === 0) navigate('/');
  }, [allItems.length, navigate]);

  const subtotal = items.reduce((sum, item) => sum + parseFloat(item.price.amount) * item.quantity, 0);
  const currencyCode = items[0]?.price.currencyCode || 'USD';

  const isKorean = customerCountry === 'KR';
  const shipping = isKorean ? 0 : (subtotal >= SHIPPING_THRESHOLD ? SHIPPING_OVER : SHIPPING_UNDER);
  const total = subtotal + shipping;

  const b2bEligible = subtotal >= B2B_MIN_ORDER;

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const lineItems = items.map((item) => ({
        variantId: item.variantId,
        quantity: item.quantity,
      }));
      const checkoutUrl = await createCheckout(lineItems);
      if (checkoutUrl) {
        // Meta Pixel: AddPaymentInfo (결제 페이지로 이동 직전)
        const fbq = (window as Window & { fbq?: (...args: unknown[]) => void }).fbq;
        if (fbq) {
          fbq('track', 'AddPaymentInfo', {
            value: total,
            currency: currencyCode,
            content_ids: items.map(i => i.variantId),
            content_type: 'product',
          });
        }
        window.location.href = checkoutUrl;
      }
    } catch (err) {
      console.error('Checkout error:', err);
      toast.error('Failed to proceed to checkout. Please try again.', { position: 'top-center' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="sticky top-0 z-50 bg-background border-b border-border">
        <div className="max-w-lg mx-auto flex items-center px-4 h-14">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="flex-1 text-center font-semibold">Order Summary</h1>
          <div className="w-9" />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {isB2B && !b2bEligible && (
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                Minimum order of {formatPrice(B2B_MIN_ORDER.toString(), currencyCode)} required for B2B pricing
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                Add {formatPrice((B2B_MIN_ORDER - subtotal).toFixed(2), currencyCode)} more to unlock your 50% B2B discount at checkout.
              </p>
            </div>
          </div>
        )}

        <div className="bg-card rounded-xl border border-border p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            Order Summary
          </h2>
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.variantId} className="flex items-center gap-3">
                {item.product.node.images?.edges?.[0]?.node && (
                  <img
                    src={item.product.node.images.edges[0].node.url}
                    alt={item.product.node.title}
                    className="w-12 h-12 rounded-lg object-cover"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{item.product.node.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.variantTitle !== 'Default Title' && item.selectedOptions.map((o) => o.value).join(' / ')}
                    {' '}x{item.quantity}
                  </p>
                </div>
                <span className="text-sm font-semibold text-right" translate="no">
                  {formatPrice((parseFloat(item.price.amount) * item.quantity).toFixed(2), item.price.currencyCode)}
                </span>
              </div>
            ))}
          </div>
          <div className="border-t border-border mt-3 pt-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span translate="no">{formatPrice(subtotal.toFixed(2), currencyCode)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                <Truck className="h-3.5 w-3.5" />Shipping
              </span>
              {countryLoading ? (
                <span className="text-xs text-muted-foreground">...</span>
              ) : isKorean ? (
                <span className="text-sm font-medium text-green-600">Free</span>
              ) : (
                <span translate="no">{formatPrice(shipping.toFixed(2), currencyCode)}</span>
              )}
            </div>
            {!countryLoading && !isKorean && !isB2B && (() => {
              const progress = Math.min((subtotal / SHIPPING_THRESHOLD) * 100, 100);
              const remaining = SHIPPING_THRESHOLD - subtotal;
              const qualifies = subtotal >= SHIPPING_THRESHOLD;
              return (
                <div className={`rounded-lg p-3 mt-2 ${qualifies ? 'bg-green-50 border border-green-200 dark:bg-green-950/30 dark:border-green-800' : 'bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 dark:from-amber-950/30 dark:to-orange-950/30 dark:border-amber-800'}`}>
                  <div className="flex items-center gap-2 mb-1.5">
                    {qualifies ? (
                      <PartyPopper className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                    ) : (
                      <Truck className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
                    )}
                    {qualifies ? (
                      <span className="text-xs font-bold text-green-600">Free Shipping Unlocked!</span>
                    ) : (
                      <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                        Add <span className="text-primary font-bold">{formatPrice(remaining.toFixed(2), currencyCode)}</span> more for <span className="font-bold">Free Shipping!</span>
                      </span>
                    )}
                  </div>
                  <div className="relative w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ease-out ${qualifies ? 'bg-green-500' : 'bg-gradient-to-r from-amber-400 to-orange-500'}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[10px] text-muted-foreground">{formatPrice(subtotal.toFixed(2), currencyCode)}</span>
                    <span className="text-[10px] text-muted-foreground">{formatPrice(SHIPPING_THRESHOLD.toString(), currencyCode)}</span>
                  </div>
                </div>
              );
            })()}
            {isB2B && b2bEligible && (
              <div className="flex justify-between text-sm text-green-600">
                <span>B2B Discount (35%)</span>
                <span translate="no">Applied at checkout</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold pt-1 border-t border-border">
              <span>Total</span>
              <span translate="no">{formatPrice(total.toFixed(2), currencyCode)}</span>
            </div>
          </div>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 z-40">
        <div className="max-w-lg mx-auto">
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || isLoading}
            className="w-full h-12 text-base font-semibold"
          >
            {isSubmitting || isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>Proceed to Payment — {formatPrice(total.toFixed(2), currencyCode)}</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
