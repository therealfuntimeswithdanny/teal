import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ATPROTO_ALLOWED_RETURN_ORIGINS } from "@/lib/oauth";

function isAllowedReturnOrigin(url: URL): boolean {
  const origin = url.origin.replace(/\/$/, "");
  return ATPROTO_ALLOWED_RETURN_ORIGINS.includes(origin);
}

export default function OAuthCallback() {
  const { initializing, sessionDid, authError, callbackState } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (initializing) return;

    if (sessionDid && callbackState) {
      if (callbackState.startsWith("/")) {
        navigate(callbackState, { replace: true });
        return;
      }

      try {
        const external = new URL(callbackState);
        if (isAllowedReturnOrigin(external)) {
          if (!external.searchParams.has("did")) {
            external.searchParams.set("did", sessionDid);
          }
          window.location.assign(external.toString());
          return;
        }
      } catch {
        // fall through to default route
      }
    }

    if (sessionDid) {
      navigate(`/${encodeURIComponent(sessionDid)}`, { replace: true });
      return;
    }

    navigate("/", { replace: true });
  }, [callbackState, initializing, navigate, sessionDid]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Finishing sign-in</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Completing your AT Protocol OAuth flow…
        </p>
        {authError &&
        <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {authError}
          </p>
        }
      </div>
    </div>
  );
}
