import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { IS_B2C_SITE } from '@/lib/site';
import { fetchMyPartner, joinAffiliate, type AffiliatePartner } from '@/lib/affiliate';

// 로그인 고객의 파트너 정보 (B2C 사이트만). 가입하면 캐시를 바로 갱신한다.
export function useAffiliatePartner() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const userId = useAuthStore((s) => s.user?.userId);
  const queryClient = useQueryClient();
  const key = ['affiliate-me', userId];

  const query = useQuery({
    queryKey: key,
    queryFn: async () => (await fetchMyPartner()).partner,
    enabled: IS_B2C_SITE && isLoggedIn && !!userId,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const join = useCallback(async (): Promise<AffiliatePartner> => {
    const { partner } = await joinAffiliate();
    queryClient.setQueryData(['affiliate-me', userId], partner);
    return partner;
  }, [queryClient, userId]);

  return {
    partner: query.data ?? null,
    isLoading: query.isLoading && query.fetchStatus !== 'idle',
    isError: query.isError,
    join,
  };
}
