import { useCallback, useEffect, useState } from "react";
import * as db from "../lib/db";
import { readMediaTags } from "../lib/mediaTags";
import {
  cleanTrackName,
  type Playlist,
  type RetuneStyle,
  type TrackMeta,
} from "../lib/types";
import { isAcceptedAudioFile } from "../lib/retune";

/** UX-4 duplicate key: cleaned display name + byte size. */
function dupKey(name: string, size: number): string {
  return `${name}\u0000${size}`;
}

function inputName(input: db.NewTrackInput): string {
  const stem = (input.fileName || "").replace(/\.[^/.]+$/, "");
  return cleanTrackName(input.name || stem);
}

export type PendingDuplicates = {
  inputs: db.NewTrackInput[];
  names: string[];
};

export function useLibrary() {
  const [tracks, setTracks] = useState<TrackMeta[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  // UX-4: exact duplicates held back from an import, awaiting user confirmation.
  const [pendingDuplicates, setPendingDuplicates] =
    useState<PendingDuplicates | null>(null);

  const refresh = useCallback(async () => {
    const [t, p] = await Promise.all([db.listTracks(), db.listPlaylists()]);
    setTracks(t);
    setPlaylists(p);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refresh();
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load library");
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const importFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const all = Array.from(fileList);
      const files = all.filter(isAcceptedAudioFile);
      const skipped = all.length - files.length;
      if (!files.length) {
        setError(
          skipped
            ? "That file is not audio. Please add MP3, WAV, M4A, FLAC, or OGG (not photos or video)."
            : "Please add audio files (MP3, WAV, M4A, FLAC, OGG).",
        );
        return [] as TrackMeta[];
      }
      setError(null);
      setImporting(true);
      try {
        // Read ID3 tags before storing (files are re-materialized in db layer).
        // Per-file try/catch so one bad file cannot crash the whole import (iPad camera/HEIC edge cases).
        const inputs: db.NewTrackInput[] = [];
        for (const file of files) {
          try {
            const tags = await readMediaTags(file);
            inputs.push({
              file,
              fileName: file.name || "track.mp3",
              name: tags.title || undefined,
              artist: tags.artist,
              album: tags.album,
              artworkBlob: tags.artworkBlob,
            });
          } catch (e) {
            console.warn("[useLibrary] skip file (tag read failed)", file.name, e);
          }
        }
        if (!inputs.length) {
          setError("Could not read those files as audio. Try another MP3 or WAV.");
          return [] as TrackMeta[];
        }

        // UX-4: split exact duplicates (same cleaned name + size) from fresh
        // files. Fresh import immediately; duplicates wait for confirmation.
        const existingKeys = new Set(tracks.map((t) => dupKey(t.name, t.size)));
        const fresh: db.NewTrackInput[] = [];
        const duplicates: db.NewTrackInput[] = [];
        for (const inp of inputs) {
          const key = dupKey(inputName(inp), (inp.file as Blob).size);
          if (existingKeys.has(key)) duplicates.push(inp);
          else {
            fresh.push(inp);
            existingKeys.add(key); // dedupe within this same batch too
          }
        }

        const created = fresh.length
          ? await db.addTracksFromFiles(fresh)
          : [];
        if (fresh.length) await refresh();

        if (duplicates.length) {
          setPendingDuplicates({
            inputs: duplicates,
            names: duplicates.map(inputName),
          });
        }

        if (!created.length && !duplicates.length) {
          setError("Import finished but no tracks were saved. Try again.");
        } else if (skipped > 0) {
          setError(
            `Imported ${created.length} audio file(s). Skipped ${skipped} non-audio item(s).`,
          );
        }
        return created;
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : "Failed to save tracks to library.";
        setError(msg);
        console.error("[useLibrary] importFiles", e);
        return [] as TrackMeta[];
      } finally {
        setImporting(false);
      }
    },
    [refresh, tracks],
  );

  /** UX-4: import the duplicates the user chose to keep ("import anyway"). */
  const confirmDuplicateImport = useCallback(async () => {
    const pending = pendingDuplicates;
    if (!pending) return [] as TrackMeta[];
    setPendingDuplicates(null);
    setImporting(true);
    try {
      const created = await db.addTracksFromFiles(pending.inputs);
      await refresh();
      return created;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to save tracks to library.",
      );
      return [] as TrackMeta[];
    } finally {
      setImporting(false);
    }
  }, [pendingDuplicates, refresh]);

  /** UX-4: skip the duplicates. */
  const dismissDuplicateImport = useCallback(() => {
    setPendingDuplicates(null);
  }, []);

  const renameTrack = useCallback(
    async (id: string, name: string) => {
      await db.updateTrackMeta(id, { name });
      await refresh();
    },
    [refresh],
  );

  const setDuration = useCallback(async (id: string, duration: number) => {
    await db.updateTrackMeta(id, { duration });
    setTracks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, duration } : t)),
    );
  }, []);

  const toggleFavorite = useCallback(
    async (id: string) => {
      const t = tracks.find((x) => x.id === id);
      if (!t) return;
      await db.updateTrackMeta(id, { favorite: !t.favorite });
      await refresh();
    },
    [tracks, refresh],
  );

  const removeTrack = useCallback(
    async (id: string) => {
      await db.deleteTrack(id);
      await refresh();
    },
    [refresh],
  );

  /** Persist a retune target onto a track (or clear it with null). */
  const saveTargetToTrack = useCallback(
    async (
      id: string,
      targetHz: number | null,
      retuneStyle: RetuneStyle | null,
    ) => {
      await db.updateTrackMeta(id, {
        savedTargetHz: targetHz,
        savedRetuneStyle: targetHz == null ? null : retuneStyle,
      });
      await refresh();
    },
    [refresh],
  );

  const createPlaylist = useCallback(
    async (name: string) => {
      const pl = await db.createPlaylist(name);
      await refresh();
      return pl;
    },
    [refresh],
  );

  /** Create playlist and set track order (M3U import). */
  const createPlaylistWithTracks = useCallback(
    async (name: string, trackIds: string[]) => {
      const pl = await db.createPlaylist(name);
      if (trackIds.length) {
        await db.setPlaylistTracks(pl.id, trackIds);
      }
      await refresh();
      const full = await db.getPlaylist(pl.id);
      return full ?? pl;
    },
    [refresh],
  );

  const renamePlaylist = useCallback(
    async (id: string, name: string) => {
      await db.renamePlaylist(id, name);
      await refresh();
    },
    [refresh],
  );

  const removePlaylist = useCallback(
    async (id: string) => {
      await db.deletePlaylist(id);
      await refresh();
    },
    [refresh],
  );

  const addToPlaylist = useCallback(
    async (playlistId: string, trackIds: string[]) => {
      await db.addTracksToPlaylist(playlistId, trackIds);
      await refresh();
    },
    [refresh],
  );

  const removeFromPlaylist = useCallback(
    async (playlistId: string, trackId: string) => {
      await db.removeTrackFromPlaylist(playlistId, trackId);
      await refresh();
    },
    [refresh],
  );

  const reorderPlaylist = useCallback(
    async (playlistId: string, from: number, to: number) => {
      await db.movePlaylistTrack(playlistId, from, to);
      await refresh();
    },
    [refresh],
  );

  const recordPlay = useCallback(async (id: string) => {
    await db.recordPlay(id);
    setTracks((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              playCount: t.playCount + 1,
              lastPlayedAt: Date.now(),
            }
          : t,
      ),
    );
  }, []);

  return {
    tracks,
    playlists,
    ready,
    error,
    setError,
    importing,
    pendingDuplicates,
    confirmDuplicateImport,
    dismissDuplicateImport,
    refresh,
    importFiles,
    renameTrack,
    setDuration,
    toggleFavorite,
    removeTrack,
    saveTargetToTrack,
    createPlaylist,
    createPlaylistWithTracks,
    renamePlaylist,
    removePlaylist,
    addToPlaylist,
    removeFromPlaylist,
    reorderPlaylist,
    recordPlay,
  };
}
