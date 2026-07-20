import type { Playlist, PlayerSettings, TrackMeta, TrackRecord } from "./types";
import {
  DEFAULT_SETTINGS,
  normalizeSettings,
  normalizeTrackRecord,
  trackMetaFromRecord,
  uid,
} from "./types";

const DB_NAME = "truehz-player";
const DB_VERSION = 1;

const STORE_TRACKS = "tracks";
const STORE_PLAYLISTS = "playlists";
const STORE_SETTINGS = "settings";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_TRACKS)) {
        const tracks = db.createObjectStore(STORE_TRACKS, { keyPath: "id" });
        tracks.createIndex("name", "name", { unique: false });
        tracks.createIndex("addedAt", "addedAt", { unique: false });
        tracks.createIndex("favorite", "favorite", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_PLAYLISTS)) {
        db.createObjectStore(STORE_PLAYLISTS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS, { keyPath: "key" });
      }
    };
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("Transaction aborted"));
  });
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Request failed"));
  });
}

// ── Tracks ──────────────────────────────────────────────────────────

export async function listTracks(): Promise<TrackMeta[]> {
  const db = await openDb();
  const tx = db.transaction(STORE_TRACKS, "readonly");
  const all = (await reqToPromise(tx.objectStore(STORE_TRACKS).getAll())) as TrackRecord[];
  await txDone(tx);
  db.close();
  return all
    .map((r) => trackMetaFromRecord(normalizeTrackRecord(r)))
    .sort((a, b) => b.addedAt - a.addedAt);
}

export async function getTrack(id: string): Promise<TrackRecord | null> {
  const db = await openDb();
  const tx = db.transaction(STORE_TRACKS, "readonly");
  const rec = (await reqToPromise(tx.objectStore(STORE_TRACKS).get(id))) as
    | TrackRecord
    | undefined;
  await txDone(tx);
  db.close();
  return rec ? normalizeTrackRecord(rec) : null;
}

export async function getTrackBlob(id: string): Promise<Blob | null> {
  const rec = await getTrack(id);
  return rec?.blob ?? null;
}

export async function getTrackArtwork(id: string): Promise<Blob | null> {
  const rec = await getTrack(id);
  return rec?.artworkBlob ?? null;
}

export type NewTrackInput = {
  file: File;
  name?: string;
  artist?: string | null;
  album?: string | null;
  artworkBlob?: Blob | null;
};

export async function addTracksFromFiles(
  files: File[] | NewTrackInput[],
): Promise<TrackMeta[]> {
  if (!files.length) return [];
  const db = await openDb();
  const tx = db.transaction(STORE_TRACKS, "readwrite");
  const store = tx.objectStore(STORE_TRACKS);
  const created: TrackMeta[] = [];
  const now = Date.now();

  for (const item of files) {
    const isInput = !(item instanceof File);
    const file = isInput ? item.file : item;
    const fallbackName = file.name.replace(/\.[^/.]+$/, "") || file.name;
    const artworkBlob = isInput ? (item.artworkBlob ?? null) : null;
    const record: TrackRecord = {
      id: uid("trk_"),
      name: (isInput && item.name) || fallbackName,
      size: file.size,
      duration: null,
      mimeType: file.type || "audio/mpeg",
      addedAt: now,
      playCount: 0,
      lastPlayedAt: null,
      favorite: false,
      artist: isInput ? (item.artist ?? null) : null,
      album: isInput ? (item.album ?? null) : null,
      hasArtwork: Boolean(artworkBlob),
      blob: file,
      artworkBlob,
    };
    store.put(record);
    created.push(trackMetaFromRecord(record));
  }

  await txDone(tx);
  db.close();
  return created;
}

export async function updateTrackMeta(
  id: string,
  patch: Partial<
    Pick<
      TrackMeta,
      | "name"
      | "duration"
      | "playCount"
      | "lastPlayedAt"
      | "favorite"
      | "artist"
      | "album"
      | "hasArtwork"
    >
  > & { artworkBlob?: Blob | null },
): Promise<TrackMeta | null> {
  const db = await openDb();
  const tx = db.transaction(STORE_TRACKS, "readwrite");
  const store = tx.objectStore(STORE_TRACKS);
  const existing = (await reqToPromise(store.get(id))) as TrackRecord | undefined;
  if (!existing) {
    await txDone(tx);
    db.close();
    return null;
  }
  const base = normalizeTrackRecord(existing);
  const next: TrackRecord = {
    ...base,
    ...patch,
    artworkBlob:
      patch.artworkBlob !== undefined ? patch.artworkBlob : base.artworkBlob,
    hasArtwork:
      patch.artworkBlob !== undefined
        ? Boolean(patch.artworkBlob)
        : patch.hasArtwork ?? base.hasArtwork,
  };
  store.put(next);
  await txDone(tx);
  db.close();
  return trackMetaFromRecord(next);
}

export async function deleteTrack(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([STORE_TRACKS, STORE_PLAYLISTS], "readwrite");
  tx.objectStore(STORE_TRACKS).delete(id);

  const playlists = (await reqToPromise(
    tx.objectStore(STORE_PLAYLISTS).getAll(),
  )) as Playlist[];
  for (const pl of playlists) {
    if (pl.trackIds.includes(id)) {
      const next: Playlist = {
        ...pl,
        trackIds: pl.trackIds.filter((t) => t !== id),
        updatedAt: Date.now(),
      };
      tx.objectStore(STORE_PLAYLISTS).put(next);
    }
  }

  await txDone(tx);
  db.close();
}

export async function recordPlay(id: string): Promise<void> {
  const rec = await getTrack(id);
  if (!rec) return;
  await updateTrackMeta(id, {
    playCount: rec.playCount + 1,
    lastPlayedAt: Date.now(),
  });
}

// ── Playlists ───────────────────────────────────────────────────────

export async function listPlaylists(): Promise<Playlist[]> {
  const db = await openDb();
  const tx = db.transaction(STORE_PLAYLISTS, "readonly");
  const all = (await reqToPromise(tx.objectStore(STORE_PLAYLISTS).getAll())) as Playlist[];
  await txDone(tx);
  db.close();
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getPlaylist(id: string): Promise<Playlist | null> {
  const db = await openDb();
  const tx = db.transaction(STORE_PLAYLISTS, "readonly");
  const pl = (await reqToPromise(tx.objectStore(STORE_PLAYLISTS).get(id))) as
    | Playlist
    | undefined;
  await txDone(tx);
  db.close();
  return pl ?? null;
}

export async function createPlaylist(name: string): Promise<Playlist> {
  const pl: Playlist = {
    id: uid("pl_"),
    name: name.trim() || "New playlist",
    trackIds: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const db = await openDb();
  const tx = db.transaction(STORE_PLAYLISTS, "readwrite");
  tx.objectStore(STORE_PLAYLISTS).put(pl);
  await txDone(tx);
  db.close();
  return pl;
}

export async function renamePlaylist(id: string, name: string): Promise<Playlist | null> {
  const db = await openDb();
  const tx = db.transaction(STORE_PLAYLISTS, "readwrite");
  const store = tx.objectStore(STORE_PLAYLISTS);
  const existing = (await reqToPromise(store.get(id))) as Playlist | undefined;
  if (!existing) {
    await txDone(tx);
    db.close();
    return null;
  }
  const next: Playlist = {
    ...existing,
    name: name.trim() || existing.name,
    updatedAt: Date.now(),
  };
  store.put(next);
  await txDone(tx);
  db.close();
  return next;
}

export async function deletePlaylist(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE_PLAYLISTS, "readwrite");
  tx.objectStore(STORE_PLAYLISTS).delete(id);
  await txDone(tx);
  db.close();
}

export async function setPlaylistTracks(
  id: string,
  trackIds: string[],
): Promise<Playlist | null> {
  const db = await openDb();
  const tx = db.transaction(STORE_PLAYLISTS, "readwrite");
  const store = tx.objectStore(STORE_PLAYLISTS);
  const existing = (await reqToPromise(store.get(id))) as Playlist | undefined;
  if (!existing) {
    await txDone(tx);
    db.close();
    return null;
  }
  const next: Playlist = {
    ...existing,
    trackIds: [...trackIds],
    updatedAt: Date.now(),
  };
  store.put(next);
  await txDone(tx);
  db.close();
  return next;
}

export async function addTracksToPlaylist(
  playlistId: string,
  trackIds: string[],
): Promise<Playlist | null> {
  const pl = await getPlaylist(playlistId);
  if (!pl) return null;
  const set = new Set(pl.trackIds);
  for (const id of trackIds) set.add(id);
  return setPlaylistTracks(playlistId, Array.from(set));
}

export async function removeTrackFromPlaylist(
  playlistId: string,
  trackId: string,
): Promise<Playlist | null> {
  const pl = await getPlaylist(playlistId);
  if (!pl) return null;
  return setPlaylistTracks(
    playlistId,
    pl.trackIds.filter((id) => id !== trackId),
  );
}

export async function movePlaylistTrack(
  playlistId: string,
  fromIndex: number,
  toIndex: number,
): Promise<Playlist | null> {
  const pl = await getPlaylist(playlistId);
  if (!pl) return null;
  const ids = [...pl.trackIds];
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= ids.length ||
    toIndex >= ids.length
  ) {
    return pl;
  }
  const [item] = ids.splice(fromIndex, 1);
  ids.splice(toIndex, 0, item);
  return setPlaylistTracks(playlistId, ids);
}

// ── Settings ────────────────────────────────────────────────────────

export async function loadSettings(): Promise<PlayerSettings> {
  const db = await openDb();
  const tx = db.transaction(STORE_SETTINGS, "readonly");
  const row = (await reqToPromise(
    tx.objectStore(STORE_SETTINGS).get("player"),
  )) as { key: string; value: Partial<PlayerSettings> } | undefined;
  await txDone(tx);
  db.close();
  return normalizeSettings(row?.value ?? DEFAULT_SETTINGS);
}

export async function saveSettings(settings: PlayerSettings): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE_SETTINGS, "readwrite");
  tx.objectStore(STORE_SETTINGS).put({ key: "player", value: settings });
  await txDone(tx);
  db.close();
}

export async function libraryStats(): Promise<{
  trackCount: number;
  totalBytes: number;
  playlistCount: number;
}> {
  const [tracks, playlists] = await Promise.all([listTracks(), listPlaylists()]);
  return {
    trackCount: tracks.length,
    totalBytes: tracks.reduce((s, t) => s + t.size, 0),
    playlistCount: playlists.length,
  };
}
