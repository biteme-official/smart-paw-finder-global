import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, Plus, Minus, Wallet } from 'lucide-react';
import { isLoggedIn as isCustomerLoggedIn } from '@/lib/customer-auth';
import { fetchCustomerAccount, fetchStoreCredit, StoreCreditTransaction } from '@/lib/customer-account';
import { formatPrice } from '@/lib/shopify';
import { toast } from 'sonner';

function TransactionItem({ tx }: { tx: StoreCreditTransaction }) {
  const isCredit = tx.type === 'CREDIT';
  const date = new Date(tx.createdAt).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
  const time = new Date(tx.createdAt).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="flex items-center justify-between py-3.5">
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
          isCredit ? 'bg-green-100' : 'bg-red-50'
        }`}>
          {isCredit
            ? <Plus className="h-4 w-4 text-green-600" />
            : <Minus className="h-4 w-4 text-red-500" />
          }
        </div>
        <div>
          <p className="text-sm font-medium">
            {isCredit ? 'Credit Added' : 'Credit Used'}
          </p>
          <p className="text-[11px] text-muted-foreground">{date} {time}</p>
        </div>
      </div>
      <div className="text-right">
        <p className={`text-sm font-semibold ${isCredit ? 'text-green-600' : 'text-red-500'}`}>
          {isCredit ? '+' : '-'}{formatPrice(tx.amount.amount, tx.amount.currencyCode)}
        </p>
        <p className="text-[10px] text-muted-foreground">
          Bal. {formatPrice(tx.balanceAfterTransaction.amount, tx.balanceAfterTransaction.currencyCode)}
        </p>
      </div>
    </div>
  );
}

export default function StoreCreditHistory() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<{ amount: string; currencyCode: string } | null>(null);
  const [transactions, setTransactions] = useState<StoreCreditTransaction[]>([]);

  useEffect(() => {
    if (!isCustomerLoggedIn()) {
      navigate('/mypage');
      return;
    }
    fetchCustomerAccount()
      .then((data) => {
        if (!data) {
          navigate('/mypage');
          return;
        }
        if (data.emailAddress) {
          return fetchStoreCredit(data.emailAddress).then((credit) => {
            setBalance(credit?.balance || null);
            setTransactions(credit?.transactions || []);
          });
        }
      })
      .catch(() => {
        toast.error('Failed to load store credit.', { position: 'top-center' });
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-md mx-auto px-4 py-6 pb-24">
        <button onClick={() => navigate('/mypage')} className="flex items-center gap-1 text-sm text-muted-foreground mb-4 hover:text-foreground transition-colors">
          <ChevronLeft className="h-4 w-4" />
          My Page
        </button>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        ) : (
          <>
            <div className="bg-card rounded-xl border border-border p-5 mb-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Wallet className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Store Credit Balance</p>
                  <p className="text-2xl font-bold">
                    {balance ? formatPrice(balance.amount, balance.currencyCode) : '$0.00'}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border px-4">
              <div className="py-3 border-b border-border">
                <h3 className="text-sm font-semibold">Transaction History</h3>
              </div>
              {transactions.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-sm text-muted-foreground">No transactions yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {transactions.map((tx) => (
                    <TransactionItem key={tx.id} tx={tx} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
