export interface PlayRecord {
  uri: string;
  cid: string;
  value: {
    isrc?: string;
    $type: string;
    artists?: { artistName: string }[];
    duration?: number;
    originUrl?: string;
    trackName?: string;
    playedTime?: string;
    releaseName?: string;
    musicServiceBaseDomain?: string;
  };
}

export interface ListRecordsResponse {
  records: PlayRecord[];
  cursor?: string;
}

const BSKY_PUBLIC_API = "https://public.api.bsky.app";

export async function resolveHandle(handle: string): Promise<string> {
  const res = await fetch(
    `${BSKY_PUBLIC_API}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`
  );
  if (!res.ok) throw new Error("Could not resolve handle");
  const data = await res.json();
  return data.did;
}

export async function fetchPlayRecords(
  did: string,
  cursor?: string
): Promise<ListRecordsResponse> {
  const params = new URLSearchParams({
    repo: did,
    collection: "fm.teal.alpha.feed.play",
    limit: "50",
  });
  if (cursor) params.set("cursor", cursor);

  const res = await fetch(
    `${BSKY_PUBLIC_API}/xrpc/com.atproto.repo.listRecords?${params}`
  );
  if (!res.ok) throw new Error("Failed to fetch records");
  return res.json();
}

const artCache = new Map<string, string | null>();

export async function fetchAlbumArt(
  trackName: string,
  artistName: string
): Promise<string | null> {
  const key = `${artistName}-${trackName}`;
  if (artCache.has(key)) return artCache.get(key)!;

  try {
    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(
        `${artistName} ${trackName}`
      )}&media=music&limit=1`
    );
    const data = await res.json();
    const url =
      data.results?.[0]?.artworkUrl100?.replace("100x100", "300x300") ?? null;
    artCache.set(key, url);
    return url;
  } catch {
    artCache.set(key, null);
    return null;
  }
}
