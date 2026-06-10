import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { PRODUCTS as STATIC_PRODUCTS } from "../data/products";

const ProductsContext = createContext(null);

// Unisce i dati del motore (id reale dal database, prezzo) con le immagini e i
// testi locali, abbinandoli per "code". Così la grafica resta identica anche in
// locale e ogni casco porta con sé il suo id vero (serve per l'ordine).
function mergeWithLocal(remote) {
  const byCode = new Map(STATIC_PRODUCTS.map((p) => [p.code, p]));
  return remote.map((r) => {
    const local = byCode.get(r.code);
    if (!local) return r;
    return {
      ...r,
      img: local.img,
      imgBack: local.imgBack,
      swatch: local.swatch ?? r.swatch,
      specs: local.specs ?? r.specs,
      blurb: local.blurb ?? r.blurb,
      tag: local.tag ?? r.tag,
    };
  });
}

export function ProductsProvider({ children }) {
  // Parte dalla lista statica: il sito mostra subito i caschi anche se il
  // motore è in fase di avvio (Render si "sveglia" dopo qualche secondo).
  const [products, setProducts] = useState(STATIC_PRODUCTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { products: list } = await api.getProducts();
        if (active && Array.isArray(list) && list.length) {
          setProducts(mergeWithLocal(list));
        }
      } catch {
        // Motore non raggiungibile: restiamo sulla lista statica.
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(() => ({ products, loading }), [products, loading]);
  return <ProductsContext.Provider value={value}>{children}</ProductsContext.Provider>;
}

export const useProducts = () => {
  const ctx = useContext(ProductsContext);
  if (!ctx) throw new Error("useProducts must be used within ProductsProvider");
  return ctx;
};
