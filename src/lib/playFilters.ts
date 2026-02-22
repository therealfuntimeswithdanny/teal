import { PlayRecord } from "@/lib/atproto";

export interface PlayFilters {
  track: string;
  artist: string;
  album: string;
  dateFrom: string;
  dateTo: string;
}

export const EMPTY_PLAY_FILTERS: PlayFilters = {
  track: "",
  artist: "",
  album: "",
  dateFrom: "",
  dateTo: "",
};

function includesInsensitive(value: string | undefined, filter: string): boolean {
  if (!filter) return true;
  if (!value) return false;
  return value.toLowerCase().includes(filter.toLowerCase());
}

function inDateRange(playedTime: string | undefined, from: string, to: string): boolean {
  if (!from && !to) return true;
  if (!playedTime) return false;
  const day = playedTime.slice(0, 10);
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

export function filterPlayRecords(records: PlayRecord[], filters: PlayFilters): PlayRecord[] {
  return records.filter((record) => {
    const trackName = record.value.trackName ?? "";
    const artistName = record.value.artists?.map((artist) => artist.artistName).join(", ") ?? "";
    const albumName = record.value.releaseName ?? "";

    return (
      includesInsensitive(trackName, filters.track) &&
      includesInsensitive(artistName, filters.artist) &&
      includesInsensitive(albumName, filters.album) &&
      inDateRange(record.value.playedTime, filters.dateFrom, filters.dateTo)
    );
  });
}

export function hasActivePlayFilters(filters: PlayFilters): boolean {
  return Boolean(
    filters.track.trim() ||
    filters.artist.trim() ||
    filters.album.trim() ||
    filters.dateFrom ||
    filters.dateTo
  );
}
