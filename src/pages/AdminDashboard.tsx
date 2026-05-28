import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from "recharts";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { CalendarIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

// ─── Types ────────────────────────────────────────────────────────────────────

type Range = "today" | "7d" | "28d" | "90d" | "custom";

interface ShopifyData {
  summary: { totalOrders: number; totalRevenue: number; averageOrderValue: number; totalItemsSold: number; currency?: string };
  dailyOrders: { date: string; orders: number; revenue: number }[];
  topProducts: { productId: string; title: string; quantity: number; revenue: number }[];
  lowStock: { title: string; variant: string; quantity: number }[];
}

interface AnalyticsData {
  overview: {
    sessions?: number; activeUsers?: number; newUsers?: number;
    bounceRate?: number; averageSessionDuration?: number;
    purchaseRevenue?: number; transactions?: number;
  };
  funnel: { eventName: string; eventCount: number }[];
  revenueOverTime: { date: string; purchaseRevenue: number; transactions: number; sessions: number; activeUsers: number; itemsViewed: number }[];
  topPages: { pagePath: string; screenPageViews: number; activeUsers: number; averageSessionDuration: number }[];
  trafficSources: { sessionSource: string; sessionMedium: string; sessions: number; activeUsers: number; transactions: number; purchaseRevenue: number }[];
  trafficSourcesOverTime: { date: string; sessionSource: string; sessionMedium: string; sessions: number; activeUsers: number }[];
  notSetLandingPages: { date: string; landingPage: string; sessions: number; activeUsers: number }[];
  devices: { deviceCategory: string; sessions: number }[];
  itemViews: { itemName: string; itemsViewed: number; itemsAddedToCart: number }[];
  exitPages: { pagePath: string; sessions: number; bounceRate: number; screenPageViews: number; averageSessionDuration: number }[];
  newVsReturning: { newVsReturning: string; activeUsers: number; sessions: number }[];
}

interface CustomerData {
  totalCustomers: number;
  newCustomersCount: number;
  repeatCustomers: number;
  repeatRate: number;
  segments: { noOrders: number; oneOrder: number; twoThreeOrders: number; fourPlusOrders: number };
  avgNewLTV: number;
  dailyNewCustomers: { date: string; count: number }[];
  currency?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BRAND = "#f85a24";
const PALETTE = ["#f85a24", "#fb8c5a", "#fdb997", "#94a3b8", "#cbd5e1"];

function formatDuration(sec: number) {
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
}
function formatRevenue(v: number, currency = "USD") {
  if (currency === "USD") return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `${v.toLocaleString()} ${currency}`;
}
function ga4DateToISO(raw: string) {
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}
function isoToLabel(iso: string) {
  return `${iso.slice(5, 7)}/${iso.slice(8, 10)}`;
}

function buildTimeline(
  ga4: AnalyticsData["revenueOverTime"],
  shopify: ShopifyData["dailyOrders"]
) {
  const map = new Map<string, { date: string; isoDate: string; sessions: number; activeUsers: number; itemViews: number; orders: number; revenue: number }>();
  for (const d of shopify) {
    map.set(d.date, { date: isoToLabel(d.date), isoDate: d.date, sessions: 0, activeUsers: 0, itemViews: 0, orders: d.orders, revenue: d.revenue });
  }
  for (const d of ga4) {
    const key = ga4DateToISO(d.date);
    const ex = map.get(key) ?? { date: isoToLabel(key), isoDate: key, sessions: 0, activeUsers: 0, itemViews: 0, orders: 0, revenue: 0 };
    ex.sessions = d.sessions;
    ex.activeUsers = d.activeUsers ?? 0;
    ex.itemViews = d.itemsViewed ?? 0;
    map.set(key, ex);
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
}

const FUNNEL_ORDER = ["view_item", "add_to_cart", "begin_checkout", "purchase"] as const;

// ─── API ──────────────────────────────────────────────────────────────────────

async function fetchAnalytics(range: Range, secret: string, customFrom?: string, customTo?: string): Promise<AnalyticsData> {
  const params = new URLSearchParams({ range });
  if (range === "custom" && customFrom && customTo) { params.set("from", customFrom); params.set("to", customTo); }
  const res = await fetch(`/api/analytics?${params}`, { headers: { Authorization: `Bearer ${secret}` } });
  if (res.status === 401) throw new Error("UNAUTHORIZED");
  if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.message || "GA4 error"); }
  return res.json();
}

async function fetchShopify(range: Range, secret: string, customFrom?: string, customTo?: string): Promise<ShopifyData> {
  const params = new URLSearchParams({ range });
  if (range === "custom" && customFrom && customTo) { params.set("from", customFrom); params.set("to", customTo); }
  const res = await fetch(`/api/shopify-analytics?${params}`, { headers: { Authorization: `Bearer ${secret}` } });
  if (res.status === 401) throw new Error("UNAUTHORIZED");
  if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.message || "Shopify error"); }
  return res.json();
}

async function fetchCustomers(range: Range, secret: string, customFrom?: string, customTo?: string): Promise<CustomerData> {
  const params = new URLSearchParams({ range });
  if (range === "custom" && customFrom && customTo) { params.set("from", customFrom); params.set("to", customTo); }
  const res = await fetch(`/api/customer-analytics?${params}`, { headers: { Authorization: `Bearer ${secret}` } });
  if (res.status === 401) throw new Error("UNAUTHORIZED");
  if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.message || "Customer data error"); }
  return res.json();
}

// ─── Components ───────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-border" />
      <span className="text-[11px] font-semibold text-muted-foreground tracking-widest uppercase">{children}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

function KpiCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <Card className={accent ? "border-orange-200 bg-orange-50/40" : ""}>
      <CardContent className="pt-4 pb-3">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p className={`text-2xl font-bold tracking-tight ${accent ? "text-orange-600" : ""}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ─── Combined Chart ──────────────────────────────────────────────────────────

function CombinedChart({ timeline, currency }: { timeline: ReturnType<typeof buildTimeline>; currency: string }) {
  const interval = Math.max(0, Math.ceil(timeline.length / 10) - 1);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Traffic / Orders / Revenue</CardTitle>
        <p className="text-xs text-muted-foreground">Revenue (bars) / Active Users (orange) / Orders (gray)</p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={timeline} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={interval} />
            <YAxis yAxisId="rev" tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v / 1).toFixed(0)}`} width={56} />
            <YAxis yAxisId="sess" orientation="right" tick={{ fontSize: 10 }} width={36} />
            <Tooltip
              formatter={(value: number, name: string) => {
                if (name === "revenue") return [formatRevenue(value, currency), "Revenue"];
                if (name === "activeUsers") return [value.toLocaleString(), "Active Users"];
                return [value, "Orders"];
              }}
            />
            <Legend
              formatter={(v) => v === "revenue" ? "Revenue" : v === "activeUsers" ? "Active Users" : "Orders"}
              wrapperStyle={{ fontSize: 11 }}
            />
            <Bar yAxisId="rev" dataKey="revenue" fill={BRAND} opacity={0.25} radius={[2, 2, 0, 0]} />
            <Line yAxisId="sess" type="monotone" dataKey="activeUsers" stroke={BRAND} strokeWidth={2.5} dot={false} />
            <Line yAxisId="sess" type="monotone" dataKey="orders" stroke="#94a3b8" strokeWidth={1.5} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ─── Timeline Table ──────────────────────────────────────────────────────────

type AggRow = { label: string; sortKey: string; activeUsers: number; itemViews: number; sessions: number; orders: number; revenue: number };

function localISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getMondayISO(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const diff = d.getDay() === 0 ? -6 : 1 - d.getDay();
  d.setDate(d.getDate() + diff);
  return localISO(d);
}

function TimelineTable({ timeline, currency }: { timeline: ReturnType<typeof buildTimeline>; currency: string }) {
  const [tab, setTab] = useState<"daily" | "weekly" | "monthly">("daily");
  const sorted = [...timeline].sort((a, b) => a.isoDate.localeCompare(b.isoDate));

  function groupBy(keyFn: (iso: string) => string, labelFn: (iso: string, key: string) => string): AggRow[] {
    const map = new Map<string, AggRow>();
    for (const row of sorted) {
      const key = keyFn(row.isoDate);
      const ex = map.get(key) ?? { label: "", sortKey: key, activeUsers: 0, itemViews: 0, sessions: 0, orders: 0, revenue: 0 };
      ex.label = labelFn(row.isoDate, key);
      ex.activeUsers += row.activeUsers;
      ex.itemViews += row.itemViews;
      ex.sessions += row.sessions;
      ex.orders += row.orders;
      ex.revenue += row.revenue;
      map.set(key, ex);
    }
    return Array.from(map.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }

  const rows: AggRow[] = (() => {
    if (tab === "daily") return sorted.map((r) => ({ label: r.isoDate, sortKey: r.isoDate, activeUsers: r.activeUsers, itemViews: r.itemViews, sessions: r.sessions, orders: r.orders, revenue: r.revenue }));
    if (tab === "weekly") return groupBy(getMondayISO, (_iso, key) => {
      const sun = new Date(key + "T00:00:00");
      sun.setDate(sun.getDate() + 6);
      return `${isoToLabel(key)}~${isoToLabel(localISO(sun))}`;
    });
    return groupBy((iso) => iso.slice(0, 7), (_iso, key) => `${key.slice(0, 4)}/${key.slice(5, 7)}`);
  })();

  const totals = rows.reduce(
    (acc, r) => ({ users: acc.users + r.activeUsers, sessions: acc.sessions + r.sessions, itemViews: acc.itemViews + r.itemViews, orders: acc.orders + r.orders, revenue: acc.revenue + r.revenue }),
    { users: 0, sessions: 0, itemViews: 0, orders: 0, revenue: 0 }
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Detail Data</CardTitle>
          <div className="flex rounded-md border overflow-hidden text-xs">
            {(["daily", "weekly", "monthly"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1 transition-colors ${tab === t ? "bg-orange-500 text-white font-medium" : "text-muted-foreground hover:bg-muted"}`}
              >
                {t === "daily" ? "Daily" : t === "weekly" ? "Weekly" : "Monthly"}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto max-h-72 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-background border-b z-10">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Date</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground">Users</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground">Item Views</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground">Sessions</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground">Orders</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-2 font-mono">{row.label}</td>
                  <td className="px-4 py-2 text-right">{row.activeUsers > 0 ? row.activeUsers.toLocaleString() : "—"}</td>
                  <td className="px-4 py-2 text-right">{row.itemViews > 0 ? row.itemViews.toLocaleString() : "—"}</td>
                  <td className="px-4 py-2 text-right">{row.sessions > 0 ? row.sessions.toLocaleString() : "—"}</td>
                  <td className="px-4 py-2 text-right">{row.orders > 0 ? row.orders.toLocaleString() : "—"}</td>
                  <td className="px-4 py-2 text-right font-medium">{row.revenue > 0 ? formatRevenue(row.revenue, currency) : "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 bg-background border-t">
              <tr>
                <td className="px-4 py-2 font-semibold text-xs">Total</td>
                <td className="px-4 py-2 text-right font-semibold">{totals.users.toLocaleString()}</td>
                <td className="px-4 py-2 text-right font-semibold">{totals.itemViews.toLocaleString()}</td>
                <td className="px-4 py-2 text-right font-semibold">{totals.sessions.toLocaleString()}</td>
                <td className="px-4 py-2 text-right font-semibold">{totals.orders.toLocaleString()}</td>
                <td className="px-4 py-2 text-right font-semibold">{formatRevenue(totals.revenue, currency)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── EC Funnel ───────────────────────────────────────────────────────────────

function FunnelSection({ data }: { data: AnalyticsData["funnel"] }) {
  const map = Object.fromEntries(data.map((d) => [d.eventName, d.eventCount]));
  const rows = FUNNEL_ORDER.map((key) => ({ key, count: map[key] ?? 0 }));
  const max = rows[0]?.count || 1;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">EC Funnel</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((row, i) => {
          const prev = i > 0 ? rows[i - 1].count : null;
          const rate = prev && prev > 0 ? ((row.count / prev) * 100).toFixed(1) : null;
          return (
            <div key={row.key}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground font-mono">{row.key}</span>
                <div className="flex items-center gap-2">
                  {rate && <span className="text-xs text-muted-foreground">{rate}%</span>}
                  <span className="text-sm font-semibold">{row.count.toLocaleString()}</span>
                </div>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${max > 0 ? (row.count / max) * 100 : 0}%`, backgroundColor: PALETTE[i] }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ─── Top Products ────────────────────────────────────────────────────────────

function TopProductsTable({ data, currency }: { data: ShopifyData["topProducts"]; currency: string }) {
  const maxRev = data[0]?.revenue || 1;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Top Products</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b">
              <th className="text-left px-4 py-2 font-medium text-muted-foreground">Product</th>
              <th className="text-right px-4 py-2 font-medium text-muted-foreground">Qty</th>
              <th className="text-right px-4 py-2 font-medium text-muted-foreground">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-14 shrink-0 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(row.revenue / maxRev) * 100}%`, backgroundColor: BRAND }} />
                    </div>
                    <span className="truncate max-w-[200px]">{row.title}</span>
                  </div>
                </td>
                <td className="px-4 py-2 text-right">{row.quantity}</td>
                <td className="px-4 py-2 text-right font-medium">{formatRevenue(row.revenue, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

// ─── Daily Source Chart ──────────────────────────────────────────────────────

const SOURCE_LABEL_MAP: Record<string, string> = {
  "google / organic": "Google Search",
  "google / cpc": "Google Ads",
  "(direct) / (none)": "Direct",
  "instagram / referral": "Instagram",
  "facebook / referral": "Facebook",
  "whatsapp / referral": "WhatsApp",
  "bing / organic": "Bing Search",
  "tiktok / referral": "TikTok",
};

function sourceLabel(source: string, medium: string) {
  return SOURCE_LABEL_MAP[`${source} / ${medium}`] ?? `${source} / ${medium}`;
}

function DailySourceChart({ data, notSetLandingPages }: {
  data: AnalyticsData["trafficSourcesOverTime"];
  notSetLandingPages: AnalyticsData["notSetLandingPages"];
}) {
  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  const [showLanding, setShowLanding] = useState(false);

  const top = useMemo(() => {
    const totals = new Map<string, number>();
    for (const row of data) {
      const k = `${row.sessionSource}|||${row.sessionMedium}`;
      totals.set(k, (totals.get(k) ?? 0) + Number(row.sessions));
    }
    return [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k]) => k);
  }, [data]);

  const rawByIso = useMemo(() => {
    const map = new Map<string, { source: string; medium: string; sessions: number; activeUsers: number }[]>();
    for (const row of data) {
      const iso = ga4DateToISO(row.date);
      if (!map.has(iso)) map.set(iso, []);
      map.get(iso)!.push({ source: row.sessionSource, medium: row.sessionMedium, sessions: Number(row.sessions), activeUsers: Number(row.activeUsers) });
    }
    for (const rows of map.values()) rows.sort((a, b) => b.sessions - a.sessions);
    return map;
  }, [data]);

  const landingByIso = useMemo(() => {
    const map = new Map<string, { landingPage: string; sessions: number; activeUsers: number }[]>();
    for (const row of notSetLandingPages) {
      const iso = ga4DateToISO(row.date);
      if (!map.has(iso)) map.set(iso, []);
      map.get(iso)!.push({ landingPage: row.landingPage as string, sessions: Number(row.sessions), activeUsers: Number(row.activeUsers) });
    }
    for (const rows of map.values()) rows.sort((a, b) => b.sessions - a.sessions);
    return map;
  }, [notSetLandingPages]);

  const chartData = useMemo(() => {
    const dateMap = new Map<string, Record<string, number | string>>();
    for (const row of data) {
      const iso = ga4DateToISO(row.date);
      if (!dateMap.has(iso)) dateMap.set(iso, { _date: isoToLabel(iso), _iso: iso });
      const entry = dateMap.get(iso)!;
      const k = `${row.sessionSource}|||${row.sessionMedium}`;
      const target = top.includes(k) ? k : "Other|||";
      entry[target] = ((entry[target] as number) ?? 0) + Number(row.sessions);
    }
    return [...dateMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  }, [data, top]);

  const keys = [...top, "Other|||"].filter(k => chartData.some(d => (d[k] as number) > 0));
  const interval = Math.max(0, Math.ceil(chartData.length / 10) - 1);

  const detailRows = selectedIso ? (rawByIso.get(selectedIso) ?? []) : [];
  const detailTotal = detailRows.reduce((s, r) => s + r.sessions, 0);
  const landingRows = selectedIso ? (landingByIso.get(selectedIso) ?? []) : [];
  const landingTotal = landingRows.reduce((s, r) => s + r.sessions, 0);
  const hasNotSet = detailRows.some(r => r.source === "(not set)");

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Daily Traffic Sources</CardTitle>
        <p className="text-xs text-muted-foreground">
          Sessions by date — top 4 sources + other
          {!selectedIso && <span className="ml-2 text-muted-foreground/60">Click bar for details</span>}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart
            data={chartData}
            margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
            onClick={(e) => {
              const iso = e?.activePayload?.[0]?.payload?._iso as string | undefined;
              if (iso) setSelectedIso(prev => prev === iso ? null : iso);
            }}
            style={{ cursor: "pointer" }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="_date" tick={{ fontSize: 10 }} interval={interval} />
            <YAxis tick={{ fontSize: 10 }} width={36} />
            <Tooltip
              formatter={(value: number, name: string) => {
                if (name === "Other|||") return [value.toLocaleString(), "Other"];
                const [src, med] = name.split("|||");
                return [value.toLocaleString(), sourceLabel(src, med)];
              }}
            />
            <Legend
              formatter={(v) => {
                if (v === "Other|||") return "Other";
                const [src, med] = v.split("|||");
                return sourceLabel(src, med);
              }}
              wrapperStyle={{ fontSize: 11 }}
            />
            {keys.map((k, i) => (
              <Bar key={k} dataKey={k} stackId="src" fill={PALETTE[i % PALETTE.length]} radius={i === keys.length - 1 ? [2, 2, 0, 0] : undefined} />
            ))}
          </ComposedChart>
        </ResponsiveContainer>

        {selectedIso && (
          <div className="border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-muted/40 border-b">
              <span className="text-xs font-semibold">{selectedIso} — All Sources</span>
              <button onClick={() => { setSelectedIso(null); setShowLanding(false); }} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Close</button>
            </div>
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-background border-b">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Source / Medium</th>
                    <th className="text-right px-4 py-2 font-medium text-muted-foreground">Sessions</th>
                    <th className="text-right px-4 py-2 font-medium text-muted-foreground">Share</th>
                    <th className="text-right px-4 py-2 font-medium text-muted-foreground">Users</th>
                  </tr>
                </thead>
                <tbody>
                  {detailRows.map((row, i) => {
                    const isNotSet = row.source === "(not set)";
                    return (
                      <tr
                        key={i}
                        className={`border-b last:border-0 transition-colors ${isNotSet && landingRows.length > 0 ? "cursor-pointer hover:bg-amber-50" : "hover:bg-muted/30"}`}
                        onClick={isNotSet && landingRows.length > 0 ? () => setShowLanding(p => !p) : undefined}
                      >
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <div className="h-1 flex-1 max-w-[80px] bg-muted rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${detailTotal > 0 ? (row.sessions / detailTotal) * 100 : 0}%`, backgroundColor: BRAND }} />
                            </div>
                            <span>{sourceLabel(row.source, row.medium)}</span>
                            {isNotSet && landingRows.length > 0 && (
                              <span className="ml-auto text-[10px] text-amber-600 font-medium">
                                Landing pages {showLanding ? "▲" : "▼"}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right font-medium">{row.sessions.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right text-muted-foreground">{detailTotal > 0 ? ((row.sessions / detailTotal) * 100).toFixed(1) : 0}%</td>
                        <td className="px-4 py-2 text-right">{row.activeUsers.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="sticky bottom-0 bg-background border-t">
                  <tr>
                    <td className="px-4 py-2 font-semibold">Total</td>
                    <td className="px-4 py-2 text-right font-semibold">{detailTotal.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-muted-foreground">100%</td>
                    <td className="px-4 py-2 text-right font-semibold">{detailRows.reduce((s, r) => s + r.activeUsers, 0).toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {hasNotSet && showLanding && landingRows.length > 0 && (
              <div className="border-t">
                <div className="px-4 py-2 bg-amber-50 border-b">
                  <span className="text-xs font-semibold text-amber-700">(not set) sessions — Landing page distribution</span>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-background border-b">
                      <tr>
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground">Landing Page</th>
                        <th className="text-right px-4 py-2 font-medium text-muted-foreground">Sessions</th>
                        <th className="text-right px-4 py-2 font-medium text-muted-foreground">Share</th>
                        <th className="text-right px-4 py-2 font-medium text-muted-foreground">Users</th>
                      </tr>
                    </thead>
                    <tbody>
                      {landingRows.map((row, i) => (
                        <tr key={i} className="border-b last:border-0 hover:bg-amber-50/50 transition-colors">
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              <div className="h-1 flex-1 max-w-[80px] bg-muted rounded-full overflow-hidden">
                                <div className="h-full rounded-full bg-amber-400" style={{ width: `${landingTotal > 0 ? (row.sessions / landingTotal) * 100 : 0}%` }} />
                              </div>
                              <span className="font-mono truncate max-w-[260px]" title={row.landingPage}>{row.landingPage}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2 text-right font-medium">{row.sessions.toLocaleString()}</td>
                          <td className="px-4 py-2 text-right text-muted-foreground">{landingTotal > 0 ? ((row.sessions / landingTotal) * 100).toFixed(1) : 0}%</td>
                          <td className="px-4 py-2 text-right">{row.activeUsers.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Traffic Sources Table ───────────────────────────────────────────────────

function TrafficSourcesTable({ data }: { data: AnalyticsData["trafficSources"] }) {
  const total = data.reduce((s, r) => s + (r.sessions as number), 0);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Traffic Sources</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b">
              <th className="text-left px-4 py-2 font-medium text-muted-foreground">Source / Medium</th>
              <th className="text-right px-4 py-2 font-medium text-muted-foreground">Sessions</th>
              <th className="text-right px-4 py-2 font-medium text-muted-foreground w-20">Share</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => {
              const sessions = row.sessions as number;
              const pct = total > 0 ? ((sessions / total) * 100).toFixed(1) : "0.0";
              return (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-1 flex-1 max-w-[80px] rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: BRAND, opacity: 0.6 }} />
                      </div>
                      {row.sessionSource} / <span className="text-muted-foreground">{row.sessionMedium}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right">{sessions.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right">{pct}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

// ─── Devices ─────────────────────────────────────────────────────────────────

function DevicesChart({ data }: { data: AnalyticsData["devices"] }) {
  const LABELS: Record<string, string> = { mobile: "Mobile", desktop: "Desktop", tablet: "Tablet" };
  const formatted = data.map((d) => ({ name: LABELS[d.deviceCategory as string] ?? d.deviceCategory, value: d.sessions as number }));
  const total = formatted.reduce((s, r) => s + r.value, 0);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Devices</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center gap-4">
        <ResponsiveContainer width={100} height={100}>
          <PieChart>
            <Pie data={formatted} cx="50%" cy="50%" innerRadius={28} outerRadius={46} dataKey="value" paddingAngle={2}>
              {formatted.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="space-y-2 flex-1">
          {formatted.map((d, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
                {d.name}
              </div>
              <span className="font-medium">{total > 0 ? ((d.value / total) * 100).toFixed(1) : 0}%</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Top Pages ───────────────────────────────────────────────────────────────

function TopPagesTable({ data }: { data: AnalyticsData["topPages"] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Top Pages</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b">
              <th className="text-left px-4 py-2 font-medium text-muted-foreground">Page</th>
              <th className="text-right px-4 py-2 font-medium text-muted-foreground">PV</th>
              <th className="text-right px-4 py-2 font-medium text-muted-foreground">Users</th>
              <th className="text-right px-4 py-2 font-medium text-muted-foreground">Avg. Time</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                <td className="px-4 py-2 font-mono truncate max-w-[220px]">{row.pagePath}</td>
                <td className="px-4 py-2 text-right">{(row.screenPageViews as number).toLocaleString()}</td>
                <td className="px-4 py-2 text-right">{(row.activeUsers as number).toLocaleString()}</td>
                <td className="px-4 py-2 text-right">{formatDuration(row.averageSessionDuration as number)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

// ─── Operations Panel ────────────────────────────────────────────────────────

function OperationsPanel({ lowStock, topProducts, itemViews, currency }: {
  lowStock: ShopifyData["lowStock"];
  topProducts: ShopifyData["topProducts"];
  itemViews: AnalyticsData["itemViews"];
  currency: string;
}) {
  const normalize = (s: string) => s.toLowerCase().replace(/[\s\-_·]/g, "");
  const viewMap = useMemo(() => {
    const m = new Map<string, { views: number; carts: number }>();
    for (const d of itemViews) {
      m.set(normalize(d.itemName as string), { views: d.itemsViewed as number, carts: d.itemsAddedToCart as number });
    }
    return m;
  }, [itemViews]);

  const merged = useMemo(() => topProducts.map((p) => {
    const key = normalize(p.title);
    let match = viewMap.get(key);
    if (!match) {
      for (const [k, v] of viewMap) {
        if (key.includes(k) || k.includes(key)) { match = v; break; }
      }
    }
    return { ...p, views: match?.views ?? 0, carts: match?.carts ?? 0 };
  }), [topProducts, viewMap]);

  const maxRev = topProducts[0]?.revenue || 1;
  const maxViews = Math.max(...merged.map((r) => r.views), 1);

  return (
    <Card>
      <Tabs defaultValue="lowstock">
        <CardHeader className="pb-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Operations</CardTitle>
            <TabsList className="h-7 text-xs">
              <TabsTrigger value="lowstock" className="h-6 text-xs px-3 flex items-center gap-1.5">
                Low Stock
                {lowStock.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 text-[10px] font-medium">{lowStock.length}</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="popular" className="h-6 text-xs px-3">Popular Items</TabsTrigger>
            </TabsList>
          </div>
        </CardHeader>
        <TabsContent value="lowstock" className="mt-0">
          <CardContent className="p-0">
            {lowStock.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">No low-stock items</p>
            ) : (
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-background border-b">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Product</th>
                      <th className="text-right px-4 py-2 font-medium text-muted-foreground">Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowStock.map((row, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2.5">
                          {row.title}
                          {row.variant && <span className="text-muted-foreground ml-1">({row.variant})</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span className={`font-semibold ${row.quantity === 0 ? "text-red-600" : "text-orange-500"}`}>
                            {row.quantity === 0 ? "Out of stock" : row.quantity}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </TabsContent>
        <TabsContent value="popular" className="mt-0">
          <CardContent className="p-0">
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-background border-b">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Product</th>
                    <th className="text-right px-4 py-2 font-medium text-muted-foreground">Views</th>
                    <th className="text-right px-4 py-2 font-medium text-muted-foreground">Sold</th>
                    <th className="text-right px-4 py-2 font-medium text-muted-foreground">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {merged.map((row, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground w-4 shrink-0 text-right">{i + 1}</span>
                          <div className="flex flex-col gap-0.5 w-12 shrink-0">
                            <div className="h-1 rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${(row.revenue / maxRev) * 100}%`, backgroundColor: BRAND }} />
                            </div>
                            <div className="h-1 rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full bg-blue-400" style={{ width: `${(row.views / maxViews) * 100}%` }} />
                            </div>
                          </div>
                          <span className="truncate max-w-[160px]">{row.title}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">{row.views > 0 ? row.views.toLocaleString() : "—"}</td>
                      <td className="px-4 py-2.5 text-right">{row.quantity.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right font-medium">{formatRevenue(row.revenue, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </TabsContent>
      </Tabs>
    </Card>
  );
}

// ─── Visual Funnel ───────────────────────────────────────────────────────────

const FUNNEL_STEPS = [
  { key: "sessions",       label: "All Sessions",   color: "#f85a24" },
  { key: "view_item",      label: "View Item",      color: "#fb8c5a" },
  { key: "add_to_cart",    label: "Add to Cart",    color: "#f59e0b" },
  { key: "begin_checkout", label: "Begin Checkout",  color: "#10b981" },
  { key: "purchase",       label: "Purchase",        color: "#3b82f6" },
];

function VisualFunnel({ funnel, sessions }: { funnel: AnalyticsData["funnel"]; sessions: number }) {
  const eventMap = Object.fromEntries(funnel.map((d) => [d.eventName, d.eventCount as number]));
  const steps = FUNNEL_STEPS.map((s) => ({ ...s, count: s.key === "sessions" ? sessions : (eventMap[s.key] ?? 0) }));
  const maxCount = Math.max(...steps.map((s) => s.count), 1);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Purchase Conversion Funnel</CardTitle>
        <p className="text-xs text-muted-foreground">User count and drop-off rate per step</p>
      </CardHeader>
      <CardContent className="space-y-1 pt-2">
        {steps.map((step, i) => {
          const prev = i > 0 ? steps[i - 1].count : null;
          const dropRate = prev && prev > 0 ? (((prev - step.count) / prev) * 100).toFixed(1) : null;
          const convRate = prev && prev > 0 ? ((step.count / prev) * 100).toFixed(1) : null;
          const widthPct = maxCount > 0 ? (step.count / maxCount) * 100 : 0;

          return (
            <div key={step.key}>
              {dropRate && (
                <div className="flex items-center gap-2 py-1 pl-4">
                  <div className="w-px h-4 bg-muted-foreground/30" />
                  <span className="text-[11px] text-muted-foreground">
                    {convRate}% entered
                    <span className="ml-2 text-red-400">({dropRate}% dropped)</span>
                  </span>
                </div>
              )}
              <div className="flex items-center gap-3">
                <div className="flex-1 relative">
                  <div
                    className="h-9 rounded-md flex items-center px-3 text-white text-xs font-medium transition-all duration-500"
                    style={{ width: `${Math.max(widthPct, 15)}%`, backgroundColor: step.color, minWidth: "80px" }}
                  >
                    {step.label}
                  </div>
                </div>
                <div className="text-right w-28 shrink-0">
                  <span className="text-sm font-bold">{step.count.toLocaleString()}</span>
                  <span className="text-xs text-muted-foreground ml-1">({maxCount > 0 ? ((step.count / maxCount) * 100).toFixed(1) : 0}%)</span>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ─── Source Conversion Table ─────────────────────────────────────────────────

function SourceConversionTable({ data, currency }: { data: AnalyticsData["trafficSources"]; currency: string }) {
  const rows = [...data]
    .map((r) => ({ ...r, sessions: r.sessions as number, transactions: r.transactions as number, purchaseRevenue: r.purchaseRevenue as number, convRate: (r.sessions as number) > 0 ? ((r.transactions as number) / (r.sessions as number)) * 100 : 0 }))
    .filter((r) => r.sessions > 0)
    .sort((a, b) => b.convRate - a.convRate);
  const maxRev = Math.max(...rows.map((r) => r.purchaseRevenue), 1);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Source / Medium Conversion</CardTitle>
        <p className="text-xs text-muted-foreground">Sorted by conversion rate — CR = purchases / sessions</p>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b">
              <th className="text-left px-4 py-2 font-medium text-muted-foreground">Source / Medium</th>
              <th className="text-right px-4 py-2 font-medium text-muted-foreground">Sessions</th>
              <th className="text-right px-4 py-2 font-medium text-muted-foreground">Purchases</th>
              <th className="text-right px-4 py-2 font-medium text-muted-foreground">CR</th>
              <th className="text-right px-4 py-2 font-medium text-muted-foreground">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="h-1 w-16 shrink-0 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(row.purchaseRevenue / maxRev) * 100}%`, backgroundColor: BRAND, opacity: 0.7 }} />
                    </div>
                    <span>{row.sessionSource}</span>
                    <span className="text-muted-foreground">/ {row.sessionMedium}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-right">{row.sessions.toLocaleString()}</td>
                <td className="px-4 py-2.5 text-right">{row.transactions > 0 ? row.transactions : "—"}</td>
                <td className="px-4 py-2.5 text-right">
                  <span className={row.convRate >= 1 ? "text-green-600 font-semibold" : row.convRate > 0 ? "text-orange-500" : "text-muted-foreground"}>
                    {row.convRate > 0 ? `${row.convRate.toFixed(2)}%` : "—"}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right font-medium">{row.purchaseRevenue > 0 ? formatRevenue(row.purchaseRevenue, currency) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

// ─── Exit Pages ──────────────────────────────────────────────────────────────

function classifyPage(path: string): string {
  if (path === "/" || path === "") return "Home";
  if (path.startsWith("/product/")) return "Product Detail";
  if (path === "/checkout") return "Checkout";
  if (path === "/checkout-return") return "Order Complete";
  if (path === "/mypage") return "My Page";
  if (path === "/wishlist" || path === "/favorites") return "Wishlist";
  if (path === "/contact") return "Contact";
  return "Other";
}

function ExitPagesTable({ data }: { data: AnalyticsData["exitPages"] }) {
  const withRisk = data.map((d) => ({
    ...d, sessions: d.sessions as number, bounceRate: d.bounceRate as number,
    risk: (d.sessions as number) * (d.bounceRate as number), type: classifyPage(d.pagePath as string),
  }));
  const maxRisk = Math.max(...withRisk.map((d) => d.risk), 1);
  const getRiskLabel = (risk: number, max: number) => {
    const pct = risk / max;
    if (pct > 0.6) return { label: "High", cls: "text-red-600 bg-red-50" };
    if (pct > 0.3) return { label: "Med", cls: "text-orange-500 bg-orange-50" };
    return { label: "Low", cls: "text-green-600 bg-green-50" };
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Exit Point Analysis</CardTitle>
        <p className="text-xs text-muted-foreground">Risk = traffic x bounce rate (highest first)</p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b">
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Page</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Type</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground">Sessions</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground">Bounce</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground">Avg. Time</th>
                <th className="px-4 py-2 font-medium text-muted-foreground text-center">Risk</th>
              </tr>
            </thead>
            <tbody>
              {withRisk.sort((a, b) => b.risk - a.risk).map((row, i) => {
                const { label, cls } = getRiskLabel(row.risk, maxRisk);
                return (
                  <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5 font-mono truncate max-w-[180px]">{row.pagePath}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{row.type}</td>
                    <td className="px-4 py-2.5 text-right">{row.sessions.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={row.bounceRate > 0.5 ? "text-red-500 font-medium" : ""}>{(row.bounceRate * 100).toFixed(1)}%</span>
                    </td>
                    <td className="px-4 py-2.5 text-right">{formatDuration(row.averageSessionDuration as number)}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${cls}`}>{label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function PageTypeSummary({ data }: { data: AnalyticsData["exitPages"] }) {
  const grouped = new Map<string, { sessions: number; bounceTotal: number }>();
  for (const d of data) {
    const type = classifyPage(d.pagePath as string);
    const ex = grouped.get(type) ?? { sessions: 0, bounceTotal: 0 };
    ex.sessions += d.sessions as number;
    ex.bounceTotal += (d.bounceRate as number) * (d.sessions as number);
    grouped.set(type, ex);
  }
  const rows = Array.from(grouped.entries())
    .map(([type, v]) => ({ type, sessions: v.sessions, avgBounce: v.sessions > 0 ? v.bounceTotal / v.sessions : 0 }))
    .sort((a, b) => b.sessions - a.sessions);
  const maxSessions = rows[0]?.sessions || 1;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Page Type Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((row, i) => (
          <div key={i}>
            <div className="flex items-center justify-between mb-1 text-xs">
              <span className="font-medium">{row.type}</span>
              <div className="flex items-center gap-3 text-muted-foreground">
                <span>{row.sessions.toLocaleString()} sessions</span>
                <span className={row.avgBounce > 0.5 ? "text-red-500 font-medium" : ""}>
                  Bounce {(row.avgBounce * 100).toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(row.sessions / maxSessions) * 100}%`, backgroundColor: BRAND, opacity: 0.7 }} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── Customer Components ─────────────────────────────────────────────────────

function NewCustomerTrendChart({ data }: { data: CustomerData["dailyNewCustomers"] }) {
  const interval = Math.max(0, Math.ceil(data.length / 10) - 1);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">New Customer Trend</CardTitle>
        <p className="text-xs text-muted-foreground">Daily new sign-ups in period</p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={data.map(d => ({ ...d, label: isoToLabel(d.date) }))} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={interval} />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} width={36} />
            <Tooltip formatter={(v: number) => [v.toLocaleString(), "New Sign-ups"]} />
            <Bar dataKey="count" fill={BRAND} opacity={0.8} radius={[3, 3, 0, 0]} />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function CustomerSegmentChart({ segments }: { segments: CustomerData["segments"] }) {
  const items = [
    { name: "No Purchase", value: segments.noOrders, color: "#e2e8f0" },
    { name: "1 Order", value: segments.oneOrder, color: "#fdb997" },
    { name: "2-3 Orders", value: segments.twoThreeOrders, color: "#fb8c5a" },
    { name: "4+ Orders", value: segments.fourPlusOrders, color: BRAND },
  ].filter(d => d.value > 0);
  const total = items.reduce((s, d) => s + d.value, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Purchase Frequency</CardTitle>
        <p className="text-xs text-muted-foreground">All customer segments</p>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <PieChart width={140} height={140}>
            <Pie data={items} dataKey="value" cx={65} cy={65} innerRadius={38} outerRadius={60} paddingAngle={2}>
              {items.map((entry, i) => <Cell key={i} fill={entry.color} />)}
            </Pie>
          </PieChart>
          <div className="flex-1 space-y-2">
            {items.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span>{item.name}</span>
                </div>
                <div className="text-right">
                  <span className="font-medium">{item.value.toLocaleString()}</span>
                  <span className="text-muted-foreground ml-1.5">{total > 0 ? ((item.value / total) * 100).toFixed(1) : 0}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function NewVsReturningChart({ data }: { data: AnalyticsData["newVsReturning"] }) {
  const labeled = data.map(d => ({
    name: d.newVsReturning === "new" ? "New Users" : "Returning Users",
    activeUsers: d.activeUsers,
    sessions: d.sessions,
    color: d.newVsReturning === "new" ? BRAND : "#94a3b8",
  }));
  const total = labeled.reduce((s, d) => s + d.activeUsers, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">New vs Returning Users</CardTitle>
        <p className="text-xs text-muted-foreground">GA4 active users</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 mt-1">
          {labeled.map((d, i) => (
            <div key={i}>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium">{d.name}</span>
                <span className="text-muted-foreground">
                  {d.activeUsers.toLocaleString()} ({total > 0 ? ((d.activeUsers / total) * 100).toFixed(1) : 0}%)
                </span>
              </div>
              <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${total > 0 ? (d.activeUsers / total) * 100 : 0}%`, backgroundColor: d.color }} />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Password Gate ───────────────────────────────────────────────────────────

function PasswordGate({ onAuth }: { onAuth: (s: string) => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm px-6">
        <div className="mb-8 text-center">
          <div className="text-2xl font-bold" style={{ color: BRAND }}>BITE ME</div>
          <p className="text-sm text-muted-foreground mt-1">Admin Dashboard</p>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); if (!value.trim()) { setError(true); return; } onAuth(value.trim()); }} className="space-y-4">
          <div>
            <input
              type="password"
              placeholder="Admin secret key"
              value={value}
              onChange={(e) => { setValue(e.target.value); setError(false); }}
              className={`w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 transition-all ${error ? "border-red-400 focus:ring-red-200" : "border-input focus:ring-ring/30"}`}
              autoFocus
            />
            {error && <p className="text-xs text-red-500 mt-1">Please enter the key</p>}
          </div>
          <button type="submit" className="w-full py-2 rounded-lg text-sm font-medium text-white hover:opacity-90 transition-opacity" style={{ backgroundColor: BRAND }}>
            Log in
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────

const RANGE_LABELS: Record<Range, string> = { today: "Today", "7d": "7D", "28d": "28D", "90d": "90D", custom: "Custom" };

function DashboardView({ secret, onLogout }: { secret: string; onLogout: () => void }) {
  const [range, setRange] = useState<Range>("7d");
  const [customDates, setCustomDates] = useState<DateRange | undefined>();
  const [calOpen, setCalOpen] = useState(false);
  const [ageGroupStatus, setAgeGroupStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [ageGroupResult, setAgeGroupResult] = useState<{ updated?: number; total?: number; errors?: unknown[] } | null>(null);

  const runSetAgeGroup = async () => {
    setAgeGroupStatus('loading');
    setAgeGroupResult(null);
    try {
      const res = await fetch('/api/set-age-group', {
        method: 'POST',
        headers: { Authorization: `Bearer ${secret}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unknown error');
      setAgeGroupResult(data);
      setAgeGroupStatus('done');
    } catch (err) {
      setAgeGroupResult({ errors: [String(err)] });
      setAgeGroupStatus('error');
    }
  };

  const customFrom = customDates?.from ? format(customDates.from, "yyyy-MM-dd") : undefined;
  const customTo = customDates?.to ? format(customDates.to, "yyyy-MM-dd") : undefined;
  const canQuery = range !== "custom" || (!!customFrom && !!customTo);

  const retry = (count: number, err: unknown) => {
    if (err instanceof Error && err.message === "UNAUTHORIZED") return false;
    return count < 2;
  };

  const { data, isLoading: ga4Loading, isError, error, refetch } = useQuery({
    queryKey: ["analytics", range, secret, customFrom, customTo],
    queryFn: () => fetchAnalytics(range, secret, customFrom, customTo),
    staleTime: 5 * 60 * 1000,
    enabled: canQuery,
    retry,
  });

  const { data: shopify, isLoading: shopifyLoading, isError: shopifyIsError, error: shopifyErr } = useQuery({
    queryKey: ["shopify-analytics", range, secret, customFrom, customTo],
    queryFn: () => fetchShopify(range, secret, customFrom, customTo),
    staleTime: 5 * 60 * 1000,
    enabled: canQuery,
    retry,
  });

  const { data: customers, isLoading: customersLoading } = useQuery({
    queryKey: ["customer-analytics", range, secret, customFrom, customTo],
    queryFn: () => fetchCustomers(range, secret, customFrom, customTo),
    staleTime: 5 * 60 * 1000,
    enabled: canQuery,
    retry,
  });

  const isUnauthorized = isError && error instanceof Error && error.message === "UNAUTHORIZED";

  useEffect(() => {
    if (isUnauthorized) onLogout();
  }, [isUnauthorized, onLogout]);

  const currency = shopify?.summary?.currency || customers?.currency || "USD";

  const ov = data?.overview ?? {};
  const sessions = (ov.sessions as number) ?? 0;
  const totalOrders = shopify?.summary.totalOrders ?? 0;
  const totalRevenue = shopify?.summary.totalRevenue ?? 0;
  const aov = shopify?.summary.averageOrderValue ?? 0;
  const convRate = sessions > 0 ? ((totalOrders / sessions) * 100).toFixed(2) : "—";
  const isLoading = ga4Loading || shopifyLoading || (!data && !shopify && !isError && !shopifyIsError);

  const timeline = useMemo(() => {
    if (!data || !shopify) return [];
    return buildTimeline(data.revenueOverTime, shopify.dailyOrders);
  }, [data, shopify]);

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="bg-background border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm" style={{ color: BRAND }}>BITE ME</span>
            <span className="text-xs text-muted-foreground">Global Analytics</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border bg-background overflow-hidden text-xs">
              {(["today", "7d", "28d", "90d"] as Range[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-3 py-1.5 transition-colors ${range === r ? "text-white font-medium" : "text-muted-foreground hover:text-foreground"}`}
                  style={range === r ? { backgroundColor: BRAND } : {}}
                >
                  {RANGE_LABELS[r]}
                </button>
              ))}
            </div>
            <Popover open={calOpen} onOpenChange={setCalOpen}>
              <PopoverTrigger asChild>
                <button
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors ${range === "custom" ? "text-white font-medium" : "text-muted-foreground hover:text-foreground"}`}
                  style={range === "custom" ? { backgroundColor: BRAND } : {}}
                >
                  <CalendarIcon className="h-3 w-3" />
                  {range === "custom" && customFrom ? customTo ? `${customFrom} ~ ${customTo}` : customFrom : "Custom"}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  selected={customDates}
                  onSelect={(val) => { setCustomDates(val); setRange("custom"); if (val?.from && val?.to) setCalOpen(false); }}
                  numberOfMonths={2}
                  disabled={{ after: new Date() }}
                  defaultMonth={customDates?.from ?? new Date()}
                />
              </PopoverContent>
            </Popover>
            <button onClick={() => refetch()} className="text-xs px-3 py-1.5 rounded-lg border hover:bg-muted transition-colors">Refresh</button>
            <button onClick={onLogout} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Logout</button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {isLoading && <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">Loading data...</div>}

        {isError && !isUnauthorized && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            GA4 Error: {error instanceof Error ? error.message : "Unknown error"}
          </div>
        )}
        {shopifyIsError && !(shopifyErr instanceof Error && shopifyErr.message === "UNAUTHORIZED") && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Shopify Error: {shopifyErr instanceof Error ? shopifyErr.message : "Unknown error"}
          </div>
        )}

        {(data || shopify) && (
          <Tabs defaultValue="dashboard" className="space-y-5">
            <TabsList className="h-9">
              <TabsTrigger value="dashboard" className="text-xs px-4">Dashboard</TabsTrigger>
              <TabsTrigger value="funnel" className="text-xs px-4">Funnel</TabsTrigger>
              <TabsTrigger value="members" className="text-xs px-4">Customers</TabsTrigger>
              <TabsTrigger value="tools" className="text-xs px-4">Tools</TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="space-y-5 mt-0">
              <SectionLabel>Key Metrics</SectionLabel>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <KpiCard label="Total Revenue" value={formatRevenue(totalRevenue, currency)} accent />
                <KpiCard label="Orders" value={totalOrders.toLocaleString()} accent />
                <KpiCard label="AOV" value={formatRevenue(aov, currency)} accent />
                <KpiCard label="Conversion Rate" value={convRate === "—" ? "—" : `${convRate}%`} sub={`Sessions ${sessions.toLocaleString()} → Orders ${totalOrders}`} accent />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <KpiCard label="Sessions" value={sessions.toLocaleString()} />
                <KpiCard label="Users" value={((ov.activeUsers as number) ?? 0).toLocaleString()} />
                <KpiCard label="Bounce Rate" value={`${(((ov.bounceRate as number) ?? 0) * 100).toFixed(1)}%`} />
                <KpiCard label="Avg. Session Duration" value={formatDuration((ov.averageSessionDuration as number) ?? 0)} />
              </div>

              {timeline.length > 0 && (
                <>
                  <CombinedChart timeline={timeline} currency={currency} />
                  <TimelineTable timeline={timeline} currency={currency} />
                </>
              )}

              <SectionLabel>Conversion / Products</SectionLabel>
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                {data && <div className="lg:col-span-2"><FunnelSection data={data.funnel} /></div>}
                {shopify && <div className="lg:col-span-3"><TopProductsTable data={shopify.topProducts} currency={currency} /></div>}
              </div>

              {data && (
                <>
                  <SectionLabel>Traffic Analysis</SectionLabel>
                  <DailySourceChart data={data.trafficSourcesOverTime} notSetLandingPages={data.notSetLandingPages} />
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2"><TrafficSourcesTable data={data.trafficSources} /></div>
                    <DevicesChart data={data.devices} />
                  </div>
                  <TopPagesTable data={data.topPages} />
                </>
              )}

              {shopify && (
                <>
                  <SectionLabel>Operations</SectionLabel>
                  <OperationsPanel lowStock={shopify.lowStock} topProducts={shopify.topProducts} itemViews={data?.itemViews ?? []} currency={currency} />
                </>
              )}

              <p className="text-center text-xs text-muted-foreground pb-4">
                Shopify: {import.meta.env.VITE_SHOPIFY_STORE_DOMAIN || "global"} &middot; {RANGE_LABELS[range]} data
              </p>
            </TabsContent>

            <TabsContent value="members" className="space-y-5 mt-0">
              {customersLoading ? (
                <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">Loading customer data...</div>
              ) : customers ? (
                <>
                  <SectionLabel>Customer Metrics</SectionLabel>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <KpiCard label="Total Customers" value={customers.totalCustomers.toLocaleString()} accent />
                    <KpiCard label="New Sign-ups" value={customers.newCustomersCount.toLocaleString()} sub={`${RANGE_LABELS[range]} new registrations`} accent />
                    <KpiCard label="Repeat Rate" value={`${(customers.repeatRate * 100).toFixed(1)}%`} sub={`${customers.repeatCustomers.toLocaleString()} customers (2+ orders)`} />
                    <KpiCard label="New Customer Avg LTV" value={customers.avgNewLTV > 0 ? formatRevenue(customers.avgNewLTV, currency) : "—"} sub="New sign-ups who purchased" />
                  </div>

                  <SectionLabel>Sign-ups / Segments</SectionLabel>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <NewCustomerTrendChart data={customers.dailyNewCustomers} />
                    <CustomerSegmentChart segments={customers.segments} />
                  </div>

                  {data?.newVsReturning && data.newVsReturning.length > 0 && (
                    <>
                      <SectionLabel>User Retention</SectionLabel>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <NewVsReturningChart data={data.newVsReturning} />
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-semibold">Segment Details</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b">
                                  <th className="text-left py-2 font-medium text-muted-foreground">Type</th>
                                  <th className="text-right py-2 font-medium text-muted-foreground">Active Users</th>
                                  <th className="text-right py-2 font-medium text-muted-foreground">Sessions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {data.newVsReturning.map((row, i) => (
                                  <tr key={i} className="border-b last:border-0">
                                    <td className="py-2.5 font-medium">{row.newVsReturning === "new" ? "New Users" : "Returning Users"}</td>
                                    <td className="py-2.5 text-right">{(row.activeUsers as number).toLocaleString()}</td>
                                    <td className="py-2.5 text-right">{(row.sessions as number).toLocaleString()}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </CardContent>
                        </Card>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">Unable to load customer data.</div>
              )}
            </TabsContent>

            <TabsContent value="funnel" className="space-y-5 mt-0">
              {data ? (
                <>
                  <SectionLabel>Purchase Conversion Funnel</SectionLabel>
                  <VisualFunnel funnel={data.funnel} sessions={sessions} />

                  <SectionLabel>Source / Medium Conversion</SectionLabel>
                  <SourceConversionTable data={data.trafficSources} currency={currency} />

                  <SectionLabel>Exit Point Analysis</SectionLabel>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2"><ExitPagesTable data={data.exitPages} /></div>
                    <PageTypeSummary data={data.exitPages} />
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">Loading GA4 data...</div>
              )}
            </TabsContent>

            <TabsContent value="tools" className="space-y-5 mt-0">
              <SectionLabel>Shopify Bulk Tools</SectionLabel>
              <div className="rounded-lg border border-border p-6 space-y-4 max-w-lg">
                <div>
                  <p className="font-medium text-sm text-foreground">Set Age Group → Adult (전체 상품)</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Google Merchant Center Missing age_group 이슈 해결용 — 스토어 전체 상품의{" "}
                    <code className="bg-muted px-1 rounded">shopify.recommended-age-group</code>을{" "}
                    <code className="bg-muted px-1 rounded">Adult</code>으로 일괄 설정합니다.
                  </p>
                </div>
                <button
                  onClick={runSetAgeGroup}
                  disabled={ageGroupStatus === 'loading'}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {ageGroupStatus === 'loading' ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      업데이트 중…
                    </>
                  ) : '실행'}
                </button>
                {ageGroupStatus === 'done' && ageGroupResult && (
                  <p className="text-sm text-green-600">
                    ✅ 완료 — {ageGroupResult.updated}/{ageGroupResult.total}개 업데이트
                    {(ageGroupResult.errors?.length ?? 0) > 0 && (
                      <span className="text-destructive ml-2">({ageGroupResult.errors?.length}개 오류)</span>
                    )}
                  </p>
                )}
                {ageGroupStatus === 'error' && (
                  <p className="text-sm text-destructive">❌ 오류 발생 — {String(ageGroupResult?.errors?.[0])}</p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}

// ─── Entry Point ─────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [secret, setSecret] = useState(() => sessionStorage.getItem("adminSecret") || "");

  if (!secret) {
    return (
      <PasswordGate
        onAuth={(s) => {
          sessionStorage.setItem("adminSecret", s);
          setSecret(s);
        }}
      />
    );
  }

  return (
    <DashboardView
      secret={secret}
      onLogout={() => {
        sessionStorage.removeItem("adminSecret");
        setSecret("");
      }}
    />
  );
}
