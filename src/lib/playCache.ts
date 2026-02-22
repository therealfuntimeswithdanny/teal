import { PlayRecord } from "@/lib/atproto";

const CACHE_PREFIX = "teal.play-cache.v1";

export interface PlayCacheEntry {
  did: string;
  handle: string;
  updatedAt: string;
  records: PlayRecord[];
}

function storageAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function cacheKey(did: string): string {
  return `${CACHE_PREFIX}:${did}`;
}

function getCacheKeys(): string[] {
  if (!storageAvailable()) return [];
  const keys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (key && key.startsWith(`${CACHE_PREFIX}:`)) {
      keys.push(key);
    }
  }
  return keys;
}

export function loadPlayCache(did: string): PlayCacheEntry | null {
  if (!storageAvailable()) return null;
  const raw = window.localStorage.getItem(cacheKey(did));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PlayCacheEntry;
    if (!Array.isArray(parsed.records)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function trySave(key: string, payload: string): boolean {
  if (!storageAvailable()) return false;
  try {
    window.localStorage.setItem(key, payload);
    return true;
  } catch {
    return false;
  }
}

export function savePlayCache(entry: PlayCacheEntry): boolean {
  if (!storageAvailable()) return false;
  const key = cacheKey(entry.did);
  const payload = JSON.stringify(entry);

  if (trySave(key, payload)) return true;

  const candidates = getCacheKeys()
    .filter((k) => k !== key)
    .map((k) => {
      const raw = window.localStorage.getItem(k);
      if (!raw) return { key: k, updatedAt: "" };
      try {
        const parsed = JSON.parse(raw) as PlayCacheEntry;
        return { key: k, updatedAt: parsed.updatedAt ?? "" };
      } catch {
        return { key: k, updatedAt: "" };
      }
    })
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));

  for (const candidate of candidates) {
    window.localStorage.removeItem(candidate.key);
    if (trySave(key, payload)) return true;
  }

  return false;
}
