import { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/components/ui/drawer';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { AFFILIATE_MIN_PAYOUT, AFFILIATE_RATE, AFFILIATE_TERMS_URL, AFFILIATE_TRACKING_DAYS } from '@/lib/affiliate';

export function AffiliateStats({ className }: { className?: string }) {
  const stats = [
    { value: `${Math.round(AFFILIATE_RATE * 100)}%`, label: 'whole order' },
    { value: `${AFFILIATE_TRACKING_DAYS}d`, label: 'tracking' },
    { value: `$${AFFILIATE_MIN_PAYOUT}`, label: 'min payout' },
  ];
  return (
    <div className={cn('grid grid-cols-3 gap-2', className)}>
      {stats.map((s) => (
        <div key={s.label} className="rounded-2xl bg-accent px-2 py-3 text-center">
          <div className="text-lg font-bold text-foreground">{s.value}</div>
          <div className="text-xs text-muted-foreground">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

function ConsentRow({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-3 py-1.5 cursor-pointer text-[15px] text-foreground">
      <input type="checkbox" className="sr-only peer" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden="true"
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40',
          checked ? 'border-primary bg-primary text-primary-foreground' : 'border-primary bg-transparent',
        )}
      >
        {checked && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
      <span>{children}</span>
    </label>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // 상품 상세: 제목·혜택 요약을 보여주고 "Copy link", 마이페이지: 체크만 보여주고 "Get my link"
  variant: 'product' | 'mypage';
  onConfirm: () => Promise<void>;
}

// 가입 시트 — 체크 2개(만 18세 이상, 약관·#ad 규칙 동의) 후 버튼 한 번에 가입 + 링크 받기. 심사 없음.
export function AffiliateJoinSheet({ open, onOpenChange, variant, onConfirm }: Props) {
  const displayName = useAuthStore((s) => s.user?.displayName);
  const [age18, setAge18] = useState(false);
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setAge18(false);
      setTerms(false);
      setBusy(false);
    }
  }, [open]);

  const ready = age18 && terms && !busy;
  const submit = async () => {
    if (!ready) return;
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-lg bg-background">
        <div className="px-5 pb-6 pt-4">
          {variant === 'product' ? (
            <>
              <DrawerTitle className="text-2xl font-bold">Share &amp; earn</DrawerTitle>
              <DrawerDescription className="mt-1 text-base">Get your link in seconds.</DrawerDescription>
              <AffiliateStats className="mt-5" />
            </>
          ) : (
            <>
              <DrawerTitle className="sr-only">Join the affiliate program</DrawerTitle>
              <DrawerDescription className="sr-only">Confirm two things to get your link.</DrawerDescription>
            </>
          )}

          <div className={cn('rounded-2xl bg-muted/60 px-4 py-2', variant === 'product' ? 'mt-3' : 'mt-1')}>
            <ConsentRow checked={age18} onChange={setAge18}>I&apos;m 18 or older</ConsentRow>
            <ConsentRow checked={terms} onChange={setTerms}>
              I agree to the{' '}
              <a href={AFFILIATE_TERMS_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2" onClick={(e) => e.stopPropagation()}>
                Terms and #ad rule
              </a>
            </ConsentRow>
          </div>

          <button
            type="button"
            onClick={submit}
            disabled={!ready}
            className={cn(
              'mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-base font-bold text-primary-foreground transition-colors',
              ready ? 'bg-primary hover:bg-primary/90' : 'bg-primary/50',
            )}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {variant === 'product' ? 'Copy link' : 'Get my link'}
          </button>

          <p className="mt-3 text-center text-xs leading-5 text-muted-foreground">
            {displayName && (
              <>
                Registering as {displayName}
                <br />
              </>
            )}
            Own purchases excluded
          </p>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
