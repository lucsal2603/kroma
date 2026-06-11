import { useSmoothScroll } from "./hooks/useSmoothScroll";
import { AuthProvider, useAuth } from "./store/auth";
import { ProductsProvider } from "./store/products";
import { CartProvider } from "./store/cart";
import Nav from "./components/Nav";
import AuthModal from "./components/AuthModal";
import Hero from "./components/Hero";
import Marquee from "./components/Marquee";
import ProductGrid from "./components/ProductGrid";
import Showcase from "./components/Showcase";
import Newsletter from "./components/Newsletter";
import Footer from "./components/Footer";
import ProductDetail from "./components/ProductDetail";
import CartDrawer from "./components/CartDrawer";
import CookieConsent from "./components/CookieConsent";
import AdminDashboard from "./components/AdminDashboard";
import WelcomeOffer from "./components/WelcomeOffer";

// Pannello accesso/registrazione, montato una sola volta e pilotato dal
// contesto auth — così può essere aperto sia dal Nav sia dal carrello.
function AuthModalHost() {
  const { authOpen, closeAuth } = useAuth();
  return <AuthModal open={authOpen} onClose={closeAuth} />;
}

// Se chi accede è un amministratore, al posto del negozio mostra la
// dashboard ADMIN. Altrimenti il sito normale da cliente.
function Shell() {
  const { isAdmin } = useAuth();
  if (isAdmin) return <AdminDashboard />;

  return (
    <div id="top" className="min-h-screen bg-ink text-bone">
      <Nav />
      <main>
        <Hero />
        <Marquee />
        <ProductGrid />
        <Showcase />
        <Newsletter />
      </main>
      <Footer />
      <ProductDetail />
      <CartDrawer />
      <CookieConsent />
      <AuthModalHost />
      <WelcomeOffer />
    </div>
  );
}

export default function App() {
  useSmoothScroll();

  return (
    <AuthProvider>
    <ProductsProvider>
    <CartProvider>
      <Shell />
    </CartProvider>
    </ProductsProvider>
    </AuthProvider>
  );
}
