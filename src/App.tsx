import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from "react-router-dom";
import { trackPageView } from "@/lib/ga4-pageview";
import Index from "./pages/Index";
import ProductDetail from "./pages/ProductDetail";
import CheckoutReturn from "./pages/CheckoutReturn";
import ContactUs from "./pages/ContactUs";
import NotFound from "./pages/NotFound";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfUse from "./pages/TermsOfUse";
import MyPage from "./pages/MyPage";
import OrderHistory from "./pages/OrderHistory";
import FavoritesPage from "./pages/FavoritesPage";
import WishlistPage from "./pages/WishlistPage";
import Checkout from "./pages/Checkout";
import AuthCallback from "./pages/AuthCallback";
import GuestOrderLookup from "./pages/GuestOrderLookup";
import B2BApply from "./pages/B2BApply";
import B2BAdmin from "./pages/B2BAdmin";
import AdminDashboard from "./pages/AdminDashboard";
import AdminManage from "./pages/AdminManage";
import DiscountRedirect from "./pages/DiscountRedirect";
import PopupOffline from "./pages/PopupOffline";
import BlogList from "./pages/BlogList";
import BlogPost from "./pages/BlogPost";
import NewProductsPage from "./pages/NewProducts";
import RefundPolicy from "./pages/RefundPolicy";
import About from "./pages/About";
import { WhatsAppButton } from "./components/layout/WhatsAppButton";

const queryClient = new QueryClient();

function ShopifyProductRedirect() {
  const { handle } = useParams();
  return <Navigate to={`/product/${handle}`} replace />;
}

function ShopifyCollectionRedirect() {
  const { handle } = useParams();
  return <Navigate to={`/?collection=${handle}`} replace />;
}

function GA4PageViewTracker() {
  const location = useLocation();
  useEffect(() => {
    trackPageView(location.pathname + location.search);
  }, [location.pathname, location.search]);
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <GA4PageViewTracker />
        <Toaster />
        <Sonner closeButton />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/checkout-return" element={<CheckoutReturn />} />
          <Route path="/contact" element={<ContactUs />} />
          <Route path="/about" element={<About />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfUse />} />
          <Route path="/refund-policy" element={<RefundPolicy />} />
          <Route path="/mypage" element={<MyPage />} />
          <Route path="/mypage/order-history" element={<OrderHistory />} />
          <Route path="/mypage/favorites" element={<FavoritesPage />} />
          <Route path="/favorites" element={<FavoritesPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/guest-order" element={<GuestOrderLookup />} />
          <Route path="/wishlist" element={<WishlistPage />} />
          <Route path="/mypage/b2b-apply" element={<B2BApply />} />
          <Route path="/manage/b2b" element={<B2BAdmin />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/manage" element={<AdminManage />} />
          <Route path="/popup-offline-stores" element={<PopupOffline />} />
          <Route path="/blog" element={<BlogList />} />
          <Route path="/blog/:slug" element={<BlogPost />} />
          <Route path="/new-products" element={<NewProductsPage />} />
          <Route path="/discount/:code" element={<DiscountRedirect />} />
          <Route path="/products/:handle" element={<ShopifyProductRedirect />} />
          <Route path="/collections/:handle" element={<ShopifyCollectionRedirect />} />
          <Route path="/collections" element={<Navigate to="/" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <WhatsAppButton />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
