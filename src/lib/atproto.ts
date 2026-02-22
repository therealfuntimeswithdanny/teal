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
    releaseMbId?: string;
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

async function resolvePds(did: string): Promise<string> {
  let doc: any;
  if (did.startsWith("did:plc:")) {
    const res = await fetch(`https://plc.directory/${did}`);
    if (!res.ok) throw new Error("Could not resolve DID document");
    doc = await res.json();
  } else if (did.startsWith("did:web:")) {
    const domain = did.replace("did:web:", "");
    const res = await fetch(`https://${domain}/.well-known/did.json`);
    if (!res.ok) throw new Error("Could not resolve DID document");
    doc = await res.json();
  } else {
    throw new Error("Unsupported DID method");
  }

  const pdsService = doc.service?.find(
    (s: any) => s.id === "#atproto_pds" || s.type === "AtprotoPersonalDataServer"
  );
  if (!pdsService?.serviceEndpoint) {
    throw new Error("No PDS endpoint found for this user");
  }
  return pdsService.serviceEndpoint;
}

export async function fetchPlayRecords(
  did: string,
  cursor?: string
): Promise<ListRecordsResponse> {
  const pds = await resolvePds(did);

  const params = new URLSearchParams({
    repo: did,
    collection: "fm.teal.alpha.feed.play",
    limit: "100",
  });
  if (cursor) params.set("cursor", cursor);

  const res = await fetch(
    `${pds}/xrpc/com.atproto.repo.listRecords?${params}`
  );
  if (!res.ok) {
    const text = await res.text();
    console.error("listRecords error:", res.status, text);
    throw new Error("Failed to fetch records from PDS");
  }
  return res.json();
}

export async function fetchAllPlayRecords(
  did: string,
  maxRecords?: number,
  onBatch?: (records: PlayRecord[], total: number) => void
): Promise<PlayRecord[]> {
  const all: PlayRecord[] = [];
  let cursor: string | undefined;
  const seenCursors = new Set<string>();

  while (true) {
    if (cursor) {
      if (seenCursors.has(cursor)) break;
      seenCursors.add(cursor);
    }

    const res = await fetchPlayRecords(did, cursor);
    all.push(...res.records);
    onBatch?.(all, all.length);
    cursor = res.cursor;

    if (maxRecords !== undefined && all.length >= maxRecords) {
      return all.slice(0, maxRecords);
    }

    if (!cursor || res.records.length === 0) break;
  }

  return all;
}

const artCache = new Map<string, string | null>();

export async function fetchAlbumArt(
  trackName: string,
  artistName: string,
  releaseName?: string,
  releaseMbId?: string
): Promise<string | null> {
  const key = `${artistName}-${releaseName || trackName}`;
  if (artCache.has(key)) return artCache.get(key)!;

  // Try MusicBrainz Cover Art Archive first if we have a release MBID
  if (releaseMbId) {
    try {
      const url = `https://coverartarchive.org/release/${releaseMbId}/front-250`;
      const res = await fetch(url, { method: "HEAD" });
      if (res.ok || res.redirected) {
        artCache.set(key, url);
        return url;
      }
    } catch {
      // fall through
    }
  }

  // Fallback: search MusicBrainz for the release, then get cover art
  try {
    const query = releaseName
      ? `release:${releaseName} AND artist:${artistName}`
      : `recording:${trackName} AND artist:${artistName}`;
    const mbRes = await fetch(
      `https://musicbrainz.org/ws/2/release/?query=${encodeURIComponent(query)}&limit=1&fmt=json`,
      { headers: { "User-Agent": "TealPlayHistory/1.0 (lovable.dev)" } }
    );
    if (mbRes.ok) {
      const mbData = await mbRes.json();
      const mbid = mbData.releases?.[0]?.id;
      if (mbid) {
        const coverUrl = `https://coverartarchive.org/release/${mbid}/front-250`;
        const coverRes = await fetch(coverUrl, { method: "HEAD" });
        if (coverRes.ok || coverRes.redirected) {
          artCache.set(key, coverUrl);
          return coverUrl;
        }
      }
    }
  } catch {
    // fall through
  }

  // Fallback: iTunes search API (no auth required)
  try {
    const term = [trackName, artistName, releaseName].filter(Boolean).join(" ");
    const itunesRes = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=5`
    );
    if (itunesRes.ok) {
      const itunesData = await itunesRes.json();
      const normalizedArtist = artistName.toLowerCase();
      const normalizedTrack = trackName.toLowerCase();
      const candidate = (itunesData.results ?? []).find((r: any) => {
        const a = String(r.artistName ?? "").toLowerCase();
        const t = String(r.trackName ?? "").toLowerCase();
        return a.includes(normalizedArtist) || normalizedArtist.includes(a) || t === normalizedTrack;
      }) ?? itunesData.results?.[0];

      if (candidate?.artworkUrl100) {
        const artworkUrl = String(candidate.artworkUrl100).replace("100x100bb", "600x600bb");
        artCache.set(key, artworkUrl);
        return artworkUrl;
      }
    }
  } catch {
    // fall through
  }

  // Fallback: Openverse image search with album + artist query
  try {
    const q = releaseName
      ? `${releaseName} ${artistName} album cover`
      : `${trackName} ${artistName} album cover`;
    const ovRes = await fetch(
      `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&page_size=1`
    );
    if (ovRes.ok) {
      const ovData = await ovRes.json();
      const imageUrl = ovData.results?.[0]?.url;
      if (imageUrl) {
        artCache.set(key, imageUrl);
        return imageUrl;
      }
    }
  } catch {
    // fall through
  }

  artCache.set(key, null);
  return null;
}
