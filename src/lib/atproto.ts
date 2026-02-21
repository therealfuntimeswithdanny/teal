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
  maxRecords = 5000,
  onBatch?: (records: PlayRecord[], total: number) => void
): Promise<PlayRecord[]> {
  const all: PlayRecord[] = [];
  let cursor: string | undefined;

  while (all.length < maxRecords) {
    const res = await fetchPlayRecords(did, cursor);
    all.push(...res.records);
    onBatch?.(all, all.length);
    cursor = res.cursor;
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

  artCache.set(key, null);
  return null;
}
