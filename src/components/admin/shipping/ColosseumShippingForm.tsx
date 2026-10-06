import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertCircle, BatteryCharging, CheckCircle2, ChevronDown, ChevronsUpDown, ClipboardPaste, Download, FileSpreadsheet, Loader2,
  Plus, Search,
  Trash2, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  ORDER_START, TEMPLATE_URL, assignOrderNumbers, orderDatePrefix, orderNumber, buildRows, buildWorkbook, detectCountry, downloadFileName, extractPostal, findCountry,
  hasBattery, parseAddress, titleCaseIfAllCaps, readCountries, searchableAddress, type Country, type Recipient,
} from './colosseum';
import { geocodeAddress } from './geocode';
import { parseSurveyPaste } from './surveyPaste';
import { normalizePhone } from './phone';
import { parseShopifyOrders, readShopifyRows } from './shopifyOrders';
import { orderToCardFields } from './orderCards';

type AutoField = 'countryCode' | 'city' | 'state' | 'zip';
/** parsed = taken from the address line, manual = typed by the user, geo = filled by address search. */
type Source = 'parsed' | 'manual' | 'geo' | 'notfound';

interface RecipientState extends Recipient {
  sources: Partial<Record<AutoField, Source>>;
  searching: boolean;
  resolvedAddress: string;
  collapsed: boolean;
}

const AUTO_FIELDS: AutoField[] = ['countryCode', 'city', 'state', 'zip'];
/** Fields that must be filled before download, with the label shown in "미입력: ..." badges. */
const REQUIRED_FIELDS: { field: keyof Recipient; label: string }[] = [
  { field: 'name', label: '이름' },
  { field: 'phone', label: '전화번호' },
  { field: 'countryCode', label: '국가' },
  { field: 'address', label: '주소' },
  { field: 'city', label: '도시' },
  { field: 'zip', label: '우편번호' },
  { field: 'products', label: '상품' },
  { field: 'tracking', label: '송장번호' },
];

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Phone in "+<calling code> <digits>" form once the country is known; untouched otherwise. */
const withPhone = <T extends Recipient>(r: T): T => {
  if (!r.phone.trim() || !r.countryCode) return r;
  const phone = normalizePhone(r.phone, r.countryCode).value;
  return phone === r.phone ? r : { ...r, phone };
};

// Last seeding order number downloaded per ship date, so a second shipment on the same day
// continues the sequence. Browser-only convenience: storage may be unavailable.
const lastOrderKey = (date: string) => `colosseum-last-order:${orderDatePrefix(date)}`;
const readLastOrder = (date: string): number | null => {
  try {
    const v = Number.parseInt(localStorage.getItem(lastOrderKey(date)) ?? '', 10);
    return Number.isFinite(v) ? v : null;
  } catch { return null; }
};
const saveLastOrder = (date: string, last: number) => {
  try {
    const prev = readLastOrder(date);
    if (prev === null || last > prev) localStorage.setItem(lastOrderKey(date), String(last));
  } catch { /* storage unavailable: nothing to remember */ }
};
const suggestedStart = (date: string) => {
  const last = readLastOrder(date);
  return String(last === null ? ORDER_START : last + 1);
};

let seq = 0;
const newRecipient = (): RecipientState => ({
  // Time-based prefix keeps ids unique even if this module is reloaded (dev hot reload resets seq).
  id: `r${Date.now().toString(36)}-${++seq}`,
  name: '', phone: '', countryCode: '', address: '', city: '', state: '', zip: '', tracking: '',
  products: [''],
  sources: {},
  searching: false,
  resolvedAddress: '',
  collapsed: false,
});

const isMissing = (r: Recipient, f: keyof Recipient) =>
  f === 'products' ? !r.products.some((p) => p.trim()) : !String(r[f]).trim();

/** A card nothing has been typed into yet: still being written, so no "미입력" marks. */
const isBlankRecipient = (r: Recipient) =>
  !r.name.trim() && !r.phone.trim() && !r.address.trim() && !r.countryCode && !r.tracking.trim()
  && !r.products.some((p) => p.trim());

const missingLabels = (r: Recipient) => REQUIRED_FIELDS.filter((f) => isMissing(r, f.field)).map((f) => f.label);

/** Border color only reflects the address search: yellow = filled by search, red = search found nothing. */
function fieldTone(source: Source | undefined) {
  if (source === 'notfound') return 'border-red-500 focus-visible:ring-red-500';
  if (source === 'geo') return 'border-yellow-500 focus-visible:ring-yellow-500';
  return '';
}

function FieldHint({ source }: { source: Source | undefined }) {
  if (source === 'geo') return <p className="text-[11px] text-yellow-700 mt-1">자동 검색값 - 확인 필요</p>;
  if (source === 'notfound') return <p className="text-[11px] text-red-600 mt-1">검색 결과 없음 - 직접 입력</p>;
  return null;
}

/** Products whose name contains every typed word, names starting with the query first. */
function suggest(names: string[], query: string, limit = 8): string[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const words = q.split(/\s+/);
  return names
    .filter((n) => { const l = n.toLowerCase(); return l !== q && words.every((w) => l.includes(w)); })
    .sort((a, b) => Number(!a.toLowerCase().startsWith(q)) - Number(!b.toLowerCase().startsWith(q)) || a.length - b.length)
    .slice(0, limit);
}

/** Free-text product name with suggestions from the product list; any name may be typed. */
function ProductInput({ value, names, onChange }: {
  value: string; names: string[]; onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const options = useMemo(() => (open ? suggest(names, value) : []), [open, names, value]);

  const pick = (name: string) => { onChange(name); setOpen(false); setActive(-1); };

  return (
    <div className="relative flex-1">
      <Input value={value} placeholder="상품명 (영문) 입력 — 비슷한 상품이 아래에 표시됩니다"
        onChange={(e) => { onChange(e.target.value); setOpen(true); setActive(-1); }}
        onFocus={() => setOpen(true)}
        onBlur={() => { setOpen(false); setActive(-1); }}
        onKeyDown={(e) => {
          // Enter keeps the typed text as-is unless a suggestion was chosen with the arrow keys.
          if (e.key === 'Enter') {
            e.preventDefault();
            if (active >= 0 && options[active]) pick(options[active]);
            else { setOpen(false); setActive(-1); }
            return;
          }
          if (e.key === 'Escape') { setOpen(false); setActive(-1); return; }
          if (!options.length) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (i + 1) % options.length); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (i <= 0 ? options.length - 1 : i - 1)); }
        }} />
      {options.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full max-h-64 overflow-auto rounded-md border bg-popover p-1 shadow-md">
          {options.map((name, i) => (
            <li key={name}
              // mousedown, not click: the pick must land before the input's blur closes the list.
              onMouseDown={(e) => { e.preventDefault(); pick(name); }}
              // Hover only highlights visually; it must not arm Enter (that would replace typed text).
              className={cn('cursor-pointer rounded-sm px-2 py-1.5 text-sm flex items-center gap-1 hover:bg-accent/60',
                i === active && 'bg-accent text-accent-foreground')}>
              <span className="flex-1">{name}</span>
              {hasBattery(name) && <BatteryCharging className="h-3.5 w-3.5 text-primary shrink-0" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Country search: whole-name / prefix matches on any name, code or alias first
 * ("usa", "US", "미국" → United States), then names merely containing the text.
 */
function countryFilter(value: string, search: string): number {
  const q = search.trim().toLowerCase();
  if (!q) return 1;
  const names = value.toLowerCase().split('|');
  if (names.some((n) => n === q)) return 1;
  if (names.some((n) => n.startsWith(q))) return 0.8;
  if (names.some((n) => n.split(/[\s,()-]+/).some((w) => w.startsWith(q)))) return 0.6;
  return names.some((n) => n.includes(q)) ? 0.3 : 0;
}

function CountryPicker({ countries, value, tone, onChange }: {
  countries: Country[]; value: string; tone: string; onChange: (code: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = countries.find((c) => c.code === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open}
          className={cn('w-full justify-between font-normal', tone)}>
          {selected ? `${selected.en} (${selected.ko})` : '국가 선택'}
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[320px] p-0" align="start">
        <Command filter={countryFilter}>
          <CommandInput placeholder="영문/한글 국가명 또는 코드 검색" />
          <CommandList>
            <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>
            <CommandGroup>
              {countries.map((c) => (
                <CommandItem key={c.code} value={[c.en, c.ko, c.code, ...(c.aliases ?? [])].join('|')}
                  onSelect={() => { onChange(c.code); setOpen(false); }}>
                  <span className="w-8 text-xs text-muted-foreground">{c.code}</span>
                  {c.en} <span className="ml-1 text-muted-foreground">({c.ko})</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function ColosseumShippingForm() {
  const [template, setTemplate] = useState<ArrayBuffer | null>(null);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [shipDate, setShipDate] = useState(todayIso);
  // Seeding order number start (YYMMDD-<start>); filled from the last download of that date
  // until the user types a value.
  const [startNo, setStartNo] = useState(() => suggestedStart(todayIso()));
  const [startEdited, setStartEdited] = useState(false);
  const startNumber = Number.parseInt(startNo, 10);
  const start = Number.isFinite(startNumber) ? startNumber : ORDER_START;

  useEffect(() => {
    if (!startEdited && shipDate) setStartNo(suggestedStart(shipDate));
  }, [shipDate, startEdited]);
  const [products, setProducts] = useState<{ name: string; hs: string }[]>([]);
  const productNames = useMemo(() => products.map((p) => p.name), [products]);
  const [recipients, setRecipients] = useState<RecipientState[]>(() => [newRecipient()]);
  const [showMissingNotice, setShowMissingNotice] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const orderFileInput = useRef<HTMLInputElement>(null);
  const [importingOrders, setImportingOrders] = useState(false);
  // Recipients added by bulk paste whose address still has to be resolved (after render).
  const pendingResolve = useRef<string[]>([]);
  const [downloading, setDownloading] = useState(false);

  // Latest state for async address resolution.
  const recipientsRef = useRef(recipients);
  recipientsRef.current = recipients;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(TEMPLATE_URL);
        if (!res.ok) throw new Error(String(res.status));
        const buf = await res.arrayBuffer();
        const XLSX = await import('xlsx');
        if (cancelled) return;
        setTemplate(buf);
        setCountries(readCountries(XLSX, buf));
      } catch {
        if (!cancelled) setLoadError(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Product suggestions are loaded on demand to keep them out of the main bundle.
  useEffect(() => {
    let cancelled = false;
    import('./shipping-products.json')
      .then((m) => { if (!cancelled) setProducts(m.default); })
      .catch(() => { /* suggestions are optional; free text still works */ });
    return () => { cancelled = true; };
  }, []);

  const patch = useCallback((id: string, fn: (r: RecipientState) => RecipientState) => {
    setRecipients((prev) => prev.map((r) => (r.id === id ? fn(r) : r)));
  }, []);

  const setField = (id: string, field: keyof Recipient, value: string) => {
    patch(id, (r) => {
      const next = { ...r, [field]: value };
      if ((AUTO_FIELDS as string[]).includes(field)) {
        next.sources = { ...r.sources, [field]: value.trim() ? 'manual' : undefined };
      }
      // A newly chosen country completes a phone typed without its calling code.
      return field === 'countryCode' ? withPhone(next) : next;
    });
  };

  const setProduct = (id: string, index: number, value: string) => {
    patch(id, (r) => ({ ...r, products: r.products.map((p, i) => (i === index ? value : p)) }));
  };
  // Order cards keep quantity / unit price per product line, so they move with the product list.
  const addProduct = (id: string) => patch(id, (r) => ({
    ...r,
    products: [...r.products, ''],
    order: r.order && { ...r.order, qtys: [...r.order.qtys, 1], prices: [...r.order.prices, ''] },
  }));
  const removeProduct = (id: string, index: number) => {
    patch(id, (r) => ({
      ...r,
      products: r.products.filter((_, i) => i !== index),
      order: r.order && {
        ...r.order,
        qtys: r.order.qtys.filter((_, i) => i !== index),
        prices: r.order.prices.filter((_, i) => i !== index),
      },
    }));
  };

  /**
   * Fills country / city / state / zip from the address line, then looks up whatever is
   * still empty. Manual values are never overwritten; search results only fill empty fields.
   */
  const resolveAddress = useCallback(async (id: string, force = false) => {
    const current = recipientsRef.current.find((r) => r.id === id);
    if (!current) return;
    // ALL-CAPS addresses are shown in normal capitalisation (codes like HK / CA / 1/F kept).
    const address = titleCaseIfAllCaps(current.address.trim(), current.countryCode);
    if (!address || (!force && address === current.resolvedAddress)) return;

    const next: RecipientState = { ...current, sources: { ...current.sources }, resolvedAddress: address };
    // Clear earlier automatic values so a changed address doesn't keep stale data.
    for (const f of AUTO_FIELDS) {
      if (next.sources[f] && next.sources[f] !== 'manual') {
        next[f] = '';
        next.sources[f] = undefined;
      }
    }
    if (!next.countryCode) {
      const found = detectCountry(address, countries);
      if (found) { next.countryCode = found.code; next.sources.countryCode = 'parsed'; }
    }
    const parsed = parseAddress(address, countries.find((c) => c.code === next.countryCode));
    for (const f of ['city', 'state', 'zip'] as const) {
      if (!next[f] && parsed[f]) { next[f] = parsed[f]; next.sources[f] = 'parsed'; }
    }
    patch(id, (r) => withPhone({
      ...r,
      address,
      countryCode: next.countryCode, city: next.city, state: next.state, zip: next.zip,
      sources: next.sources, resolvedAddress: address,
    }));

    const missing = AUTO_FIELDS.filter((f) => !next[f]);
    if (missing.length === 0) return;

    patch(id, (r) => ({ ...r, searching: true }));
    let geo: Awaited<ReturnType<typeof geocodeAddress>> = null;
    try {
      geo = await geocodeAddress(searchableAddress(address, next.countryCode), next.countryCode || undefined);
    } catch {
      toast.error('주소 검색에 실패했습니다. 직접 입력해 주세요.', { position: 'top-center' });
    }
    const known = new Set(countries.map((c) => c.code));
    patch(id, (r) => {
      // The address changed while searching: drop this result.
      if (r.address.trim() !== address) return { ...r, searching: false };
      const out: RecipientState = { ...r, searching: false, sources: { ...r.sources } };
      // City-states come back without a state: mirror the city, as on the original sheet.
      const geoState = geo && !geo.state ? geo.city : geo?.state ?? '';
      for (const f of missing) {
        if (out[f]) continue; // filled by hand meanwhile
        const raw = f === 'state' ? geoState : geo?.[f] ?? '';
        const value = raw && (f !== 'countryCode' || known.has(raw)) ? raw : '';
        if (value) { out[f] = value; out.sources[f] = 'geo'; } else { out.sources[f] = 'notfound'; }
      }
      // Once the country is known, a postal code written in the address beats the
      // search result (map data is often a neighbouring code).
      if (missing.includes('zip') && out.sources.zip !== 'manual' && out.countryCode) {
        const written = extractPostal(address, out.countryCode);
        if (written) { out.zip = written.zip; out.sources.zip = 'parsed'; }
      }
      return withPhone(out);
    });
  }, [countries, patch]);

  useEffect(() => {
    if (!pendingResolve.current.length) return;
    const ids = pendingResolve.current;
    pendingResolve.current = [];
    // Lookups are queued inside geocode (1 req/s), so firing them all here is safe.
    ids.forEach((id) => { void resolveAddress(id); });
  }, [recipients, resolveAddress]);


  /** Shopify "Export orders" file → one collapsed card per order, read in the browser only. */
  const handleOrderFile = async (file: File | undefined) => {
    if (!file) return;
    setImportingOrders(true);
    try {
      const XLSX = await import('xlsx');
      const orders = parseShopifyOrders(readShopifyRows(XLSX, { name: file.name, data: await file.arrayBuffer() }));
      if (!orders.length) {
        toast.error('파일에서 주문을 찾지 못했습니다.', { position: 'top-center' });
        return;
      }
      const unmatched: string[] = [];
      const added = orders.map((o) => {
        const { fields, country } = orderToCardFields(o, countries);
        if (!country) unmatched.push(`${o.number} (${o.country || '국가 없음'})`);
        const given = (v: string) => (v ? 'manual' as const : undefined);
        return {
          ...newRecipient(),
          ...fields,
          // Shopify already split the address: no extraction / search for these cards.
          sources: {
            countryCode: country ? 'manual' as const : undefined,
            city: given(fields.city), state: given(fields.state), zip: given(fields.zip),
          },
          resolvedAddress: fields.address,
          collapsed: true,
        };
      });
      setRecipients((prev) => [...prev.filter((r) => !isBlankRecipient(r)), ...added]);
      toast.success(`주문 ${added.length}건을 등록했습니다.`, { position: 'top-center' });
      if (unmatched.length) {
        toast.error(`국가를 찾지 못했습니다: ${unmatched.join(', ')} — 직접 선택해 주세요.`, { position: 'top-center' });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '주문서를 읽지 못했습니다.', { position: 'top-center' });
    } finally {
      setImportingOrders(false);
      if (orderFileInput.current) orderFileInput.current.value = '';
    }
  };

  const handleBulkAdd = () => {
    const { rows: parsed } = parseSurveyPaste(pasteText);
    if (!parsed.length) {
      toast.error('붙여넣은 내용에서 수취인을 찾지 못했습니다.', { position: 'top-center' });
      return;
    }
    const unmatched: string[] = [];
    const added = parsed.map((row) => {
      const r = newRecipient();
      const country = findCountry(row.country, countries);
      if (row.country && !country) unmatched.push(row.country);
      return withPhone({
        ...r,
        name: titleCaseIfAllCaps(row.name),
        phone: row.phone,
        address: titleCaseIfAllCaps(row.address, country?.code),
        countryCode: country?.code ?? '',
        collapsed: true,
        // The survey's country is the customer's own answer: keep it like a manual value.
        sources: country ? { countryCode: 'manual' as const } : {},
      });
    });
    pendingResolve.current.push(...added.filter((r) => r.address).map((r) => r.id));
    // Replace the untouched starter card instead of leaving it empty at the top.
    setRecipients((prev) => [...prev.filter((r) => !isBlankRecipient(r)), ...added]);
    setPasteText('');
    toast.success(`수취인 ${added.length}명을 추가했습니다.`, { position: 'top-center' });
    if (unmatched.length) {
      toast.error(`국가를 찾지 못했습니다: ${[...new Set(unmatched)].join(', ')} — 직접 선택해 주세요.`, { position: 'top-center' });
    }
  };

  const orders = useMemo(() => assignOrderNumbers(recipients, shipDate || todayIso(), start), [recipients, shipDate, start]);
  const rows = useMemo(
    () => buildRows(recipients, shipDate || todayIso(), countries, start),
    [recipients, shipDate, countries, start],
  );
  // Seeding numbers only: Shopify order cards keep their own #numbers.
  const seedingOrders = useMemo(
    () => [...new Set(recipients.filter((r) => !r.order).map((r) => orders.get(r.id) ?? ''))].filter(Boolean),
    [recipients, orders],
  );
  const shopifyOrderCount = recipients.filter((r) => r.order).length;

  const incomplete = useMemo(
    () => recipients
      .map((r, i) => ({ id: r.id, index: i, labels: missingLabels(r) }))
      .filter((x) => x.labels.length > 0),
    [recipients],
  );

  const incompleteShown = incomplete.filter((x) => !isBlankRecipient(recipients[x.index]));

  const setAllCollapsed = (collapsed: boolean) => setRecipients((prev) => prev.map((r) => ({ ...r, collapsed })));
  const toggleCollapsed = (id: string) => patch(id, (r) => ({ ...r, collapsed: !r.collapsed }));

  /** Opens a recipient card and scrolls it into view. */
  const goToRecipient = (id: string) => {
    patch(id, (r) => ({ ...r, collapsed: false }));
    requestAnimationFrame(() => {
      document.getElementById(`recipient-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const handleDownload = async () => {
    if (!shipDate) {
      toast.error('출고일자를 입력해 주세요.', { position: 'top-center' });
      return;
    }
    if (incomplete.length) {
      setShowMissingNotice(true);
      toast.error(`${incomplete.length}명 미입력 — 아래 목록에서 눌러 이동하세요.`, { position: 'top-center' });
      return;
    }
    if (!template) return;
    setDownloading(true);
    try {
      const XLSX = await import('xlsx');
      const bytes = buildWorkbook(XLSX, template, rows);
      const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = downloadFileName();
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      if (seedingOrders.length) saveLastOrder(shipDate, start + seedingOrders.length - 1);
    } catch {
      toast.error('엑셀 생성에 실패했습니다.', { position: 'top-center' });
    } finally {
      setDownloading(false);
    }
  };

  if (loadError) {
    return <p className="text-sm text-red-600">양식 파일을 불러오지 못했습니다. 새로고침해 주세요.</p>;
  }

  const firstOrder = seedingOrders[0] ?? orderNumber(shipDate || todayIso(), 0, start);
  const lastOrder = seedingOrders[seedingOrders.length - 1] ?? firstOrder;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">붙여넣기</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <Textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={4}
            placeholder="구글 시트에서 설문 응답 행을 복사해 붙여넣으세요 (헤더 줄 포함 가능). 한 줄당 수취인 1명이 추가됩니다."
            className="font-mono text-xs" />
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <p className="text-[11px] text-muted-foreground">
              일괄 등록: 설문 응답의 이름·전화번호·국가·주소만 채웁니다. 주문서 등록: Shopify 주문 내보내기 파일(.csv/.xlsx)로 주문별 카드를 만듭니다. 송장번호는 직접 입력해 주세요.
            </p>
            <div className="flex flex-col md:flex-row gap-2">
              <input ref={orderFileInput} type="file" accept=".csv,.xlsx" className="hidden"
                onChange={(e) => handleOrderFile(e.target.files?.[0])} />
              <Button className="w-full md:w-auto bg-green-600 text-white hover:bg-green-700"
                disabled={!countries.length || importingOrders} onClick={() => orderFileInput.current?.click()}>
                {importingOrders ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-1" />}
                주문서 등록
              </Button>
              <Button className="w-full md:w-auto" disabled={!pasteText.trim() || !countries.length} onClick={handleBulkAdd}>
                <ClipboardPaste className="h-4 w-4 mr-1" /> 일괄 등록
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">출고 기본정보</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="ship-date">출고일자</Label>
              <Input id="ship-date" type="date" value={shipDate} onChange={(e) => setShipDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="start-no">시작 번호</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono text-muted-foreground">{orderDatePrefix(shipDate || todayIso())}-</span>
                <Input id="start-no" inputMode="numeric" value={startNo} placeholder={String(ORDER_START)}
                  onChange={(e) => { setStartNo(e.target.value.replace(/\D/g, '')); setStartEdited(true); }} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>주문번호 미리보기</Label>
              <p className="min-h-10 flex flex-wrap items-center gap-x-2 text-sm font-mono">
                <span>{seedingOrders.length > 1 ? `${firstOrder} ~ ${lastOrder} (${seedingOrders.length}건)` : firstOrder}</span>
                {shopifyOrderCount > 0 && (
                  <span className="font-sans text-xs text-muted-foreground">· Shopify 주문 {shopifyOrderCount}건은 자체 번호</span>
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <p className="text-sm font-semibold">
          수취인 {recipients.length}명
          {incompleteShown.length > 0 && (
            <span className="ml-2 text-xs font-normal text-red-600">미입력 {incompleteShown.length}명</span>
          )}
          {incomplete.length === 0 && <span className="ml-2 text-xs font-normal text-green-700">모두 입력됨</span>}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1 md:flex-none" onClick={() => setAllCollapsed(true)}>모두 접기</Button>
          <Button variant="outline" size="sm" className="flex-1 md:flex-none" onClick={() => setAllCollapsed(false)}>모두 펼치기</Button>
        </div>
      </div>

      {recipients.map((r, i) => {
        const order = orders.get(r.id) ?? '';
        const sharedWith = recipients.findIndex((x) => orders.get(x.id) === order);
        const missing = missingLabels(r);
        const blank = isBlankRecipient(r);
        const productCount = r.products.filter((p) => p.trim()).length;
        const countryName = countries.find((c) => c.code === r.countryCode)?.en;
        // Calling code that doesn't belong to the selected country (e.g. +62 number, Singapore selected).
        const phoneMismatch = normalizePhone(r.phone, r.countryCode).mismatch;
        return (
          <Card key={r.id} id={`recipient-${r.id}`}
            className={cn('scroll-mt-4', r.collapsed && !blank && missing.length > 0 && 'border-red-200')}>
            <CardHeader role="button" tabIndex={0} aria-expanded={!r.collapsed}
              onClick={() => toggleCollapsed(r.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleCollapsed(r.id); } }}
              className={cn('flex flex-row items-center justify-between gap-2 space-y-0 cursor-pointer select-none',
                r.collapsed ? 'py-3' : 'pb-3')}>
              <div className="min-w-0 flex-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', r.collapsed && '-rotate-90')} />
                <span className="font-semibold">수취인 #{i + 1}</span>
                <span className="font-mono text-xs text-muted-foreground">{order}</span>
                {/* Shipment type: decides the sheet's recipient email (시딩 → zoey@, 주문 → suejoo@). */}
                {r.order ? (
                  <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-800">
                    주문{r.order.b2b ? ' · B2B' : ''}
                  </span>
                ) : (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">시딩</span>
                )}
                {r.collapsed ? (
                  // One-line summary: 이름 · 국가 · 상품 N개 · 송장번호
                  <span className="text-xs text-muted-foreground truncate">
                    · {r.name.trim() || '이름 없음'} · {countryName ?? (r.countryCode || '국가 없음')}
                    {' '}· 상품 {productCount}개 · {r.tracking.trim() || '송장번호 없음'}
                  </span>
                ) : !r.order && sharedWith < i && (
                  <span className="text-xs text-primary">수취인 #{sharedWith + 1}과 같은 이름 → 합포장</span>
                )}
                {blank ? null : missing.length > 0 ? (
                  <span className="text-xs text-red-600" title={missing.join(', ')}>미입력 {missing.length}</span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
                    <CheckCircle2 className="h-4 w-4" /> 입력 완료
                  </span>
                )}
                {r.searching && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
              </div>
              <Button variant="ghost" size="sm" disabled={recipients.length === 1}
                onClick={(e) => { e.stopPropagation(); setRecipients((prev) => prev.filter((x) => x.id !== r.id)); }}>
                <Trash2 className="h-4 w-4 mr-1" /> 삭제
              </Button>
            </CardHeader>
            {!r.collapsed && (
            <CardContent className="pt-0 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>수취인 이름</Label>
                  <Input value={r.name} onChange={(e) => setField(r.id, 'name', e.target.value)}
                    onBlur={() => patch(r.id, (x) => ({ ...x, name: titleCaseIfAllCaps(x.name.trim()) }))}
                    className={cn(r.order?.nameAmbiguous && 'border-yellow-500 focus-visible:ring-yellow-500')} />
                  {r.order?.nameAmbiguous && <p className="text-[11px] text-yellow-700 mt-1">이름/성 순서 확인 필요</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>전화번호</Label>
                  <Input value={r.phone} onChange={(e) => setField(r.id, 'phone', e.target.value)}
                    onBlur={() => patch(r.id, withPhone)}
                    className={cn(phoneMismatch && 'border-yellow-500 focus-visible:ring-yellow-500')} />
                  {phoneMismatch && <p className="text-[11px] text-yellow-700 mt-1">국가번호 확인 필요</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>국가 {r.countryCode && <span className="text-muted-foreground font-normal">· ISO {r.countryCode}</span>}</Label>
                  <CountryPicker countries={countries} value={r.countryCode}
                    tone={fieldTone(r.sources.countryCode)}
                    onChange={(code) => setField(r.id, 'countryCode', code)} />
                  <FieldHint source={r.sources.countryCode} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>전체 주소 (한 줄로 붙여넣기)</Label>
                <div className="flex flex-col md:flex-row gap-2">
                  <Input value={r.address} placeholder="예: 123 Main St, Apt 4, Springfield, IL 62704, USA"
                    onChange={(e) => setField(r.id, 'address', e.target.value)}
                    onBlur={() => resolveAddress(r.id)}
                    className={cn('flex-1', r.order?.droppedAddress2 && 'border-yellow-500 focus-visible:ring-yellow-500')} />
                  <Button variant="outline" className="w-full md:w-auto" disabled={!r.address.trim() || r.searching}
                    onClick={() => resolveAddress(r.id, true)}>
                    {r.searching ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Search className="h-4 w-4 mr-1" />}
                    {r.searching ? '검색 중' : '주소로 다시 채우기'}
                  </Button>
                </div>
                {r.order?.droppedAddress2 && (
                  <p className="text-[11px] text-yellow-700">
                    주소2 "{r.order.droppedAddress2}"는 숫자만 있어 주소에서 뺐습니다 — 확인 필요
                  </p>
                )}
                <p className="text-[11px] text-muted-foreground">
                  입력칸을 벗어나면 도시·주·우편번호·국가를 주소에서 추출하고, 못 찾은 칸만 검색합니다 (싱가포르: OneMap → OpenStreetMap, 그 외: OpenStreetMap).
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(['city', 'state', 'zip'] as const).map((f) => (
                  <div key={f} className="space-y-1.5">
                    <Label>{f === 'city' ? '도시' : f === 'state' ? '주' : '우편번호'}</Label>
                    <Input value={r[f]} onChange={(e) => setField(r.id, f, e.target.value)}
                      onBlur={f === 'city'
                        ? () => patch(r.id, (x) => ({ ...x, city: titleCaseIfAllCaps(x.city.trim(), x.countryCode) }))
                        : undefined}
                      className={cn(fieldTone(r.sources[f]))} />
                    <FieldHint source={r.sources[f]} />
                  </div>
                ))}
              </div>

              <div className="space-y-1.5">
                <Label>상품</Label>
                <div className="flex flex-col gap-2">
                  {r.products.map((p, pi) => (
                    <div key={pi} className="flex items-center gap-2">
                      <ProductInput value={p} names={productNames}
                        onChange={(v) => setProduct(r.id, pi, v)} />
                      {r.order && (
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          × {r.order.qtys[pi] ?? 1}{r.order.prices[pi] ? ` · ${r.order.currency || 'USD'} ${r.order.prices[pi]}` : ''}
                        </span>
                      )}
                      {hasBattery(p) && (
                        <span className="hidden md:inline-flex items-center gap-0.5 text-xs text-primary whitespace-nowrap">
                          <BatteryCharging className="h-3.5 w-3.5" /> 배터리 포함
                        </span>
                      )}
                      <Button variant="ghost" size="icon" aria-label="상품 삭제" disabled={r.products.length === 1}
                        onClick={() => removeProduct(r.id, pi)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="w-full md:w-fit" onClick={() => addProduct(r.id)}>
                    <Plus className="h-4 w-4 mr-1" /> 상품 추가
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5 md:w-1/3">
                <Label>송장번호</Label>
                <Input value={r.tracking} placeholder="예: 5227-3375-2663"
                  onChange={(e) => setField(r.id, 'tracking', e.target.value)} />
              </div>
            </CardContent>
            )}
          </Card>
        );
      })}

      <Button variant="outline" className="w-full" onClick={() => setRecipients((prev) => [...prev, newRecipient()])}>
        <Plus className="h-4 w-4 mr-1" /> 수취인 추가
      </Button>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">
            미리보기 <span className="font-normal text-muted-foreground">· 수취인 {recipients.length}명 / 엑셀 {rows.length}줄</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 overflow-x-auto">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">상품을 입력하면 엑셀에 들어갈 줄이 표시됩니다.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>주문번호</TableHead>
                  <TableHead>상품명</TableHead>
                  <TableHead>수취인</TableHead>
                  <TableHead>주소</TableHead>
                  <TableHead>비고</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs whitespace-nowrap">{row.D}</TableCell>
                    <TableCell className="text-xs">{row.J}</TableCell>
                    <TableCell className="text-xs">{row.R}</TableCell>
                    {/* Exactly what goes into column W; long addresses wrap. */}
                    <TableCell className="text-xs whitespace-normal break-words min-w-[220px]">{row.W}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{row.AT}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {showMissingNotice && incomplete.length > 0 && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 space-y-2">
          <p className="text-sm font-semibold text-red-700 flex items-center gap-1">
            <AlertCircle className="h-4 w-4" /> {incomplete.length}명 미입력 — 눌러서 해당 카드로 이동
          </p>
          <div className="flex flex-wrap gap-2">
            {incomplete.map((x) => (
              <Button key={x.id} variant="outline" size="sm" className="h-auto py-1 border-red-300 text-left whitespace-normal"
                onClick={() => goToRecipient(x.id)}>
                수취인 #{x.index + 1} · {x.labels.join(', ')}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center md:justify-end gap-2">
        <p className="text-xs text-muted-foreground">입력한 정보는 서버에 저장되지 않으며 새로고침하면 사라집니다.</p>
        <Button className="w-full md:w-auto" disabled={!template || downloading} onClick={handleDownload}>
          {downloading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
          엑셀 다운로드
        </Button>
      </div>
    </div>
  );
}
