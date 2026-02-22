import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { usePlayRecords } from "@/hooks/use-play-records";
import { useAuth } from "@/contexts/AuthContext";
import AuthAccountMenu from "@/components/AuthAccountMenu";
import { useUserPreferences } from "@/hooks/use-user-preferences";
import {
  EMPTY_PLAY_FILTERS,
  filterPlayRecords,
  hasActivePlayFilters,
  PlayFilters,
} from "@/lib/playFilters";
import { Loader2, Disc3, ArrowLeft, Music, Clock, Users, Disc } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  AreaChart,
  Area,
} from "recharts";

export default function StatsPage() {
  const { handle: routeHandle } = useParams<{handle: string;}>();
  const [showAllArtists, setShowAllArtists] = useState(false);
  const [showAllTracks, setShowAllTracks] = useState(false);
  const [showAllAlbums, setShowAllAlbums] = useState(false);
  const [filters, setFilters] = useState<PlayFilters>({ ...EMPTY_PLAY_FILTERS });
  const [oauthPending, setOauthPending] = useState(false);

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
    cancelFetch,
  } = usePlayRecords(routeHandle);

  useEffect(() => {
    if (!isAuthenticated || !sessionDid) return;
    if (!preferencesReady) return;
    setFilters({ ...preferences.savedFilters.stats });
  }, [isAuthenticated, preferences.savedFilters.stats, preferencesReady, sessionDid]);

  useEffect(() => {
    if (!isAuthenticated || !sessionDid || !preferencesReady) return;
    setSavedFilters("stats", filters);
  }, [filters, isAuthenticated, preferencesReady, sessionDid, setSavedFilters]);

  const pinnedArtists = preferences.pinnedArtists;
  const pinnedAlbums = preferences.pinnedAlbums;

  const handleOAuthSignIn = async () => {
    const trimmed = routeHandle?.trim();
    if (!trimmed || authInitializing || oauthPending) return;
    clearAuthError();
    setOauthPending(true);
    try {
      await signIn(trimmed, `/user/${encodeURIComponent(trimmed)}/stats`);
    } finally {
      setOauthPending(false);
    }
  };

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

  const stats = useMemo(() => {
    if (filteredRecords.length === 0) return null;

    const artistCounts = new Map<string, number>();
    const trackCounts = new Map<string, {count: number;artist: string;}>();
    const albumCounts = new Map<string, {count: number;artist: string;}>();
    let totalDuration = 0;

    const dailyCounts = new Map<string, number>();
    const dailyArtistCounts = new Map<string, Map<string, number>>();

    for (const record of filteredRecords) {
      const value = record.value;
      const artist = value.artists?.map((artistItem) => artistItem.artistName).join(", ") ?? "Unknown";
      const trackName = value.trackName ?? "Untitled";

      artistCounts.set(artist, (artistCounts.get(artist) ?? 0) + 1);

      const trackKey = `${trackName} — ${artist}`;
      const existingTrack = trackCounts.get(trackKey);
      trackCounts.set(trackKey, { count: (existingTrack?.count ?? 0) + 1, artist });

      if (value.releaseName) {
        const albumKey = `${value.releaseName} — ${artist}`;
        const existingAlbum = albumCounts.get(albumKey);
        albumCounts.set(albumKey, { count: (existingAlbum?.count ?? 0) + 1, artist });
      }

      if (value.duration) totalDuration += value.duration;

      if (value.playedTime) {
        const day = value.playedTime.slice(0, 10);
        dailyCounts.set(day, (dailyCounts.get(day) ?? 0) + 1);

        if (!dailyArtistCounts.has(day)) dailyArtistCounts.set(day, new Map());
        const dayArtists = dailyArtistCounts.get(day)!;
        dayArtists.set(artist, (dayArtists.get(artist) ?? 0) + 1);
      }
    }

    const topArtists = [...artistCounts.entries()].sort((a, b) => b[1] - a[1]);
    const topTracks = [...trackCounts.entries()].sort((a, b) => b[1].count - a[1].count);
    const topAlbums = [...albumCounts.entries()].sort((a, b) => b[1].count - a[1].count);

    const hours = Math.floor(totalDuration / 3600);
    const minutes = Math.floor(totalDuration % 3600 / 60);

    const dailyTrend = [...dailyCounts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date: date.slice(5), count }));

    const top5Artists = topArtists.slice(0, 5).map(([name]) => name);
    const artistTrend = [...dailyArtistCounts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, artists]) => {
        const entry: Record<string, string | number> = { date: date.slice(5) };
        for (const artistName of top5Artists) {
          entry[artistName] = artists.get(artistName) ?? 0;
        }
        return entry;
      });

    const artistBarData = topArtists.slice(0, 15).map(([name, count]) => ({
      name: name.length > 20 ? `${name.slice(0, 18)}…` : name,
      plays: count,
    }));

    return {
      topArtists,
      topTracks,
      topAlbums,
      hours,
      minutes,
      dailyTrend,
      artistTrend,
      top5Artists,
      artistBarData,
      uniqueArtists: artistCounts.size,
      uniqueAlbums: albumCounts.size,
    };
  }, [filteredRecords]);

  const COLORS = [
    "hsl(var(--primary))",
    "hsl(var(--accent))",
    "hsl(180 60% 50%)",
    "hsl(320 60% 55%)",
    "hsl(45 80% 55%)",
  ];

  const renderList = (
    items: [string, number | { count: number; artist: string; }][],
    showAll: boolean,
    type: "artist" | "track" | "album"
  ): ReactNode => {
    if (items.length === 0) {
      return <p className="text-sm text-muted-foreground">No matching data.</p>;
    }

    const displayed = showAll ? items : items.slice(0, 20);
    const first = items[0][1];
    const maxCount = typeof first === "number" ? first : first.count;

    return displayed.map(([name, data], i) => {
      const count = typeof data === "number" ? data : data.count;
      const width = maxCount > 0 ? count / maxCount * 100 : 0;
      const [title, subtitle] = type !== "artist" ? name.split(" — ") : [name, null];
      const isPinned = type === "artist"
        ? pinnedArtists.includes(name)
        : type === "album"
          ? pinnedAlbums.includes(name)
          : false;
      return (
        <div key={name} className="flex items-center gap-3">
          <span className="w-6 text-right text-sm font-medium text-muted-foreground">{i + 1}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{title}</p>
            {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
            {type === "artist" &&
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
              </div>
            }
          </div>
          <div className="flex items-center gap-2">
            <span className="flex-shrink-0 text-sm text-muted-foreground">{count}</span>
            {isAuthenticated && type === "artist" &&
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => togglePinnedArtist(name)}
            >
                {isPinned ? "Unpin" : "Pin"}
              </Button>
            }
            {isAuthenticated && type === "album" &&
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => togglePinnedAlbum(name)}
            >
                {isPinned ? "Unpin" : "Pin"}
              </Button>
            }
          </div>
        </div>
      );
    });
  };

  const customTooltipStyle = {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
    color: "hsl(var(--foreground))",
    fontSize: "12px",
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="mb-8">
          <Link to={`/user/${encodeURIComponent(routeHandle ?? "")}`}>
            <Button variant="ghost" size="sm" className="mb-4 gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to history
            </Button>
          </Link>
          <div className="text-center">
            <Disc3 className="mx-auto mb-3 h-10 w-10 animate-spin text-primary" style={{ animationDuration: "3s" }} />
            <h1 className="text-3xl font-bold tracking-tight text-foreground">teal.fm Stats</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {routeHandle} · {filteredRecords.length} shown{filteredRecords.length !== displayRecords.length ? ` of ${displayRecords.length}` : ""} · {records.length} total loaded{loading ? "…" : ""}
            </p>
          </div>
        </div>

        {isAuthenticated ?
        <div className="mb-4">
            <AuthAccountMenu lastSyncedAt={lastSyncedAt} />
          </div> :
        <div className="mb-4 rounded-md border border-border bg-card p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Sign in with OAuth to enable saved filters and pinned artists/albums in stats.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!routeHandle?.trim() || authInitializing || oauthPending}
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
              id="stats-partial-toggle"
              checked={showPartialResults}
              onCheckedChange={(value) => setShowPartialResults(value === true)}
            />
            <label htmlFor="stats-partial-toggle" className="text-sm text-muted-foreground">
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
                key={`stats-artist:${artist}`}
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
                key={`stats-album:${album}`}
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

        {loading && displayRecords.length === 0 &&
        <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        }

        {error &&
        <p className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
        }

        {!stats && !loading && hasActivePlayFilters(filters) && displayRecords.length > 0 &&
        <p className="mb-4 rounded-md border border-border bg-card p-3 text-sm text-muted-foreground">
            No plays match the current filters.
          </p>
        }

        {stats &&
        <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <CardContent className="flex items-center gap-3 p-4">
                  <Music className="h-5 w-5 flex-shrink-0 text-primary" />
                  <div>
                    <p className="text-2xl font-bold text-foreground">{filteredRecords.length}</p>
                    <p className="text-xs text-muted-foreground">Total plays</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-3 p-4">
                  <Clock className="h-5 w-5 flex-shrink-0 text-primary" />
                  <div>
                    <p className="text-2xl font-bold text-foreground">
                      {stats.hours}h {stats.minutes}m
                    </p>
                    <p className="text-xs text-muted-foreground">Listening time</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-3 p-4">
                  <Users className="h-5 w-5 flex-shrink-0 text-primary" />
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stats.uniqueArtists}</p>
                    <p className="text-xs text-muted-foreground">Artists</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-3 p-4">
                  <Disc className="h-5 w-5 flex-shrink-0 text-primary" />
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stats.uniqueAlbums}</p>
                    <p className="text-xs text-muted-foreground">Albums</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="daily" className="w-full">
              <CardHeader className="px-0 pb-3">
                <CardTitle className="text-lg">Listening Trends</CardTitle>
              </CardHeader>
              <TabsList className="mb-4">
                <TabsTrigger value="daily">Daily Plays</TabsTrigger>
                <TabsTrigger value="artists">Top Artists Over Time</TabsTrigger>
                <TabsTrigger value="bar">Artist Breakdown</TabsTrigger>
              </TabsList>

              <TabsContent value="daily">
                <Card>
                  <CardContent className="p-4">
                    <ResponsiveContainer width="100%" height={250}>
                      <AreaChart data={stats.dailyTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                        <Tooltip contentStyle={customTooltipStyle} />
                        <Area
                          type="monotone"
                          dataKey="count"
                          stroke="hsl(var(--primary))"
                          fill="hsl(var(--primary))"
                          fillOpacity={0.2}
                          name="Plays"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="artists">
                <Card>
                  <CardContent className="p-4">
                    <ResponsiveContainer width="100%" height={250}>
                      <AreaChart data={stats.artistTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                        <Tooltip contentStyle={customTooltipStyle} />
                        {stats.top5Artists.map((artist, i) =>
                        <Area
                          key={artist}
                          type="monotone"
                          dataKey={artist}
                          stackId="1"
                          stroke={COLORS[i]}
                          fill={COLORS[i]}
                          fillOpacity={0.4}
                        />
                        )}
                      </AreaChart>
                    </ResponsiveContainer>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs">
                      {stats.top5Artists.map((artist, i) =>
                      <div key={artist} className="flex items-center gap-1.5">
                          <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COLORS[i] }} />
                          <span className="max-w-[120px] truncate text-muted-foreground">{artist}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="bar">
                <Card>
                  <CardContent className="p-4">
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={stats.artistBarData} layout="vertical" margin={{ left: 80 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={75} />
                        <Tooltip contentStyle={customTooltipStyle} />
                        <Bar dataKey="plays" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Top Artists ({stats.topArtists.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {renderList(stats.topArtists, showAllArtists, "artist")}
                {stats.topArtists.length > 20 &&
                <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => setShowAllArtists(!showAllArtists)}>
                    {showAllArtists ? "Show less" : `Show all ${stats.topArtists.length}`}
                  </Button>
                }
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Top Tracks ({stats.topTracks.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {renderList(stats.topTracks, showAllTracks, "track")}
                {stats.topTracks.length > 20 &&
                <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => setShowAllTracks(!showAllTracks)}>
                    {showAllTracks ? "Show less" : `Show all ${stats.topTracks.length}`}
                  </Button>
                }
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Top Albums ({stats.topAlbums.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {renderList(stats.topAlbums, showAllAlbums, "album")}
                {stats.topAlbums.length > 20 &&
                <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => setShowAllAlbums(!showAllAlbums)}>
                    {showAllAlbums ? "Show less" : `Show all ${stats.topAlbums.length}`}
                  </Button>
                }
              </CardContent>
            </Card>

            <p className="text-center text-xs text-muted-foreground">
              {filteredRecords.length} shown{filteredRecords.length !== displayRecords.length ? ` of ${displayRecords.length}` : ""} · {records.length} total loaded
              {isAuthenticated && activeAccount?.handle ? ` · ${activeAccount.handle}` : ""}
            </p>
          </div>
        }
      </div>
    </div>
  );
}
