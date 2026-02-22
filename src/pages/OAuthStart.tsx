import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { APP_ORIGIN, ATPROTO_ALLOWED_RETURN_ORIGINS } from "@/lib/oauth";

function normalizeReturnTo(input: string | null): string {
  if (!input) return APP_ORIGIN;
  try {
    const candidate = new URL(input);
    const origin = candidate.origin.replace(/\/$/, "");
    if (!ATPROTO_ALLOWED_RETURN_ORIGINS.includes(origin)) {
      return APP_ORIGIN;
    }
    return candidate.toString();
  } catch {
    return APP_ORIGIN;
  }
}

export default function OAuthStart() {
  const [localError, setLocalError] = useState<string | null>(null);
  const { signIn, authError, clearAuthError } = useAuth();

  const params = useMemo(() => {
    const search = new URLSearchParams(window.location.search);
    return {
      handle: search.get("handle")?.trim() ?? "",
      returnTo: normalizeReturnTo(search.get("return_to")),
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!params.handle) {
        setLocalError("Missing handle for OAuth start.");
        return;
      }
      clearAuthError();
      try {
        await signIn(params.handle, params.returnTo);
      } catch (error) {
        if (cancelled) return;
        if (error instanceof Error) setLocalError(error.message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clearAuthError, params.handle, params.returnTo, signIn]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Starting sign-in</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Redirecting to your AT Protocol OAuth provider…
        </p>
        {(localError || authError) &&
        <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {localError || authError}
          </p>
        }
      </div>
    </div>
  );
}
