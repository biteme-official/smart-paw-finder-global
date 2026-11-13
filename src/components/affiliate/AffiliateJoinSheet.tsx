import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Loader2 } from 'lucide-react';
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/components/ui/drawer';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { AFFILIATE_MIN_PAYOUT, AFFILIATE_RATE, AFFILIATE_TERMS_URL, AFFILIATE_TRACKING_DAYS } from '@/lib/affiliate';
import { fetchCustomerAccount } from '@/lib/customer-account';
import {
  EMPTY_JOIN_PROFILE, PROFILE_MAX_LENGTH, countryOptions, isJoinProfileComplete, trimJoinProfile, type AffiliateJoinProfile,
} from './joinProfile';

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

const inputCls =
  'h-11 w-full rounded-xl border border-input bg-background px-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 md:text-[15px]';

function Field({ id, label, optional, children }: { id: string; label: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
        {optional && <span className="font-normal text-muted-foreground"> (optional)</span>}
      </label>
      {children}
    </div>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // 상품 상세: 제목·혜택 요약을 보여주고 "Copy link", 마이페이지: 체크만 보여주고 "Get my link"
  variant: 'product' | 'mypage';
  onConfirm: (profile: AffiliateJoinProfile) => Promise<void>;
}

// 가입 시트 — 정산 정보(이름·거주 국가·주소) 입력 + 체크 2개(만 18세 이상, 약관·#ad 규칙 동의) 후 버튼 한 번에 가입 + 링크 받기. 심사 없음.
export function AffiliateJoinSheet({ open, onOpenChange, variant, onConfirm }: Props) {
  const displayName = useAuthStore((s) => s.user?.displayName);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const [profile, setProfile] = useState<AffiliateJoinProfile>(EMPTY_JOIN_PROFILE);
  const [countryTouched, setCountryTouched] = useState(false);
  const [age18, setAge18] = useState(false);
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const countries = useMemo(countryOptions, []);

  // Shopify 기본 배송지 국가로 미리 채움 (고객이 직접 고르면 덮지 않음)
  const { data: account } = useQuery({
    queryKey: ['affiliate-join-account'],
    queryFn: fetchCustomerAccount,
    enabled: open && isLoggedIn,
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
  const defaultCountry = account?.defaultAddress?.country || '';

  useEffect(() => {
    if (!open) {
      setProfile(EMPTY_JOIN_PROFILE);
      setCountryTouched(false);
      setAge18(false);
      setTerms(false);
      setBusy(false);
    }
  }, [open]);

  useEffect(() => {
    if (open && !countryTouched && defaultCountry && countries.some((c) => c.code === defaultCountry)) {
      setProfile((p) => (p.country ? p : { ...p, country: defaultCountry }));
    }
  }, [open, countryTouched, defaultCountry, countries]);

  const set = (key: keyof AffiliateJoinProfile) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (key === 'country') setCountryTouched(true);
    setProfile((p) => ({ ...p, [key]: e.target.value }));
  };

  const ready = isJoinProfileComplete(profile) && age18 && terms && !busy;
  const submit = async () => {
    if (!ready) return;
    setBusy(true);
    try {
      await onConfirm(trimJoinProfile(profile));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-h-[92dvh] max-w-lg bg-background">
        <div className="overflow-y-auto px-5 pb-6 pt-4">
          {variant === 'product' ? (
            <>
              <DrawerTitle className="text-2xl font-bold">Share &amp; earn</DrawerTitle>
              <DrawerDescription className="mt-1 text-base">Get your link in seconds.</DrawerDescription>
              <AffiliateStats className="mt-5" />
            </>
          ) : (
            <>
              <DrawerTitle className="sr-only">Join the affiliate program</DrawerTitle>
              <DrawerDescription className="sr-only">Enter your payout details and confirm two things to get your link.</DrawerDescription>
            </>
          )}

          <div className={cn('space-y-3', variant === 'product' ? 'mt-5' : 'mt-1')}>
            <p className="text-sm font-semibold text-foreground">Payout details</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field id="aff-first-name" label="First name">
                <input id="aff-first-name" className={inputCls} autoComplete="given-name" maxLength={PROFILE_MAX_LENGTH} value={profile.firstName} onChange={set('firstName')} />
              </Field>
              <Field id="aff-last-name" label="Last name">
                <input id="aff-last-name" className={inputCls} autoComplete="family-name" maxLength={PROFILE_MAX_LENGTH} value={profile.lastName} onChange={set('lastName')} />
              </Field>
            </div>
            <Field id="aff-country" label="Country of residence">
              <select id="aff-country" className={inputCls} autoComplete="country" value={profile.country} onChange={set('country')}>
                <option value="" disabled>Select country</option>
                {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            </Field>
            <Field id="aff-address1" label="Street address">
              <input id="aff-address1" className={inputCls} autoComplete="address-line1" maxLength={PROFILE_MAX_LENGTH} value={profile.address1} onChange={set('address1')} />
            </Field>
            <Field id="aff-address2" label="Apt, suite, etc." optional>
              <input id="aff-address2" className={inputCls} autoComplete="address-line2" maxLength={PROFILE_MAX_LENGTH} value={profile.address2} onChange={set('address2')} />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field id="aff-city" label="City">
                <input id="aff-city" className={inputCls} autoComplete="address-level2" maxLength={PROFILE_MAX_LENGTH} value={profile.city} onChange={set('city')} />
              </Field>
              <Field id="aff-province" label="State / Province" optional>
                <input id="aff-province" className={inputCls} autoComplete="address-level1" maxLength={PROFILE_MAX_LENGTH} value={profile.province} onChange={set('province')} />
              </Field>
              <Field id="aff-zip" label="ZIP / Postal code" optional>
                <input id="aff-zip" className={inputCls} autoComplete="postal-code" maxLength={PROFILE_MAX_LENGTH} value={profile.zip} onChange={set('zip')} />
              </Field>
            </div>
            <p className="text-xs text-muted-foreground">Use your legal name. We use this to pay you and for tax records.</p>
          </div>

          <div className="mt-4 rounded-2xl bg-muted/60 px-4 py-2">
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
