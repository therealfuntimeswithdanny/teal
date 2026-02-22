import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { fetchPublicProfile } from "@/lib/atproto";
import { ATPROTO_OAUTH_ORIGIN, getOAuthClient } from "@/lib/oauth";
import {
  AuthAccount,
  clearPendingHandle,
  loadActiveDid,
  loadAuthAccounts,
  loadPendingHandle,
  removeAuthAccount,
  saveActiveDid,
  saveAuthAccounts,
  savePendingHandle,
  upsertAuthAccount,
} from "@/lib/authAccounts";

interface AuthContextValue {
  initializing: boolean;
  isAuthenticated: boolean;
  sessionDid: string | null;
  activeAccount: AuthAccount | null;
  accounts: AuthAccount[];
  hasOAuthSession: boolean;
  authError: string | null;
  callbackState: string | null;
  signIn: (handle: string, state?: string) => Promise<void>;
  signOut: () => Promise<void>;
  switchAccount: (did: string) => Promise<void>;
  removeAccount: (did: string) => void;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function formatAuthError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (raw.includes('Forbidden sec-fetch-site header "same-site"')) {
    return [
      "AT Protocol OAuth blocked this request because your app domain is 'same-site' with the auth server.",
      "Use a different top-level site for login (for example your `*.vercel.app` URL), then return here.",
    ].join(" ");
  }
  return raw;
}

function consumeDidFromQueryParam(): string | null {
  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  const did = url.searchParams.get("did");
  if (!did) return null;
  url.searchParams.delete("did");
  const normalized = url.toString();
  window.history.replaceState(null, "", normalized);
  return did;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [initializing, setInitializing] = useState(true);
  const [sessionDid, setSessionDid] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<AuthAccount[]>([]);
  const [hasOAuthSession, setHasOAuthSession] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [callbackState, setCallbackState] = useState<string | null>(null);
  const accountsRef = useRef<AuthAccount[]>([]);

  useEffect(() => {
    accountsRef.current = accounts;
  }, [accounts]);

  const upsertAccount = useCallback((input: Omit<AuthAccount, "lastUsedAt"> & { lastUsedAt?: string }) => {
    setAccounts((current) => {
      const next = upsertAuthAccount(current, input);
      saveAuthAccounts(next);
      return next;
    });
  }, []);

  const hydrateAccount = useCallback(async (did: string, fallbackHandle?: string) => {
    const profile = await fetchPublicProfile(did);
    upsertAccount({
      did,
      handle: profile?.handle ?? fallbackHandle,
      displayName: profile?.displayName,
      avatar: profile?.avatar,
    });
  }, [upsertAccount]);

  useEffect(() => {
    let cancelled = false;

    const storedAccounts = loadAuthAccounts();
    setAccounts(storedAccounts);

    const didFromQuery = consumeDidFromQueryParam();
    const storedActiveDid = didFromQuery || loadActiveDid();

    if (storedActiveDid) {
      setSessionDid(storedActiveDid);
      saveActiveDid(storedActiveDid);
      void hydrateAccount(storedActiveDid);
    }

    (async () => {
      try {
        const client = await getOAuthClient();
        const result = await client.init();
        if (cancelled) return;

        let activeDid = result?.session?.did ?? storedActiveDid ?? null;
        let oauthSessionRestored = Boolean(result?.session?.did);
        const pendingHandle = loadPendingHandle();

        if (!oauthSessionRestored && activeDid) {
          try {
            await client.restore(activeDid, false);
            oauthSessionRestored = true;
          } catch {
            oauthSessionRestored = false;
          }
        }

        if (activeDid) {
          setSessionDid(activeDid);
          saveActiveDid(activeDid);
          await hydrateAccount(activeDid, pendingHandle ?? undefined);
        }

        setHasOAuthSession(oauthSessionRestored);
        setCallbackState(result?.state ? String(result.state) : null);
        clearPendingHandle();
      } catch (error) {
        if (cancelled) return;
        setAuthError(formatAuthError(error));
      } finally {
        if (!cancelled) setInitializing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrateAccount]);

  const signIn = useCallback(async (handle: string, state?: string) => {
    const normalized = handle.trim();
    if (!normalized) {
      setAuthError("Enter your Bluesky handle before signing in.");
      return;
    }

    setAuthError(null);
    savePendingHandle(normalized);

    if (typeof window !== "undefined") {
      const currentOrigin = window.location.origin;
      if (ATPROTO_OAUTH_ORIGIN && ATPROTO_OAUTH_ORIGIN !== currentOrigin) {
        const returnTo = state
          ? new URL(state, currentOrigin).toString()
          : window.location.href;
        const startUrl = new URL("/oauth/start", ATPROTO_OAUTH_ORIGIN);
        startUrl.searchParams.set("handle", normalized);
        startUrl.searchParams.set("return_to", returnTo);
        window.location.assign(startUrl.toString());
        return;
      }
    }

    try {
      const client = await getOAuthClient();
      await client.signInRedirect(normalized, {
        state,
        scope: "atproto transition:generic",
      });
    } catch (error) {
      setAuthError(formatAuthError(error));
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    if (!sessionDid) return;
    setAuthError(null);
    try {
      if (hasOAuthSession) {
        const client = await getOAuthClient();
        await client.revoke(sessionDid);
      }
    } catch (error) {
      setAuthError(formatAuthError(error));
    } finally {
      setSessionDid(null);
      setHasOAuthSession(false);
      setCallbackState(null);
      saveActiveDid(null);
    }
  }, [hasOAuthSession, sessionDid]);

  const switchAccount = useCallback(async (did: string) => {
    if (!did) return;
    if (!accountsRef.current.some((account) => account.did === did)) {
      setAuthError("That account is not available on this device.");
      return;
    }

    setAuthError(null);
    setSessionDid(did);
    setCallbackState(null);
    saveActiveDid(did);
    upsertAccount({ did });

    try {
      const client = await getOAuthClient();
      await client.restore(did, false);
      setHasOAuthSession(true);
    } catch {
      setHasOAuthSession(false);
    }

    await hydrateAccount(did, accountsRef.current.find((account) => account.did === did)?.handle);
  }, [hydrateAccount, upsertAccount]);

  const removeAccountFromList = useCallback((did: string) => {
    setAccounts((current) => {
      const next = removeAuthAccount(current, did);
      saveAuthAccounts(next);
      return next;
    });

    if (did === sessionDid) {
      setSessionDid(null);
      setHasOAuthSession(false);
      setCallbackState(null);
      saveActiveDid(null);
    }
  }, [sessionDid]);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const activeAccount = useMemo(
    () => accounts.find((account) => account.did === sessionDid) ?? null,
    [accounts, sessionDid]
  );

  const value = useMemo<AuthContextValue>(() => ({
    initializing,
    isAuthenticated: Boolean(sessionDid),
    sessionDid,
    activeAccount,
    accounts,
    hasOAuthSession,
    authError,
    callbackState,
    signIn,
    signOut,
    switchAccount,
    removeAccount: removeAccountFromList,
    clearAuthError,
  }), [
    activeAccount,
    accounts,
    authError,
    callbackState,
    clearAuthError,
    hasOAuthSession,
    initializing,
    removeAccountFromList,
    sessionDid,
    signIn,
    signOut,
    switchAccount,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
