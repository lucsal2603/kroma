import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { api, setToken, clearToken, getToken } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false); // true quando abbiamo verificato il token salvato
  const [authOpen, setAuthOpen] = useState(false); // pannello accesso/registrazione
  const [showWelcome, setShowWelcome] = useState(false); // popup sconto benvenuto

  // All'avvio: se c'è un token salvato, recupera il profilo.
  useEffect(() => {
    let active = true;
    (async () => {
      if (!getToken()) {
        setReady(true);
        return;
      }
      try {
        const { user } = await api.profile();
        if (active) setUser(user);
      } catch {
        clearToken(); // token scaduto o non valido
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Mostra il pop-up dello sconto ogni volta che entra un utente ancora idoneo
  // (welcome_used === false): vale per la registrazione, il login e la ricarica
  // della pagina con token salvato. La verifica delle 24h la fa WelcomeOffer,
  // quindi se il buono è scaduto il pop-up semplicemente non comparirà.
  useEffect(() => {
    if (user && user.welcome_used === false) setShowWelcome(true);
  }, [user]);

  const login = useCallback(async ({ email, password }) => {
    const { user, token } = await api.login({ email, password });
    setToken(token);
    setUser(user);
    return user;
  }, []);

  const register = useCallback(async ({ username, email, password }) => {
    const { user, token } = await api.register({ username, email, password });
    setToken(token);
    setUser(user); // il pop-up parte dall'effetto qui sopra (utente idoneo)
    return user;
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
    setShowWelcome(false);
  }, []);

  // Aggiorna localmente alcuni campi dell'utente (es. il consenso alle email)
  // senza dover ricaricare il profilo dal server.
  const updateUser = useCallback((patch) => setUser((u) => (u ? { ...u, ...patch } : u)), []);

  const openAuth = useCallback(() => setAuthOpen(true), []);
  const closeAuth = useCallback(() => setAuthOpen(false), []);
  const dismissWelcome = useCallback(() => setShowWelcome(false), []);

  const value = useMemo(
    () => ({
      user,
      ready,
      isAuthenticated: Boolean(user),
      isAdmin: Boolean(user?.is_admin),
      login,
      register,
      logout,
      updateUser,
      authOpen,
      openAuth,
      closeAuth,
      showWelcome,
      dismissWelcome,
    }),
    [user, ready, login, register, logout, updateUser, authOpen, openAuth, closeAuth, showWelcome, dismissWelcome]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
