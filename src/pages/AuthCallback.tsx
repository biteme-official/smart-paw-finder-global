import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { handleCallback, getAccessToken } from '@/lib/customer-auth';
import { IS_B2C_SITE } from '@/lib/site';
import { fetchCustomerAccount, createStorefrontCustomerToken } from '@/lib/customer-account';
import { useAuthStore, fetchB2BDiscountRate } from '@/stores/authStore';
import { toast } from 'sonner';
import { isNewSignup, requestPetProfilePrompt, shouldPromptPetProfile } from '@/components/account/PetProfile';

export default function AuthCallback() {
  const navigate = useNavigate();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');
    const errorDescription = params.get('error_description');

    if (error) {
      toast.error(errorDescription || error, { position: 'top-center' });
      navigate('/mypage', { replace: true });
      return;
    }

    if (!code || !state) {
      toast.error('Invalid login response.', { position: 'top-center' });
      navigate('/mypage', { replace: true });
      return;
    }

    handleCallback(code, state).then(async (result) => {
      if (!result.success) {
        toast.error(result.error || 'Login failed.', { position: 'top-center' });
        navigate('/mypage', { replace: true });
        return;
      }

      try {
        const [profile] = await Promise.all([
          fetchCustomerAccount(),
          createStorefrontCustomerToken().catch(() => null),
        ]);
        // B2C 사이트 이용 고객 구분용 태그 (CRM). 실패해도 로그인에는 영향 없음
        const accessToken = getAccessToken();
        if (IS_B2C_SITE && accessToken) {
          fetch('/api/customer-site-tag', { method: 'POST', headers: { Authorization: accessToken } }).catch(() => {});
        }
        if (profile) {
          useAuthStore.getState().login({
            userId: profile.emailAddress || profile.id,
            displayName: profile.displayName || profile.emailAddress || 'Customer',
            email: profile.emailAddress || undefined,
          });

          const promptData = {
            customerId: profile.id,
            emailMarketingState: profile.emailMarketingState,
            petType: profile.petType,
            petBirthday: profile.petBirthday,
          };
          if (isNewSignup(profile.creationDate) && shouldPromptPetProfile(promptData)) {
            requestPetProfilePrompt(promptData, result.returnTo || '/mypage');
          }

          if (profile.emailAddress) {
            try {
              const tagRes = await fetch('/api/customer-tags', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: profile.emailAddress }),
              });
              const tagData = await tagRes.json();
              const tags: string[] = tagData.tags || [];
              const isB2B = tags.some((t) => t.toUpperCase() === 'B2B');
              useAuthStore.getState().setB2B(isB2B);
              if (isB2B) fetchB2BDiscountRate();
            } catch {
              // Non-fatal: tag check failed
            }
          }
        }
      } catch {
        // Non-fatal: profile sync failed but login succeeded
      }

      toast.success('Logged in successfully', { position: 'top-center' });
      navigate(result.returnTo || '/mypage', { replace: true });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm">Signing you in...</p>
      </div>
    </div>
  );
}
