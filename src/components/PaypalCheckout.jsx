import { useEffect, useRef, useState } from "react";

// Carica lo script ufficiale di PayPal una sola volta e lo riusa.
let sdkPromise = null;
let sdkKey = null;
function loadPaypalSdk(clientId, currency) {
  const key = `${clientId}:${currency}`;
  if (window.paypal && sdkKey === key) return Promise.resolve(window.paypal);
  if (sdkPromise && sdkKey === key) return sdkPromise;
  sdkKey = key;
  sdkPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src =
      `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}` +
      `&currency=${encodeURIComponent(currency)}&intent=capture`;
    s.onload = () => resolve(window.paypal);
    s.onerror = () => {
      sdkPromise = null;
      reject(new Error("Impossibile caricare PayPal."));
    };
    document.head.appendChild(s);
  });
  return sdkPromise;
}

/**
 * Pulsanti PayPal ufficiali.
 * @param onClickValidate  () => boolean  — chiamata prima di aprire PayPal; se
 *                          restituisce false il pagamento non parte.
 * @param createOrder      () => Promise<string>  — restituisce l'id ordine PayPal.
 * @param onApprove        (orderID) => Promise<void>  — pagamento approvato.
 * @param onError          (err) => void
 */
export default function PaypalCheckout({ clientId, currency = "EUR", onClickValidate, createOrder, onApprove, onError }) {
  const containerRef = useRef(null);
  const [loadError, setLoadError] = useState("");
  // Manteniamo le callback più recenti in un ref: i pulsanti PayPal vengono
  // creati una volta sola, ma devono sempre leggere lo stato aggiornato.
  const cbs = useRef({});
  cbs.current = { onClickValidate, createOrder, onApprove, onError };

  useEffect(() => {
    let buttons;
    let cancelled = false;

    loadPaypalSdk(clientId, currency)
      .then((paypal) => {
        if (cancelled || !containerRef.current) return;
        buttons = paypal.Buttons({
          style: { color: "gold", shape: "pill", label: "paypal", height: 48 },
          onClick: (_data, actions) => {
            const ok = cbs.current.onClickValidate?.();
            return ok === false ? actions.reject() : actions.resolve();
          },
          createOrder: () => cbs.current.createOrder(),
          onApprove: (data) => cbs.current.onApprove(data.orderID),
          onError: (err) => cbs.current.onError?.(err),
          onCancel: () => {},
        });
        buttons.render(containerRef.current).catch(() => {});
      })
      .catch((e) => setLoadError(e.message));

    return () => {
      cancelled = true;
      try { buttons?.close(); } catch { /* ignora */ }
    };
  }, [clientId, currency]);

  if (loadError) {
    return (
      <p className="mt-5 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-center font-mono text-[0.7rem] tracking-wide text-red-300">
        {loadError}
      </p>
    );
  }

  return <div ref={containerRef} className="mt-5 min-h-[52px]" />;
}
