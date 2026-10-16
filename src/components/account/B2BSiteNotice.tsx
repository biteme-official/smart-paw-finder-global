import { Building2 } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { B2B_SITE_URL } from '@/lib/site';

/** B2C 사이트에 B2B 계정으로 로그인했을 때만 표시 — 도매가는 B2B 사이트에서만 적용된다고 안내 */
export function B2BSiteNotice() {
  const show = useAuthStore((s) => s.isB2BAccountOnB2CSite);
  if (!show) return null;

  return (
    <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start gap-3">
      <Building2 className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
          You're signed in with a wholesale (B2B) account
        </p>
        <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
          Prices here are retail. Wholesale pricing is only available on our B2B store.
        </p>
        <a
          href={B2B_SITE_URL}
          className="inline-block mt-2 text-xs font-semibold text-amber-700 dark:text-amber-400 underline underline-offset-2"
        >
          Shop wholesale at biteme.one →
        </a>
      </div>
    </div>
  );
}
