import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { api, setToken, clearToken, getToken } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false); // true quando abbiamo verificato il token salvato
  const [authOpen, setAuthOpen] = useState(false); // pannello accesso/registrazione

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

  const login = useCallback(async ({ email, password }) => {
    const { user, token } = await api.login({ email, password });
    setToken(token);
    setUser(user);
    return user;
  }, []);

  const register = useCallback(async ({ username, email, password }) => {
    const { user, token } = await api.register({ username, email, password });
    setToken(token);
    setUser(user);
    return user;
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  const openAuth = useCallback(() => setAuthOpen(true), []);
  const closeAuth = useCallback(() => setAuthOpen(false), []);

  const value = useMemo(
    () => ({
      user,
      ready,
      isAuthenticated: Boolean(user),
      isAdmin: Boolean(user?.is_admin),
      login,
      register,
      logout,
      authOpen,
      openAuth,
      closeAuth,
    }),
    [user, ready, login, register, logout, authOpen, openAuth, closeAuth]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
