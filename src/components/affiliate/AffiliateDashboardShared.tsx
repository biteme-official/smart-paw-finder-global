import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format, isValid, parseISO } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { ChevronDown, Calendar as CalendarIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { toast } from 'sonner';
import { isLoggedIn as isCustomerLoggedIn } from '@/lib/customer-auth';
import { fetchCustomerAccount } from '@/lib/customer-account';
import { isDevPreviewActive, DEV_PREVIEW_CUSTOMER } from '@/lib/dev-preview';

// Shared building blocks for My Page > Affiliate and its sub pages
// (All links, Shared products).

export function Thumbnail({ image, alt, loading, className }: { image?: string; alt: string; loading: boolean; className?: string }) {
  if (loading) return <Skeleton className={className} />;
  if (image) return <img src={image} alt={alt} className={`${className} object-cover`} />;
  return (
    <div className={`${className} flex items-center justify-center bg-secondary text-muted-foreground text-[10px]`}>
      No Image
    </div>
  );
}

/** Redirects to /mypage (login) unless a customer session or dev preview is active. */
export function useAffiliateCustomer(returnTo: string) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState<string | undefined>();

  useEffect(() => {
    if (isDevPreviewActive()) {
      setDisplayName(DEV_PREVIEW_CUSTOMER.displayName);
      setLoading(false);
      return;
    }
    if (!isCustomerLoggedIn()) {
      navigate('/mypage', { state: { returnTo } });
      return;
    }
    fetchCustomerAccount()
      .then((data) => {
        if (!data) {
          navigate('/mypage', { state: { returnTo } });
          return;
        }
        setDisplayName(data.displayName);
      })
      .catch(() => toast.error('Failed to load your affiliate info.', { position: 'top-center' }))
      .finally(() => setLoading(false));
  }, [navigate, returnTo]);

  return { loading, displayName };
}

function parseDate(value: string | null): Date | undefined {
  if (!value) return undefined;
  const d = parseISO(value);
  return isValid(d) ? d : undefined;
}

/**
 * The selected period lives in the URL (?from=&to=) so it carries over between
 * the Affiliate main page and its sub pages, and survives back navigation.
 * Other query params (e.g. devPreview) are preserved.
 */
export function useAffiliateRange() {
  const [searchParams, setSearchParams] = useSearchParams();
  const from = parseDate(searchParams.get('from'));
  const to = parseDate(searchParams.get('to'));
  const range: DateRange | undefined = from
    ? { from, to }
    : { from: new Date(new Date().getFullYear(), new Date().getMonth(), 1), to: new Date() };

  const setRange = (next: DateRange | undefined) => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      if (next?.from) params.set('from', format(next.from, 'yyyy-MM-dd'));
      else params.delete('from');
      if (next?.to) params.set('to', format(next.to, 'yyyy-MM-dd'));
      else params.delete('to');
      return params;
    }, { replace: true });
  };

  return { range, setRange };
}

/** Builds a path that keeps the current query string (period + devPreview). */
export function useAffiliateHref() {
  const [searchParams] = useSearchParams();
  const qs = searchParams.toString();
  return (path: string) => (qs ? `${path}?${qs}` : path);
}

export function DateRangeFilter({ range, onChange }: { range: DateRange | undefined; onChange: (r: DateRange | undefined) => void }) {
  const [open, setOpen] = useState(false);
  const label = range?.from
    ? range.to
      ? `${format(range.from, 'MMM d')} – ${format(range.to, 'MMM d')}`
      : format(range.from, 'MMM d')
    : 'Select dates';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="w-full flex items-center justify-center gap-2 h-10 rounded-full border border-border bg-card shadow-sm text-sm font-medium hover:bg-secondary/50 transition-colors">
          <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
          {label}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="center">
        <Calendar
          mode="range"
          selected={range}
          onSelect={(val) => { onChange(val); if (val?.from && val?.to) setOpen(false); }}
          disabled={{ after: new Date() }}
          defaultMonth={range?.from ?? new Date()}
        />
      </PopoverContent>
    </Popover>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="bg-card rounded-xl border border-border py-16 px-6 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
