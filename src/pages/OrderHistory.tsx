import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ChevronLeft, Package, Truck, ExternalLink, CreditCard, XCircle, Loader2, ShoppingBag,
} from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { formatPrice } from '@/lib/shopify';
import { isLoggedIn as isCustomerLoggedIn } from '@/lib/customer-auth';
import { fetchCustomerAccount, cancelCustomerOrder, CustomerAccountOrder } from '@/lib/customer-account';
import { toast } from 'sonner';

function StatusBadge({ status, type }: { status: string; type: 'financial' | 'fulfillment' }) {
  const map: Record<string, { label: string; cls: string }> = type === 'financial' ? {
    PAID: { label: 'Paid', cls: 'bg-green-100 text-green-700' },
    PENDING: { label: 'Pending', cls: 'bg-yellow-100 text-yellow-700' },
    REFUNDED: { label: 'Refunded', cls: 'bg-gray-100 text-gray-600' },
    PARTIALLY_REFUNDED: { label: 'Partial Refund', cls: 'bg-gray-100 text-gray-600' },
    AUTHORIZED: { label: 'Authorized', cls: 'bg-blue-100 text-blue-700' },
    VOIDED: { label: 'Cancelled', cls: 'bg-red-100 text-red-600' },
  } : {
    FULFILLED: { label: 'Shipped', cls: 'bg-green-100 text-green-700' },
    UNFULFILLED: { label: 'Pending', cls: 'bg-orange-100 text-orange-700' },
    PARTIALLY_FULFILLED: { label: 'Partial', cls: 'bg-yellow-100 text-yellow-700' },
  };
  const info = map[status] || { label: status || 'Pending', cls: 'bg-orange-100 text-orange-700' };
  return <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${info.cls}`}>{info.label}</span>;
}

function OrderCard({ order, onCancelled }: { order: CustomerAccountOrder; onCancelled: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const date = new Date(order.processedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  const isCancellable =
    order.financialStatus === 'PAID' &&
    (!order.fulfillmentStatus || order.fulfillmentStatus === 'UNFULFILLED');

  const firstTracking = order.fulfillments[0];

  const handleCancel = async () => {
    if (cancelling) return;
    setCancelling(true);
    try {
      const result = await cancelCustomerOrder(order.id);
      if (result.success) {
        toast.success('Order cancelled successfully. A refund has been initiated.', { position: 'top-center' });
        onCancelled();
      } else {
        toast.error(result.error || 'Failed to cancel order.', { position: 'top-center' });
      }
    } catch {
      toast.error('Failed to cancel order. Please try again.', { position: 'top-center' });
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full p-4 text-left">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold">{order.name}</span>
            <StatusBadge status={order.financialStatus} type="financial" />
            <StatusBadge status={order.fulfillmentStatus} type="fulfillment" />
          </div>
          <span className="text-xs text-muted-foreground flex-shrink-0">{date}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{order.lineItems.length} items</span>
          <span className="text-sm font-bold" translate="no">{formatPrice(order.totalPrice.amount, order.totalPrice.currencyCode)}</span>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
          {order.lineItems.map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              {item.image?.url ? (
                <img src={item.image.url} alt={item.title} className="w-12 h-12 rounded-lg object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center">
                  <Package className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{item.title}</p>
                <p className="text-xs text-muted-foreground">x{item.quantity}</p>
              </div>
            </div>
          ))}

          {firstTracking?.trackingUrl && (
            <a href={firstTracking.trackingUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
              <Truck className="h-4 w-4" />
              Track Shipment
              {firstTracking.trackingCompany && <span className="text-xs text-muted-foreground">({firstTracking.trackingCompany})</span>}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}

          {order.statusPageUrl && (
            <a href={order.statusPageUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <CreditCard className="h-4 w-4" />
              Order Details
              <ExternalLink className="h-3 w-3" />
            </a>
          )}

          {isCancellable && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button disabled={cancelling} className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 rounded-lg border border-destructive/30 text-destructive text-sm font-medium hover:bg-destructive/5 transition-colors disabled:opacity-50">
                  {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                  {cancelling ? 'Cancelling...' : 'Cancel Order'}
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel Order {order.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will cancel your order and initiate a full refund of{' '}
                    <span className="font-semibold text-foreground">{formatPrice(order.totalPrice.amount, order.totalPrice.currencyCode)}</span>.
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep Order</AlertDialogCancel>
                  <AlertDialogAction onClick={handleCancel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Yes, Cancel Order
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      )}
    </div>
  );
}

export default function OrderHistory() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<CustomerAccountOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!isCustomerLoggedIn()) {
      navigate('/mypage', { replace: true });
      return;
    }
    setLoading(true);
    fetchCustomerAccount()
      .then((data) => {
        setOrders(data?.orders || []);
      })
      .catch(() => toast.error('Failed to load orders.', { position: 'top-center' }))
      .finally(() => setLoading(false));
  }, [navigate, refreshKey]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <header className="sticky top-[57px] z-40 bg-background border-b border-border">
        <div className="max-w-md mx-auto flex items-center px-4 h-12">
          <button onClick={() => navigate('/mypage')} className="p-2 -ml-2">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="flex-1 text-center font-semibold text-sm">Order History</h1>
          <div className="w-9" />
        </div>
      </header>
      <main className="max-w-md mx-auto px-4 py-6 space-y-3 pb-24">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-12 text-center">
            <ShoppingBag className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No orders yet</p>
          </div>
        ) : (
          orders.map((order) => (
            <OrderCard key={order.id} order={order} onCancelled={() => setRefreshKey((k) => k + 1)} />
          ))
        )}
      </main>
    </div>
  );
}
