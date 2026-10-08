import {usePortalSessionLimit, PortalUpdateNotice} from './PortalSessionPolicy';
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import portalAdapter from "@/services/portalAdapter";

const PortalAuthContext = createContext(null);

// Auth states: loading | unauthenticated | requiresMfa | authenticated
export function PortalAuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [status, setStatus] = useState("loading");
  const [pendingMfa, setPendingMfa] = useState(null); // { email, methods, trustDevice }
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setStatus("loading");
    try {
      const s = await portalAdapter.auth.getSession();
      if (s) { setSession(s); setStatus("authenticated"); }
      else { setSession(null); setStatus("unauthenticated"); }
    } catch {
      setSession(null); setStatus("unauthenticated");
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const signIn = useCallback(async ({ email, password, trustDevice }) => {
    setError(null);
    const res = await portalAdapter.auth.createSession({ email, password, trustDevice });
    if (res && res.status === "mfa_required") {
      setPendingMfa({ email: res.email, methods: res.methods, trustDevice: !!res.trustDevice });
      setStatus("requiresMfa");
      return { requiresMfa: true };
    }
    setSession(res); setStatus("authenticated");
    return { requiresMfa: false };
  }, []);

  const verifyMfa = useCallback(async ({ code, method, trustDevice }) => {
    setError(null);
    const s = await portalAdapter.auth.verifyMfa({ code, method, trustDevice });
    setSession(s); setPendingMfa(null); setStatus("authenticated");
    return s;
  }, []);

  const cancelMfa = useCallback(() => {
    setPendingMfa(null); setStatus("unauthenticated");
  }, []);

  const signOut = useCallback(async () => {
    localStorage.removeItem('gms-customer-session-activity');
    if (portalAdapter.isBypassMode()) {
      const s = await portalAdapter.auth.getSession();
      setSession(s);
      setPendingMfa(null);
      setStatus("authenticated");
      return;
    }
    try { await portalAdapter.auth.deleteSession(); } catch { /* ignore */ }
    setSession(null); setPendingMfa(null); setStatus("unauthenticated");
  }, []);

  usePortalSessionLimit(status === 'authenticated' && !portalAdapter.isBypassMode(), signOut, 'gms-customer');
  const value = { session, status, pendingMfa, error, setError, signIn, verifyMfa, cancelMfa, signOut, refresh, isPreview: portalAdapter.isPreviewMode };
  return <PortalAuthContext.Provider value={value}><PortalUpdateNotice />{children}</PortalAuthContext.Provider>;
}

export function usePortalAuth() {
  const ctx = useContext(PortalAuthContext);
  if (!ctx) throw new Error("usePortalAuth must be used within PortalAuthProvider");
  return ctx;
}
