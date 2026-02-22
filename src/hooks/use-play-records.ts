import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchPlayRecords, PlayRecord, resolveHandle, resolvePdsEndpoint } from "@/lib/atproto";
import { loadPlayCache, savePlayCache } from "@/lib/playCache";

const ESTIMATE_FUTURE_BATCH = 25;

export interface PlayLoadProgress {
  loadedCount: number;
  pagesLoaded: number;
  estimatedTotal: number | null;
  estimatedPages: number | null;
  hasNext: boolean;
  cacheCount: number;
  newCount: number;
  fromCache: boolean;
}

const INITIAL_PROGRESS: PlayLoadProgress = {
  loadedCount: 0,
  pagesLoaded: 0,
  estimatedTotal: null,
  estimatedPages: null,
  hasNext: false,
  cacheCount: 0,
  newCount: 0,
  fromCache: false,
};

function mergeUniqueRecords(newerRecords: PlayRecord[], olderRecords: PlayRecord[]): PlayRecord[] {
  const merged: PlayRecord[] = [];
  const seen = new Set<string>();
  for (const record of [...newerRecords, ...olderRecords]) {
    if (seen.has(record.uri)) continue;
    seen.add(record.uri);
    merged.push(record);
  }
  return merged;
}

function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  return (error as { name?: string }).name === "AbortError";
}

export function usePlayRecords(routeHandle?: string) {
  const [records, setRecords] = useState<PlayRecord[]>([]);
  const [stableRecords, setStableRecords] = useState<PlayRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<PlayLoadProgress>(INITIAL_PROGRESS);
  const [showPartialResults, setShowPartialResults] = useState(true);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [resolvedDid, setResolvedDid] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const latestRecordsRef = useRef<PlayRecord[]>([]);

  useEffect(() => {
    latestRecordsRef.current = records;
  }, [records]);

  const cancelFetch = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const loadForHandle = useCallback(async (rawHandle: string) => {
    const handle = rawHandle.trim();
    if (!handle) return;

    cancelFetch();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = ++requestIdRef.current;

    setLoading(true);
    setError("");
    setProgress(INITIAL_PROGRESS);

    try {
      const did = handle.startsWith("did:") ? handle : await resolveHandle(handle);
      if (requestIdRef.current !== requestId) return;
      setResolvedDid(did);

      const cached = loadPlayCache(did);
      const cachedRecords = cached?.records ?? [];
      setLastSyncedAt(cached?.updatedAt ?? null);
      setStableRecords(cachedRecords);
      setRecords(cachedRecords);
      setProgress({
        loadedCount: cachedRecords.length,
        pagesLoaded: 0,
        estimatedTotal: cachedRecords.length > 0 ? cachedRecords.length + 1 : null,
        estimatedPages: cachedRecords.length > 0 ? 1 : null,
        hasNext: true,
        cacheCount: cachedRecords.length,
        newCount: 0,
        fromCache: cachedRecords.length > 0,
      });

      const knownUris = new Set<string>(cachedRecords.map((record) => record.uri));
      const incomingRecords: PlayRecord[] = [];
      let cursor: string | undefined;
      let pagesLoaded = 0;

      const pds = await resolvePdsEndpoint(did);

      while (true) {
        if (controller.signal.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }

        const page = await fetchPlayRecords(did, cursor, { pds, signal: controller.signal });
        pagesLoaded += 1;
        const hasNext = Boolean(page.cursor) && page.records.length > 0;

        let overlapDetected = false;
        const freshPageRecords: PlayRecord[] = [];
        for (const record of page.records) {
          if (knownUris.has(record.uri)) {
            overlapDetected = true;
            continue;
          }
          knownUris.add(record.uri);
          freshPageRecords.push(record);
        }
        if (freshPageRecords.length > 0) {
          incomingRecords.push(...freshPageRecords);
        }

        const merged = mergeUniqueRecords(incomingRecords, cachedRecords);
        if (requestIdRef.current !== requestId) return;
        setRecords(merged);

        const loadedCount = merged.length;
        const estimatedTotal = hasNext && !overlapDetected
          ? loadedCount + Math.max(page.records.length, ESTIMATE_FUTURE_BATCH)
          : loadedCount;
        const estimatedPages = hasNext && !overlapDetected
          ? pagesLoaded + 1
          : pagesLoaded;

        setProgress({
          loadedCount,
          pagesLoaded,
          estimatedTotal,
          estimatedPages,
          hasNext,
          cacheCount: cachedRecords.length,
          newCount: incomingRecords.length,
          fromCache: cachedRecords.length > 0,
        });

        if (!page.cursor || page.records.length === 0) break;
        if (cachedRecords.length > 0 && overlapDetected) break;
        cursor = page.cursor;
      }

      const finalRecords = mergeUniqueRecords(incomingRecords, cachedRecords);
      if (requestIdRef.current !== requestId) return;

      setRecords(finalRecords);
      setStableRecords(finalRecords);
      setProgress({
        loadedCount: finalRecords.length,
        pagesLoaded,
        estimatedTotal: finalRecords.length,
        estimatedPages: pagesLoaded,
        hasNext: false,
        cacheCount: cachedRecords.length,
        newCount: incomingRecords.length,
        fromCache: cachedRecords.length > 0,
      });

      const syncedAt = new Date().toISOString();
      setLastSyncedAt(syncedAt);
      savePlayCache({
        did,
        handle,
        updatedAt: syncedAt,
        records: finalRecords,
      });
    } catch (err: unknown) {
      if (requestIdRef.current !== requestId) return;
      if (isAbortError(err)) {
        const partialRecords = latestRecordsRef.current;
        setStableRecords(partialRecords);
        setError(partialRecords.length > 0
          ? "Sync cancelled. Showing fetched results."
          : "Sync cancelled.");
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Something went wrong");
      }
    } finally {
      if (requestIdRef.current === requestId) {
        setLoading(false);
      }
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    }
  }, [cancelFetch]);

  useEffect(() => {
    if (!routeHandle) return;
    void loadForHandle(routeHandle);
  }, [routeHandle, loadForHandle]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const displayRecords = useMemo(
    () => (loading && !showPartialResults ? stableRecords : records),
    [loading, records, showPartialResults, stableRecords]
  );

  return {
    records,
    displayRecords,
    loading,
    error,
    progress,
    showPartialResults,
    setShowPartialResults,
    lastSyncedAt,
    resolvedDid,
    loadForHandle,
    cancelFetch,
  };
}
