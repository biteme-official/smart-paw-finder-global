import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { IS_B2C_SITE } from '@/lib/site';
import { toast } from 'sonner';
import { fetchMyPartner, joinAffiliate, uploadW9, type AffiliatePartner } from '@/lib/affiliate';
import { W9_COUNTRY, checkW9File, fileToBase64, type AffiliateJoinProfile } from './joinProfile';

// 가입은 이미 끝났으므로 W-9 실패는 가입을 되돌리지 않고 안내만 한다. 파일 내용·오류 상세는 로그에 남기지 않는다.
async function sendW9(file: File): Promise<void> {
  try {
    const check = await checkW9File(file);
    if ('error' in check) throw new Error('invalid');
    await uploadW9({ fileName: file.name.slice(0, 100), mimeType: check.mimeType, data: await fileToBase64(file) });
  } catch {
    toast.error("You're in, but your W-9 didn't upload. Please contact us to send it.", { position: 'top-center', duration: 8000 });
  }
}

// 로그인 고객의 파트너 정보 (B2C 사이트만). 가입하면 캐시를 바로 갱신한다.
export function useAffiliatePartner() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const userId = useAuthStore((s) => s.user?.userId);
  const queryClient = useQueryClient();
  const key = ['affiliate-me', userId];

  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      const r = await fetchMyPartner();
      return { partner: r.partner, removed: !!r.removed };
    },
    enabled: IS_B2C_SITE && isLoggedIn && !!userId,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // w9: 거주 국가가 US일 때만 보낸다 (선택). 가입 응답을 늦추지 않도록 기다리지 않는다
  const join = useCallback(async (profile: AffiliateJoinProfile, w9?: File | null): Promise<AffiliatePartner> => {
    const { partner } = await joinAffiliate(profile);
    queryClient.setQueryData(['affiliate-me', userId], { partner, removed: false });
    if (w9 && profile.country === W9_COUNTRY) void sendW9(w9);
    return partner;
  }, [queryClient, userId]);

  return {
    partner: query.data?.partner ?? null,
    removed: query.data?.removed ?? false, // 관리자가 프로그램에서 제외한 고객
    ready: query.isSuccess, // 내 정보를 실제로 받아온 뒤에만 true
    isLoading: query.isLoading && query.fetchStatus !== 'idle',
    isError: query.isError,
    join,
  };
}
