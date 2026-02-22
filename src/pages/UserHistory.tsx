import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import PlayCard from "@/components/PlayCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import AuthAccountMenu from "@/components/AuthAccountMenu";
import { useUserPreferences } from "@/hooks/use-user-preferences";
import { trackPreferenceKey } from "@/lib/userPreferences";

interface TrackDraft {
  note: string;
  tags: string;
}

export default function UserHistory() {
  const { handle: routeHandle } = useParams<{handle: string;}>();
  const navigate = useNavigate();
  const [handle, setHandle] = useState(routeHandle ?? "");
  const [filters, setFilters] = useState<PlayFilters>({ ...EMPTY_PLAY_FILTERS });
  const [oauthPending, setOauthPending] = useState(false);
  const [editingTrackKey, setEditingTrackKey] = useState<string | null>(null);
  const [trackDrafts, setTrackDrafts] = useState<Record<string, TrackDraft>>({});

  const {
    initializing: authInitializing,
    isAuthenticated,
    sessionDid,
    activeAccount,
    signIn,
    authError,
    clearAuthError,
  } = useAuth();

  const {
    preferences,
    ready: preferencesReady,
    setSavedFilters,
    togglePinnedArtist,
    togglePinnedAlbum,
    setTrackPreference,
  } = useUserPreferences(isAuthenticated ? sessionDid : null);

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

  useEffect(() => {
    if (!isAuthenticated || !sessionDid) return;
    if (!preferencesReady) return;
    setFilters({ ...preferences.savedFilters.history });
  }, [isAuthenticated, preferences.savedFilters.history, preferencesReady, sessionDid]);

  useEffect(() => {
    if (!isAuthenticated || !sessionDid || !preferencesReady) return;
    setSavedFilters("history", filters);
  }, [filters, isAuthenticated, preferencesReady, sessionDid, setSavedFilters]);

  const pinnedArtists = preferences.pinnedArtists;
  const pinnedAlbums = preferences.pinnedAlbums;

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

  const openTrackEditor = (
    key: string,
    existing: { note: string; tags: string[] } | undefined
  ) => {
    setTrackDrafts((current) => ({
      ...current,
      [key]: {
        note: existing?.note ?? "",
        tags: existing?.tags?.join(", ") ?? "",
      },
    }));
    setEditingTrackKey(key);
  };

  const saveTrackDraft = (key: string) => {
    const draft = trackDrafts[key] ?? { note: "", tags: "" };
    const tags = draft.tags.split(",").map((tag) => tag.trim()).filter(Boolean);
    setTrackPreference(key, draft.note, tags);
    setEditingTrackKey(null);
  };

  const clearTrackDraft = (key: string) => {
    setTrackPreference(key, "", []);
    setTrackDrafts((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    setEditingTrackKey(null);
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

        <form onSubmit={handleSubmit} className="mb-6 flex gap-2">
          <Input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="handle.bsky.social" className="flex-1 bg-card border-border" />
          <Button type="submit" disabled={!handle.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Fetch"}
          </Button>
        </form>

        {isAuthenticated ?
        <div className="mb-4">
            <AuthAccountMenu lastSyncedAt={lastSyncedAt} />
          </div> :
        <div className="mb-4 rounded-md border border-border bg-card p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Sign in with OAuth to enable saved filters, pinned artists/albums, and private notes.
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
            {authError &&
            <p className="mt-2 text-sm text-destructive">{authError}</p>
            }
          </div>
        }

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

        {isAuthenticated && (pinnedArtists.length > 0 || pinnedAlbums.length > 0) &&
        <div className="mb-4 rounded-md border border-border bg-card p-3">
            <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Pinned</p>
            <div className="flex flex-wrap gap-2">
              {pinnedArtists.map((artist) =>
              <Button
                key={`artist:${artist}`}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setFilters((current) => ({ ...current, artist }))}
              >
                  Artist: {artist}
                </Button>
              )}
              {pinnedAlbums.map((album) =>
              <Button
                key={`album:${album}`}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setFilters((current) => ({ ...current, album: album.split(" — ")[0] ?? album }))}
              >
                  Album: {album}
                </Button>
              )}
            </div>
          </div>
        }

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

        <div className="space-y-3">
          {filteredRecords.map((record) => {
            const key = trackPreferenceKey(record);
            const pref = preferences.trackPreferences[key];
            const draft = trackDrafts[key] ?? {
              note: pref?.note ?? "",
              tags: pref?.tags?.join(", ") ?? "",
            };
            const artist = record.value.artists?.map((item) => item.artistName).join(", ") ?? "Unknown";
            const album = record.value.releaseName;

            return (
              <div key={record.uri} className="space-y-1">
                <PlayCard record={record} />
                {isAuthenticated &&
                <div className="rounded-md border border-border bg-card/50 p-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => togglePinnedArtist(artist)}
                      >
                        {pinnedArtists.includes(artist) ? "Unpin artist" : "Pin artist"}
                      </Button>
                      {album &&
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => togglePinnedAlbum(`${album} — ${artist}`)}
                      >
                          {pinnedAlbums.includes(`${album} — ${artist}`) ? "Unpin album" : "Pin album"}
                        </Button>
                      }
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => openTrackEditor(key, pref)}
                      >
                        {pref ? "Edit note/tags" : "Add note/tags"}
                      </Button>
                    </div>

                    {pref &&
                    <div className="mt-2 text-xs text-muted-foreground space-y-1">
                        {pref.tags.length > 0 &&
                        <p>Tags: {pref.tags.join(", ")}</p>
                        }
                        {pref.note && <p>Note: {pref.note}</p>}
                      </div>
                    }

                    {editingTrackKey === key &&
                    <div className="mt-2 space-y-2">
                        <Input
                          value={draft.tags}
                          onChange={(e) =>
                            setTrackDrafts((current) => ({
                              ...current,
                              [key]: { ...draft, tags: e.target.value },
                            }))}
                          placeholder="tag1, tag2"
                        />
                        <Textarea
                          value={draft.note}
                          onChange={(e) =>
                            setTrackDrafts((current) => ({
                              ...current,
                              [key]: { ...draft, note: e.target.value },
                            }))}
                          placeholder="Private note for this track"
                          rows={3}
                        />
                        <div className="flex gap-2">
                          <Button type="button" size="sm" onClick={() => saveTrackDraft(key)}>
                            Save
                          </Button>
                          <Button type="button" variant="outline" size="sm" onClick={() => clearTrackDraft(key)}>
                            Clear
                          </Button>
                          <Button type="button" variant="ghost" size="sm" onClick={() => setEditingTrackKey(null)}>
                            Close
                          </Button>
                        </div>
                      </div>
                    }
                  </div>
                }
              </div>
            );
          })}
        </div>

        {filteredRecords.length === 0 && hasActivePlayFilters(filters) &&
        <p className="mt-4 text-center text-sm text-muted-foreground">
            No plays match the current filters.
          </p>
        }

        {displayRecords.length > 0 && !loading &&
        <p className="mt-6 text-center text-xs text-muted-foreground">
            {filteredRecords.length} shown{filteredRecords.length !== displayRecords.length ? ` of ${displayRecords.length}` : ""} · {records.length} total loaded
            {isAuthenticated && activeAccount?.handle ? ` · ${activeAccount.handle}` : ""}
          </p>
        }
      </div>
    </div>
  );
}
