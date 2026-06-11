import { createContext, useContext, useMemo, useState, useCallback } from "react";
import { effectivePrice } from "../data/products";

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [product, setProduct] = useState(null); // prodotto aperto nella scheda

  const add = useCallback((p, size) => {
    const id = `${p.code}-${size}`;
    setItems((prev) => {
      const found = prev.find((it) => it.id === id);
      if (found) return prev.map((it) => (it.id === id ? { ...it, qty: it.qty + 1 } : it));
      // `price` è quello effettivo (scontato se in saldo); `listPrice` è il
      // prezzo pieno, usato per mostrarlo barrato. Il server ricalcola comunque.
      return [...prev, { id, productId: p.id, code: p.code, brand: p.brand, model: p.model, name: p.name, price: effectivePrice(p), listPrice: Number(p.price), img: p.img, color: p.color, size, qty: 1 }];
    });
    setProduct(null);
    setCartOpen(true);
    // Avvisa il resto del sito che è stato aggiunto un prodotto: serve a
    // ReviewPrompt per chiedere (una volta a sessione) una valutazione.
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("kroma:added-to-cart"));
    }
  }, []);

  const setQty = useCallback((id, qty) => {
    setItems((prev) =>
      qty <= 0 ? prev.filter((it) => it.id !== id) : prev.map((it) => (it.id === id ? { ...it, qty } : it))
    );
  }, []);

  const remove = useCallback((id) => setItems((prev) => prev.filter((it) => it.id !== id)), []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo(() => {
    const count = items.reduce((n, it) => n + it.qty, 0);
    const subtotal = items.reduce((n, it) => n + it.qty * it.price, 0);
    return {
      items, count, subtotal,
      add, setQty, remove, clear,
      cartOpen, openCart: () => setCartOpen(true), closeCart: () => setCartOpen(false),
      product, openProduct: setProduct, closeProduct: () => setProduct(null),
    };
  }, [items, cartOpen, product, add, setQty, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
};
