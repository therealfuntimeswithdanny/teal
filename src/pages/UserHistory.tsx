import { useState, useCallback, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { resolveHandle, fetchAllPlayRecords, PlayRecord } from "@/lib/atproto";
import PlayCard from "@/components/PlayCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Disc3, BarChart3 } from "lucide-react";

export default function UserHistory() {
  const { handle: routeHandle } = useParams<{handle: string;}>();
  const navigate = useNavigate();
  const [handle, setHandle] = useState(routeHandle ?? "");
  const [records, setRecords] = useState<PlayRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loadingProgress, setLoadingProgress] = useState(0);

  const search = useCallback(async (searchHandle: string) => {
    if (!searchHandle.trim()) return;
    setLoading(true);
    setError("");
    setRecords([]);
    setLoadingProgress(0);
    try {
      const resolved = searchHandle.startsWith("did:") ? searchHandle : await resolveHandle(searchHandle);
      const all = await fetchAllPlayRecords(resolved, 5000, (_records, total) => {
        setRecords([..._records]);
        setLoadingProgress(total);
      });
      setRecords(all);
    } catch (e: any) {
      setError(e.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (routeHandle) {
      setHandle(routeHandle);
      search(routeHandle);
    }
  }, [routeHandle, search]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (handle.trim()) {
      navigate(`/user/${encodeURIComponent(handle.trim())}`, { replace: true });
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
            View AT Protocol listening history
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mb-8 flex gap-2">
          <Input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="handle.bsky.social"
            className="flex-1 bg-card border-border" />

          <Button type="submit" disabled={loading || !handle.trim()}>
            {loading && records.length === 0 ?
            <Loader2 className="h-4 w-4 animate-spin" /> :

            "Fetch"
            }
          </Button>
        </form>

        {loading && loadingProgress > 0 &&
        <p className="mb-4 text-center text-sm text-muted-foreground">
            Loading… {loadingProgress} plays fetched
          </p>
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

        <div className="space-y-2">
          {records.map((r) =>
          <PlayCard key={r.uri} record={r} />
          )}
        </div>

        {records.length > 0 && !loading &&
        <p className="mt-6 text-center text-xs text-muted-foreground">
            {records.length} plays loaded
          </p>
        }
      </div>
    </div>);

}