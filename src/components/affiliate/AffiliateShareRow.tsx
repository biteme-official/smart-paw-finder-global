import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, CircleDollarSign, Copy } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { initiateLogin } from '@/lib/customer-auth';
import { buildAffiliateLink, estimateCommission, formatUsd, recordLinkCopy } from '@/lib/affiliate';
import { AffiliateJoinSheet } from './AffiliateJoinSheet';
import { copyText } from './copy-text';
import { useAffiliatePartner } from './useAffiliatePartner';

const SHARE_PARAM = 'share';
const REMOVED_MESSAGE = 'This account can’t join the program. Please contact us.';

// 상품 상세 "$4.50+ earn per share sale · Copy link" 줄 (B2C 사이트 전용)
// 비로그인 → 로그인 안내 → 로그인 후 같은 상품으로 돌아와 가입 시트, 파트너 → 바로 복사
export function AffiliateShareRow({ handle, minPrice }: { handle: string; minPrice: number }) {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const { partner, removed, ready, isLoading, join } = useAffiliatePartner();
  const [loginOpen, setLoginOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [params, setParams] = useSearchParams();
  const resetTimer = useRef<number>();

  useEffect(() => () => window.clearTimeout(resetTimer.current), []);

  // 로그인 후 돌아온 경우(?share=1): 내 정보를 받아온 뒤, 아직 파트너가 아니면 가입 시트를 연다
  useEffect(() => {
    if (params.get(SHARE_PARAM) !== '1' || !isLoggedIn || !ready) return;
    const next = new URLSearchParams(params);
    next.delete(SHARE_PARAM);
    setParams(next, { replace: true });
    if (!partner && !removed) setJoinOpen(true);
  }, [params, setParams, isLoggedIn, ready, partner, removed]);

  const markCopied = () => {
    setCopied(true);
    toast.success('Link copied', { position: 'top-center' });
    window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => setCopied(false), 3000);
    recordLinkCopy(handle);
  };

  const onCopyClick = async () => {
    if (!isLoggedIn) return setLoginOpen(true);
    if (isLoading) return;
    if (removed) {
      toast.error(REMOVED_MESSAGE, { position: 'top-center' });
      return;
    }
    if (!partner) return setJoinOpen(true);
    if (partner.status !== 'active') {
      toast.error('Your affiliate account is paused. Please contact us.', { position: 'top-center' });
      return;
    }
    try {
      await copyText(buildAffiliateLink(partner.code, handle));
      markCopied();
    } catch {
      toast.error('Could not copy the link.', { position: 'top-center' });
    }
  };

  const onJoinConfirm = async () => {
    // 가입 응답을 기다리는 동안에도 복사가 막히지 않게 Promise째 넘긴다
    const joined = join();
    const link = joined.then((p) => buildAffiliateLink(p.code, handle));
    const copied = await copyText(link).then(() => true, () => false);
    try {
      await joined;
    } catch {
      toast.error('Something went wrong. Please try again.', { position: 'top-center' });
      return;
    }
    setJoinOpen(false);
    if (copied) markCopied();
    else toast.success("You're in! Tap Copy link to copy your link.", { position: 'top-center' });
  };

  const earn = estimateCommission(minPrice);

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3 border-y border-dashed border-primary/50 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <CircleDollarSign className="h-6 w-6 shrink-0 text-primary" strokeWidth={1.75} aria-hidden="true" />
          <div className="min-w-0">
            <div className="text-lg font-bold leading-tight text-foreground">{formatUsd(earn)}+</div>
            <div className="text-xs text-muted-foreground">earn per share sale</div>
          </div>
        </div>
        <button
          type="button"
          onClick={onCopyClick}
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-primary bg-accent px-4 text-sm font-bold text-primary transition-colors hover:bg-primary/10"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Copied' : 'Copy link'}
        </button>
      </div>

      <AlertDialog open={loginOpen} onOpenChange={setLoginOpen}>
        <AlertDialogContent className="max-w-[calc(100%-32px)] rounded-3xl sm:max-w-sm" onOpenAutoFocus={(e) => e.preventDefault()}>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-center text-lg">Please log in and try again.</AlertDialogTitle>
            <AlertDialogDescription className="sr-only">Log in to get your affiliate link.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
            <AlertDialogAction
              className={cn('h-11 w-full rounded-xl font-bold')}
              onClick={() => initiateLogin(`/product/${handle}?${SHARE_PARAM}=1`)}
            >
              Log in first to begin
            </AlertDialogAction>
            <AlertDialogCancel className="mt-0 h-11 w-full rounded-xl">Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AffiliateJoinSheet open={joinOpen} onOpenChange={setJoinOpen} variant="product" onConfirm={onJoinConfirm} />
    </>
  );
}
