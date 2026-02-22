import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import PlayCard from "@/components/PlayCard";
import { usePlayRecords } from "@/hooks/use-play-records";
import { useAuth } from "@/contexts/AuthContext";
import AuthAccountMenu from "@/components/AuthAccountMenu";
import {
  createPinRecord,
  fetchArtistSongs,
  fetchPinRecords,
  fetchPublicProfile,
  searchArtists,
  type ArtistSearchResult,
  type ArtistSongResult,
  type PinRecord,
  type PlayRecord,
  type PublicProfile,
  resolvePdsEndpoint,
} from "@/lib/atproto";
import { Loader2, Disc3, ArrowLeft, Music, Clock, Users, Disc, Pin } from "lucide-react";
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

interface ProfilePin {
  id: string;
  type: "album" | "song" | "artist";
  title: string;
  subtitle?: string;
}

function normalizeLabel(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function songPinKey(title: string, artist: string): string {
  return `${normalizeLabel(title)}::${normalizeLabel(artist)}`;
}

function parsePinRecord(pin: PinRecord): ProfilePin | null {
  const value = pin.value ?? {};
  const rawType = [value.pinType, value.kind, value.type].filter(Boolean).join(" ").toLowerCase();

  const artistFromList = value.artists
    ?.map((artist) => artist.artistName ?? artist.name)
    .filter(Boolean)
    .join(", ");
  const artist = value.artistName ?? artistFromList;

  const trackTitle = value.trackName ?? value.songName;
  const albumTitle = value.releaseName ?? value.albumName;

  let type: "album" | "song" | "artist";
  if (rawType.includes("artist")) {
    type = "artist";
  } else if (rawType.includes("album")) {
    type = "album";
  } else if (rawType.includes("song") || rawType.includes("track")) {
    type = "song";
  } else if (albumTitle && !trackTitle) {
    type = "album";
  } else {
    type = "song";
  }

  const title = type === "album"
    ? (albumTitle ?? value.title ?? value.text)
    : type === "artist"
      ? (artist ?? value.title ?? value.text)
      : (trackTitle ?? value.title ?? value.text);

  if (!title) return null;

  return {
    id: pin.uri,
    type,
    title,
    subtitle: type === "artist" ? undefined : artist,
  };
}

export default function StatsPage() {
  const { handle: routeHandle } = useParams<{handle: string;}>();
  const [searchQuery, setSearchQuery] = useState("");
  const [oauthPending, setOauthPending] = useState(false);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [pinnedFromRepo, setPinnedFromRepo] = useState<ProfilePin[]>([]);
  const [pinsLoading, setPinsLoading] = useState(false);
  const [pinsReloadKey, setPinsReloadKey] = useState(0);
  const [pinActionKey, setPinActionKey] = useState<string | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);

  const [artistQuery, setArtistQuery] = useState("");
  const [artistResults, setArtistResults] = useState<ArtistSearchResult[]>([]);
  const [artistSearchLoading, setArtistSearchLoading] = useState(false);
  const [artistSearchError, setArtistSearchError] = useState<string | null>(null);
  const [selectedArtist, setSelectedArtist] = useState<ArtistSearchResult | null>(null);
  const [selectedArtistSongs, setSelectedArtistSongs] = useState<ArtistSongResult[]>([]);
  const [artistSongsLoading, setArtistSongsLoading] = useState(false);
  const [artistSongsError, setArtistSongsError] = useState<string | null>(null);

  const {
    initializing: authInitializing,
    isAuthenticated,
    hasOAuthSession,
    sessionDid,
    activeAccount,
    signIn,
    authError,
    clearAuthError,
  } = useAuth();

  const {
    records,
    displayRecords,
    loading,
    error,
    progress,
    lastSyncedAt,
    resolvedDid,
  } = usePlayRecords(routeHandle);

  useEffect(() => {
    let cancelled = false;
    const actor = resolvedDid ?? routeHandle?.trim();
    if (!actor) {
      setProfile(null);
      return;
    }

    void (async () => {
      const next = await fetchPublicProfile(actor);
      if (!cancelled) {
        setProfile(next);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [resolvedDid, routeHandle]);

  useEffect(() => {
    let cancelled = false;

    if (!resolvedDid) {
      setPinnedFromRepo([]);
      return;
    }

    void (async () => {
      setPinsLoading(true);
      try {
        const pds = await resolvePdsEndpoint(resolvedDid);
        const allPins: PinRecord[] = [];
        let cursor: string | undefined;

        while (true) {
          const response = await fetchPinRecords(resolvedDid, cursor, { pds });
          allPins.push(...response.records);
          if (!response.cursor || response.records.length === 0) break;
          cursor = response.cursor;
        }

        if (cancelled) return;

        const deduped = new Set<string>();
        const parsed = allPins
          .map(parsePinRecord)
          .filter((pin): pin is ProfilePin => Boolean(pin))
          .filter((pin) => {
            const key = `${pin.type}:${normalizeLabel(pin.title)}:${normalizeLabel(pin.subtitle)}`;
            if (deduped.has(key)) return false;
            deduped.add(key);
            return true;
          });

        setPinnedFromRepo(parsed);
      } catch {
        if (!cancelled) {
          setPinnedFromRepo([]);
        }
      } finally {
        if (!cancelled) {
          setPinsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pinsReloadKey, resolvedDid]);

  const handleOAuthSignIn = async () => {
    const trimmed = routeHandle?.trim();
    if (!trimmed || authInitializing || oauthPending) return;
    clearAuthError();
    setOauthPending(true);
    try {
      await signIn(trimmed, `/${encodeURIComponent(trimmed)}`);
    } finally {
      setOauthPending(false);
    }
  };

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredRecords = useMemo(() => {
    if (!normalizedSearch) return displayRecords;

    return displayRecords.filter((record) => {
      const track = (record.value.trackName ?? "").toLowerCase();
      const artist = (record.value.artists?.map((item) => item.artistName).join(", ") ?? "").toLowerCase();
      const album = (record.value.releaseName ?? "").toLowerCase();
      return track.includes(normalizedSearch) || artist.includes(normalizedSearch) || album.includes(normalizedSearch);
    });
  }, [displayRecords, normalizedSearch]);

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
    const albumCounts = new Map<string, {count: number;artist: string;}>();
    let totalDuration = 0;

    const dailyCounts = new Map<string, number>();
    const dailyArtistCounts = new Map<string, Map<string, number>>();

    for (const record of filteredRecords) {
      const value = record.value;
      const artist = value.artists?.map((artistItem) => artistItem.artistName).join(", ") ?? "Unknown";

      artistCounts.set(artist, (artistCounts.get(artist) ?? 0) + 1);

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

  const pinnedAlbums = pinnedFromRepo.filter((item) => item.type === "album");
  const pinnedSongs = pinnedFromRepo.filter((item) => item.type === "song");
  const pinnedArtists = pinnedFromRepo.filter((item) => item.type === "artist");

  const pinnedSongKeys = useMemo(() => {
    return new Set(pinnedSongs.map((item) => songPinKey(item.title, item.subtitle ?? "")));
  }, [pinnedSongs]);

  const pinnedArtistKeys = useMemo(() => {
    return new Set(pinnedArtists.map((item) => normalizeLabel(item.title)));
  }, [pinnedArtists]);

  const queuePinReload = () => {
    if (sessionDid && resolvedDid && sessionDid === resolvedDid) {
      setPinsReloadKey((current) => current + 1);
    }
  };

  const handlePinSong = async (record: PlayRecord) => {
    if (!sessionDid || !hasOAuthSession) {
      setPinError("Sign in to pin songs.");
      return;
    }

    const trackName = record.value.trackName ?? "Untitled";
    const artistName = record.value.artists?.map((item) => item.artistName).join(", ") ?? "Unknown";
    const actionKey = `song:${trackName}:${artistName}`;

    setPinError(null);
    setPinActionKey(actionKey);

    try {
      await createPinRecord(sessionDid, {
        pinType: "song",
        title: trackName,
        trackName,
        artistName,
        releaseName: record.value.releaseName,
        originUrl: record.value.originUrl,
        sourceRecordUri: record.uri,
      });
      queuePinReload();
    } catch (pinRecordError) {
      setPinError(pinRecordError instanceof Error ? pinRecordError.message : "Failed to pin song");
    } finally {
      setPinActionKey((current) => (current === actionKey ? null : current));
    }
  };

  const handlePinArtist = async (artistName: string) => {
    if (!sessionDid || !hasOAuthSession) {
      setPinError("Sign in to pin artists.");
      return;
    }

    const normalizedArtist = artistName.trim();
    if (!normalizedArtist) return;

    const actionKey = `artist:${normalizedArtist}`;
    setPinError(null);
    setPinActionKey(actionKey);

    try {
      await createPinRecord(sessionDid, {
        pinType: "artist",
        title: normalizedArtist,
        artistName: normalizedArtist,
      });
      queuePinReload();
    } catch (pinRecordError) {
      setPinError(pinRecordError instanceof Error ? pinRecordError.message : "Failed to pin artist");
    } finally {
      setPinActionKey((current) => (current === actionKey ? null : current));
    }
  };

  const runArtistSearch = async () => {
    const trimmed = artistQuery.trim();
    if (!trimmed) {
      setArtistResults([]);
      setArtistSearchError(null);
      return;
    }

    setArtistSearchError(null);
    setArtistSearchLoading(true);

    try {
      const results = await searchArtists(trimmed);
      setArtistResults(results);
    } catch (searchError) {
      setArtistSearchError(searchError instanceof Error ? searchError.message : "Failed to search artists");
      setArtistResults([]);
    } finally {
      setArtistSearchLoading(false);
    }
  };

  const handleArtistSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void runArtistSearch();
  };

  const viewArtistSongs = async (artist: ArtistSearchResult) => {
    setSelectedArtist(artist);
    setArtistSongsError(null);
    setArtistSongsLoading(true);

    try {
      const songs = await fetchArtistSongs(artist.artistId);
      setSelectedArtistSongs(songs);
    } catch (songsError) {
      setArtistSongsError(songsError instanceof Error ? songsError.message : "Failed to load artist songs");
      setSelectedArtistSongs([]);
    } finally {
      setArtistSongsLoading(false);
    }
  };

  const COLORS = [
    "hsl(var(--primary))",
    "hsl(var(--accent))",
    "hsl(180 60% 50%)",
    "hsl(320 60% 55%)",
    "hsl(45 80% 55%)",
  ];

  const customTooltipStyle = {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
    color: "hsl(var(--foreground))",
    fontSize: "12px",
  };

  const profileName = profile?.displayName || profile?.handle || routeHandle || "Profile";
  const profileHandle = profile?.handle || routeHandle || "";

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      <header className="sticky top-0 z-20 border-b border-border/50 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Home
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Disc3 className="h-5 w-5 animate-spin text-primary" style={{ animationDuration: "3s" }} />
              <span className="text-sm font-semibold tracking-wide">teal.fm</span>
            </div>
          </div>
          {isAuthenticated ?
          <AuthAccountMenu lastSyncedAt={lastSyncedAt} /> :
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!routeHandle?.trim() || authInitializing || oauthPending}
            onClick={handleOAuthSignIn}
          >
              {oauthPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
            </Button>
          }
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        {authError &&
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{authError}</p>
        }

        {pinError &&
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{pinError}</p>
        }

        <section className="grid gap-4 lg:grid-cols-[1.2fr_2fr]">
          <Card className="border-border/60">
            <CardContent className="flex flex-col gap-4 p-5">
              <div className="flex items-start gap-4">
                <Avatar className="h-16 w-16 border border-border">
                  <AvatarImage src={profile?.avatar} alt={profileName} />
                  <AvatarFallback>{profileName.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-xl font-semibold text-foreground">{profileName}</p>
                  <p className="truncate text-sm text-muted-foreground">@{profileHandle}</p>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {profile?.description || "No bio available for this profile yet."}
              </p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <Clock className="h-5 w-5 flex-shrink-0 text-primary" />
                <div>
                  <p className="text-xl font-bold text-foreground">{stats ? `${stats.hours}h ${stats.minutes}m` : "0h 0m"}</p>
                  <p className="text-xs text-muted-foreground">Hours Played</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <Music className="h-5 w-5 flex-shrink-0 text-primary" />
                <div>
                  <p className="text-xl font-bold text-foreground">{filteredRecords.length}</p>
                  <p className="text-xs text-muted-foreground">Song Plays</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <Users className="h-5 w-5 flex-shrink-0 text-primary" />
                <div>
                  <p className="text-xl font-bold text-foreground">{stats?.uniqueArtists ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Artists</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <Disc className="h-5 w-5 flex-shrink-0 text-primary" />
                <div>
                  <p className="text-xl font-bold text-foreground">{stats?.uniqueAlbums ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Albums</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Search</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="Search songs, artists, or albums"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                onClick={() => setSearchQuery("")}
                disabled={!searchQuery.trim()}
              >
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>

        {lastSyncedAt &&
        <div className="rounded-md border border-border bg-card/40 px-3 py-2">
            <span className="text-xs text-muted-foreground">
              Cache updated {new Date(lastSyncedAt).toLocaleString()}
            </span>
          </div>
        }

        {loading &&
        <div className="rounded-md border border-border bg-card p-3">
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

        {error &&
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
        }

        <section className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Pinned Albums</CardTitle>
              <p className="text-xs text-muted-foreground">Saved in uk.madebydanny.teal.pin</p>
            </CardHeader>
            <CardContent className="space-y-2">
              {pinsLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              {!pinsLoading && pinnedAlbums.length === 0 &&
              <p className="text-sm text-muted-foreground">No pinned albums found.</p>
              }
              {pinnedAlbums.map((item) =>
              <div key={item.id} className="rounded-md border border-border bg-muted/30 p-2">
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  {item.subtitle && <p className="text-xs text-muted-foreground">{item.subtitle}</p>}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Pinned Songs</CardTitle>
              <p className="text-xs text-muted-foreground">Saved in uk.madebydanny.teal.pin</p>
            </CardHeader>
            <CardContent className="space-y-2">
              {pinsLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              {!pinsLoading && pinnedSongs.length === 0 &&
              <p className="text-sm text-muted-foreground">No pinned songs found.</p>
              }
              {pinnedSongs.map((item) =>
              <div key={item.id} className="rounded-md border border-border bg-muted/30 p-2">
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  {item.subtitle && <p className="text-xs text-muted-foreground">{item.subtitle}</p>}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Pinned Artists</CardTitle>
              <p className="text-xs text-muted-foreground">Saved in uk.madebydanny.teal.pin</p>
            </CardHeader>
            <CardContent className="space-y-2">
              {pinsLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              {!pinsLoading && pinnedArtists.length === 0 &&
              <p className="text-sm text-muted-foreground">No pinned artists found.</p>
              }
              {pinnedArtists.map((item) =>
              <div key={item.id} className="rounded-md border border-border bg-muted/30 p-2">
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Artist Search</CardTitle>
              <p className="text-xs text-muted-foreground">Search artists, pin them, and view songs from the search API</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleArtistSearchSubmit} className="flex flex-wrap gap-2">
                <Input
                  placeholder="Search artist names"
                  value={artistQuery}
                  onChange={(event) => setArtistQuery(event.target.value)}
                  className="min-w-[220px] flex-1"
                />
                <Button type="submit" disabled={!artistQuery.trim() || artistSearchLoading}>
                  {artistSearchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
                </Button>
              </form>

              {artistSearchError &&
              <p className="text-sm text-destructive">{artistSearchError}</p>
              }

              {artistResults.length > 0 &&
              <div className="space-y-2">
                  {artistResults.map((artist) => {
                    const actionKey = `artist:${artist.artistName}`;
                    const pinned = pinnedArtistKeys.has(normalizeLabel(artist.artistName));

                    return (
                      <div key={artist.artistId} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-2">
                        <div>
                          <p className="text-sm font-medium text-foreground">{artist.artistName}</p>
                          {artist.primaryGenreName &&
                          <p className="text-xs text-muted-foreground">{artist.primaryGenreName}</p>
                          }
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => void viewArtistSongs(artist)}>
                            View songs
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={pinned ? "secondary" : "outline"}
                            disabled={!hasOAuthSession || pinned || pinActionKey === actionKey}
                            onClick={() => void handlePinArtist(artist.artistName)}
                          >
                            {pinActionKey === actionKey ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pin className="h-4 w-4" />}
                            {pinned ? "Pinned" : "Pin artist"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              }

              {selectedArtist &&
              <div className="space-y-2 rounded-md border border-border p-3">
                  <p className="text-sm font-semibold text-foreground">Songs by {selectedArtist.artistName}</p>
                  {artistSongsLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                  {artistSongsError && <p className="text-sm text-destructive">{artistSongsError}</p>}
                  {!artistSongsLoading && !artistSongsError && selectedArtistSongs.length === 0 &&
                  <p className="text-sm text-muted-foreground">No songs found.</p>
                  }
                  {!artistSongsLoading && selectedArtistSongs.length > 0 &&
                  <div className="space-y-1">
                      {selectedArtistSongs.slice(0, 20).map((song) =>
                      <div key={song.trackId} className="rounded-md bg-muted/30 px-2 py-1.5">
                          <p className="text-sm text-foreground">{song.trackName}</p>
                          {song.collectionName &&
                          <p className="text-xs text-muted-foreground">{song.collectionName}</p>
                          }
                        </div>
                      )}
                    </div>
                  }
                </div>
              }
            </CardContent>
          </Card>
        </section>

        {stats &&
        <section>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Graphs</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="daily" className="w-full">
                  <TabsList className="mb-4">
                    <TabsTrigger value="daily">Daily Plays</TabsTrigger>
                    <TabsTrigger value="artists">Top Artists Over Time</TabsTrigger>
                    <TabsTrigger value="bar">Artist Breakdown</TabsTrigger>
                  </TabsList>

                  <TabsContent value="daily">
                    <ResponsiveContainer width="100%" height={260}>
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
                  </TabsContent>

                  <TabsContent value="artists">
                    <ResponsiveContainer width="100%" height={260}>
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
                  </TabsContent>

                  <TabsContent value="bar">
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={stats.artistBarData} layout="vertical" margin={{ left: 80 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={75} />
                        <Tooltip contentStyle={customTooltipStyle} />
                        <Bar dataKey="plays" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </section>
        }

        <section>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">All Plays</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading && displayRecords.length === 0 &&
              <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              }

              {!loading && filteredRecords.length === 0 && searchQuery.trim() &&
              <p className="text-sm text-muted-foreground">No plays match your search.</p>
              }

              {filteredRecords.map((record) => {
                const trackName = record.value.trackName ?? "Untitled";
                const artistName = record.value.artists?.map((item) => item.artistName).join(", ") ?? "Unknown";
                const songKey = songPinKey(trackName, artistName);
                const songPinned = pinnedSongKeys.has(songKey);
                const artistPinned = pinnedArtistKeys.has(normalizeLabel(artistName));
                const songActionKey = `song:${trackName}:${artistName}`;
                const artistActionKey = `artist:${artistName}`;

                return (
                  <div key={record.uri} className="rounded-md border border-border/60 p-2">
                    <PlayCard record={record} />
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={songPinned ? "secondary" : "outline"}
                        disabled={!hasOAuthSession || songPinned || pinActionKey === songActionKey}
                        onClick={() => void handlePinSong(record)}
                      >
                        {pinActionKey === songActionKey ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pin className="h-4 w-4" />}
                        {songPinned ? "Pinned song" : "Pin song"}
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        variant={artistPinned ? "secondary" : "outline"}
                        disabled={!hasOAuthSession || artistPinned || pinActionKey === artistActionKey}
                        onClick={() => void handlePinArtist(artistName)}
                      >
                        {pinActionKey === artistActionKey ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pin className="h-4 w-4" />}
                        {artistPinned ? "Pinned artist" : "Pin artist"}
                      </Button>
                    </div>
                  </div>
                );
              })}

              {displayRecords.length > 0 && !loading &&
              <p className="pt-2 text-center text-xs text-muted-foreground">
                  {filteredRecords.length} shown{filteredRecords.length !== displayRecords.length ? ` of ${displayRecords.length}` : ""} · {records.length} total loaded
                  {isAuthenticated && activeAccount?.handle ? ` · ${activeAccount.handle}` : ""}
                </p>
              }
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
