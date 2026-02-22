import { PlayRecord } from "@/lib/atproto";
import { EMPTY_PLAY_FILTERS, PlayFilters } from "@/lib/playFilters";

const PREFS_PREFIX = "teal.user-preferences.v1";

export interface TrackPreference {
  note: string;
  tags: string[];
  updatedAt: string;
}

export interface UserPreferences {
  savedFilters: {
    history: PlayFilters;
    stats: PlayFilters;
  };
  pinnedArtists: string[];
  pinnedAlbums: string[];
  trackPreferences: Record<string, TrackPreference>;
}

export function createDefaultUserPreferences(): UserPreferences {
  return {
    savedFilters: {
      history: { ...EMPTY_PLAY_FILTERS },
      stats: { ...EMPTY_PLAY_FILTERS },
    },
    pinnedArtists: [],
    pinnedAlbums: [],
    trackPreferences: {},
  };
}

function hasStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function prefsKey(did: string): string {
  return `${PREFS_PREFIX}:${did}`;
}

export function loadUserPreferences(did: string): UserPreferences {
  if (!hasStorage()) return createDefaultUserPreferences();
  const raw = window.localStorage.getItem(prefsKey(did));
  if (!raw) return createDefaultUserPreferences();
  try {
    const parsed = JSON.parse(raw) as Partial<UserPreferences>;
    const defaults = createDefaultUserPreferences();
    return {
      savedFilters: {
        history: { ...defaults.savedFilters.history, ...(parsed.savedFilters?.history ?? {}) },
        stats: { ...defaults.savedFilters.stats, ...(parsed.savedFilters?.stats ?? {}) },
      },
      pinnedArtists: Array.isArray(parsed.pinnedArtists) ? parsed.pinnedArtists : [],
      pinnedAlbums: Array.isArray(parsed.pinnedAlbums) ? parsed.pinnedAlbums : [],
      trackPreferences:
        parsed.trackPreferences && typeof parsed.trackPreferences === "object"
          ? parsed.trackPreferences
          : {},
    };
  } catch {
    return createDefaultUserPreferences();
  }
}

export function saveUserPreferences(did: string, prefs: UserPreferences): void {
  if (!hasStorage()) return;
  window.localStorage.setItem(prefsKey(did), JSON.stringify(prefs));
}

export function trackPreferenceKey(record: PlayRecord): string {
  const trackName = record.value.trackName ?? "Untitled";
  const artistName = record.value.artists?.map((artist) => artist.artistName).join(", ") ?? "Unknown";
  return `${trackName}::${artistName}`;
}
