import { useAuthStore } from '@/stores/authStore';
import { useFavoritesStore } from '@/stores/favoritesStore';
import { initiateLogin } from '@/lib/customer-auth';
import { toast } from 'sonner';

export function useFavoriteAction() {
  const authUserId = useAuthStore((s) => s.user?.userId);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const { addFavorite, removeFavorite, isFavorite } = useFavoritesStore();

  const toggleFavorite = (handle: string) => {
    if (!isLoggedIn || !authUserId) {
      toast('Login required', {
        description: 'Please log in to use favorites.',
        position: 'top-center',
        action: {
          label: 'Log In',
          onClick: () => initiateLogin(window.location.pathname),
        },
      });
      return;
    }
    if (isFavorite(authUserId, handle)) {
      removeFavorite(authUserId, handle);
      toast.success('Removed from favorites', { position: 'top-center' });
    } else {
      addFavorite(authUserId, handle);
      toast.success('Added to favorites', { position: 'top-center' });
      // Meta Pixel: AddToWishlist
      const fbq = (window as Window & { fbq?: (...args: unknown[]) => void }).fbq;
      if (fbq) fbq('track', 'AddToWishlist', { content_ids: [handle], content_type: 'product' });
    }
  };

  const checkFavorite = (handle: string) => {
    if (!isLoggedIn || !authUserId) return false;
    return isFavorite(authUserId, handle);
  };

  return { toggleFavorite, checkFavorite };
}
