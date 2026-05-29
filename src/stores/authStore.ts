import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useFavoritesStore } from './favoritesStore';

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
  login: (user: UserProfile) => void;
  setB2B: (isB2B: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      isLoggedIn: false,
      isB2B: false,
      login: (user) => {
        set({ user, isLoggedIn: true });
        useFavoritesStore.getState().mergeGuestToUser(user.userId);
      },
      setB2B: (isB2B) => set({ isB2B }),
      logout: () => set({ user: null, isLoggedIn: false, isB2B: false }),
    }),
    {
      name: 'auth',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

export const B2B_DISCOUNT_RATE = 0.50;
