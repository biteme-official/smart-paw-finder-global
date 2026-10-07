import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

/** Small red flag for China, Taiwan, Malaysia and Philippines — shown, never blocked. */
export function RestrictedBadge({ country, className }: { country: string; className?: string }) {
  return (
    <Badge variant="outline" title={`${country} is a restricted country`}
      className={cn('px-1.5 py-0 text-[10px] font-medium whitespace-nowrap', RED, className)}>
      Restricted country
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
export const TABLE_WRAP = 'rounded-lg border overflow-x-auto';
export const TH = 'p-3 font-medium text-muted-foreground whitespace-nowrap';
export const TD = 'p-3';
export const TR = 'border-b last:border-0 hover:bg-gray-50 transition-colors';
