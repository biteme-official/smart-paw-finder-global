/**
 * 관리자 「재입고 알림」 탭 (#202) — 누가 무엇을 신청했고, 메일이 나갔는지.
 *
 * 발송은 자동이 아니다. 재고가 풀린 신청(재입고됨)을 골라 「미리보기」 → 「보내기」를 눌러야 나간다.
 * 서버가 보내기 직전에 재고를 다시 확인하고, 한 사람에게는 한 통으로 묶는다.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, Loader2, RefreshCw, Send } from 'lucide-react';
import { toast } from 'sonner';
import { ManagePageHeader, useManageAuth } from '@/components/admin/ManageLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type Status = 'waiting' | 'ready' | 'sent' | 'gone';

interface Row {
  key: string;
  email: string;
  productId: string;
  handle: string;
  productTitle: string;
  variantId: string;
  variantTitle: string;
  origin: string;
  createdAt: string;
  sentAt?: string;
  status: Status;
  inventoryQuantity: number | null;
}

interface Preview {
  recipients: number;
  items: number;
  skipped: number;
  sample: { to: string; subject: string; text: string } | null;
  mailConfigured: boolean;
}

const STATUS_LABEL: Record<Status, string> = { ready: '재입고됨', waiting: '품절 중', sent: '발송함', gone: '판매 종료' };
const STATUS_CLASS: Record<Status, string> = {
  ready: 'bg-emerald-100 text-emerald-700',
  waiting: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  gone: 'bg-red-100 text-red-600',
};
const FILTERS: { value: Status | 'all'; label: string }[] = [
  { value: 'ready', label: '재입고됨' },
  { value: 'waiting', label: '품절 중' },
  { value: 'sent', label: '발송함' },
  { value: 'all', label: '전체' },
];

const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' }) : '-');
const variantLabel = (r: Row) => (r.variantTitle === 'Default Title' ? '-' : r.variantTitle);
const siteLabel = (origin: string) => origin.replace(/^https?:\/\/(www\.)?/, '');

export default function RestockAdmin() {
  const { adminKey } = useManageAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [mailConfigured, setMailConfigured] = useState(true);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Status | 'all'>('ready');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<Preview | null>(null);
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/restock?action=list', { headers: { 'x-admin-key': adminKey } });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      setRows(data.rows);
      setMailConfigured(data.mailConfigured);
      setSelected(new Set());
      setPreview(null);
    } catch {
      toast.error('목록을 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  }, [adminKey]);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length, ready: 0, waiting: 0, sent: 0, gone: 0 };
    for (const r of rows) c[r.status] += 1;
    return c;
  }, [rows]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (filter === 'all' || r.status === filter) &&
        (!q || r.productTitle.toLowerCase().includes(q) || r.email.includes(q) || r.variantTitle.toLowerCase().includes(q)),
    );
  }, [rows, filter, search]);

  const selectable = visible.filter((r) => r.status === 'ready');
  const allSelected = selectable.length > 0 && selectable.every((r) => selected.has(r.key));

  const toggle = (key: string, on: boolean) => {
    setPreview(null);
    setSelected((s) => {
      const next = new Set(s);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const post = async (confirm: boolean) => {
    const res = await fetch('/api/restock?action=send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
      body: JSON.stringify({ keys: [...selected], confirm }),
    });
    if (!res.ok) throw new Error(res.status === 503 ? '메일 발송 설정이 아직 없어요.' : `오류 (${res.status})`);
    return res.json();
  };

  const handlePreview = async () => {
    setWorking(true);
    try {
      setPreview(await post(false));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setWorking(false);
    }
  };

  const handleSend = async () => {
    setWorking(true);
    try {
      const r = await post(true);
      toast.success(`${r.sent}명에게 보냈어요.${r.failed ? ` 실패 ${r.failed}명.` : ''}${r.skipped ? ` 제외 ${r.skipped}건.` : ''}`);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setWorking(false);
    }
  };

  return (
    <div>
      <ManagePageHeader icon={Bell} heading="재입고 알림" />
      <main className="max-w-6xl mx-auto p-4 md:p-6 space-y-4">
        {!mailConfigured && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            메일 발송 설정(RESEND_API_KEY, RESTOCK_FROM_EMAIL)이 아직 없어요. 미리보기만 할 수 있어요.
          </div>
        )}

        <div className="flex flex-col md:flex-row md:items-center gap-2 md:justify-between">
          <div className="flex flex-wrap gap-1">
            {FILTERS.map((f) => (
              <Button
                key={f.value}
                size="sm"
                variant={filter === f.value ? 'default' : 'outline'}
                onClick={() => { setFilter(f.value); setSelected(new Set()); setPreview(null); }}
              >
                {f.label} ({counts[f.value]})
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="상품명·옵션·이메일 검색"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full md:w-64"
            />
            <Button variant="outline" size="sm" onClick={load} disabled={loading} className="h-10">
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="p-3 w-10">
                    <Checkbox
                      checked={allSelected}
                      disabled={selectable.length === 0}
                      onCheckedChange={(c) => {
                        setPreview(null);
                        setSelected(c ? new Set(selectable.map((r) => r.key)) : new Set());
                      }}
                    />
                  </th>
                  <th className="p-3">상품</th>
                  <th className="p-3">옵션</th>
                  <th className="p-3">상태</th>
                  <th className="p-3 text-right">재고</th>
                  <th className="p-3">이메일</th>
                  <th className="p-3">사이트</th>
                  <th className="p-3">신청</th>
                  <th className="p-3">발송</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-muted-foreground">
                      {loading ? '불러오는 중…' : '신청이 없어요.'}
                    </td>
                  </tr>
                )}
                {visible.map((r) => (
                  <tr key={r.key} className="border-t">
                    <td className="p-3">
                      <Checkbox
                        checked={selected.has(r.key)}
                        disabled={r.status !== 'ready'}
                        onCheckedChange={(c) => toggle(r.key, c === true)}
                      />
                    </td>
                    <td className="p-3 max-w-[260px]">
                      <a href={`/product/${r.handle}`} target="_blank" rel="noreferrer" className="hover:underline line-clamp-2">
                        {r.productTitle}
                      </a>
                    </td>
                    <td className="p-3 whitespace-nowrap">{variantLabel(r)}</td>
                    <td className="p-3">
                      <span className={cn('rounded px-2 py-0.5 text-xs font-medium whitespace-nowrap', STATUS_CLASS[r.status])}>
                        {STATUS_LABEL[r.status]}
                      </span>
                    </td>
                    <td className="p-3 text-right tabular-nums">{r.inventoryQuantity ?? '-'}</td>
                    <td className="p-3">{r.email}</td>
                    <td className="p-3 whitespace-nowrap text-muted-foreground">{siteLabel(r.origin)}</td>
                    <td className="p-3 whitespace-nowrap text-muted-foreground">{fmtDate(r.createdAt)}</td>
                    <td className="p-3 whitespace-nowrap text-muted-foreground">{fmtDate(r.sentAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* 하단 결정 바 — 고른 신청 미리보기 → 보내기 */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center gap-2 md:justify-between">
              <p className="text-sm">
                선택 <b>{selected.size}</b>건 · 재입고됨 상태만 고를 수 있어요
              </p>
              <Button onClick={handlePreview} disabled={selected.size === 0 || working} variant="outline" className="w-full md:w-auto">
                {working && !preview && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                미리보기
              </Button>
            </div>
            {preview && (
              <div className="space-y-3 border-t pt-3">
                <p className="text-sm">
                  받는 사람 <b>{preview.recipients}</b>명 · 상품 {preview.items}건
                  {preview.skipped > 0 && <span className="text-muted-foreground"> · 제외 {preview.skipped}건(재고 없음·이미 발송)</span>}
                </p>
                {preview.sample && (
                  <div className="rounded-lg bg-gray-50 p-3 text-xs space-y-1">
                    <p className="text-muted-foreground">예시 — {preview.sample.to}</p>
                    <p className="font-semibold">{preview.sample.subject}</p>
                    <pre className="whitespace-pre-wrap font-sans">{preview.sample.text}</pre>
                  </div>
                )}
                <Button
                  onClick={handleSend}
                  disabled={working || preview.recipients === 0 || !preview.mailConfigured}
                  className="w-full md:w-auto"
                >
                  {working ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                  {preview.recipients}명에게 보내기
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
