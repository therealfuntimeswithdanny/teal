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

export interface PublicProfile {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
  description?: string;
}

export interface PinRecord {
  uri: string;
  cid: string;
  value: {
    pinType?: string;
    kind?: string;
    type?: string;
    trackName?: string;
    songName?: string;
    releaseName?: string;
    albumName?: string;
    artists?: { artistName?: string; name?: string }[];
    artistName?: string;
    title?: string;
    text?: string;
  };
}

const BSKY_PUBLIC_API = "https://public.api.bsky.app";
const LASTFM_API_KEY = typeof import.meta.env.VITE_LASTFM_API_KEY === "string"
  ? import.meta.env.VITE_LASTFM_API_KEY
  : "";

export async function resolveHandle(handle: string): Promise<string> {
  const res = await fetch(
    `${BSKY_PUBLIC_API}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`
  );
  if (!res.ok) throw new Error("Could not resolve handle");
  const data = await res.json();
  return data.did;
}

export async function fetchPublicProfile(actor: string): Promise<PublicProfile | null> {
  try {
    const res = await fetch(
      `${BSKY_PUBLIC_API}/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(actor)}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.did || !data?.handle) return null;
    return {
      did: String(data.did),
      handle: String(data.handle),
      displayName: data.displayName ? String(data.displayName) : undefined,
      avatar: data.avatar ? String(data.avatar) : undefined,
      description: data.description ? String(data.description) : undefined,
    };
  } catch {
    return null;
  }
}

export async function resolvePdsEndpoint(did: string): Promise<string> {
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

export interface FetchPlayRecordsOptions {
  pds?: string;
  signal?: AbortSignal;
}

export async function fetchPlayRecords(
  did: string,
  cursor?: string,
  options: FetchPlayRecordsOptions = {}
): Promise<ListRecordsResponse> {
  const pds = options.pds ?? await resolvePdsEndpoint(did);

  const params = new URLSearchParams({
    repo: did,
    collection: "fm.teal.alpha.feed.play",
    limit: "100",
  });
  if (cursor) params.set("cursor", cursor);

  const res = await fetch(`${pds}/xrpc/com.atproto.repo.listRecords?${params}`, {
    signal: options.signal,
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("listRecords error:", res.status, text);
    throw new Error("Failed to fetch records from PDS");
  }
  return res.json();
}

export async function fetchPinRecords(
  did: string,
  cursor?: string,
  options: FetchPlayRecordsOptions = {}
): Promise<ListRecordsResponse> {
  const pds = options.pds ?? await resolvePdsEndpoint(did);

  const params = new URLSearchParams({
    repo: did,
    collection: "uk.madebydanny.teal.pin",
    limit: "100",
  });
  if (cursor) params.set("cursor", cursor);

  const res = await fetch(`${pds}/xrpc/com.atproto.repo.listRecords?${params}`, {
    signal: options.signal,
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("pin listRecords error:", res.status, text);
    throw new Error("Failed to fetch pin records from PDS");
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

function normalizeItunesArtwork(url: string): string {
  return url.replace(/\/[0-9]+x[0-9]+bb/, "/600x600bb");
}

async function fetchItunesArtByIsrc(isrc: string, artistName: string): Promise<string | null> {
  const res = await fetch(
    `https://itunes.apple.com/lookup?isrc=${encodeURIComponent(isrc)}&entity=song&limit=5`
  );
  if (!res.ok) return null;
  const data = await res.json();
  const normalizedArtist = artistName.toLowerCase();
  const candidate = (data.results ?? []).find((r: any) =>
    String(r.artistName ?? "").toLowerCase().includes(normalizedArtist)
  ) ?? data.results?.[0];

  const artworkUrl100 = candidate?.artworkUrl100;
  if (!artworkUrl100) return null;
  return normalizeItunesArtwork(String(artworkUrl100));
}

async function fetchSpotifyOEmbedArt(originUrl?: string): Promise<string | null> {
  if (!originUrl) return null;
  try {
    const parsed = new URL(originUrl);
    const isSpotifyTrack = parsed.hostname.includes("spotify.com") && parsed.pathname.startsWith("/track/");
    if (!isSpotifyTrack) return null;
  } catch {
    return null;
  }

  const res = await fetch(
    `https://open.spotify.com/oembed?url=${encodeURIComponent(originUrl)}`
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.thumbnail_url ?? null;
}

async function fetchLastFmArt(
  artistName: string,
  trackName: string,
  releaseName?: string
): Promise<string | null> {
  if (!LASTFM_API_KEY) return null;

  const trackParams = new URLSearchParams({
    method: "track.getInfo",
    api_key: LASTFM_API_KEY,
    artist: artistName,
    track: trackName,
    format: "json",
  });
  const trackRes = await fetch(`https://ws.audioscrobbler.com/2.0/?${trackParams}`);
  if (trackRes.ok) {
    const trackData = await trackRes.json();
    const trackImages = trackData.track?.album?.image;
    const image =
      trackImages?.find((img: any) => img.size === "extralarge")?.["#text"] ??
      trackImages?.[trackImages.length - 1]?.["#text"];
    if (image) return image;
  }

  if (!releaseName) return null;

  const albumParams = new URLSearchParams({
    method: "album.getInfo",
    api_key: LASTFM_API_KEY,
    artist: artistName,
    album: releaseName,
    format: "json",
  });
  const albumRes = await fetch(`https://ws.audioscrobbler.com/2.0/?${albumParams}`);
  if (!albumRes.ok) return null;
  const albumData = await albumRes.json();
  const albumImages = albumData.album?.image;
  const image =
    albumImages?.find((img: any) => img.size === "extralarge")?.["#text"] ??
    albumImages?.[albumImages.length - 1]?.["#text"];
  return image || null;
}

export async function fetchAlbumArt(
  trackName: string,
  artistName: string,
  releaseName?: string,
  releaseMbId?: string,
  isrc?: string,
  originUrl?: string
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

  // Fallback: ISRC lookup via iTunes API
  if (isrc) {
    try {
      const itunesArt = await fetchItunesArtByIsrc(isrc, artistName);
      if (itunesArt) {
        artCache.set(key, itunesArt);
        return itunesArt;
      }
    } catch {
      // fall through
    }
  }

  // Fallback: Spotify oEmbed if origin URL is a Spotify track
  try {
    const spotifyArt = await fetchSpotifyOEmbedArt(originUrl);
    if (spotifyArt) {
      artCache.set(key, spotifyArt);
      return spotifyArt;
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
        const artworkUrl = normalizeItunesArtwork(String(candidate.artworkUrl100));
        artCache.set(key, artworkUrl);
        return artworkUrl;
      }
    }
  } catch {
    // fall through
  }

  // Fallback: Last.fm (requires VITE_LASTFM_API_KEY)
  try {
    const lastFmArt = await fetchLastFmArt(artistName, trackName, releaseName);
    if (lastFmArt) {
      artCache.set(key, lastFmArt);
      return lastFmArt;
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
