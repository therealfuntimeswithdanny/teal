import { useCallback, useEffect, useState } from "react";
import { PlayFilters } from "@/lib/playFilters";
import {
  createDefaultUserPreferences,
  loadUserPreferences,
  saveUserPreferences,
  UserPreferences,
} from "@/lib/userPreferences";

export function useUserPreferences(did: string | null) {
  const [preferences, setPreferences] = useState<UserPreferences>(createDefaultUserPreferences());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!did) {
      setPreferences(createDefaultUserPreferences());
      setReady(true);
      return;
    }
    setPreferences(loadUserPreferences(did));
    setReady(true);
  }, [did]);

  const updatePreferences = useCallback((updater: (current: UserPreferences) => UserPreferences) => {
    if (!did) return;
    setPreferences((current) => {
      const next = updater(current);
      saveUserPreferences(did, next);
      return next;
    });
  }, [did]);

  const setSavedFilters = useCallback((page: "history" | "stats", filters: PlayFilters) => {
    updatePreferences((current) => ({
      ...current,
      savedFilters: {
        ...current.savedFilters,
        [page]: { ...filters },
      },
    }));
  }, [updatePreferences]);

  const togglePinnedArtist = useCallback((name: string) => {
    updatePreferences((current) => {
      const has = current.pinnedArtists.includes(name);
      return {
        ...current,
        pinnedArtists: has
          ? current.pinnedArtists.filter((artist) => artist !== name)
          : [...current.pinnedArtists, name],
      };
    });
  }, [updatePreferences]);

  const togglePinnedAlbum = useCallback((name: string) => {
    updatePreferences((current) => {
      const has = current.pinnedAlbums.includes(name);
      return {
        ...current,
        pinnedAlbums: has
          ? current.pinnedAlbums.filter((album) => album !== name)
          : [...current.pinnedAlbums, name],
      };
    });
  }, [updatePreferences]);

  const setTrackPreference = useCallback((key: string, note: string, tags: string[]) => {
    updatePreferences((current) => {
      const normalizedTags = tags
        .map((tag) => tag.trim())
        .filter(Boolean)
        .filter((tag, index, array) => array.indexOf(tag) === index);
      const trimmedNote = note.trim();

      const nextTrackPrefs = { ...current.trackPreferences };
      if (!trimmedNote && normalizedTags.length === 0) {
        delete nextTrackPrefs[key];
      } else {
        nextTrackPrefs[key] = {
          note: trimmedNote,
          tags: normalizedTags,
          updatedAt: new Date().toISOString(),
        };
      }

      return {
        ...current,
        trackPreferences: nextTrackPrefs,
      };
    });
  }, [updatePreferences]);

  return {
    preferences,
    ready,
    setSavedFilters,
    togglePinnedArtist,
    togglePinnedAlbum,
    setTrackPreference,
  };
}
