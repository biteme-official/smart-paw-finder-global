export type Language = 'en';

export const translations: Record<string, Record<string, string | Record<string, string>>> = {
  common: {
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    cancel: 'Cancel',
    confirm: 'Confirm',
  },
  nav: {
    shop: 'Shop',
    cart: 'Cart',
    favorites: 'Favorites',
    account: 'My Page',
    searchProducts: 'Search products...',
  },
  search: {
    recentSearches: 'Recent Searches',
    suggestions: 'Suggested Products',
    noResults: 'No results found',
  },
  header: {
    login: 'Login',
    logout: 'Logout',
    signup: 'Sign Up',
  },
  languages: {
    en: 'English',
  },
  cart: {
    title: 'Shopping Cart',
    empty: 'Your cart is empty',
    itemCount: 'items',
    total: 'Total',
    checkout: 'Proceed to Checkout',
    creatingCheckout: 'Preparing checkout...',
    addedToCart: 'Added to cart',
    awayFrom: 'Away from',
    unlockedAll: '🎉 You have unlocked all benefits!',
    freeShipping: 'Free Shipping',
    discount5: '5% Off',
    freeGift: 'Free Gift',
    shippingCost: 'Shipping',
    currentShipping: 'Current Shipping',
  },
  checkout: {
    returnTitle: 'Order Complete',
    thankYou: 'Thank you!',
    orderConfirmation: 'Your order has been placed. Please check your confirmation email.',
    trackingInfo: 'Shipment Tracking',
    trackingDesc: 'A tracking number will be sent to your email after shipping.',
    continueShopping: 'Continue Shopping',
    viewOrders: 'View Orders',
    inAppNotice: 'To return to the app, tap the back button or X at the top.',
    orderNumber: 'Order Number',
  },
  product: {
    addToCart: 'Add to Cart',
    noProducts: 'No products found',
    soldOut: 'Sold Out',
    selectOption: 'Select Option',
    loadMore: 'Load More',
    quantity: 'Quantity',
    outOfStock: 'Out of Stock',
    back: 'Back',
    notFound: 'Product not found',
    total: 'Total',
    shippingBenefit: 'FREE SHIPPING ON $75+',
    shippingBenefitDesc: 'Worldwide shipping available',
    qualityGuarantee: 'Quality Guarantee',
    qualityGuaranteeDesc: '100% satisfaction guaranteed',
    easyReturns: 'Easy Returns',
    easyReturnsDesc: 'Within 30 days',
    aboutProduct: 'About this product',
    someSizesUnavailable: 'Some sizes unavailable',
    addedToCart: 'Added to cart',
  },
  filters: {
    sort: 'Sort',
    sortOptions: {
      default: 'Default',
      priceAsc: 'Price: Low to High',
      priceDesc: 'Price: High to Low',
      titleAsc: 'Name: A–Z',
      titleDesc: 'Name: Z–A',
    },
    filter: 'Filter',
    reset: 'Reset',
    priceRange: 'Price Range',
    availability: 'Availability',
    all: 'All',
    available: 'In Stock',
    apply: 'Apply Filters',
    clearFilters: 'Clear Filters',
  },
  quickAccess: {
    new: 'New',
    flashSale: 'Flash Sale',
    clearance: 'Clearance',
    dogs: 'Dogs',
    cats: 'Cats',
    treats: 'Treats',
    food: 'Food',
    toys: 'Toys',
    topRated: 'Popular',
    health: 'Health',
  },
  timeDeal: {
    todaysDeals: "Today's Deals",
    viewAll: 'View All',
    claimed: 'Sold',
  },
};

export function getLanguage(): Language {
  return 'en';
}

export function getLocale(): string {
  return 'en-US';
}

export function t(path: string): string {
  const keys = path.split('.');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let result: any = translations;

  for (const key of keys) {
    if (result && typeof result === 'object' && key in result) {
      result = result[key];
    } else {
      return path;
    }
  }

  if (typeof result === 'string') {
    return result;
  }

  return path;
}
