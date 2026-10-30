import { useCallback, useEffect, useState } from 'react';
import { Download, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useManageAuth } from '@/components/admin/ManageLayout';
import { cn } from '@/lib/utils';
import { FULL, GROUP, HEAD_ROW, NUM, ROW, TABLE, TD, TH, WRAP, monthDay, shortDate, shortDateTime } from './tableStyles';
import {
  SHEET_RETENTION_DAYS, SheetApiError, deleteSheet, downloadBytes, fetchSheetFile, kindLabel, listSheets, sheetOrderNumbers,
  type SheetMeta,
} from './shippingSheets';

const dateTime = shortDateTime;

/** Shown before "외 n건". */
const ORDERS_SHOWN = 3;

/** "261010-170~171, #1830" in one line, "외 n건" past ORDERS_SHOWN; '-' when the sheet has none. */
const shortOrderNumbers = (s: SheetMeta) => {
  const all = sheetOrderNumbers(s);
  if (!all.length) return '-';
  const rest = all.length - ORDERS_SHOWN;
  return all.slice(0, ORDERS_SHOWN).join(', ') + (rest > 0 ? ` 외 ${rest}건` : '');
};

/**
 * 주문번호: the seeding range (261028-160~162) and the Shopify #numbers, in that order. The first few
 * + "외 n건" (all on hover, or opened by a click); '-' when the sheet has neither.
 */
function OrderNumbers({ numbers }: { numbers: string[] }) {
  const [open, setOpen] = useState(false);
  if (!numbers.length) return <span className="text-muted-foreground">-</span>;
  const rest = numbers.length - ORDERS_SHOWN;
  if (rest <= 0 || open) {
    return (
      <span className={cn(WRAP, 'inline-block max-w-[16rem]')}>
        {numbers.join(', ')}
        {rest > 0 && (
          <button type="button" className="ml-1 text-xs text-primary hover:underline" onClick={() => setOpen(false)}>접기</button>
        )}
      </span>
    );
  }
  return (
    <span className="whitespace-nowrap" title={numbers.join(', ')}>
      {numbers.slice(0, ORDERS_SHOWN).join(', ')}
      <button type="button" className="ml-1 text-xs text-primary hover:underline" onClick={() => setOpen(true)}>외 {rest}건</button>
    </span>
  );
}

/** 출고시트 tab: sheets saved from 출고 등록, downloaded again exactly as they were saved. Loads on mount. */
export default function ShippingSheetList() {
  const { adminKey, logout } = useManageAuth();
  const [sheets, setSheets] = useState<SheetMeta[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SheetMeta | null>(null);

  const fail = useCallback((e: unknown, message: string) => {
    if (e instanceof SheetApiError && e.status === 401) { logout(); return; }
    toast.error(e instanceof SheetApiError && e.status === 404 ? '삭제되었거나 보관 기간이 지난 시트입니다.' : message,
      { position: 'top-center' });
  }, [logout]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSheets(await listSheets(adminKey));
    } catch (e) {
      fail(e, '출고시트 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [adminKey, fail]);

  useEffect(() => { load(); }, [load]);

  const download = async (s: SheetMeta) => {
    setBusyId(s.id);
    try {
      const { fileName, bytes } = await fetchSheetFile(adminKey, s.id);
      downloadBytes(bytes, fileName);
    } catch (e) {
      fail(e, '시트를 내려받지 못했습니다.');
      if (e instanceof SheetApiError && e.status === 404) load();
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (s: SheetMeta) => {
    setBusyId(s.id);
    try {
      await deleteSheet(adminKey, s.id);
      setSheets((prev) => prev?.filter((x) => x.id !== s.id) ?? null);
      toast.success('출고시트를 삭제했습니다.', { position: 'top-center' });
    } catch (e) {
      fail(e, '시트를 삭제하지 못했습니다.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          저장한 출고시트는 관리자만 볼 수 있으며, 저장 후 {SHEET_RETENTION_DAYS}일이 지나면 자동 삭제됩니다.
          다시 받으면 저장할 때의 엑셀이 그대로 내려받아집니다.
        </p>
        <Button variant="outline" size="sm" className="w-full md:w-auto" disabled={loading} onClick={load}>
          {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
          새로고침
        </Button>
      </div>

      <div className="bg-white border rounded-lg overflow-x-auto">
        <table className={cn(TABLE, 'grid-cols-[repeat(9,max-content)]')}>
          <thead className={GROUP}>
            <tr className={HEAD_ROW}>
              <th className={TH}>저장 일시</th>
              <th className={TH}>출고일자</th>
              <th className={TH}>주문번호</th>
              <th className={TH}>구분</th>
              <th className={cn(TH, NUM)}>수취인 수</th>
              <th className={cn(TH, NUM)}>상품 줄 수</th>
              <th className={TH}>다운로드</th>
              <th className={TH}>삭제</th>
              <th className={TH}>삭제 예정</th>
            </tr>
          </thead>
          <tbody className={GROUP}>
            {sheets?.map((s) => (
              <tr key={s.id} className={ROW}>
                <td className={TD}>{dateTime(s.savedAt)}</td>
                <td className={TD}>{monthDay(s.shipDate)}</td>
                <td className={TD}><OrderNumbers numbers={sheetOrderNumbers(s)} /></td>
                <td className={TD}>{kindLabel(s.kinds)}</td>
                <td className={cn(TD, NUM)}>{s.recipients}</td>
                <td className={cn(TD, NUM)}>{s.lines}</td>
                <td className={TD}>
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={busyId === s.id} onClick={() => download(s)}>
                    {busyId === s.id ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />}
                    다시 다운받기
                  </Button>
                </td>
                <td className={TD}>
                  <Button size="sm" variant="outline" className="h-7 w-7 p-0" aria-label="삭제" disabled={busyId === s.id}
                    onClick={() => setConfirmDelete(s)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </td>
                <td className={cn(TD, 'text-muted-foreground')}>{shortDate(s.expiresAt)}</td>
              </tr>
            ))}
            {sheets && !sheets.length && (
              <tr className={ROW}><td className={cn(FULL, 'text-sm text-muted-foreground')}>저장한 출고시트가 없습니다.</td></tr>
            )}
            {!sheets && loading && (
              <tr className={ROW}><td className={FULL}><Loader2 className="h-4 w-4 animate-spin inline" /></td></tr>
            )}
            {!sheets && !loading && (
              <tr className={ROW}><td className={cn(FULL, 'text-sm text-red-600')}>출고시트 목록을 불러오지 못했습니다 — 새로고침을 눌러 주세요.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <AlertDialog open={!!confirmDelete} onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>출고시트 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete && `${dateTime(confirmDelete.savedAt)}에 저장한 ${confirmDelete.shipDate} 출고시트(${shortOrderNumbers(confirmDelete)})를 삭제합니다. 삭제하면 되돌릴 수 없습니다.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (confirmDelete) remove(confirmDelete); }}>삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
