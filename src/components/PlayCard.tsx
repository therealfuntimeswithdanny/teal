import { useEffect, useState } from "react";
import { PlayRecord, fetchAlbumArt } from "@/lib/atproto";
import { Music } from "lucide-react";

function formatDuration(seconds?: number) {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatTime(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function PlayCard({ record }: { record: PlayRecord }) {
  const { trackName, artists, releaseName, duration, playedTime, originUrl, releaseMbId, isrc } =
    record.value as any;
  const artistName = artists?.map((a: any) => a.artistName).join(", ") ?? "Unknown";
  const [art, setArt] = useState<string | null>(null);

  useEffect(() => {
    if (trackName && artistName) {
      fetchAlbumArt(trackName, artistName, releaseName, releaseMbId, isrc, originUrl).then(setArt);
    }
  }, [trackName, artistName, releaseName, releaseMbId, isrc, originUrl]);

  return (
    <a
      href={originUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-4 rounded-lg bg-card p-3 transition-colors hover:bg-secondary group"
    >
      <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-md bg-muted flex items-center justify-center">
        {art ? (
          <img src={art} alt={trackName} className="h-full w-full object-cover" />
        ) : (
          <Music className="h-6 w-6 text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground font-[family-name:var(--font-display)]">
          {trackName ?? "Untitled"}
        </p>
        <p className="truncate text-sm text-muted-foreground">{artistName}</p>
        <p className="truncate text-xs text-muted-foreground/70">
          {releaseName}
        </p>
      </div>
      <div className="hidden sm:flex flex-col items-end gap-1 text-xs text-muted-foreground flex-shrink-0">
        <span>{formatDuration(duration)}</span>
        <span>{formatTime(playedTime)}</span>
      </div>
    </a>
  );
}
