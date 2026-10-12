import { useState } from 'react';
import { CalendarIcon } from 'lucide-react';
import type { DateRange as DayPickerRange } from 'react-day-picker';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { RANGE_PRESET_LABELS, formatRange, presetRange, type DateRange, type RangePreset } from './affiliateAdminData';

export interface PeriodSelection {
  preset: RangePreset;
  range: DateRange;
}

const PRESETS: Exclude<RangePreset, 'custom'>[] = ['this-month', 'last-month', 'last-7', 'last-30'];

// The calendar works in the viewer's local time; a picked day is taken as that KST date.
const toDateString = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fromDateString = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const segment = (active: boolean) => cn(
  'px-3 py-1.5 text-xs whitespace-nowrap transition-colors',
  active ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground hover:text-foreground',
);

export function DateRangeFilter({ value, today, onChange }: {
  value: PeriodSelection;
  today: string;
  onChange: (next: PeriodSelection) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DayPickerRange | undefined>();

  const openCalendar = (next: boolean) => {
    // Start empty so the first click picks the start date instead of extending the current range.
    if (next) setDraft(undefined);
    setOpen(next);
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <div className="flex flex-wrap rounded-lg border bg-white overflow-hidden">
        {PRESETS.map((p) => (
          <button key={p} type="button" className={segment(value.preset === p)}
            onClick={() => onChange({ preset: p, range: presetRange(p, today) })}>
            {RANGE_PRESET_LABELS[p]}
          </button>
        ))}
      </div>
      <Popover open={open} onOpenChange={openCalendar}>
        <PopoverTrigger asChild>
          <button type="button" className={cn(
            'flex items-center gap-1.5 rounded-lg border',
            value.preset !== 'custom' && 'bg-white',
            segment(value.preset === 'custom'),
          )}>
            <CalendarIcon className="h-3 w-3" />
            {value.preset === 'custom' ? formatRange(value.range) : 'Custom'}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="range"
            selected={draft}
            onSelect={(val) => {
              setDraft(val);
              if (val?.from && val.to) {
                onChange({ preset: 'custom', range: { from: toDateString(val.from), to: toDateString(val.to) } });
                setOpen(false);
              }
            }}
            numberOfMonths={1}
            disabled={{ after: fromDateString(today) }}
            defaultMonth={fromDateString(value.range.to)}
          />
          <p className="px-3 pb-3 text-[10px] text-muted-foreground">Pick a start and end date (KST).</p>
        </PopoverContent>
      </Popover>
    </div>
  );
}
