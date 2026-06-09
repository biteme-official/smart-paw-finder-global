import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
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

interface Product {
  id: string; title: string; status: string;
  totalInventory: number; tracksInventory: boolean;
  minPrice: string; maxPrice: string; currency: string;
  variants: { id: string; title: string | null; price: string; inventory: number; sku: string }[];
  totalVariants: number; imageUrl: string | null;
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

function fmtMoney(v: string | number, currency = 'USD') {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (currency === 'USD') return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `${n.toLocaleString()} ${currency}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function pctChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function shopifyUrl(gid: string, type: 'orders' | 'products' | 'customers') {
  const numId = gid.split('/').pop();
  return `https://admin.shopify.com/store/biteme-one/${type}/${numId}`;
}

async function fetchSection<T>(section: string, secret: string, params?: Record<string, string>): Promise<T> {
  const sp = new URLSearchParams({ section, ...params });
  const res = await fetch(`/api/admin-manage?${sp}`, { headers: { Authorization: `Bearer ${secret}` } });
  if (res.status === 401) throw new Error('UNAUTHORIZED');
  if (!res.ok) throw new Error(`API error (${res.status})`);
  return res.json();
}

const PALETTE = ['#22c55e', '#3b82f6', '#8b5cf6', '#94a3b8'];
const FINANCIAL_BADGE: Record<string, { label: string; cls: string }> = {
  PAID: { label: 'Paid', cls: 'badge-success' },
  PENDING: { label: 'Pending', cls: 'badge-warning' },
  REFUNDED: { label: 'Refunded', cls: 'badge-danger' },
  PARTIALLY_REFUNDED: { label: 'Partial Refund', cls: 'badge-warning' },
  AUTHORIZED: { label: 'Authorized', cls: 'badge-info' },
  VOIDED: { label: 'Voided', cls: 'badge-muted' },
};
const FULFILLMENT_BADGE: Record<string, { label: string; cls: string }> = {
  UNFULFILLED: { label: 'Unfulfilled', cls: 'badge-warning' },
  FULFILLED: { label: 'Fulfilled', cls: 'badge-success' },
  PARTIALLY_FULFILLED: { label: 'Partial', cls: 'badge-info' },
  IN_PROGRESS: { label: 'In Progress', cls: 'badge-info' },
};

// ─── Login ───

function LoginGate({ onLogin }: { onLogin: (key: string) => void }) {
  const [pw, setPw] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pw.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin-manage?section=overview', { headers: { Authorization: `Bearer ${pw}` } });
      if (res.ok) { sessionStorage.setItem('admin-manage-key', pw); onLogin(pw); }
      else toast.error('Invalid password.', { position: 'top-center' });
    } catch { toast.error('Connection error.', { position: 'top-center' }); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0f1923', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#1a2736', borderRadius: 12, padding: '40px 32px', width: 360, border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#fff' }}>
            BITE<span style={{ color: '#4a90d9' }}>ME</span>
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, letterSpacing: 1 }}>ADMIN CONSOLE</div>
        </div>
        <form onSubmit={submit}>
          <input type="password" placeholder="Enter admin password" value={pw}
            onChange={e => setPw(e.target.value)} autoFocus
            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #334155', background: '#0f1923', color: '#e2e8f0', fontSize: 14, outline: 'none', marginBottom: 12 }} />
          <button type="submit" disabled={loading}
            style={{ width: '100%', padding: '10px 0', borderRadius: 8, border: 'none', background: '#4a90d9', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Sidebar ───

const NAV_ITEMS = [
  { section: 'Dashboard' },
  { id: 'overview', icon: '📊', label: 'Overview' },
  { id: 'orders', icon: '📦', label: 'Orders', badgeKey: 'pending' as const },
  { section: 'Management' },
  { id: 'products', icon: '🏷️', label: 'Products' },
  { id: 'customers', icon: '👥', label: 'Customers' },
] as const;

function Sidebar({ active, onNav, pendingCount, onLogout }: {
  active: string; onNav: (id: string) => void; pendingCount: number; onLogout: () => void;
}) {
  return (
    <aside className="admin-sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">BITE<span>ME</span></div>
        <div className="sidebar-sub">Admin Console</div>
      </div>
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item, i) => {
          if ('section' in item) return <div key={i} className="nav-section">{item.section}</div>;
          const badge = item.badgeKey === 'pending' && pendingCount > 0 ? pendingCount : null;
          return (
            <div key={item.id} className={`nav-item ${active === item.id ? 'active' : ''}`}
              onClick={() => onNav(item.id)}>
              <span className="icon">{item.icon}</span>
              {item.label}
              {badge && <span className="nav-badge">{badge}</span>}
            </div>
          );
        })}
      </nav>
      <div className="sidebar-footer">
        <button onClick={onLogout} className="logout-btn">Logout</button>
      </div>
    </aside>
  );
}

// ─── Overview ───

function OverviewPanel({ secret }: { secret: string }) {
  const { data, isLoading, refetch } = useQuery<Overview>({
    queryKey: ['admin-overview'], queryFn: () => fetchSection<Overview>('overview', secret), staleTime: 60_000,
  });

  if (isLoading || !data) return <div className="loading">Loading...</div>;

  const revPct = pctChange(data.today.revenue, data.yesterday.revenue);
  const ordPct = pctChange(data.today.orders, data.yesterday.orders);

  const chartData = [
    { name: 'Yesterday', revenue: data.yesterday.revenue, orders: data.yesterday.orders },
    { name: 'Today', revenue: data.today.revenue, orders: data.today.orders },
  ];

  return (
    <>
      <div className="topbar">
        <div className="topbar-left">
          <h2>Overview</h2>
          <span className="topbar-breadcrumb">Dashboard / Sales Overview</span>
        </div>
        <div className="topbar-right">
          <div className="topbar-date">{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</div>
          <button className="btn btn-primary" onClick={() => refetch()}>🔄 Refresh</button>
        </div>
      </div>
      <div className="content">
        <div className="kpi-row">
          <KPICard color="blue" label="TODAY REVENUE" value={fmtMoney(data.today.revenue, data.currency)}
            change={revPct} desc={`Yesterday: ${fmtMoney(data.yesterday.revenue, data.currency)}`} />
          <KPICard color="green" label="TODAY ORDERS" value={String(data.today.orders)}
            change={ordPct} desc={`Yesterday: ${data.yesterday.orders}`} />
          <KPICard color="amber" label="PENDING FULFILLMENT" value={String(data.counts.pending)}
            desc="Paid but not shipped" />
          <KPICard color="purple" label="7-DAY REVENUE" value={fmtMoney(data.week.revenue, data.currency)}
            desc={`${data.week.orders} orders`} />
          <KPICard color="green" label="TOTAL ORDERS" value={data.counts.all.toLocaleString()}
            desc="All time" />
        </div>

        <div className="grid-2">
          <div className="card">
            <div className="card-header"><h3>Revenue Comparison</h3></div>
            <div className="card-body">
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => fmtMoney(v, data.currency)} />
                    <Bar dataKey="revenue" fill="#4a90d9" radius={[4, 4, 0, 0]} name="Revenue" />
                    <Line dataKey="orders" stroke="#22c55e" strokeWidth={2} name="Orders" yAxisId={0} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-header"><h3>Quick Stats</h3></div>
            <div className="card-body">
              <div className="stat-grid">
                <div className="stat-item">
                  <div className="stat-label">Today AOV</div>
                  <div className="stat-value">
                    {data.today.orders > 0 ? fmtMoney(data.today.revenue / data.today.orders, data.currency) : '-'}
                  </div>
                </div>
                <div className="stat-item">
                  <div className="stat-label">Yesterday AOV</div>
                  <div className="stat-value">
                    {data.yesterday.orders > 0 ? fmtMoney(data.yesterday.revenue / data.yesterday.orders, data.currency) : '-'}
                  </div>
                </div>
                <div className="stat-item">
                  <div className="stat-label">7-Day AOV</div>
                  <div className="stat-value">
                    {data.week.orders > 0 ? fmtMoney(data.week.revenue / data.week.orders, data.currency) : '-'}
                  </div>
                </div>
                <div className="stat-item">
                  <div className="stat-label">Today vs Yesterday</div>
                  <div className={`stat-value ${revPct >= 0 ? 'up' : 'down'}`}>
                    {revPct >= 0 ? '↑' : '↓'} {Math.abs(revPct)}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Orders ───

function OrdersPanel({ secret }: { secret: string }) {
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery<{ orders: Order[] }>({
    queryKey: ['admin-orders', status], queryFn: () => fetchSection('orders', secret, { status }), staleTime: 30_000,
  });

  const orders = (data?.orders || []).filter(o => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return o.name.toLowerCase().includes(q) || o.customerName.toLowerCase().includes(q) ||
      o.customerEmail.toLowerCase().includes(q) || o.country.toLowerCase().includes(q);
  });

  return (
    <>
      <div className="topbar">
        <div className="topbar-left">
          <h2>Orders</h2>
          <span className="topbar-breadcrumb">Management / Orders</span>
        </div>
        <div className="topbar-right">
          <button className="btn" onClick={() => refetch()}>🔄 Refresh</button>
        </div>
      </div>
      <div className="content">
        <div className="card">
          <div className="tabs">
            {['all', 'pending', 'fulfilled', 'cancelled'].map(s => (
              <div key={s} className={`tab ${status === s ? 'active' : ''}`} onClick={() => setStatus(s)}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </div>
            ))}
          </div>
          <div style={{ padding: '12px 20px', display: 'flex', gap: 8, alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
            <input className="search-input" placeholder="Search order, customer, country..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {isLoading ? <div className="loading">Loading...</div> : orders.length === 0 ? (
            <div className="empty">No orders found.</div>
          ) : (
            <div className="card-body no-pad">
              <table>
                <thead><tr>
                  <th>Order</th><th>Date</th><th>Customer</th><th>Country</th>
                  <th>Payment</th><th>Fulfillment</th><th style={{ textAlign: 'right' }}>Total</th><th></th>
                </tr></thead>
                <tbody>
                  {orders.map(o => {
                    const fin = FINANCIAL_BADGE[o.financialStatus] || { label: o.financialStatus, cls: 'badge-muted' };
                    const ful = FULFILLMENT_BADGE[o.fulfillmentStatus] || { label: o.fulfillmentStatus || 'N/A', cls: 'badge-muted' };
                    const isExp = expanded === o.id;
                    return (
                      <tr key={o.id} className={isExp ? 'row-expanded' : ''} onClick={() => setExpanded(isExp ? null : o.id)} style={{ cursor: 'pointer' }}>
                        <td>
                          <div className="cell-company">{o.name}</div>
                          {isExp && (
                            <div className="order-detail">
                              {o.items.map((item, i) => (
                                <div key={i} className="detail-row">
                                  <span>{item.title}{item.variant ? ` (${item.variant})` : ''} ×{item.quantity}</span>
                                  <span>{fmtMoney(item.amount, o.currency)}</span>
                                </div>
                              ))}
                              <div className="detail-divider" />
                              <div className="detail-row"><span>Subtotal</span><span>{fmtMoney(o.subtotal, o.currency)}</span></div>
                              <div className="detail-row"><span>Shipping</span><span>{fmtMoney(o.shipping, o.currency)}</span></div>
                              {parseFloat(o.refunded) > 0 && (
                                <div className="detail-row danger"><span>Refunded</span><span>-{fmtMoney(o.refunded, o.currency)}</span></div>
                              )}
                            </div>
                          )}
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(o.createdAt)}</td>
                        <td>
                          <div className="cell-company">{o.customerName}</div>
                          <div className="cell-sub">{o.customerEmail}</div>
                        </td>
                        <td>{o.country}{o.city ? `, ${o.city}` : ''}</td>
                        <td><span className={`badge ${fin.cls}`}>{fin.label}</span></td>
                        <td><span className={`badge ${ful.cls}`}>{ful.label}</span></td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmtMoney(o.total, o.currency)}</td>
                        <td>
                          <a href={shopifyUrl(o.id, 'orders')} target="_blank" rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()} className="link-icon">↗</a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Products ───

function ProductsPanel({ secret }: { secret: string }) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const { data, isLoading, refetch } = useQuery<{ products: Product[] }>({
    queryKey: ['admin-products', filter], queryFn: () => fetchSection('products', secret, { filter }), staleTime: 60_000,
  });

  const products = (data?.products || []).filter(p => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return p.title.toLowerCase().includes(q) || p.variants.some(v => v.sku?.toLowerCase().includes(q));
  });

  return (
    <>
      <div className="topbar">
        <div className="topbar-left">
          <h2>Products</h2>
          <span className="topbar-breadcrumb">Management / Products & Inventory</span>
        </div>
        <div className="topbar-right">
          <button className="btn" onClick={() => refetch()}>🔄 Refresh</button>
        </div>
      </div>
      <div className="content">
        <div className="card">
          <div className="tabs">
            {['all', 'low-stock', 'out-of-stock'].map(f => (
              <div key={f} className={`tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                {f === 'all' ? 'All Products' : f === 'low-stock' ? '⚠️ Low Stock' : '🚫 Out of Stock'}
              </div>
            ))}
          </div>
          <div style={{ padding: '12px 20px', display: 'flex', gap: 8, alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
            <input className="search-input" placeholder="Search product or SKU..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {isLoading ? <div className="loading">Loading...</div> : products.length === 0 ? (
            <div className="empty">No products found.</div>
          ) : (
            <div className="card-body no-pad">
              <table>
                <thead><tr>
                  <th>Product</th><th style={{ textAlign: 'right' }}>Price</th>
                  <th style={{ textAlign: 'right' }}>Inventory</th><th>Variants</th><th></th>
                </tr></thead>
                <tbody>
                  {products.map(p => (
                    <tr key={p.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {p.imageUrl ? (
                            <img src={p.imageUrl + '&width=40'} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', border: '1px solid var(--border)' }} />
                          ) : (
                            <div style={{ width: 36, height: 36, borderRadius: 6, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>📦</div>
                          )}
                          <span className="cell-company">{p.title}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {p.minPrice === p.maxPrice ? fmtMoney(p.minPrice, p.currency) : `${fmtMoney(p.minPrice, p.currency)} – ${fmtMoney(p.maxPrice, p.currency)}`}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {p.tracksInventory ? (
                          <span className={p.totalInventory <= 0 ? 'text-danger fw-800' : p.totalInventory < 5 ? 'text-warning fw-700' : ''}>
                            {p.totalInventory <= 0 && '⚠ '}{p.totalInventory}
                          </span>
                        ) : <span className="cell-sub">N/A</span>}
                      </td>
                      <td>
                        {p.variants.length <= 1 ? <span className="cell-sub">Single</span> : (
                          <div>
                            {p.variants.slice(0, 3).map(v => (
                              <div key={v.id} className="cell-sub" style={{ fontSize: 11 }}>
                                {v.title || v.sku}: <span className={v.inventory <= 0 ? 'text-danger' : v.inventory < 5 ? 'text-warning' : ''}>{v.inventory}</span>
                              </div>
                            ))}
                            {p.variants.length > 3 && <div className="cell-sub">+{p.variants.length - 3} more</div>}
                          </div>
                        )}
                      </td>
                      <td>
                        <a href={shopifyUrl(p.id, 'products')} target="_blank" rel="noopener noreferrer" className="link-icon">↗</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Customers ───

function CustomersPanel({ secret }: { secret: string }) {
  const [tab, setTab] = useState('top');

  const { data, isLoading, refetch } = useQuery<CustomerData>({
    queryKey: ['admin-customers'], queryFn: () => fetchSection<CustomerData>('customers', secret, { view: 'all' }), staleTime: 60_000,
  });

  if (isLoading || !data) return <><div className="topbar"><div className="topbar-left"><h2>Customers</h2></div></div><div className="content"><div className="loading">Loading...</div></div></>;

  const { summary } = data;
  const purchasedTotal = summary.oneOrder + summary.twoThree + summary.fourPlus;
  const segmentData = [
    { name: '4+ Orders', value: summary.fourPlus },
    { name: '2-3 Orders', value: summary.twoThree },
    { name: '1 Order', value: summary.oneOrder },
    { name: 'No Orders', value: summary.noOrders },
  ];
  const customers = tab === 'top' ? data.topCustomers : data.recentCustomers;

  return (
    <>
      <div className="topbar">
        <div className="topbar-left">
          <h2>Customers</h2>
          <span className="topbar-breadcrumb">Management / Customer Overview</span>
        </div>
        <div className="topbar-right">
          <button className="btn" onClick={() => refetch()}>🔄 Refresh</button>
        </div>
      </div>
      <div className="content">
        <div className="kpi-row kpi-4">
          <KPICard color="blue" label="TOTAL CUSTOMERS" value={summary.total.toLocaleString()} desc="All time" />
          <KPICard color="green" label="PURCHASED" value={purchasedTotal.toLocaleString()} desc={`${Math.round(purchasedTotal / Math.max(summary.total, 1) * 100)}% of total`} />
          <KPICard color="purple" label="REPEAT (2+)" value={(summary.twoThree + summary.fourPlus).toLocaleString()}
            desc={purchasedTotal > 0 ? `${Math.round((summary.twoThree + summary.fourPlus) / purchasedTotal * 100)}% repeat rate` : '-'} />
          <KPICard color="amber" label="NO ORDERS" value={summary.noOrders.toLocaleString()} desc="Registered only" />
        </div>

        <div className="grid-3-7">
          <div className="card">
            <div className="card-header"><h3>Segments</h3></div>
            <div className="card-body">
              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={segmentData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                      innerRadius={45} outerRadius={75} paddingAngle={2}>
                      {segmentData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="tabs">
              <div className={`tab ${tab === 'top' ? 'active' : ''}`} onClick={() => setTab('top')}>🏆 Top Spenders</div>
              <div className={`tab ${tab === 'recent' ? 'active' : ''}`} onClick={() => setTab('recent')}>🆕 Recent (30d)</div>
            </div>
            <div className="card-body no-pad">
              {customers.length === 0 ? <div className="empty">No customers.</div> : (
                <table>
                  <thead><tr>
                    <th>#</th><th>Customer</th><th>Country</th>
                    <th style={{ textAlign: 'right' }}>Orders</th><th style={{ textAlign: 'right' }}>Spent</th>
                    <th>Joined</th><th></th>
                  </tr></thead>
                  <tbody>
                    {customers.map((c, i) => (
                      <tr key={c.id}>
                        <td className="cell-sub">{i + 1}</td>
                        <td>
                          <div className="cell-company">{c.name}</div>
                          <div className="cell-sub">{c.email}</div>
                        </td>
                        <td>{c.country}{c.city ? `, ${c.city}` : ''}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{c.orders}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600, fontSize: 12 }}>{fmtMoney(c.spent, c.currency)}</td>
                        <td className="cell-sub" style={{ whiteSpace: 'nowrap' }}>{fmtDateShort(c.createdAt)}</td>
                        <td><a href={shopifyUrl(c.id, 'customers')} target="_blank" rel="noopener noreferrer" className="link-icon">↗</a></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── KPI Card ───

function KPICard({ color, label, value, change, desc }: {
  color: string; label: string; value: string; change?: number; desc?: string;
}) {
  return (
    <div className={`kpi-card ${color}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-sub">
        {change !== undefined && (
          <span className={`kpi-change ${change >= 0 ? 'up' : 'down'}`}>
            {change >= 0 ? '↑' : '↓'} {Math.abs(change)}%
          </span>
        )}
        {desc && <span className="kpi-desc">{desc}</span>}
      </div>
    </div>
  );
}

// ─── Styles ───

const ADMIN_STYLES = `
:root {
  --navy: #0f1923; --navy-mid: #1a2736; --navy-light: #243447;
  --sidebar-w: 220px; --accent: #4a90d9; --accent-hover: #3a7bc8;
  --danger: #ef4444; --warning: #f59e0b; --success: #22c55e; --purple: #8b5cf6;
  --bg: #f1f5f9; --card: #fff; --text: #1e293b; --text-secondary: #64748b; --text-muted: #94a3b8;
  --border: #e2e8f0; --border-light: #f1f5f9; --radius: 12px;
  --shadow: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06);
  --font: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
}
.admin-root { display: flex; min-height: 100vh; font-family: var(--font); background: var(--bg); color: var(--text); }
.admin-sidebar { width: var(--sidebar-w); background: var(--navy); color: #cbd5e1; position: fixed; top: 0; left: 0; bottom: 0; display: flex; flex-direction: column; z-index: 200; }
.sidebar-header { padding: 20px 20px 16px; border-bottom: 1px solid rgba(255,255,255,0.06); }
.sidebar-logo { font-size: 20px; font-weight: 800; color: #fff; }
.sidebar-logo span { color: var(--accent); }
.sidebar-sub { font-size: 11px; color: #64748b; margin-top: 2px; letter-spacing: 0.5px; }
.sidebar-nav { flex: 1; padding: 12px 0; overflow-y: auto; }
.nav-section { padding: 16px 20px 6px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #475569; }
.nav-item { display: flex; align-items: center; gap: 10px; padding: 9px 20px; font-size: 13px; cursor: pointer; border-left: 3px solid transparent; color: #94a3b8; transition: all 0.2s; }
.nav-item:hover { background: rgba(255,255,255,0.04); color: #e2e8f0; }
.nav-item.active { background: rgba(74,144,217,0.1); color: #fff; border-left-color: var(--accent); }
.nav-item .icon { width: 18px; text-align: center; }
.nav-badge { margin-left: auto; background: var(--danger); color: #fff; font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 10px; }
.sidebar-footer { padding: 16px 20px; border-top: 1px solid rgba(255,255,255,0.06); }
.logout-btn { background: none; border: 1px solid rgba(255,255,255,0.1); color: #94a3b8; padding: 6px 14px; border-radius: 6px; font-size: 12px; cursor: pointer; width: 100%; }
.logout-btn:hover { background: rgba(255,255,255,0.05); color: #e2e8f0; }
.admin-main { margin-left: var(--sidebar-w); flex: 1; min-height: 100vh; }
.topbar { background: var(--card); border-bottom: 1px solid var(--border); padding: 0 28px; height: 56px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 100; }
.topbar-left { display: flex; align-items: center; gap: 16px; }
.topbar-left h2 { font-size: 16px; font-weight: 700; }
.topbar-breadcrumb { font-size: 12px; color: var(--text-muted); }
.topbar-right { display: flex; align-items: center; gap: 12px; }
.topbar-date { font-size: 12px; color: var(--text-secondary); background: var(--bg); padding: 6px 12px; border-radius: 8px; }
.btn { padding: 7px 16px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; border: 1px solid var(--border); background: #fff; color: var(--text); display: inline-flex; align-items: center; gap: 6px; }
.btn:hover { background: var(--bg); }
.btn-primary { background: var(--accent); color: #fff; border-color: var(--accent); }
.btn-primary:hover { background: var(--accent-hover); }
.content { padding: 24px 28px; }
.kpi-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 14px; margin-bottom: 20px; }
.kpi-row.kpi-4 { grid-template-columns: repeat(4, 1fr); }
.kpi-card { background: var(--card); border-radius: var(--radius); padding: 18px 20px; box-shadow: var(--shadow); border: 1px solid var(--border); position: relative; overflow: hidden; }
.kpi-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; }
.kpi-card.blue::before { background: var(--accent); }
.kpi-card.green::before { background: var(--success); }
.kpi-card.amber::before { background: var(--warning); }
.kpi-card.red::before { background: var(--danger); }
.kpi-card.purple::before { background: var(--purple); }
.kpi-label { font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
.kpi-value { font-size: 24px; font-weight: 800; letter-spacing: -0.5px; line-height: 1; }
.kpi-sub { display: flex; align-items: center; gap: 6px; margin-top: 8px; font-size: 12px; }
.kpi-change { font-weight: 700; padding: 2px 6px; border-radius: 4px; font-size: 11px; }
.kpi-change.up { color: var(--success); background: rgba(34,197,94,0.08); }
.kpi-change.down { color: var(--danger); background: rgba(239,68,68,0.08); }
.kpi-desc { color: var(--text-muted); font-size: 11px; }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
.grid-3-7 { display: grid; grid-template-columns: 3fr 7fr; gap: 16px; margin-bottom: 20px; }
.card { background: var(--card); border-radius: var(--radius); box-shadow: var(--shadow); border: 1px solid var(--border); overflow: hidden; }
.card-header { padding: 16px 20px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
.card-header h3 { font-size: 14px; font-weight: 700; }
.card-body { padding: 20px; }
.card-body.no-pad { padding: 0; }
.tabs { display: flex; border-bottom: 2px solid var(--border); padding: 0 20px; }
.tab { padding: 12px 16px; font-size: 13px; font-weight: 600; color: var(--text-muted); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px; transition: all 0.2s; white-space: nowrap; }
.tab:hover { color: var(--text); }
.tab.active { color: var(--accent); border-bottom-color: var(--accent); }
table { width: 100%; border-collapse: collapse; }
thead th { padding: 10px 14px; text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; color: var(--text-muted); background: #fafbfc; border-bottom: 1px solid var(--border); white-space: nowrap; }
tbody td { padding: 10px 14px; font-size: 13px; border-bottom: 1px solid var(--border-light); }
tbody tr { transition: background 0.2s; }
tbody tr:hover { background: #f8fafc; }
tbody tr:last-child td { border-bottom: none; }
.cell-company { font-weight: 600; }
.cell-sub { font-size: 11px; color: var(--text-muted); }
.badge { display: inline-block; padding: 3px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; }
.badge-success { background: rgba(34,197,94,0.08); color: #16a34a; }
.badge-warning { background: rgba(245,158,11,0.08); color: #d97706; }
.badge-danger { background: rgba(239,68,68,0.08); color: var(--danger); }
.badge-info { background: rgba(74,144,217,0.08); color: var(--accent); }
.badge-muted { background: var(--bg); color: var(--text-muted); }
.search-input { padding: 7px 12px 7px 34px; border: 1px solid var(--border); border-radius: 8px; font-size: 12px; outline: none; width: 260px; transition: border 0.2s; background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='%2394a3b8' viewBox='0 0 16 16'%3E%3Cpath d='M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85zm-5.242.656a5 5 0 1 1 0-10 5 5 0 0 1 0 10z'/%3E%3C/svg%3E") no-repeat 10px center; }
.search-input:focus { border-color: var(--accent); }
.link-icon { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 6px; color: var(--text-muted); font-size: 14px; text-decoration: none; transition: all 0.2s; }
.link-icon:hover { background: var(--bg); color: var(--accent); }
.loading { display: flex; justify-content: center; padding: 48px; color: var(--text-muted); font-size: 14px; }
.empty { padding: 48px; text-align: center; color: var(--text-muted); font-size: 14px; }
.stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.stat-item { background: var(--bg); border-radius: 10px; padding: 16px; text-align: center; }
.stat-label { font-size: 11px; color: var(--text-muted); font-weight: 600; text-transform: uppercase; margin-bottom: 6px; }
.stat-value { font-size: 20px; font-weight: 800; }
.stat-value.up { color: var(--success); }
.stat-value.down { color: var(--danger); }
.order-detail { margin-top: 8px; font-size: 12px; color: var(--text-secondary); }
.detail-row { display: flex; justify-content: space-between; padding: 2px 0; }
.detail-row.danger { color: var(--danger); }
.detail-divider { border-top: 1px solid var(--border); margin: 4px 0; }
.row-expanded { background: #f8fafc !important; }
.text-danger { color: var(--danger); }
.text-warning { color: var(--warning); }
.fw-700 { font-weight: 700; }
.fw-800 { font-weight: 800; }
@media (max-width: 768px) {
  .admin-sidebar { display: none; }
  .admin-main { margin-left: 0; }
  .kpi-row { grid-template-columns: repeat(2, 1fr); }
  .kpi-row.kpi-4 { grid-template-columns: repeat(2, 1fr); }
  .grid-2, .grid-3-7 { grid-template-columns: 1fr; }
  .topbar { padding: 0 16px; }
  .content { padding: 16px; }
}
`;

// ─── Main ───

export default function AdminManage() {
  const [adminKey, setAdminKey] = useState(() => sessionStorage.getItem('admin-manage-key') || '');
  const [active, setActive] = useState('overview');
  const { data: overviewData } = useQuery<Overview>({
    queryKey: ['admin-overview-count'],
    queryFn: () => fetchSection<Overview>('overview', adminKey),
    enabled: !!adminKey,
    staleTime: 60_000,
  });
  const pendingCount = overviewData?.counts?.pending ?? 0;

  if (!adminKey) return <LoginGate onLogin={setAdminKey} />;

  const logout = () => { setAdminKey(''); sessionStorage.removeItem('admin-manage-key'); };

  return (
    <>
      <style>{ADMIN_STYLES}</style>
      <div className="admin-root">
        <Sidebar active={active} onNav={setActive} pendingCount={pendingCount} onLogout={logout} />
        <div className="admin-main">
          {active === 'overview' && <OverviewPanel secret={adminKey} />}
          {active === 'orders' && <OrdersPanel secret={adminKey} />}
          {active === 'products' && <ProductsPanel secret={adminKey} />}
          {active === 'customers' && <CustomersPanel secret={adminKey} />}
        </div>
      </div>
    </>
  );
}
