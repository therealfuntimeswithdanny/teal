import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import PlayCard from "@/components/PlayCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Loader2, Disc3, BarChart3 } from "lucide-react";
import { usePlayRecords } from "@/hooks/use-play-records";
import {
  EMPTY_PLAY_FILTERS,
  filterPlayRecords,
  hasActivePlayFilters,
  PlayFilters,
} from "@/lib/playFilters";
import { useAuth } from "@/contexts/AuthContext";

export default function UserHistory() {
  const { handle: routeHandle } = useParams<{handle: string;}>();
  const navigate = useNavigate();
  const [handle, setHandle] = useState(routeHandle ?? "");
  const [filters, setFilters] = useState<PlayFilters>({ ...EMPTY_PLAY_FILTERS });
  const [oauthPending, setOauthPending] = useState(false);

  const {
    initializing: authInitializing,
    isAuthenticated,
    sessionDid,
    signIn,
    signOut,
    authError,
    clearAuthError,
  } = useAuth();

  const {
    records,
    displayRecords,
    loading,
    error,
    progress,
    showPartialResults,
    setShowPartialResults,
    lastSyncedAt,
    loadForHandle,
    cancelFetch,
  } = usePlayRecords(routeHandle);

  useEffect(() => {
    setHandle(routeHandle ?? "");
  }, [routeHandle]);

  const filteredRecords = useMemo(
    () => filterPlayRecords(displayRecords, filters),
    [displayRecords, filters]
  );

  const progressValue = useMemo(() => {
    if (!progress.estimatedTotal || progress.estimatedTotal <= 0) return 0;
    const value = progress.loadedCount / progress.estimatedTotal * 100;
    if (loading && progress.hasNext) {
      return Math.max(2, Math.min(99, value));
    }
    return Math.max(0, Math.min(100, value));
  }, [loading, progress]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = handle.trim();
    if (!trimmed) return;
    if (trimmed === routeHandle) {
      void loadForHandle(trimmed);
      return;
    }
    navigate(`/user/${encodeURIComponent(trimmed)}`, { replace: true });
  };

  const handleOAuthSignIn = async () => {
    if (!handle.trim() || authInitializing || oauthPending) return;
    clearAuthError();
    setOauthPending(true);
    try {
      await signIn(handle.trim(), `/user/${encodeURIComponent(handle.trim())}`);
    } finally {
      setOauthPending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-xl px-4 py-12">
        <div className="mb-8 text-center">
          <Link to="/">
            <Disc3 className="mx-auto mb-3 h-10 w-10 text-primary animate-spin" style={{ animationDuration: "3s" }} />
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
             teal.fm Play History
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            View teal.fm plays for anyone on the AT Protocol (Bluesky)
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mb-8 flex gap-2">
          <Input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="handle.bsky.social" className="flex-1 bg-card border-border" />

          <Button type="submit" disabled={!handle.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Fetch"}
          </Button>
        </form>

        <div className="mb-4 rounded-md border border-border bg-card p-3">
          {isAuthenticated && sessionDid ?
          <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-foreground">Signed in with AT Protocol OAuth</p>
                <p className="text-xs text-muted-foreground break-all">{sessionDid}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/user/${encodeURIComponent(sessionDid)}`, { replace: true })}
                >
                  My history
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={signOut}>
                  Sign out
                </Button>
              </div>
            </div> :
          <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Sign in with OAuth to use your own account identity.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!handle.trim() || authInitializing || oauthPending}
                onClick={handleOAuthSignIn}
              >
                {oauthPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
              </Button>
            </div>
          }
          {authError &&
          <p className="mt-2 text-sm text-destructive">{authError}</p>
          }
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-4 rounded-md border border-border bg-card/40 px-3 py-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="history-partial-toggle"
              checked={showPartialResults}
              onCheckedChange={(value) => setShowPartialResults(value === true)}
            />
            <label htmlFor="history-partial-toggle" className="text-sm text-muted-foreground">
              Show partial results while syncing
            </label>
          </div>
          {loading &&
          <Button type="button" variant="outline" size="sm" onClick={cancelFetch}>
              Cancel sync
            </Button>
          }
          {lastSyncedAt &&
          <span className="text-xs text-muted-foreground">
              Cache updated {new Date(lastSyncedAt).toLocaleString()}
            </span>
          }
        </div>

        {loading &&
        <div className="mb-4 rounded-md border border-border bg-card p-3">
            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">
                {progress.loadedCount} plays from {progress.pagesLoaded} pages
              </span>
              <span className="text-muted-foreground">
                {progress.estimatedTotal ? `~${progress.estimatedTotal} plays / ~${progress.estimatedPages ?? "?"} pages` : "Estimating…"}
              </span>
            </div>
            <Progress value={progressValue} className="h-2" />
            {progress.fromCache &&
            <p className="mt-2 text-xs text-muted-foreground">
                Loaded {progress.cacheCount} cached plays, +{progress.newCount} new this sync
              </p>
            }
          </div>
        }

        <div className="mb-4 rounded-md border border-border bg-card p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Input
              placeholder="Track contains…"
              value={filters.track}
              onChange={(e) => setFilters((current) => ({ ...current, track: e.target.value }))}
            />
            <Input
              placeholder="Artist contains…"
              value={filters.artist}
              onChange={(e) => setFilters((current) => ({ ...current, artist: e.target.value }))}
            />
            <Input
              placeholder="Album contains…"
              value={filters.album}
              onChange={(e) => setFilters((current) => ({ ...current, album: e.target.value }))}
            />
          </div>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <Input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters((current) => ({ ...current, dateFrom: e.target.value }))}
            />
            <Input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters((current) => ({ ...current, dateTo: e.target.value }))}
            />
            <Button
              type="button"
              variant="ghost"
              onClick={() => setFilters({ ...EMPTY_PLAY_FILTERS })}
              disabled={!hasActivePlayFilters(filters)}
            >
              Clear filters
            </Button>
          </div>
        </div>

        {error &&
        <p className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        }

        {records.length > 0 && routeHandle &&
        <div className="mb-4 flex justify-end">
            <Link to={`/user/${encodeURIComponent(routeHandle)}/stats`}>
              <Button variant="outline" size="sm" className="gap-2">
                <BarChart3 className="h-4 w-4" />
                Stats
              </Button>
            </Link>
          </div>
        }

        <div className="space-y-2">
          {filteredRecords.map((r) =>
          <PlayCard key={r.uri} record={r} />
          )}
        </div>

        {filteredRecords.length === 0 && hasActivePlayFilters(filters) &&
        <p className="mt-4 text-center text-sm text-muted-foreground">
            No plays match the current filters.
          </p>
        }

        {displayRecords.length > 0 && !loading &&
        <p className="mt-6 text-center text-xs text-muted-foreground">
            {filteredRecords.length} shown{filteredRecords.length !== displayRecords.length ? ` of ${displayRecords.length}` : ""} · {records.length} total loaded
          </p>
        }
      </div>
    </div>);

}
