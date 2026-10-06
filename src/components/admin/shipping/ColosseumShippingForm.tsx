import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BatteryCharging, ChevronsUpDown, Download, Loader2, Plus, Search, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  TEMPLATE_URL, assignOrderNumbers, buildRows, buildWorkbook, detectCountry, downloadFileName,
  hasBattery, parseAddress, readCountries, searchableAddress, type Country, type Recipient,
} from './colosseum';
import { geocodeAddress } from './geocode';

type AutoField = 'countryCode' | 'city' | 'state' | 'zip';
/** parsed = taken from the address line, manual = typed by the user, geo = filled by address search. */
type Source = 'parsed' | 'manual' | 'geo' | 'notfound';

interface RecipientState extends Recipient {
  sources: Partial<Record<AutoField, Source>>;
  searching: boolean;
  resolvedAddress: string;
}

const AUTO_FIELDS: AutoField[] = ['countryCode', 'city', 'state', 'zip'];
const REQUIRED: (keyof Recipient)[] = ['name', 'phone', 'countryCode', 'address', 'city', 'state', 'zip', 'tracking'];

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

let seq = 0;
const newRecipient = (): RecipientState => ({
  id: `r${++seq}`,
  name: '', phone: '', countryCode: '', address: '', city: '', state: '', zip: '', tracking: '',
  products: [''],
  sources: {},
  searching: false,
  resolvedAddress: '',
});

const isMissing = (r: Recipient, f: keyof Recipient) =>
  f === 'products' ? !r.products.some((p) => p.trim()) : !String(r[f]).trim();

function fieldTone(source: Source | undefined, missing: boolean) {
  if (source === 'notfound' || missing) return 'border-red-500 bg-red-100 focus-visible:ring-red-500';
  if (source === 'geo') return 'border-yellow-500 bg-yellow-100 focus-visible:ring-yellow-500';
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
function ProductInput({ value, names, invalid, onChange }: {
  value: string; names: string[]; invalid: boolean; onChange: (v: string) => void;
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
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (!options.length) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (i + 1) % options.length); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (i <= 0 ? options.length - 1 : i - 1)); }
          else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); pick(options[active]); }
          else if (e.key === 'Escape') setOpen(false);
        }}
        className={cn(fieldTone(undefined, invalid))} />
      {options.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full max-h-64 overflow-auto rounded-md border bg-popover p-1 shadow-md">
          {options.map((name, i) => (
            <li key={name}
              // mousedown, not click: the pick must land before the input's blur closes the list.
              onMouseDown={(e) => { e.preventDefault(); pick(name); }}
              onMouseEnter={() => setActive(i)}
              className={cn('cursor-pointer rounded-sm px-2 py-1.5 text-sm flex items-center gap-1',
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
        <Command>
          <CommandInput placeholder="영문/한글 국가명 또는 코드 검색" />
          <CommandList>
            <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>
            <CommandGroup>
              {countries.map((c) => (
                <CommandItem key={c.code} value={`${c.en} ${c.ko} ${c.code}`}
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
  const [productNames, setProductNames] = useState<string[]>([]);
  const [recipients, setRecipients] = useState<RecipientState[]>(() => [newRecipient()]);
  const [showErrors, setShowErrors] = useState(false);
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
      .then((m) => { if (!cancelled) setProductNames(m.default.map((p) => p.name)); })
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
      return next;
    });
  };

  const setProduct = (id: string, index: number, value: string) => {
    patch(id, (r) => ({ ...r, products: r.products.map((p, i) => (i === index ? value : p)) }));
  };
  const addProduct = (id: string) => patch(id, (r) => ({ ...r, products: [...r.products, ''] }));
  const removeProduct = (id: string, index: number) => {
    patch(id, (r) => ({ ...r, products: r.products.filter((_, i) => i !== index) }));
  };

  /**
   * Fills country / city / state / zip from the address line, then looks up whatever is
   * still empty. Manual values are never overwritten; search results only fill empty fields.
   */
  const resolveAddress = useCallback(async (id: string, force = false) => {
    const current = recipientsRef.current.find((r) => r.id === id);
    if (!current) return;
    const address = current.address.trim();
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
    patch(id, (r) => ({
      ...r,
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
      return out;
    });
  }, [countries, patch]);

  const orders = useMemo(() => assignOrderNumbers(recipients, shipDate || todayIso()), [recipients, shipDate]);
  const rows = useMemo(() => buildRows(recipients, shipDate || todayIso()), [recipients, shipDate]);

  const problems = useMemo(() => {
    const list: string[] = [];
    if (!shipDate) list.push('출고일자');
    recipients.forEach((r, i) => {
      const miss = [...REQUIRED, 'products' as const].filter((f) => isMissing(r, f));
      if (miss.length) list.push(`수취인 #${i + 1}`);
    });
    return list;
  }, [recipients, shipDate]);

  const handleDownload = async () => {
    setShowErrors(true);
    if (problems.length || !template) {
      toast.error(`빈 필수 항목이 있습니다: ${problems.join(', ')}`, { position: 'top-center' });
      return;
    }
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
    } catch {
      toast.error('엑셀 생성에 실패했습니다.', { position: 'top-center' });
    } finally {
      setDownloading(false);
    }
  };

  if (loadError) {
    return <p className="text-sm text-red-600">양식 파일을 불러오지 못했습니다. 새로고침해 주세요.</p>;
  }

  const orderList = [...new Set(orders.values())];
  const firstOrder = orderList[0] ?? '-';
  const lastOrder = orderList[orderList.length - 1] ?? '-';

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">출고 기본정보</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="ship-date">출고일자</Label>
              <Input id="ship-date" type="date" value={shipDate} onChange={(e) => setShipDate(e.target.value)}
                className={cn(showErrors && !shipDate && fieldTone(undefined, true))} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>주문번호 미리보기</Label>
              <p className="h-10 flex items-center text-sm font-mono">
                {orderList.length > 1 ? `${firstOrder} ~ ${lastOrder} (${orderList.length}건)` : firstOrder}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {recipients.map((r, i) => {
        const err = (f: keyof Recipient) => showErrors && isMissing(r, f);
        const order = orders.get(r.id) ?? '';
        const sharedWith = recipients.findIndex((x) => orders.get(x.id) === order);
        return (
          <Card key={r.id}>
            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-semibold">
                수취인 #{i + 1}
                <span className="ml-2 font-mono text-xs text-muted-foreground">{order}</span>
                {sharedWith < i && (
                  <span className="ml-2 text-xs font-normal text-primary">수취인 #{sharedWith + 1}과 같은 이름 → 합포장</span>
                )}
              </CardTitle>
              <Button variant="ghost" size="sm" disabled={recipients.length === 1}
                onClick={() => setRecipients((prev) => prev.filter((x) => x.id !== r.id))}>
                <Trash2 className="h-4 w-4 mr-1" /> 삭제
              </Button>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>수취인 이름</Label>
                  <Input value={r.name} onChange={(e) => setField(r.id, 'name', e.target.value)}
                    className={cn(fieldTone(undefined, err('name')))} />
                </div>
                <div className="space-y-1.5">
                  <Label>전화번호</Label>
                  <Input value={r.phone} onChange={(e) => setField(r.id, 'phone', e.target.value)}
                    className={cn(fieldTone(undefined, err('phone')))} />
                </div>
                <div className="space-y-1.5">
                  <Label>국가 {r.countryCode && <span className="text-muted-foreground font-normal">· ISO {r.countryCode}</span>}</Label>
                  <CountryPicker countries={countries} value={r.countryCode}
                    tone={fieldTone(r.sources.countryCode, err('countryCode'))}
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
                    className={cn('flex-1', fieldTone(undefined, err('address')))} />
                  <Button variant="outline" className="w-full md:w-auto" disabled={!r.address.trim() || r.searching}
                    onClick={() => resolveAddress(r.id, true)}>
                    {r.searching ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Search className="h-4 w-4 mr-1" />}
                    {r.searching ? '검색 중' : '주소로 다시 채우기'}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  입력칸을 벗어나면 도시·주·우편번호·국가를 주소에서 추출하고, 못 찾은 칸만 검색합니다 (싱가포르: OneMap → OpenStreetMap, 그 외: OpenStreetMap).
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(['city', 'state', 'zip'] as const).map((f) => (
                  <div key={f} className="space-y-1.5">
                    <Label>{f === 'city' ? '도시' : f === 'state' ? '주' : '우편번호'}</Label>
                    <Input value={r[f]} onChange={(e) => setField(r.id, f, e.target.value)}
                      className={cn(fieldTone(r.sources[f], err(f)))} />
                    <FieldHint source={r.sources[f]} />
                  </div>
                ))}
              </div>

              <div className="space-y-1.5">
                <Label>상품</Label>
                <div className="flex flex-col gap-2">
                  {r.products.map((p, pi) => (
                    <div key={pi} className="flex items-center gap-2">
                      <ProductInput value={p} names={productNames} invalid={err('products') && !p.trim()}
                        onChange={(v) => setProduct(r.id, pi, v)} />
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
                  onChange={(e) => setField(r.id, 'tracking', e.target.value)}
                  className={cn(fieldTone(undefined, err('tracking')))} />
              </div>
            </CardContent>
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
                  <TableHead>국가</TableHead>
                  <TableHead>도시 / 주 / 우편번호</TableHead>
                  <TableHead>비고</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs whitespace-nowrap">{row.D}</TableCell>
                    <TableCell className="text-xs">{row.J}</TableCell>
                    <TableCell className="text-xs">{row.R}</TableCell>
                    <TableCell className="text-xs">{row.AA}</TableCell>
                    <TableCell className="text-xs">{[row.Y, row.Z, row.AB].join(' / ')}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{row.AT}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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
