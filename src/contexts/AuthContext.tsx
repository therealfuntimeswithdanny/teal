import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getOAuthClient } from "@/lib/oauth";

interface AuthContextValue {
  initializing: boolean;
  isAuthenticated: boolean;
  sessionDid: string | null;
  authError: string | null;
  callbackState: string | null;
  signIn: (handle: string, state?: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [initializing, setInitializing] = useState(true);
  const [sessionDid, setSessionDid] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [callbackState, setCallbackState] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const client = await getOAuthClient();
        const result = await client.init();
        if (cancelled) return;
        setSessionDid(result?.session?.did ?? null);
        setCallbackState(result?.state ? String(result.state) : null);
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Failed to initialize OAuth session.";
        setAuthError(message);
      } finally {
        if (!cancelled) setInitializing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (handle: string, state?: string) => {
    const normalized = handle.trim();
    if (!normalized) {
      setAuthError("Enter your Bluesky handle before signing in.");
      return;
    }

    setAuthError(null);
    const client = await getOAuthClient();
    await client.signInRedirect(normalized, {
      state,
      scope: "atproto transition:generic",
    });
  }, []);

  const signOut = useCallback(async () => {
    if (!sessionDid) return;
    setAuthError(null);
    try {
      const client = await getOAuthClient();
      await client.revoke(sessionDid);
      setSessionDid(null);
      setCallbackState(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to sign out.";
      setAuthError(message);
    }
  }, [sessionDid]);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const value = useMemo<AuthContextValue>(() => ({
    initializing,
    isAuthenticated: Boolean(sessionDid),
    sessionDid,
    authError,
    callbackState,
    signIn,
    signOut,
    clearAuthError,
  }), [authError, callbackState, clearAuthError, initializing, sessionDid, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
