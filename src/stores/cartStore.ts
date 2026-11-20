import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { ShopifyProduct, createStorefrontCheckout } from '@/lib/shopify';
import { trackAddToCartCapi } from '@/lib/meta-capi';
import { klaviyoAddedToCart, type KlaviyoCartLine } from '@/lib/klaviyo';

export interface CartItem {
  product: ShopifyProduct;
  variantId: string;
  variantTitle: string;
  price: {
    amount: string;
    currencyCode: string;
  };
  quantity: number;
  quantityAvailable: number | null; // Track available stock
  selectedOptions: Array<{
    name: string;
    value: string;
  }>;
}

interface CartStore {
  items: CartItem[];
  cartId: string | null;
  checkoutUrl: string | null;
  isLoading: boolean;

  // Actions
  addItem: (item: CartItem) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  removeItem: (variantId: string) => void;
  clearCart: () => void;
  setCartId: (cartId: string) => void;
  setCheckoutUrl: (url: string) => void;
  setLoading: (loading: boolean) => void;
  createCheckout: (lineItems?: { variantId: string; quantity: number }[]) => Promise<string | null>;
  getTotalItems: () => number;
  getTotalPrice: () => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      cartId: null,
      checkoutUrl: null,
      isLoading: false,

      addItem: (item) => {
        const { items } = get();
        const existingItem = items.find(i => i.variantId === item.variantId);
        const prevQuantity = existingItem ? existingItem.quantity : 0;
        const maxQuantity = item.quantityAvailable ?? Infinity;
        const finalQuantity = Math.min(prevQuantity + item.quantity, maxQuantity);

        if (existingItem) {
          // Check stock limit when adding to existing item
          set({
            items: items.map(i =>
              i.variantId === item.variantId
                ? { ...i, quantity: finalQuantity, quantityAvailable: item.quantityAvailable }
                : i
            )
          });
        } else {
          // Check stock limit for new item
          set({ items: [...items, { ...item, quantity: finalQuantity }] });
        }

        // Meta CAPI: AddToCart — 재고 한도로 클램핑될 수 있으므로 실제로 추가된 수량 기준으로 전송, 0이면 스킵
        const actualAdded = finalQuantity - prevQuantity;
        if (actualAdded > 0) {
          trackAddToCartCapi({
            contentId: item.variantId.split('/').pop() || item.variantId,
            contentName: item.product.node.title,
            value: parseFloat(item.price.amount) * actualAdded,
            currency: item.price.currencyCode,
          });

          // Klaviyo: Added to Cart — 담은 상품(실제 추가 수량) + 장바구니 전체 목록·합계 (장바구니 이탈 메일용)
          const toKlaviyoLine = (line: CartItem, quantity: number): KlaviyoCartLine => ({
            product: {
              id: line.product.node.id,
              title: line.product.node.title,
              handle: line.product.node.handle,
              vendor: line.product.node.vendor,
              productType: line.product.node.productType,
              imageUrl: line.product.node.images.edges[0]?.node.url,
            },
            quantity,
            price: line.price,
          });
          klaviyoAddedToCart(
            toKlaviyoLine(item, actualAdded),
            get().items.map((line) => toKlaviyoLine(line, line.quantity)),
          );
        }
      },

      updateQuantity: (variantId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(variantId);
          return;
        }

        const item = get().items.find(i => i.variantId === variantId);
        if (!item) return;

        // Check stock limit
        const maxQuantity = item.quantityAvailable ?? Infinity;
        const finalQuantity = Math.min(quantity, maxQuantity);

        set({
          items: get().items.map(i =>
            i.variantId === variantId ? { ...i, quantity: finalQuantity } : i
          )
        });
      },

      removeItem: (variantId) => {
        set({
          items: get().items.filter(item => item.variantId !== variantId)
        });
      },

      clearCart: () => {
        set({ items: [], cartId: null, checkoutUrl: null });
      },

      setCartId: (cartId) => set({ cartId }),
      setCheckoutUrl: (checkoutUrl) => set({ checkoutUrl }),
      setLoading: (isLoading) => set({ isLoading }),

      createCheckout: async (lineItems) => {
        const { items, setLoading, setCheckoutUrl } = get();
        const checkoutItems = lineItems ?? items.map(item => ({
          variantId: item.variantId,
          quantity: item.quantity,
        }));
        if (checkoutItems.length === 0) return null;

        setLoading(true);
        try {
          const checkoutUrl = await createStorefrontCheckout(checkoutItems);
          setCheckoutUrl(checkoutUrl);
          return checkoutUrl;
        } catch (error) {
          console.error('Failed to create checkout:', error);
          return null;
        } finally {
          setLoading(false);
        }
      },

      getTotalItems: () => {
        return get().items.length;
      },

      getTotalPrice: () => {
        return get().items.reduce((sum, item) => sum + (parseFloat(item.price.amount) * item.quantity), 0);
      },
    }),
    {
      name: 'shopify-cart',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        items: state.items,
        cartId: state.cartId,
        checkoutUrl: state.checkoutUrl,
      }),
    }
  )
);
