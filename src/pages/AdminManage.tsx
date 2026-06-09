import { useState, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Lock, Loader2, LayoutDashboard, ShoppingCart, Package, Users,
  TrendingUp, TrendingDown, AlertTriangle, Clock, CheckCircle, XCircle,
  Truck, RefreshCw, ExternalLink, ChevronLeft, ChevronRight, Search, Eye,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ───

interface Overview {
  today: { orders: number; revenue: number };
  yesterday: { orders: number; revenue: number };
  week: { orders: number; revenue: number };
  counts: { all: number; pending: number; todayAll: number };
  currency: string;
}

interface OrderItem { title: string; quantity: number; variant: string | null; amount: string }
interface Order {
  id: string; name: string; createdAt: string;
  financialStatus: string; fulfillmentStatus: string; cancelled: boolean;
  total: string; subtotal: string; shipping: string; tax: string; refunded: string; currency: string;
  customerName: string; customerEmail: string; country: string; city: string;
  items: OrderItem[];
}

interface ProductVariant { id: string; title: string | null; price: string; inventory: number; sku: string }
interface Product {
  id: string; title: string; status: string;
  totalInventory: number; tracksInventory: boolean;
  minPrice: string; maxPrice: string; currency: string;
  variants: ProductVariant[]; totalVariants: number; imageUrl: string | null;
}

interface Customer {
  id: string; name: string; email: string;
  orders: number; spent: string; currency: string;
  createdAt: string; country: string; city: string; tags: string[];
}

interface CustomerData {
  summary: { total: number; noOrders: number; oneOrder: number; twoThree: number; fourPlus: number };
  topCustomers: Customer[];
  recentCustomers: Customer[];
}

// ─── Helpers ───

const BRAND = '#f85a24';
const PALETTE = ['#f85a24', '#fb8c5a', '#fdb997', '#94a3b8', '#cbd5e1'];

function fmtMoney(v: string | number, currency = 'USD') {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (currency === 'USD') return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `${n.toLocaleString()} ${currency}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function pctChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function shopifyAdminUrl(gid: string, type: 'orders' | 'products' | 'customers') {
  const numId = gid.split('/').pop();
  const shop = 'biteme-one';
  return `https://admin.shopify.com/store/${shop}/${type}/${numId}`;
}

const FINANCIAL_BADGE: Record<string, { label: string; color: string }> = {
  PAID: { label: 'Paid', color: 'bg-green-50 text-green-700 border-green-200' },
  PENDING: { label: 'Pending', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  REFUNDED: { label: 'Refunded', color: 'bg-red-50 text-red-700 border-red-200' },
  PARTIALLY_REFUNDED: { label: 'Partial Refund', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  AUTHORIZED: { label: 'Authorized', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  VOIDED: { label: 'Voided', color: 'bg-gray-50 text-gray-700 border-gray-200' },
};

const FULFILLMENT_BADGE: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  UNFULFILLED: { label: 'Unfulfilled', color: 'bg-yellow-50 text-yellow-700 border-yellow-200', icon: Clock },
  FULFILLED: { label: 'Fulfilled', color: 'bg-green-50 text-green-700 border-green-200', icon: CheckCircle },
  PARTIALLY_FULFILLED: { label: 'Partial', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: Truck },
  IN_PROGRESS: { label: 'In Progress', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: Truck },
};

// ─── API ───

async function fetchSection<T>(section: string, secret: string, params?: Record<string, string>): Promise<T> {
  const sp = new URLSearchParams({ section, ...params });
  const res = await fetch(`/api/admin-manage?${sp}`, { headers: { Authorization: `Bearer ${secret}` } });
  if (res.status === 401) throw new Error('UNAUTHORIZED');
  if (!res.ok) throw new Error(`API error (${res.status})`);
  return res.json();
}

// ─── Login Gate ───

function LoginGate({ onLogin }: { onLogin: (key: string) => void }) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin-manage?section=overview', { headers: { Authorization: `Bearer ${password}` } });
      if (res.ok) { sessionStorage.setItem('admin-manage-key', password); onLogin(password); }
      else toast.error('Invalid password.', { position: 'top-center' });
    } catch { toast.error('Connection error.', { position: 'top-center' }); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Admin Dashboard</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">Operations Management</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input type="password" placeholder="Enter admin password" value={password}
              onChange={(e) => setPassword(e.target.value)} autoFocus />
            <Button type="submit" disabled={loading} className="w-full">
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Sign In
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── KPI Card ───

function KPICard({ label, value, sub, change, icon: Icon, color }: {
  label: string; value: string; sub?: string; change?: number; icon: typeof TrendingUp; color: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
          {change !== undefined && (
            <div className={`flex items-center gap-0.5 text-xs font-medium ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {Math.abs(change)}%
            </div>
          )}
        </div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ─── Overview Tab ───

function OverviewSection({ secret }: { secret: string }) {
  const { data, isLoading, refetch } = useQuery<Overview>({
    queryKey: ['admin-manage-overview'],
    queryFn: () => fetchSection<Overview>('overview', secret),
    staleTime: 60_000,
  });

  if (isLoading || !data) return <LoadingSpinner />;

  const revChange = pctChange(data.today.revenue, data.yesterday.revenue);
  const ordChange = pctChange(data.today.orders, data.yesterday.orders);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Overview</h2>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard label="Today Revenue" value={fmtMoney(data.today.revenue, data.currency)}
          sub={`Yesterday: ${fmtMoney(data.yesterday.revenue, data.currency)}`}
          change={revChange} icon={TrendingUp} color="bg-green-50 text-green-600" />
        <KPICard label="Today Orders" value={String(data.today.orders)}
          sub={`Yesterday: ${data.yesterday.orders}`}
          change={ordChange} icon={ShoppingCart} color="bg-blue-50 text-blue-600" />
        <KPICard label="Pending Fulfillment" value={String(data.counts.pending)}
          sub="Paid but not shipped" icon={Clock} color="bg-yellow-50 text-yellow-600" />
        <KPICard label="7-Day Revenue" value={fmtMoney(data.week.revenue, data.currency)}
          sub={`${data.week.orders} orders`} icon={LayoutDashboard} color="bg-purple-50 text-purple-600" />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Revenue Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={[
                { name: 'Yesterday', revenue: data.yesterday.revenue, orders: data.yesterday.orders },
                { name: 'Today', revenue: data.today.revenue, orders: data.today.orders },
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => fmtMoney(v, data.currency)} />
                <Bar dataKey="revenue" fill={BRAND} radius={[4, 4, 0, 0]} name="Revenue" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Orders Tab ───

function OrdersSection({ secret }: { secret: string }) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery<{ orders: Order[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } }>({
    queryKey: ['admin-manage-orders', statusFilter],
    queryFn: () => fetchSection('orders', secret, { status: statusFilter }),
    staleTime: 30_000,
  });

  const orders = (data?.orders || []).filter(o => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return o.name.toLowerCase().includes(q) || o.customerName.toLowerCase().includes(q) ||
      o.customerEmail.toLowerCase().includes(q) || o.country.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="fulfilled">Fulfilled</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2 ml-auto">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search orders..." value={search} onChange={e => setSearch(e.target.value)}
              className="pl-9 w-[200px]" />
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {isLoading ? <LoadingSpinner /> : orders.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>No orders found.</p>
        </CardContent></Card>
      ) : (
        <div className="bg-white rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50/50">
                <th className="text-left p-3 font-medium text-muted-foreground">Order</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Date</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Customer</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Country</th>
                <th className="text-center p-3 font-medium text-muted-foreground">Payment</th>
                <th className="text-center p-3 font-medium text-muted-foreground">Fulfillment</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Total</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => {
                const fin = FINANCIAL_BADGE[o.financialStatus] || { label: o.financialStatus, color: 'bg-gray-50 text-gray-700 border-gray-200' };
                const ful = FULFILLMENT_BADGE[o.fulfillmentStatus] || { label: o.fulfillmentStatus || 'N/A', color: 'bg-gray-50 text-gray-700 border-gray-200', icon: Clock };
                const FulIcon = ful.icon;
                const isExpanded = expandedOrder === o.id;

                return (
                  <tr key={o.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => setExpandedOrder(isExpanded ? null : o.id)}>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{o.name}</span>
                        {o.cancelled && <XCircle className="h-3.5 w-3.5 text-red-400" />}
                      </div>
                      {isExpanded && (
                        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                          {o.items.map((item, i) => (
                            <div key={i} className="flex justify-between">
                              <span>{item.title}{item.variant ? ` (${item.variant})` : ''} x{item.quantity}</span>
                              <span>{fmtMoney(item.amount, o.currency)}</span>
                            </div>
                          ))}
                          <Separator className="my-1" />
                          <div className="flex justify-between">
                            <span>Subtotal</span><span>{fmtMoney(o.subtotal, o.currency)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Shipping</span><span>{fmtMoney(o.shipping, o.currency)}</span>
                          </div>
                          {parseFloat(o.tax) > 0 && (
                            <div className="flex justify-between">
                              <span>Tax</span><span>{fmtMoney(o.tax, o.currency)}</span>
                            </div>
                          )}
                          {parseFloat(o.refunded) > 0 && (
                            <div className="flex justify-between text-red-600">
                              <span>Refunded</span><span>-{fmtMoney(o.refunded, o.currency)}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(o.createdAt)}</td>
                    <td className="p-3">
                      <p className="font-medium text-xs">{o.customerName}</p>
                      <p className="text-[10px] text-muted-foreground">{o.customerEmail}</p>
                    </td>
                    <td className="p-3 text-xs">{o.country}{o.city ? `, ${o.city}` : ''}</td>
                    <td className="p-3 text-center">
                      <Badge variant="outline" className={`text-[10px] ${fin.color}`}>{fin.label}</Badge>
                    </td>
                    <td className="p-3 text-center">
                      <Badge variant="outline" className={`text-[10px] ${ful.color}`}>
                        <FulIcon className="h-3 w-3 mr-1" />{ful.label}
                      </Badge>
                    </td>
                    <td className="p-3 text-right font-medium">{fmtMoney(o.total, o.currency)}</td>
                    <td className="p-3">
                      <a href={shopifyAdminUrl(o.id, 'orders')} target="_blank" rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="text-muted-foreground hover:text-foreground transition-colors">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Products Tab ───

function ProductsSection({ secret }: { secret: string }) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const { data, isLoading, refetch } = useQuery<{ products: Product[]; pageInfo: { hasNextPage: boolean } }>({
    queryKey: ['admin-manage-products', filter],
    queryFn: () => fetchSection('products', secret, { filter }),
    staleTime: 60_000,
  });

  const products = (data?.products || []).filter(p => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return p.title.toLowerCase().includes(q) ||
      p.variants.some(v => v.sku?.toLowerCase().includes(q));
  });

  const lowStockCount = (data?.products || []).filter(p => p.totalInventory > 0 && p.totalInventory < 5).length;
  const outOfStockCount = (data?.products || []).filter(p => p.totalInventory <= 0).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="low-stock">
              Low Stock {lowStockCount > 0 && <Badge variant="destructive" className="ml-1 h-5 text-[10px]">{lowStockCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="out-of-stock">
              Out of Stock {outOfStockCount > 0 && <Badge variant="destructive" className="ml-1 h-5 text-[10px]">{outOfStockCount}</Badge>}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2 ml-auto">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search products / SKU..." value={search} onChange={e => setSearch(e.target.value)}
              className="pl-9 w-[200px]" />
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {isLoading ? <LoadingSpinner /> : products.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>No products found.</p>
        </CardContent></Card>
      ) : (
        <div className="bg-white rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50/50">
                <th className="text-left p-3 font-medium text-muted-foreground">Product</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Price</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Inventory</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Variants</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => {
                const invClass = p.totalInventory <= 0 ? 'text-red-600 font-bold' :
                  p.totalInventory < 5 ? 'text-yellow-600 font-semibold' : '';
                return (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        {p.imageUrl ? (
                          <img src={p.imageUrl + '&width=48'} alt="" className="w-10 h-10 rounded object-cover border" />
                        ) : (
                          <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center">
                            <Package className="h-4 w-4 text-gray-400" />
                          </div>
                        )}
                        <span className="font-medium">{p.title}</span>
                      </div>
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      {p.minPrice === p.maxPrice
                        ? fmtMoney(p.minPrice, p.currency)
                        : `${fmtMoney(p.minPrice, p.currency)} – ${fmtMoney(p.maxPrice, p.currency)}`}
                    </td>
                    <td className={`p-3 text-right ${invClass}`}>
                      {p.tracksInventory ? (
                        <div className="flex items-center justify-end gap-1">
                          {p.totalInventory <= 0 && <AlertTriangle className="h-3.5 w-3.5" />}
                          {p.totalInventory}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">N/A</span>
                      )}
                    </td>
                    <td className="p-3">
                      {p.variants.length <= 1 ? (
                        <span className="text-xs text-muted-foreground">Single</span>
                      ) : (
                        <div className="space-y-0.5">
                          {p.variants.slice(0, 3).map(v => (
                            <div key={v.id} className="text-[10px] flex items-center gap-2">
                              <span className="text-muted-foreground">{v.title || v.sku}</span>
                              <span className={v.inventory <= 0 ? 'text-red-500 font-medium' : v.inventory < 5 ? 'text-yellow-500' : ''}>
                                qty: {v.inventory}
                              </span>
                            </div>
                          ))}
                          {p.variants.length > 3 && (
                            <span className="text-[10px] text-muted-foreground">+{p.variants.length - 3} more</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      <a href={shopifyAdminUrl(p.id, 'products')} target="_blank" rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground transition-colors">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Customers Tab ───

function CustomersSection({ secret }: { secret: string }) {
  const [tab, setTab] = useState('top');

  const { data, isLoading, refetch } = useQuery<CustomerData>({
    queryKey: ['admin-manage-customers'],
    queryFn: () => fetchSection<CustomerData>('customers', secret, { view: 'all' }),
    staleTime: 60_000,
  });

  if (isLoading || !data) return <LoadingSpinner />;

  const { summary } = data;
  const purchasedTotal = summary.oneOrder + summary.twoThree + summary.fourPlus;
  const segmentData = [
    { name: 'No Orders', value: summary.noOrders },
    { name: '1 Order', value: summary.oneOrder },
    { name: '2-3 Orders', value: summary.twoThree },
    { name: '4+ Orders', value: summary.fourPlus },
  ];

  const customers = tab === 'top' ? data.topCustomers : data.recentCustomers;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="top">Top Spenders</TabsTrigger>
              <TabsTrigger value="recent">Recent (30d)</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Segments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={segmentData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                      innerRadius={50} outerRadius={80} paddingAngle={2}>
                      {segmentData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3 text-center">
                <div className="bg-gray-50 rounded p-2">
                  <p className="text-lg font-bold">{summary.total.toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">Total</p>
                </div>
                <div className="bg-gray-50 rounded p-2">
                  <p className="text-lg font-bold">{purchasedTotal > 0 ? Math.round((summary.twoThree + summary.fourPlus) / purchasedTotal * 100) : 0}%</p>
                  <p className="text-[10px] text-muted-foreground">Repeat Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          {customers.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>No customers.</p>
            </CardContent></Card>
          ) : (
            <div className="bg-white rounded-lg border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50/50">
                    <th className="text-left p-3 font-medium text-muted-foreground">#</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Customer</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Country</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Orders</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Spent</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Joined</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c, i) => (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                      <td className="p-3 text-muted-foreground text-xs">{i + 1}</td>
                      <td className="p-3">
                        <p className="font-medium text-xs">{c.name}</p>
                        <p className="text-[10px] text-muted-foreground">{c.email}</p>
                      </td>
                      <td className="p-3 text-xs">{c.country}{c.city ? `, ${c.city}` : ''}</td>
                      <td className="p-3 text-right font-medium">{c.orders}</td>
                      <td className="p-3 text-right font-medium text-xs">{fmtMoney(c.spent, c.currency)}</td>
                      <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-3">
                        <a href={shopifyAdminUrl(c.id, 'customers')} target="_blank" rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground transition-colors">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Shared ───

function LoadingSpinner() {
  return (
    <div className="flex justify-center py-16">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

// ─── Main ───

export default function AdminManage() {
  const [adminKey, setAdminKey] = useState(() => sessionStorage.getItem('admin-manage-key') || '');
  const [activeTab, setActiveTab] = useState('overview');

  if (!adminKey) return <LoginGate onLogin={setAdminKey} />;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <LayoutDashboard className="h-5 w-5 text-primary" />
          <h1 className="text-base font-bold">Admin Manage</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={() => { setAdminKey(''); sessionStorage.removeItem('admin-manage-key'); }}>
          Logout
        </Button>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white border">
            <TabsTrigger value="overview" className="gap-1.5">
              <LayoutDashboard className="h-4 w-4" /> Overview
            </TabsTrigger>
            <TabsTrigger value="orders" className="gap-1.5">
              <ShoppingCart className="h-4 w-4" /> Orders
            </TabsTrigger>
            <TabsTrigger value="products" className="gap-1.5">
              <Package className="h-4 w-4" /> Products
            </TabsTrigger>
            <TabsTrigger value="customers" className="gap-1.5">
              <Users className="h-4 w-4" /> Customers
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview"><OverviewSection secret={adminKey} /></TabsContent>
          <TabsContent value="orders"><OrdersSection secret={adminKey} /></TabsContent>
          <TabsContent value="products"><ProductsSection secret={adminKey} /></TabsContent>
          <TabsContent value="customers"><CustomersSection secret={adminKey} /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
