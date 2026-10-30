import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Loader2, RefreshCw, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useManageAuth } from '@/components/admin/ManageLayout';
import { cn } from '@/lib/utils';
import {
  SHEET_RETENTION_DAYS, SheetApiError, downloadBytes, fetchSheetFile, listRecipients, shownKind, type SheetRecipientRow,
} from './shippingSheets';
import { FULL, GROUP, HEAD_ROW, ROW, TABLE, TD, TH, WRAP, monthDay } from './tableStyles';

const KIND_FILTERS = ['전체', '주문', '시딩'] as const;
type KindFilter = (typeof KIND_FILTERS)[number];

/** Case, spaces, hyphens and "#" don't matter: "TEST-1001-0001" = "test10010001", "#1801" = "1801". */
const searchKey = (s: string) => s.toLowerCase().replace(/[\s#-]/g, '');

/** 수취인 조회 tab: every recipient of the saved sheets, one per row. Gone with its sheet (deleted / expired). */
export default function RecipientLookup() {
  const { adminKey, logout } = useManageAuth();
  const [rows, setRows] = useState<SheetRecipientRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<KindFilter>('전체');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const fail = useCallback((e: unknown, message: string) => {
    if (e instanceof SheetApiError && e.status === 401) { logout(); return; }
    toast.error(e instanceof SheetApiError && e.status === 404 ? '삭제되었거나 보관 기간이 지난 시트입니다.' : message,
      { position: 'top-center' });
  }, [logout]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listRecipients(adminKey));
    } catch (e) {
      fail(e, '수취인 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [adminKey, fail]);

  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => {
    const q = searchKey(query.trim());
    return (rows ?? []).filter((r) => (kind === '전체' || shownKind(r.kind) === kind)
      && (!from || r.shipDate >= from) && (!to || r.shipDate <= to)
      && (!q || [r.orderNo, r.name, r.address, r.tracking].some((v) => searchKey(v).includes(q))));
  }, [rows, query, kind, from, to]);

  const download = async (r: SheetRecipientRow, key: string) => {
    setBusyKey(key);
    try {
      const { fileName, bytes } = await fetchSheetFile(adminKey, r.sheetId);
      downloadBytes(bytes, fileName);
    } catch (e) {
      fail(e, '시트를 내려받지 못했습니다.');
      if (e instanceof SheetApiError && e.status === 404) load();
    } finally {
      setBusyKey(null);
    }
  };

  const filtered = !!query.trim() || kind !== '전체' || !!from || !!to;

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          저장한 출고시트의 수취인입니다. 관리자만 볼 수 있으며, 시트를 삭제하거나 {SHEET_RETENTION_DAYS}일이 지나 자동 삭제되면 여기서도 함께 사라집니다.
        </p>
        <Button variant="outline" size="sm" className="w-full md:w-auto" disabled={loading} onClick={load}>
          {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
          새로고침
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2 md:items-center">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9"
            placeholder="주문번호(261028-160, #1801, 1801) · 수취인명 · 주소 · 송장번호 검색" />
        </div>
        <Select value={kind} onValueChange={(v) => setKind(v as KindFilter)}>
          <SelectTrigger className="w-full md:w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            {KIND_FILTERS.map((k) => <SelectItem key={k} value={k}>{k === '전체' ? '구분 전체' : k}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Input type="date" aria-label="출고일자 시작" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)}
            className="w-full md:w-40" />
          <span className="text-muted-foreground">~</span>
          <Input type="date" aria-label="출고일자 끝" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)}
            className="w-full md:w-40" />
        </div>
      </div>

      {rows && (
        <p className="text-xs text-muted-foreground">
          {filtered ? `${rows.length}명 중 ${shown.length}명` : `${rows.length}명`}
          {filtered && (
            <button type="button" className="ml-2 text-primary hover:underline"
              onClick={() => { setQuery(''); setKind('전체'); setFrom(''); setTo(''); }}>
              조건 초기화
            </button>
          )}
        </p>
      )}

      <div className="bg-white border rounded-lg overflow-x-auto">
        <table className={cn(TABLE, 'grid-cols-[repeat(9,max-content)]')}>
          <thead className={GROUP}>
            <tr className={HEAD_ROW}>
              <th className={TH}>출고일자</th>
              <th className={TH}>주문번호</th>
              <th className={TH}>구분</th>
              <th className={TH}>수취인명</th>
              <th className={TH}>국가</th>
              <th className={TH}>주소</th>
              <th className={TH}>송장번호</th>
              <th className={TH}>상품</th>
              <th className={TH}>다운로드</th>
            </tr>
          </thead>
          <tbody className={GROUP}>
            {shown.map((r, i) => {
              const key = `${r.sheetId}:${i}`;
              return (
                <tr key={key} className={ROW}>
                  <td className={TD}>{monthDay(r.shipDate)}</td>
                  <td className={cn(TD, 'font-mono')}>{r.orderNo || '-'}</td>
                  <td className={TD}>{shownKind(r.kind)}</td>
                  <td className={TD}><div className={cn(WRAP, 'min-w-[6rem] max-w-[10rem]')}>{r.name}</div></td>
                  <td className={TD}>{r.country}</td>
                  <td className={TD}><div className={cn(WRAP, 'min-w-[11rem] max-w-[15rem]')}>{r.address}</div></td>
                  <td className={cn(TD, 'font-mono')}>{r.tracking || '-'}</td>
                  <td className={TD}><div className={cn(WRAP, 'min-w-[9rem] max-w-[12rem]')} title={r.products}>{r.products}</div></td>
                  <td className={TD}>
                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={busyKey === key} onClick={() => download(r, key)}>
                      {busyKey === key ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />}
                      시트 받기
                    </Button>
                  </td>
                </tr>
              );
            })}
            {rows && !shown.length && (
              <tr className={ROW}>
                <td className={cn(FULL, 'text-sm text-muted-foreground')}>
                  {rows.length ? '조건에 맞는 수취인이 없습니다.' : '저장한 출고시트가 없습니다.'}
                </td>
              </tr>
            )}
            {!rows && loading && (
              <tr className={ROW}><td className={FULL}><Loader2 className="h-4 w-4 animate-spin inline" /></td></tr>
            )}
            {!rows && !loading && (
              <tr className={ROW}><td className={cn(FULL, 'text-sm text-red-600')}>수취인 목록을 불러오지 못했습니다 — 새로고침을 눌러 주세요.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
