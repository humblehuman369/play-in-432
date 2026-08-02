import { useCallback, useEffect, useState } from "react";
import * as db from "../lib/db";
import { readMediaTags } from "../lib/mediaTags";
import type { Playlist, TrackMeta } from "../lib/types";
import { isAcceptedAudioFile } from "../lib/retune";

export function useLibrary() {
  const [tracks, setTracks] = useState<TrackMeta[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

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
        const created = await db.addTracksFromFiles(inputs);
        await refresh();
        if (!created.length) {
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
    [refresh],
  );

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

  const createPlaylist = useCallback(
    async (name: string) => {
      const pl = await db.createPlaylist(name);
      await refresh();
      return pl;
    },
    [refresh],
  );

  /** Create playlist and set track order (M3U / Spotify import). */
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
    refresh,
    importFiles,
    renameTrack,
    setDuration,
    toggleFavorite,
    removeTrack,
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
