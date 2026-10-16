import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useFavoritesStore } from './favoritesStore';
import { isLoggedIn as isSessionValid } from '@/lib/customer-auth';
import { IS_B2C_SITE } from '@/lib/site';

export interface UserProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  email?: string;
  shopifyCustomerToken?: string;
  shopifyEmail?: string;
}

interface AuthStore {
  user: UserProfile | null;
  isLoggedIn: boolean;
  isB2B: boolean;
  // B2C 사이트에서 B2B 태그 계정으로 로그인한 경우 — 가격은 소매가, biteme.one 안내만 띄운다
  isB2BAccountOnB2CSite: boolean;
  b2bDiscountRate: number;
  login: (user: UserProfile) => void;
  setB2B: (isB2B: boolean) => void;
  setB2BDiscountRate: (rate: number) => void;
  logout: () => void;
}

const DEFAULT_B2B_DISCOUNT_RATE = 0.60;

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      isLoggedIn: false,
      isB2B: false,
      isB2BAccountOnB2CSite: false,
      b2bDiscountRate: DEFAULT_B2B_DISCOUNT_RATE,
      login: (user) => {
        set({ user, isLoggedIn: true });
        useFavoritesStore.getState().mergeGuestToUser(user.userId);
      },
      // B2C 사이트에서는 B2B 태그가 있어도 일반 고객과 같은 가격을 보여준다
      setB2B: (isB2B) => set({ isB2B: isB2B && !IS_B2C_SITE, isB2BAccountOnB2CSite: isB2B && IS_B2C_SITE }),
      setB2BDiscountRate: (rate) => set({ b2bDiscountRate: rate }),
      logout: () => set({ user: null, isLoggedIn: false, isB2B: false, isB2BAccountOnB2CSite: false }),
    }),
    {
      name: 'auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        isLoggedIn: state.isLoggedIn,
      }),
      merge: (persisted, current) => {
        const sessionActive = isSessionValid();
        return {
          ...current,
          ...(persisted as Partial<AuthStore>),
          isB2B: false,
          isB2BAccountOnB2CSite: false,
          b2bDiscountRate: DEFAULT_B2B_DISCOUNT_RATE,
          ...(sessionActive ? {} : { isLoggedIn: false, user: null }),
        };
      },
    }
  )
);

export function getB2BDiscountRate(): number {
  return useAuthStore.getState().b2bDiscountRate;
}

export async function fetchB2BDiscountRate(): Promise<number> {
  try {
    const res = await fetch('/api/b2b?action=get-discount-rate');
    if (!res.ok) return DEFAULT_B2B_DISCOUNT_RATE;
    const data = await res.json();
    const rate = data.rate ?? DEFAULT_B2B_DISCOUNT_RATE;
    useAuthStore.getState().setB2BDiscountRate(rate);
    return rate;
  } catch {
    return DEFAULT_B2B_DISCOUNT_RATE;
  }
}
