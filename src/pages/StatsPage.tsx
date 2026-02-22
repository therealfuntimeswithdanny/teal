import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { resolveHandle, fetchAllPlayRecords, PlayRecord } from "@/lib/atproto";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Disc3, ArrowLeft, Music, Clock, Users, Disc } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, AreaChart, Area } from
"recharts";

export default function StatsPage() {
  const { handle } = useParams<{handle: string;}>();
  const [records, setRecords] = useState<PlayRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [showAllArtists, setShowAllArtists] = useState(false);
  const [showAllTracks, setShowAllTracks] = useState(false);
  const [showAllAlbums, setShowAllAlbums] = useState(false);

  useEffect(() => {
    if (!handle) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      setLoadingProgress(0);
      try {
        const resolved = handle.startsWith("did:") ? handle : await resolveHandle(handle);
        const all = await fetchAllPlayRecords(resolved, undefined, (_records, total) => {
          if (!cancelled) {
            setRecords([..._records]);
            setLoadingProgress(total);
          }
        });
        if (!cancelled) setRecords(all);
      } catch (e: any) {
        if (!cancelled) setError(e.message ?? "Something went wrong");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {cancelled = true;};
  }, [handle]);

  const stats = useMemo(() => {
    if (records.length === 0) return null;

    const artistCounts = new Map<string, number>();
    const trackCounts = new Map<string, {count: number;artist: string;}>();
    const albumCounts = new Map<string, {count: number;artist: string;}>();
    let totalDuration = 0;

    // Daily play counts for trend
    const dailyCounts = new Map<string, number>();
    // Daily artist breakdown (top 5 artists over time)
    const dailyArtistCounts = new Map<string, Map<string, number>>();

    for (const r of records) {
      const v = r.value;
      const artist = v.artists?.map((a) => a.artistName).join(", ") ?? "Unknown";

      artistCounts.set(artist, (artistCounts.get(artist) ?? 0) + 1);

      const trackKey = `${v.trackName} — ${artist}`;
      const existing = trackCounts.get(trackKey);
      trackCounts.set(trackKey, { count: (existing?.count ?? 0) + 1, artist });

      if (v.releaseName) {
        const albumKey = `${v.releaseName} — ${artist}`;
        const existingAlbum = albumCounts.get(albumKey);
        albumCounts.set(albumKey, { count: (existingAlbum?.count ?? 0) + 1, artist });
      }

      if (v.duration) totalDuration += v.duration;

      // Trend data
      if (v.playedTime) {
        const day = v.playedTime.slice(0, 10);
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

    // Build daily trend data sorted by date
    const dailyTrend = [...dailyCounts.entries()].
    sort((a, b) => a[0].localeCompare(b[0])).
    map(([date, count]) => ({ date: date.slice(5), count }));

    // Top 5 artists for stacked area chart
    const top5Artists = topArtists.slice(0, 5).map(([name]) => name);
    const artistTrend = [...dailyArtistCounts.entries()].
    sort((a, b) => a[0].localeCompare(b[0])).
    map(([date, artists]) => {
      const entry: Record<string, string | number> = { date: date.slice(5) };
      for (const a of top5Artists) {
        entry[a] = artists.get(a) ?? 0;
      }
      return entry;
    });

    // Top artists bar chart data (top 15)
    const artistBarData = topArtists.slice(0, 15).map(([name, count]) => ({
      name: name.length > 20 ? name.slice(0, 18) + "…" : name,
      plays: count
    }));

    return {
      topArtists, topTracks, topAlbums, totalDuration, hours, minutes,
      dailyTrend, artistTrend, top5Artists, artistBarData,
      uniqueArtists: artistCounts.size,
      uniqueAlbums: albumCounts.size
    };
  }, [records]);

  const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(180 60% 50%)",
  "hsl(320 60% 55%)",
  "hsl(45 80% 55%)"];


  const renderList = (
  items: [string, any][],
  showAll: boolean,
  type: "artist" | "track" | "album") =>
  {
    const displayed = showAll ? items : items.slice(0, 20);
    return displayed.map(([name, data], i) => {
      const count = typeof data === "number" ? data : data.count;
      const maxCount = typeof items[0][1] === "number" ? items[0][1] : items[0][1].count;
      const [title, subtitle] = type !== "artist" ? name.split(" — ") : [name, null];
      return (
        <div key={name} className="flex items-center gap-3">
          <span className="w-6 text-right text-sm font-medium text-muted-foreground">{i + 1}</span>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{title}</p>
            {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
            {type === "artist" &&
            <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${count / maxCount * 100}%` }} />

              </div>
            }
          </div>
          <span className="text-sm text-muted-foreground flex-shrink-0">{count}</span>
        </div>);

    });
  };

  const customTooltipStyle = {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
    color: "hsl(var(--foreground))",
    fontSize: "12px"
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="mb-8">
          <Link to={`/user/${encodeURIComponent(handle ?? "")}`}>
            <Button variant="ghost" size="sm" className="gap-2 mb-4">
              <ArrowLeft className="h-4 w-4" />
              Back to history
            </Button>
          </Link>
          <div className="text-center">
            <Disc3 className="mx-auto mb-3 h-10 w-10 text-primary animate-spin" style={{ animationDuration: "3s" }} />
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              
              
              teal.fm Stats
            
            
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {handle} · {records.length} plays loaded{loading ? "…" : ""}
            </p>
          </div>
        </div>

        {loading && records.length === 0 && <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>}

        {loading && loadingProgress > 0 && <p className="mb-4 text-center text-sm text-muted-foreground">
            Loading… {loadingProgress} plays fetched
          </p>}

        {error &&
        <p className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
        }

        {stats &&
        <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <Music className="h-5 w-5 text-primary flex-shrink-0" />
                  <div>
                    <p className="text-2xl font-bold text-foreground">{records.length}</p>
                    <p className="text-xs text-muted-foreground">Total plays</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <Clock className="h-5 w-5 text-primary flex-shrink-0" />
                  <div>
                    <p className="text-2xl font-bold text-foreground">
                      {stats.hours}h {stats.minutes}m
                    </p>
                    <p className="text-xs text-muted-foreground">Listening time</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <Users className="h-5 w-5 text-primary flex-shrink-0" />
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stats.uniqueArtists}</p>
                    <p className="text-xs text-muted-foreground">Artists</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <Disc className="h-5 w-5 text-primary flex-shrink-0" />
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stats.uniqueAlbums}</p>
                    <p className="text-xs text-muted-foreground">Albums</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Trends Section */}
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
                        name="Plays" />

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
                        fillOpacity={0.4} />

                      )}
                      </AreaChart>
                    </ResponsiveContainer>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs">
                      {stats.top5Artists.map((artist, i) =>
                    <div key={artist} className="flex items-center gap-1.5">
                          <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COLORS[i] }} />
                          <span className="text-muted-foreground truncate max-w-[120px]">{artist}</span>
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

            {/* Top Artists */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Top Artists ({stats.topArtists.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {renderList(stats.topArtists, showAllArtists, "artist")}
                {stats.topArtists.length > 20 &&
              <Button variant="ghost" size="sm" className="w-full mt-2" onClick={() => setShowAllArtists(!showAllArtists)}>
                    {showAllArtists ? "Show less" : `Show all ${stats.topArtists.length}`}
                  </Button>
              }
              </CardContent>
            </Card>

            {/* Top Tracks */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Top Tracks ({stats.topTracks.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {renderList(stats.topTracks, showAllTracks, "track")}
                {stats.topTracks.length > 20 &&
              <Button variant="ghost" size="sm" className="w-full mt-2" onClick={() => setShowAllTracks(!showAllTracks)}>
                    {showAllTracks ? "Show less" : `Show all ${stats.topTracks.length}`}
                  </Button>
              }
              </CardContent>
            </Card>

            {/* Top Albums */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Top Albums ({stats.topAlbums.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {renderList(stats.topAlbums, showAllAlbums, "album")}
                {stats.topAlbums.length > 20 &&
              <Button variant="ghost" size="sm" className="w-full mt-2" onClick={() => setShowAllAlbums(!showAllAlbums)}>
                    {showAllAlbums ? "Show less" : `Show all ${stats.topAlbums.length}`}
                  </Button>
              }
              </CardContent>
            </Card>
          </div>
        }
      </div>
    </div>);

}
