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

    // Render (piano gratuito) si "addormenta" dopo un po' di inattività e al
    // primo accesso ci mette qualche decina di secondi a svegliarsi. Per non
    // costringere l'utente a ricaricare la pagina 2-3 volte, qui riproviamo
    // da soli con attese crescenti finché il motore non risponde con la lista
    // vera (che include anche i prodotti aggiunti di recente).
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const RETRY_DELAYS = [0, 2000, 3000, 4000, 6000, 8000, 10000, 12000]; // ~45s in totale

    (async () => {
      for (let i = 0; i < RETRY_DELAYS.length; i++) {
        if (RETRY_DELAYS[i]) await wait(RETRY_DELAYS[i]);
        if (!active) return;
        try {
          const { products: list } = await api.getProducts();
          if (!active) return;
          if (Array.isArray(list) && list.length) {
            setProducts(mergeWithLocal(list));
            setLoading(false);
            return; // riuscito: smettiamo di riprovare
          }
        } catch {
          // Motore ancora non raggiungibile (probabilmente si sta svegliando):
          // restiamo sulla lista statica e riproviamo al giro successivo.
        }
      }
      // Esauriti i tentativi: il sito resta utilizzabile con la lista statica.
      if (active) setLoading(false);
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
