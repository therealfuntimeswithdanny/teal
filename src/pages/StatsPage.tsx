import { useState, useCallback, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { resolveHandle, fetchPlayRecords, PlayRecord } from "@/lib/atproto";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Disc3, ArrowLeft, Music, Clock, Users, Disc } from "lucide-react";

export default function StatsPage() {
  const { handle } = useParams<{ handle: string }>();
  const [records, setRecords] = useState<PlayRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [cursor, setCursor] = useState<string | undefined>();
  const [did, setDid] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!handle) return;
    setLoading(true);
    setError("");
    try {
      const resolved = handle.startsWith("did:") ? handle : await resolveHandle(handle);
      setDid(resolved);
      const res = await fetchPlayRecords(resolved);
      setRecords(res.records);
      setCursor(res.cursor);
    } catch (e: any) {
      setError(e.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [handle]);

  const loadMore = useCallback(async () => {
    if (!did || !cursor) return;
    setLoadingMore(true);
    try {
      const res = await fetchPlayRecords(did, cursor);
      setRecords((prev) => [...prev, ...res.records]);
      setCursor(res.cursor);
    } catch {
      // silently stop
      setCursor(undefined);
    } finally {
      setLoadingMore(false);
    }
  }, [did, cursor]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const stats = useMemo(() => {
    if (records.length === 0) return null;

    const artistCounts = new Map<string, number>();
    const trackCounts = new Map<string, { count: number; artist: string }>();
    const albumCounts = new Map<string, { count: number; artist: string }>();
    let totalDuration = 0;
    const serviceCounts = new Map<string, number>();

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

      if (v.musicServiceBaseDomain) {
        serviceCounts.set(v.musicServiceBaseDomain, (serviceCounts.get(v.musicServiceBaseDomain) ?? 0) + 1);
      }
    }

    const topArtists = [...artistCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const topTracks = [...trackCounts.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10);

    const topAlbums = [...albumCounts.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10);

    const hours = Math.floor(totalDuration / 3600);
    const minutes = Math.floor((totalDuration % 3600) / 60);

    return { topArtists, topTracks, topAlbums, totalDuration, hours, minutes, serviceCounts: [...serviceCounts.entries()] };
  }, [records]);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-12">
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
              Listening Stats
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {handle} · {records.length} plays loaded
            </p>
          </div>
        </div>

        {loading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {error && (
          <p className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
        )}

        {stats && (
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
                    <p className="text-2xl font-bold text-foreground">{stats.topArtists.length}</p>
                    <p className="text-xs text-muted-foreground">Artists</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <Disc className="h-5 w-5 text-primary flex-shrink-0" />
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stats.topAlbums.length}</p>
                    <p className="text-xs text-muted-foreground">Albums</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Top Artists */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Top Artists</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {stats.topArtists.map(([name, count], i) => (
                  <div key={name} className="flex items-center gap-3">
                    <span className="w-6 text-right text-sm font-medium text-muted-foreground">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{name}</p>
                      <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${(count / stats.topArtists[0][1]) * 100}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-sm text-muted-foreground flex-shrink-0">{count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Top Tracks */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Top Tracks</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {stats.topTracks.map(([name, { count }], i) => {
                  const [track, artist] = name.split(" — ");
                  return (
                    <div key={name} className="flex items-center gap-3">
                      <span className="w-6 text-right text-sm font-medium text-muted-foreground">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{track}</p>
                        <p className="truncate text-xs text-muted-foreground">{artist}</p>
                      </div>
                      <span className="text-sm text-muted-foreground flex-shrink-0">{count}</span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Top Albums */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Top Albums</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {stats.topAlbums.map(([name, { count }], i) => {
                  const [album, artist] = name.split(" — ");
                  return (
                    <div key={name} className="flex items-center gap-3">
                      <span className="w-6 text-right text-sm font-medium text-muted-foreground">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{album}</p>
                        <p className="truncate text-xs text-muted-foreground">{artist}</p>
                      </div>
                      <span className="text-sm text-muted-foreground flex-shrink-0">{count}</span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Load more for better stats */}
            {cursor && (
              <div className="text-center">
                <Button variant="secondary" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : "Load more plays for better stats"}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
