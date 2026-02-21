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
    limit: "50",
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
