import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Lock, Loader2, Building2, Users, CheckCircle, XCircle, Clock,
  FileText, Mail, Phone, MapPin, User, Eye, RefreshCw, ShoppingBag, Globe, Percent,
} from 'lucide-react';
import { toast } from 'sonner';

interface ApplicationSummary {
  id: string;
  email: string;
  representativeName: string;
  phoneNumber: string;
  address: string;
  companyName: string;
  documentName: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt: string;
}

interface ApplicationDetail extends Omit<ApplicationSummary, 'documentName'> {
  document: { name: string; type: string; data: string };
}

interface ShopifyB2BCustomer {
  id: string;
  displayName: string;
  email: string;
  phone: string | null;
  tags: string[];
  numberOfOrders: number;
  amountSpent: { amount: string; currencyCode: string } | null;
  defaultAddress: { address1: string; city: string; country: string; company: string } | null;
  businessCountry: string | null;
  createdAt: string;
}

interface MergedB2B {
  key: string;
  shopifyId?: string;
  email: string;
  name: string;
  company: string;
  country: string;
  countrySource: 'admin' | 'address';
  orders: number;
  spent: string;
  joined: string;
  source: 'applied' | 'direct';
  appStatus?: 'pending' | 'approved' | 'rejected';
  application?: ApplicationSummary;
  shopify?: ShopifyB2BCustomer;
}

const B2B_COUNTRIES = [
  'South Korea', 'Hong Kong', 'United States', 'Australia', 'Canada', 'Japan',
  'China', 'Taiwan', 'Singapore', 'Thailand', 'Indonesia', 'Malaysia',
  'Philippines', 'Vietnam', 'United Kingdom', 'Germany', 'France', 'New Zealand',
];

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
  approved: { label: 'Approved', color: 'text-green-600 bg-green-50 border-green-200' },
  rejected: { label: 'Rejected', color: 'text-red-600 bg-red-50 border-red-200' },
};

const SOURCE_CONFIG = {
  applied: { label: 'Applied', color: 'text-blue-600 bg-blue-50 border-blue-200' },
  direct: { label: 'Direct', color: 'text-gray-600 bg-gray-50 border-gray-200' },
};

const COUNTRY_FLAGS: Record<string, string> = {
  'South Korea': '\u{1F1F0}\u{1F1F7}', 'Hong Kong': '\u{1F1ED}\u{1F1F0}', 'United States': '\u{1F1FA}\u{1F1F8}',
  'Australia': '\u{1F1E6}\u{1F1FA}', 'Canada': '\u{1F1E8}\u{1F1E6}', 'Japan': '\u{1F1EF}\u{1F1F5}',
  'China': '\u{1F1E8}\u{1F1F3}', 'Taiwan': '\u{1F1F9}\u{1F1FC}', 'Singapore': '\u{1F1F8}\u{1F1EC}',
  'Thailand': '\u{1F1F9}\u{1F1ED}', 'Indonesia': '\u{1F1EE}\u{1F1E9}', 'Malaysia': '\u{1F1F2}\u{1F1FE}',
  'Philippines': '\u{1F1F5}\u{1F1ED}', 'Vietnam': '\u{1F1FB}\u{1F1F3}', 'United Kingdom': '\u{1F1EC}\u{1F1E7}',
};

function LoginGate({ onLogin }: { onLogin: (key: string) => void }) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/b2b-list', { headers: { 'x-admin-key': password } });
      if (res.ok) {
        sessionStorage.setItem('b2b-admin-key', password);
        onLogin(password);
      } else {
        toast.error('Invalid password.', { position: 'top-center' });
      }
    } catch {
      toast.error('Connection error.', { position: 'top-center' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>B2B Admin</CardTitle>
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

function StatCard({ icon: Icon, label, value, color }: { icon: typeof Users; label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-lg border p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function DocumentViewer({ document }: { document: { name: string; type: string; data: string } }) {
  const [imgError, setImgError] = useState(false);
  const dataUrl = `data:${document.type};base64,${document.data}`;

  if (document.type === 'application/pdf') {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium flex items-center gap-2"><FileText className="h-4 w-4" />{document.name}</p>
        <iframe src={dataUrl} className="w-full h-[500px] border rounded-lg" title="Business Registration Document" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium flex items-center gap-2"><FileText className="h-4 w-4" />{document.name}</p>
      {imgError ? (
        <div className="w-full border rounded-lg bg-muted/50 p-8 flex flex-col items-center gap-2 text-muted-foreground">
          <FileText className="h-10 w-10" />
          <p className="text-sm">Unable to preview this file.</p>
          <a href={dataUrl} download={document.name} className="text-xs text-primary underline">Download file</a>
        </div>
      ) : (
        <img src={dataUrl} alt="Business Registration Document" className="w-full rounded-lg border"
          onError={() => setImgError(true)} />
      )}
    </div>
  );
}

function DetailDialog({
  app, adminKey, onClose, onStatusChange,
}: {
  app: ApplicationSummary; adminKey: string;
  onClose: () => void; onStatusChange: () => void;
}) {
  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/b2b-detail?id=${app.id}`, { headers: { 'x-admin-key': adminKey } });
        const data = await res.json();
        setDetail(data.application);
      } catch { toast.error('Failed to load details.'); }
      finally { setLoading(false); }
    })();
  }, [app.id, adminKey]);

  const handleAction = async (action: 'approve' | 'reject') => {
    if (action === 'reject' && !rejectReason.trim()) {
      toast.error('Please enter a rejection reason.', { position: 'top-center' });
      return;
    }
    setActing(true);
    try {
      const res = await fetch('/api/b2b-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify({ id: app.id, action, ...(action === 'reject' ? { reason: rejectReason.trim() } : {}) }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(action === 'approve' ? 'Application approved.' : 'Application rejected.', { position: 'top-center' });
        onStatusChange();
        onClose();
      } else {
        toast.error(data.error || 'Action failed.', { position: 'top-center' });
      }
    } catch { toast.error('Network error.'); }
    finally { setActing(false); }
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" /> Application Detail
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : detail ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge className={STATUS_CONFIG[detail.status].color}>{STATUS_CONFIG[detail.status].label}</Badge>
              <span className="text-xs text-muted-foreground">{new Date(detail.createdAt).toLocaleDateString()}</span>
            </div>

            <Separator />

            <div className="grid gap-3">
              <div className="flex items-start gap-3">
                <Building2 className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div><p className="text-xs text-muted-foreground">Company</p><p className="text-sm font-medium">{detail.companyName}</p></div>
              </div>
              <div className="flex items-start gap-3">
                <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div><p className="text-xs text-muted-foreground">Representative</p><p className="text-sm font-medium">{detail.representativeName}</p></div>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div><p className="text-xs text-muted-foreground">Email</p><p className="text-sm font-medium">{detail.email}</p></div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div><p className="text-xs text-muted-foreground">Phone</p><p className="text-sm font-medium">{detail.phoneNumber}</p></div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div><p className="text-xs text-muted-foreground">Address</p><p className="text-sm font-medium">{detail.address}</p></div>
              </div>
            </div>

            <Separator />

            <DocumentViewer document={detail.document} />

            {detail.status === 'pending' && (
              <>
                <Separator />
                {showRejectForm ? (
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold text-destructive">Rejection Reason</Label>
                    <Textarea placeholder="Please explain why this application is being rejected..."
                      value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} autoFocus />
                    <div className="flex gap-3">
                      <Button onClick={() => handleAction('reject')} disabled={acting || !rejectReason.trim()} variant="destructive" className="flex-1">
                        {acting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />} Confirm Reject
                      </Button>
                      <Button onClick={() => { setShowRejectForm(false); setRejectReason(''); }} disabled={acting} variant="outline" className="flex-1">Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <Button onClick={() => handleAction('approve')} disabled={acting} className="flex-1 bg-green-600 hover:bg-green-700">
                      {acting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />} Approve
                    </Button>
                    <Button onClick={() => setShowRejectForm(true)} disabled={acting} variant="destructive" className="flex-1">
                      <XCircle className="h-4 w-4 mr-2" /> Reject
                    </Button>
                  </div>
                )}
              </>
            )}

            {detail.status === 'rejected' && (detail as any).rejectionReason && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-red-600 mb-1">Rejection Reason</p>
                <p className="text-sm text-red-800">{(detail as any).rejectionReason}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">Application not found.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function mergeData(applications: ApplicationSummary[], shopifyCustomers: ShopifyB2BCustomer[]): MergedB2B[] {
  const map = new Map<string, MergedB2B>();

  for (const s of shopifyCustomers) {
    const key = (s.email || s.id).toLowerCase();
    const hasAdminCountry = !!s.businessCountry;
    map.set(key, {
      key,
      shopifyId: s.id,
      email: s.email || '-',
      name: s.displayName || '-',
      company: s.defaultAddress?.company || '-',
      country: s.businessCountry || s.defaultAddress?.country || '-',
      countrySource: hasAdminCountry ? 'admin' : 'address',
      orders: s.numberOfOrders || 0,
      spent: s.amountSpent ? `${parseFloat(s.amountSpent.amount).toLocaleString()} ${s.amountSpent.currencyCode}` : '-',
      joined: s.createdAt,
      source: 'direct',
      shopify: s,
    });
  }

  for (const a of applications) {
    const key = a.email.toLowerCase();
    const existing = map.get(key);
    if (existing) {
      existing.source = 'applied';
      existing.appStatus = a.status;
      existing.application = a;
      if (existing.company === '-' && a.companyName) existing.company = a.companyName;
    } else {
      map.set(key, {
        key,
        email: a.email,
        name: a.representativeName,
        company: a.companyName,
        country: '-',
        countrySource: 'address',
        orders: 0,
        spent: '-',
        joined: a.createdAt,
        source: 'applied',
        appStatus: a.status,
        application: a,
      });
    }
  }

  return [...map.values()].sort((a, b) => new Date(b.joined).getTime() - new Date(a.joined).getTime());
}

export default function B2BAdmin() {
  const [adminKey, setAdminKey] = useState(() => sessionStorage.getItem('b2b-admin-key') || '');
  const [applications, setApplications] = useState<ApplicationSummary[]>([]);
  const [shopifyCustomers, setShopifyCustomers] = useState<ShopifyB2BCustomer[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedApp, setSelectedApp] = useState<ApplicationSummary | null>(null);
  const [editingCountry, setEditingCountry] = useState<string | null>(null);
  const [savingCountry, setSavingCountry] = useState(false);
  const [discountRate, setDiscountRate] = useState<number | null>(null);
  const [discountInput, setDiscountInput] = useState('');
  const [savingDiscount, setSavingDiscount] = useState(false);

  const fetchDiscountRate = useCallback(async () => {
    try {
      const res = await fetch('/api/b2b?action=get-discount-rate');
      const data = await res.json();
      const rate = data.rate ?? 0.60;
      setDiscountRate(rate);
      setDiscountInput(String(Math.round(rate * 100)));
    } catch { /* ignore */ }
  }, []);

  const handleDiscountSave = async () => {
    const pct = parseInt(discountInput, 10);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      toast.error('Enter a valid percentage (0-100).', { position: 'top-center' });
      return;
    }
    setSavingDiscount(true);
    try {
      const res = await fetch('/api/b2b?action=set-discount-rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify({ rate: pct / 100 }),
      });
      if (res.ok) {
        setDiscountRate(pct / 100);
        toast.success(`Discount rate updated to ${pct}%`, { position: 'top-center' });
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to update discount rate', { position: 'top-center' });
      }
    } catch { toast.error('Network error.'); }
    finally { setSavingDiscount(false); }
  };

  const handleCountrySave = async (email: string, country: string) => {
    setSavingCountry(true);
    try {
      const res = await fetch('/api/b2b-update-country', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify({ email, country }),
      });
      if (res.ok) {
        toast.success(`Country updated to ${country}`, { position: 'top-center' });
        setShopifyCustomers(prev => prev.map(c =>
          c.email?.toLowerCase() === email.toLowerCase() ? { ...c, businessCountry: country } : c
        ));
        setEditingCountry(null);
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to update country', { position: 'top-center' });
      }
    } catch { toast.error('Network error.'); }
    finally { setSavingCountry(false); }
  };

  const fetchAll = useCallback(async () => {
    if (!adminKey) return;
    setLoading(true);
    try {
      const [appRes, shopRes] = await Promise.all([
        fetch('/api/b2b-list', { headers: { 'x-admin-key': adminKey } }),
        fetch('/api/b2b-shopify', { headers: { 'x-admin-key': adminKey } }),
      ]);
      if (appRes.status === 401) { setAdminKey(''); sessionStorage.removeItem('b2b-admin-key'); return; }
      const [appData, shopData] = await Promise.all([appRes.json(), shopRes.json()]);
      setApplications(appData.applications || []);
      setShopifyCustomers(shopData.customers || []);
    } catch { toast.error('Failed to load data.'); }
    finally { setLoading(false); }
  }, [adminKey]);

  useEffect(() => { fetchAll(); fetchDiscountRate(); }, [fetchAll, fetchDiscountRate]);

  if (!adminKey) return <LoginGate onLogin={setAdminKey} />;

  const merged = mergeData(applications, shopifyCustomers);

  const filterFn = (r: MergedB2B) => {
    if (filter === 'pending') return r.appStatus === 'pending';
    if (filter === 'approved') return r.appStatus === 'approved' || (r.source === 'direct' && !r.appStatus);
    if (filter === 'rejected') return r.appStatus === 'rejected';
    if (filter === 'no-orders') return r.orders === 0;
    return true;
  };

  const searchFn = (r: MergedB2B) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q) ||
      r.company.toLowerCase().includes(q) || r.country.toLowerCase().includes(q);
  };

  const filtered = merged.filter(r => filterFn(r) && searchFn(r));

  const counts = {
    total: merged.length,
    pending: merged.filter(r => r.appStatus === 'pending').length,
    approved: merged.filter(r => r.appStatus === 'approved' || (r.source === 'direct' && !r.appStatus)).length,
    rejected: merged.filter(r => r.appStatus === 'rejected').length,
    noOrders: merged.filter(r => r.orders === 0).length,
  };

  const countryStats = merged.filter(r => r.country && r.country !== '-').reduce<Record<string, { count: number; orders: number }>>((acc, r) => {
    if (!acc[r.country]) acc[r.country] = { count: 0, orders: 0 };
    acc[r.country].count++;
    acc[r.country].orders += r.orders;
    return acc;
  }, {});
  const countrySorted = Object.entries(countryStats).sort((a, b) => b[1].count - a[1].count);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-primary" />
          <h1 className="text-lg font-bold">B2B Admin</h1>
          <Badge variant="outline" className="text-xs">{counts.total} partners</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { setAdminKey(''); sessionStorage.removeItem('b2b-admin-key'); }}>
            Logout
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Discount Rate Setting */}
        {discountRate !== null && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Percent className="h-4 w-4" /> B2B Discount Rate
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center gap-3">
                <span className="text-3xl font-bold text-primary">{Math.round(discountRate * 100)}%</span>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={discountInput}
                    onChange={(e) => setDiscountInput(e.target.value)}
                    className="w-20 text-center"
                    placeholder="%"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                  <Button
                    size="sm"
                    onClick={handleDiscountSave}
                    disabled={savingDiscount || discountInput === String(Math.round(discountRate * 100))}
                  >
                    {savingDiscount ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                  </Button>
                </div>
                <span className="text-xs text-muted-foreground ml-2">
                  B2B customers see prices at {100 - Math.round(discountRate * 100)}% of retail
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Country breakdown */}
        {!loading && countrySorted.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Globe className="h-4 w-4" /> Wholesalers by Country
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                {countrySorted.map(([country, stats]) => {
                  const pct = Math.round((stats.count / merged.length) * 100);
                  return (
                    <div key={country} className="relative bg-gray-50 rounded-lg p-3 overflow-hidden cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => setSearch(search === country ? '' : country)}>
                      <div className="absolute bottom-0 left-0 h-1 bg-blue-400 rounded-b-lg" style={{ width: `${pct}%` }} />
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{COUNTRY_FLAGS[country] || '\u{1F30F}'}</span>
                        <span className="text-xs font-medium truncate">{country}</span>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-xl font-bold">{stats.count}</span>
                        <span className="text-[10px] text-muted-foreground">({pct}%)</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{stats.orders} orders</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard icon={Users} label="Total" value={counts.total} color="bg-blue-50 text-blue-600" />
          <StatCard icon={Clock} label="Pending" value={counts.pending} color="bg-yellow-50 text-yellow-600" />
          <StatCard icon={CheckCircle} label="Active" value={counts.approved} color="bg-green-50 text-green-600" />
          <StatCard icon={XCircle} label="Rejected" value={counts.rejected} color="bg-red-50 text-red-600" />
          <StatCard icon={ShoppingBag} label="No Orders" value={counts.noOrders} color="bg-orange-50 text-orange-600" />
        </div>

        {/* Filter + Search */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList>
              <TabsTrigger value="all">All ({counts.total})</TabsTrigger>
              <TabsTrigger value="pending">Pending ({counts.pending})</TabsTrigger>
              <TabsTrigger value="approved">Active ({counts.approved})</TabsTrigger>
              <TabsTrigger value="rejected">Rejected ({counts.rejected})</TabsTrigger>
              <TabsTrigger value="no-orders">No Orders ({counts.noOrders})</TabsTrigger>
            </TabsList>
          </Tabs>
          <Input placeholder="Search name, email, company, country..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No partners found.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="bg-white rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50/50">
                  <th className="text-left p-3 font-medium text-muted-foreground">#</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Name</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Email</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Company</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Country</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Orders</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Spent</th>
                  <th className="text-center p-3 font-medium text-muted-foreground">Source</th>
                  <th className="text-center p-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Joined</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.key} className={`border-b last:border-0 hover:bg-gray-50 transition-colors ${r.orders === 0 ? 'bg-yellow-50/30' : ''}`}>
                    <td className="p-3 text-muted-foreground text-xs">{i + 1}</td>
                    <td className="p-3 font-medium">{r.name}</td>
                    <td className="p-3 text-muted-foreground text-xs">{r.email}</td>
                    <td className="p-3 text-xs">{r.company}</td>
                    <td className="p-3 text-xs whitespace-nowrap">
                      {editingCountry === r.key ? (
                        <div className="flex items-center gap-1">
                          <select
                            className="border rounded px-1 py-0.5 text-xs bg-white"
                            defaultValue={r.country}
                            disabled={savingCountry}
                            onChange={(e) => {
                              if (r.email && r.email !== '-' && e.target.value) handleCountrySave(r.email, e.target.value);
                            }}
                          >
                            <option value="">Select...</option>
                            {B2B_COUNTRIES.map(c => <option key={c} value={c}>{COUNTRY_FLAGS[c] || ''} {c}</option>)}
                            {r.country && r.country !== '-' && !B2B_COUNTRIES.includes(r.country) && (
                              <option value={r.country}>{r.country}</option>
                            )}
                          </select>
                          {savingCountry && <Loader2 className="h-3 w-3 animate-spin" />}
                          <button onClick={() => setEditingCountry(null)} className="text-muted-foreground hover:text-foreground">
                            <XCircle className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => r.email !== '-' && setEditingCountry(r.key)}
                          className={`inline-flex items-center gap-1 hover:bg-gray-100 rounded px-1 py-0.5 transition-colors ${r.countrySource === 'address' && r.country !== '-' ? 'text-orange-500' : ''}`}
                          title={r.countrySource === 'admin' ? 'Admin set' : 'From shipping address (click to edit)'}
                        >
                          {r.country !== '-' && <span>{COUNTRY_FLAGS[r.country] || ''}</span>}
                          {r.country}
                          {r.countrySource === 'admin' && <CheckCircle className="h-3 w-3 text-green-500 ml-0.5" />}
                        </button>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {r.orders > 0 ? (
                        <span className="font-medium">{r.orders}</span>
                      ) : (
                        <Badge variant="outline" className="text-yellow-600 border-yellow-200 bg-yellow-50 text-xs">0</Badge>
                      )}
                    </td>
                    <td className="p-3 text-right font-medium text-xs">{r.spent}</td>
                    <td className="p-3 text-center">
                      <Badge variant="outline" className={`text-xs ${SOURCE_CONFIG[r.source].color}`}>
                        {SOURCE_CONFIG[r.source].label}
                      </Badge>
                    </td>
                    <td className="p-3 text-center">
                      {r.appStatus ? (
                        <Badge variant="outline" className={`text-xs ${STATUS_CONFIG[r.appStatus].color}`}>
                          {STATUS_CONFIG[r.appStatus].label}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-green-600 bg-green-50 border-green-200">Active</Badge>
                      )}
                    </td>
                    <td className="p-3 text-muted-foreground text-xs whitespace-nowrap">{new Date(r.joined).toLocaleDateString()}</td>
                    <td className="p-3">
                      {r.application && (
                        <button onClick={() => setSelectedApp(r.application!)} className="text-muted-foreground hover:text-foreground transition-colors">
                          <Eye className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {selectedApp && (
        <DetailDialog app={selectedApp} adminKey={adminKey}
          onClose={() => setSelectedApp(null)} onStatusChange={fetchAll} />
      )}
    </div>
  );
}
