import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useFavoritesStore } from './favoritesStore';
import { isLoggedIn as isSessionValid } from '@/lib/customer-auth';

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
  b2bDiscountRate: number;
  hasOrdered: boolean | null;
  login: (user: UserProfile) => void;
  setB2B: (isB2B: boolean) => void;
  setB2BDiscountRate: (rate: number) => void;
  setHasOrdered: (v: boolean) => void;
  logout: () => void;
}

const DEFAULT_B2B_DISCOUNT_RATE = 0.60;

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      isLoggedIn: false,
      isB2B: false,
      b2bDiscountRate: DEFAULT_B2B_DISCOUNT_RATE,
      hasOrdered: null,
      login: (user) => {
        set({ user, isLoggedIn: true, hasOrdered: null });
        useFavoritesStore.getState().mergeGuestToUser(user.userId);
      },
      setB2B: (isB2B) => set({ isB2B }),
      setB2BDiscountRate: (rate) => set({ b2bDiscountRate: rate }),
      setHasOrdered: (v) => set({ hasOrdered: v }),
      logout: () => set({ user: null, isLoggedIn: false, isB2B: false, hasOrdered: null }),
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
