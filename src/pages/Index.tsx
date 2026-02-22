import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Disc3, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import AuthAccountMenu from "@/components/AuthAccountMenu";

export default function Index() {
  const [handle, setHandle] = useState("");
  const [oauthPending, setOauthPending] = useState(false);
  const navigate = useNavigate();
  const {
    initializing,
    isAuthenticated,
    sessionDid,
    activeAccount,
    signIn,
    signOut,
    authError,
    clearAuthError,
  } = useAuth();

  useEffect(() => {
    if (!handle.trim() && isAuthenticated) {
      setHandle(activeAccount?.handle ?? sessionDid ?? "");
    }
  }, [activeAccount?.handle, handle, isAuthenticated, sessionDid]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (handle.trim()) {
      navigate(`/${encodeURIComponent(handle.trim())}`);
    }
  };

  const handleOAuth = async () => {
    if (!handle.trim() || oauthPending || initializing) return;
    clearAuthError();
    setOauthPending(true);
    try {
      await signIn(handle.trim(), `/${encodeURIComponent(handle.trim())}`);
    } finally {
      setOauthPending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="mx-auto max-w-md px-4 text-center">
        <Disc3 className="mx-auto mb-4 h-14 w-14 text-primary animate-spin" style={{ animationDuration: "3s" }} />
        <h1 className="text-4xl font-bold tracking-tight text-foreground mb-2">
          teal.fm stats
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          enter a bluesky handle that uses teal.fm to track music plays
        </p>

        <AuthAccountMenu />

        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="handle.bsky.social"
            className="flex-1 bg-card border-border" />

          <Button type="submit" disabled={!handle.trim()}>
            View
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!handle.trim() || initializing || oauthPending}
            onClick={handleOAuth}
          >
            {oauthPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
          </Button>
        </form>

        {authError &&
        <p className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive text-left">
            {authError}
          </p>
        }

        {isAuthenticated && sessionDid &&
        <div className="mt-6 rounded-lg border border-border bg-card p-4 text-left">
            <p className="text-sm text-foreground">
              Signed in with AT Protocol OAuth
            </p>
            <p className="mt-1 text-xs text-muted-foreground break-all">
              {activeAccount?.handle ?? sessionDid}
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => navigate(`/${encodeURIComponent(sessionDid)}`)}
              >
                My profile
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={signOut}>
                Sign out
              </Button>
            </div>
          </div>
        }
      </div>
    </div>);

}
