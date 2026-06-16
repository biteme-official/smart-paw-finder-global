import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { handleCallback } from '@/lib/customer-auth';
import { fetchCustomerAccount } from '@/lib/customer-account';
import { useAuthStore } from '@/stores/authStore';
import { toast } from 'sonner';

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
        const profile = await fetchCustomerAccount();
        if (profile) {
          useAuthStore.getState().login({
            userId: profile.emailAddress || profile.id,
            displayName: profile.displayName || profile.emailAddress || 'Customer',
            email: profile.emailAddress || undefined,
          });

          if (profile.emailAddress) {
            try {
              const tagRes = await fetch('/api/customer-tags', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: profile.emailAddress }),
              });
              const tagData = await tagRes.json();
              const tags: string[] = tagData.tags || [];
              useAuthStore.getState().setB2B(tags.some((t) => t.toUpperCase() === 'B2B'));
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
