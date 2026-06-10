import { useEffect, useRef, useState } from "react";
import { gsap } from "../lib/gsap";
import { useCart } from "../store/cart";
import { useAuth } from "../store/auth";
import Logo from "./Logo";
import OrdersModal from "./OrdersModal";

export default function Nav() {
  const { count, openCart } = useCart();
  const { user, isAuthenticated, logout, openAuth } = useAuth();
  const navRef = useRef(null);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);

  // Sfondo nero solo dopo aver superato l'hero (l'uomo col casco).
  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > window.innerHeight - 90);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    const ctx = gsap.context(() => {
      gsap.from(el.querySelectorAll("[data-nav]"), {
        y: -24,
        opacity: 0,
        duration: 0.9,
        ease: "expo.out",
        stagger: 0.08,
        delay: 0.2,
      });
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <header
      ref={navRef}
      className={
        "fixed top-0 left-0 z-50 w-full transition-colors duration-500 " +
        (scrolled
          ? "border-b border-line bg-ink/85 backdrop-blur-md"
          : "border-b border-transparent bg-transparent")
      }
    >
      <nav className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-5 lg:px-10">
        <a data-nav href="#top" aria-label="KROMA — home">
          <Logo markClass="h-8 w-8" textClass="text-2xl" />
        </a>
        <ul className="hidden gap-9 font-mono text-xs tracking-[0.18em] text-muted uppercase md:flex">
          {[
            ["Collezione", "#collezione"],
            ["Tecnologia", "#tech"],
          ].map(([label, href]) => (
            <li data-nav key={href}>
              <a href={href} className="transition-colors duration-300 hover:text-bone">
                {label}
              </a>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <div data-nav className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                aria-label={`Account di ${user.username}`}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-volt/50 bg-volt/10 font-mono text-sm font-bold text-volt uppercase transition-colors duration-300 hover:border-volt"
              >
                {user.username.charAt(0)}
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-2xl border border-line bg-elevated shadow-xl">
                    <div className="border-b border-line px-4 py-3">
                      <p className="font-mono text-[0.6rem] tracking-wider text-muted uppercase">Connesso come</p>
                      <p className="truncate font-display text-lg text-bone">{user.username}</p>
                      <p className="text-faint truncate text-xs">{user.email}</p>
                    </div>
                    <button
                      onClick={() => {
                        setOrdersOpen(true);
                        setMenuOpen(false);
                      }}
                      className="block w-full border-b border-line px-4 py-3 text-left font-mono text-xs tracking-wider text-bone uppercase transition-colors hover:bg-ink"
                    >
                      I miei ordini
                    </button>
                    <button
                      onClick={() => {
                        logout();
                        setMenuOpen(false);
                      }}
                      className="block w-full px-4 py-3 text-left font-mono text-xs tracking-wider text-bone uppercase transition-colors hover:bg-ink"
                    >
                      Esci
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              data-nav
              onClick={openAuth}
              aria-label="Accedi al tuo account"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-bone transition-colors duration-300 hover:border-bone/40"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
                <circle cx="12" cy="8" r="3.6" stroke="currentColor" strokeWidth="1.7" />
                <path d="M4.5 19.5a7.5 7.5 0 0 1 15 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            </button>
          )}

          <button
            data-nav
            onClick={openCart}
            className="relative inline-flex items-center gap-2 rounded-full border border-line px-5 py-2.5 font-mono text-xs tracking-[0.18em] text-bone uppercase transition-colors duration-300 hover:border-bone/40"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
              <path d="M3 4h2l2.4 12.2a1.6 1.6 0 0 0 1.57 1.3h8.06a1.6 1.6 0 0 0 1.57-1.27L21 8H6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="9.5" cy="20" r="1.4" fill="currentColor" />
              <circle cx="18" cy="20" r="1.4" fill="currentColor" />
            </svg>
            Carrello
            {count > 0 && (
              <span className="anim-pulse absolute -top-2 -right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-volt px-1 font-mono text-[0.62rem] font-bold text-black">
                {count}
              </span>
            )}
          </button>
        </div>
      </nav>

      <OrdersModal open={ordersOpen} onClose={() => setOrdersOpen(false)} />
    </header>
  );
}
