import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { OrderStatus, PartnerStatus, PayoutStatus } from './affiliateAdminData';

// Badge colors follow B2BAdmin (outline badge + -50 background / -600 text).
const YELLOW = 'text-yellow-600 bg-yellow-50 border-yellow-200';
const GREEN = 'text-green-600 bg-green-50 border-green-200';
const RED = 'text-red-600 bg-red-50 border-red-200';
const BLUE = 'text-blue-600 bg-blue-50 border-blue-200';
const ORANGE = 'text-orange-600 bg-orange-50 border-orange-200';
const GRAY = 'text-gray-500 bg-gray-50 border-gray-200';

type BadgeConfig = { label: string; color: string };

export const ORDER_STATUS: Record<OrderStatus, BadgeConfig> = {
  pending: { label: 'Pending', color: YELLOW },
  approved: { label: 'Approved', color: GREEN },
  voided: { label: 'Voided', color: GRAY },
  refunded: { label: 'Refunded', color: RED },
  'self-purchase': { label: 'Self-purchase', color: ORANGE },
  'excluded-b2b': { label: 'Excluded (B2B)', color: GRAY },
};

export const PAYOUT_STATUS: Record<PayoutStatus, BadgeConfig> = {
  ready: { label: 'Ready', color: BLUE },
  'carried-over': { label: 'Carried over', color: YELLOW },
  paid: { label: 'Paid', color: GREEN },
  'missing-paypal': { label: 'Missing PayPal', color: RED },
};

export const PARTNER_STATUS: Record<PartnerStatus, BadgeConfig> = {
  active: { label: 'Active', color: GREEN },
  suspended: { label: 'Suspended', color: YELLOW },
  removed: { label: 'Removed', color: GRAY },
};

export function StatusBadge({ config, className }: { config: BadgeConfig; className?: string }) {
  return (
    <Badge variant="outline" className={cn('text-xs whitespace-nowrap', config.color, className)}>
      {config.label}
    </Badge>
  );
}

export function SectionCard({ title, count, description, action, children }: {
  title: string;
  count?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-sm font-semibold">
              {title}
              {count !== undefined && <span className="ml-1.5 font-normal text-muted-foreground">· {count}</span>}
            </CardTitle>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
          {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
        </div>
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}

/** Small underlined row action, like the inline actions in the JP admin table. */
export function RowAction({ children, onClick, danger }: { children: ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={cn(
        'text-xs underline underline-offset-2 whitespace-nowrap transition-colors',
        danger ? 'text-red-600 hover:text-red-700' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

export function EmptyRow({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{children}</p>;
}

// Same table look as B2BAdmin.
//
// Column alignment rule for every affiliate admin table (use for new tables too):
// - TEXT_COL (left): text columns — order #, partner ID, name, email, product.
// - VALUE_COL (center): everything else — dates, amounts, rates, counts, country codes, status badges, checks.
// - Row actions (Void, Mark as paid, Remind) sit in a last "Action" column, centered.
// Header, its gray sub-label and the cells of a column always share the same alignment.
// A table always spans its card; fix column shares with a <colgroup> when the
// automatic widths bunch up (see PayoutsCard).
export const TEXT_COL = 'text-left';
export const VALUE_COL = 'text-center';
export const ACTION_COL = 'text-right';

export const TABLE_WRAP = 'rounded-lg border overflow-x-auto';
export const TH = 'p-3 font-medium text-muted-foreground whitespace-nowrap';
export const TD = 'p-3';
export const TR = 'border-b last:border-0 hover:bg-gray-50 transition-colors';

/** "< 1 / 2 >" pager, right-aligned under a table. Hidden when everything fits on one page. */
export function Pager({ page, pageCount, onChange }: { page: number; pageCount: number; onChange: (page: number) => void }) {
  if (pageCount <= 1) return null;
  return (
    <div className="mt-3 flex items-center justify-end gap-1 text-sm">
      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Previous page"
        disabled={page <= 1} onClick={() => onChange(page - 1)}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="min-w-[3.5rem] text-center tabular-nums text-muted-foreground">{page} / {pageCount}</span>
      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Next page"
        disabled={page >= pageCount} onClick={() => onChange(page + 1)}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

/** Clamps `page` so a shrinking list never leaves you on an empty page. */
export function paginate<T>(items: T[], page: number, pageSize: number) {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, pageCount);
  return { pageCount, page: current, items: items.slice((current - 1) * pageSize, current * pageSize) };
}

/**
 * Hover tooltip for table cells. Rendered in a portal so the tables' overflow-x
 * wrapper can't clip it (the shared TooltipContent renders in place).
 */
export function CellTooltip({ content, children }: { content: ReactNode; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex cursor-help">{children}</span>
      </TooltipTrigger>
      <TooltipPrimitive.Portal>
        <TooltipContent>{content}</TooltipContent>
      </TooltipPrimitive.Portal>
    </Tooltip>
  );
}
