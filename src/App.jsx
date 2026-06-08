import { useSmoothScroll } from "./hooks/useSmoothScroll";
import { CartProvider } from "./store/cart";
import Nav from "./components/Nav";
import Hero from "./components/Hero";
import Marquee from "./components/Marquee";
import ProductGrid from "./components/ProductGrid";
import Showcase from "./components/Showcase";
import Newsletter from "./components/Newsletter";
import Footer from "./components/Footer";
import ProductDetail from "./components/ProductDetail";
import CartDrawer from "./components/CartDrawer";
import CookieConsent from "./components/CookieConsent";

export default function App() {
  useSmoothScroll();

  return (
    <CartProvider>
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
      </div>
    </CartProvider>
  );
}
