import type {
  Playlist,
  PlayerSettings,
  RetuneStyle,
  TrackMeta,
  TrackRecord,
} from "./types";
import {
  cleanTrackName,
  DEFAULT_SETTINGS,
  normalizeSettings,
  trackMetaFromRecord,
  uid,
} from "./types";

const DB_NAME = "truehz-player";
const DB_VERSION = 2;

const STORE_TRACKS = "tracks";
/** v2: audio + artwork blobs live here, keyed by track id, so listing/updating
 *  metadata never materializes the audio (CODE-2 / CODE-3). */
const STORE_TRACK_BLOBS = "trackBlobs";
const STORE_PLAYLISTS = "playlists";
const STORE_SETTINGS = "settings";

/** Row shape in STORE_TRACK_BLOBS. */
type TrackBlobRow = { id: string; blob: Blob; artworkBlob: Blob | null };

/**
 * v1 → v2 migration: move each track's inline `blob`/`artworkBlob` into the
 * new trackBlobs store and strip them from the meta record. Iterates by cursor
 * (not getAll) so migrating a large library never holds it all in memory. Runs
 * inside the versionchange transaction: if anything throws, the whole upgrade
 * aborts atomically and the DB stays at v1 (see failure-safety test).
 */
function migrateTracksV1ToV2(tx: IDBTransaction) {
  const tracks = tx.objectStore(STORE_TRACKS);
  const blobs = tx.objectStore(STORE_TRACK_BLOBS);
  const cursorReq = tracks.openCursor();
  cursorReq.onsuccess = () => {
    const cursor = cursorReq.result;
    if (!cursor) return;
    const rec = cursor.value as TrackRecord & { blob?: Blob };
    if (rec && rec.blob) {
      blobs.put({
        id: rec.id,
        blob: rec.blob,
        artworkBlob: rec.artworkBlob ?? null,
      });
      // Strip blob fields; keep hasArtwork accurate for the meta-only record.
      const { blob: _blob, artworkBlob, ...meta } = rec;
      void _blob;
      cursor.update({
        ...meta,
        hasArtwork: rec.hasArtwork ?? Boolean(artworkBlob),
      });
    }
    cursor.continue();
  };
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      const tx = req.transaction!;

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

      // v2: split blobs into their own store.
      if (!db.objectStoreNames.contains(STORE_TRACK_BLOBS)) {
        db.createObjectStore(STORE_TRACK_BLOBS, { keyPath: "id" });
      }
      // Only migrate when upgrading from an existing v1 database.
      if (event.oldVersion >= 1 && event.oldVersion < 2) {
        migrateTracksV1ToV2(tx);
      }
    };
  });
}

/** Normalize a meta-only (v2) stored record; tolerates legacy tag gaps. */
function metaFromStored(raw: Partial<TrackRecord> & { id: string }): TrackMeta {
  return {
    id: raw.id,
    name: raw.name ?? "",
    size: raw.size ?? 0,
    duration: raw.duration ?? null,
    mimeType: raw.mimeType ?? "audio/mpeg",
    addedAt: raw.addedAt ?? 0,
    playCount: raw.playCount ?? 0,
    lastPlayedAt: raw.lastPlayedAt ?? null,
    favorite: Boolean(raw.favorite),
    artist: raw.artist ?? null,
    album: raw.album ?? null,
    hasArtwork: Boolean(raw.hasArtwork ?? raw.artworkBlob),
    savedTargetHz:
      typeof raw.savedTargetHz === "number" && Number.isFinite(raw.savedTargetHz)
        ? raw.savedTargetHz
        : null,
    savedRetuneStyle:
      raw.savedRetuneStyle === "concert" || raw.savedRetuneStyle === "reanchor"
        ? raw.savedRetuneStyle
        : null,
    bakedRetune: Boolean(raw.bakedRetune),
  };
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
  // Meta-only store now — getAll no longer materializes any audio (CODE-2).
  const all = (await reqToPromise(
    tx.objectStore(STORE_TRACKS).getAll(),
  )) as (Partial<TrackRecord> & { id: string })[];
  await txDone(tx);
  db.close();
  return all
    .map((r) => metaFromStored(r))
    .sort((a, b) => b.addedAt - a.addedAt);
}

/** Read a track's metadata only (no audio). */
async function getTrackMeta(
  id: string,
): Promise<(Partial<TrackRecord> & { id: string }) | null> {
  const db = await openDb();
  const tx = db.transaction(STORE_TRACKS, "readonly");
  const rec = (await reqToPromise(tx.objectStore(STORE_TRACKS).get(id))) as
    | (Partial<TrackRecord> & { id: string })
    | undefined;
  await txDone(tx);
  db.close();
  return rec ?? null;
}

/**
 * Reassemble a full TrackRecord (meta + audio + artwork) for playback/export.
 * Returns null if the track is unknown or its audio blob is missing.
 */
export async function getTrack(id: string): Promise<TrackRecord | null> {
  const db = await openDb();
  const tx = db.transaction([STORE_TRACKS, STORE_TRACK_BLOBS], "readonly");
  // Issue both reads before awaiting so the transaction stays active.
  const metaReq = tx.objectStore(STORE_TRACKS).get(id);
  const blobReq = tx.objectStore(STORE_TRACK_BLOBS).get(id);
  const [meta, blobRow] = (await Promise.all([
    reqToPromise(metaReq),
    reqToPromise(blobReq),
  ])) as [
    (Partial<TrackRecord> & { id: string }) | undefined,
    TrackBlobRow | undefined,
  ];
  await txDone(tx);
  db.close();
  if (!meta || !blobRow?.blob) return null;
  return {
    ...metaFromStored(meta),
    blob: blobRow.blob,
    artworkBlob: blobRow.artworkBlob ?? null,
  };
}

export async function getTrackBlob(id: string): Promise<Blob | null> {
  const db = await openDb();
  const tx = db.transaction(STORE_TRACK_BLOBS, "readonly");
  const row = (await reqToPromise(tx.objectStore(STORE_TRACK_BLOBS).get(id))) as
    | TrackBlobRow
    | undefined;
  await txDone(tx);
  db.close();
  return row?.blob ?? null;
}

export async function getTrackArtwork(id: string): Promise<Blob | null> {
  const db = await openDb();
  const tx = db.transaction(STORE_TRACK_BLOBS, "readonly");
  const row = (await reqToPromise(tx.objectStore(STORE_TRACK_BLOBS).get(id))) as
    | TrackBlobRow
    | undefined;
  await txDone(tx);
  db.close();
  return row?.artworkBlob ?? null;
}

export type NewTrackInput = {
  file: File | Blob;
  name?: string;
  /** Original filename for extension / mime fallback */
  fileName?: string;
  artist?: string | null;
  album?: string | null;
  artworkBlob?: Blob | null;
  /** Seed a saved retune target (used by rendered-copy imports). */
  savedTargetHz?: number | null;
  savedRetuneStyle?: RetuneStyle | null;
  /** Mark the audio as already-retuned (plays original, no re-pitch). */
  bakedRetune?: boolean;
};

/**
 * iOS/WebKit often fails to persist raw File handles in IndexedDB after
 * async tag reads. Materialize a plain Blob from ArrayBuffer first.
 */
async function materializeBlob(
  source: Blob,
  mimeHint?: string,
): Promise<Blob> {
  const type = source.type || mimeHint || "application/octet-stream";
  if (source.size === 0) {
    throw new Error("Audio file is empty (0 bytes). Try another file.");
  }
  try {
    const buf = await source.arrayBuffer();
    if (!buf.byteLength) {
      throw new Error("Could not read audio data from the file.");
    }
    return new Blob([buf], { type });
  } catch (e) {
    if (e instanceof Error && /empty|Could not read/i.test(e.message)) throw e;
    // Last resort: some environments already have a stable Blob
    if (source instanceof Blob && source.size > 0) {
      return source.slice(0, source.size, type);
    }
    throw e instanceof Error
      ? e
      : new Error("Failed to read audio file into memory.");
  }
}

async function materializeArtwork(source: Blob | null): Promise<Blob | null> {
  if (!source || source.size === 0) return null;
  try {
    const buf = await source.arrayBuffer();
    if (!buf.byteLength) return null;
    return new Blob([buf], { type: source.type || "image/jpeg" });
  } catch {
    return null;
  }
}

function idbErrorMessage(err: unknown): string {
  const name =
    err && typeof err === "object" && "name" in err
      ? String((err as { name: string }).name)
      : "";
  const msg = err instanceof Error ? err.message : String(err ?? "unknown");
  if (name === "QuotaExceededError" || /quota/i.test(msg)) {
    return "Device storage is full. Free space, then try importing again.";
  }
  if (/empty|Could not read|0 bytes/i.test(msg)) return msg;
  return `Could not save to library: ${msg}`;
}

function isNewTrackInput(item: File | NewTrackInput): item is NewTrackInput {
  return (
    typeof item === "object" &&
    item !== null &&
    !(item instanceof File) &&
    "file" in item &&
    (item as NewTrackInput).file instanceof Blob
  );
}

/**
 * Add one track per transaction so a single failure does not wipe a batch,
 * and so iOS can persist large audio blobs reliably.
 */
export async function addTracksFromFiles(
  files: File[] | NewTrackInput[],
): Promise<TrackMeta[]> {
  if (!files.length) return [];
  const created: TrackMeta[] = [];
  const now = Date.now();
  const errors: string[] = [];

  for (const item of files) {
    const input = isNewTrackInput(item) ? item : null;
    const file: Blob = input ? input.file : (item as File);
    const fileName =
      input?.fileName ||
      (file instanceof File ? file.name : null) ||
      input?.name ||
      "track.mp3";
    const fallbackName = fileName.replace(/\.[^/.]+$/, "") || fileName;
    const mimeType =
      file.type ||
      (/\.flac$/i.test(fileName)
        ? "audio/flac"
        : /\.wav$/i.test(fileName)
          ? "audio/wav"
          : /\.m4a$/i.test(fileName)
            ? "audio/mp4"
            : "audio/mpeg");

    try {
      const blob = await materializeBlob(file, mimeType);
      const artworkBlob = await materializeArtwork(input?.artworkBlob ?? null);
      const id = uid("trk_");
      const record: TrackRecord = {
        id,
        name: cleanTrackName(input?.name || fallbackName),
        size: blob.size,
        duration: null,
        mimeType: blob.type || mimeType,
        addedAt: now,
        playCount: 0,
        lastPlayedAt: null,
        favorite: false,
        artist: input?.artist ?? null,
        album: input?.album ?? null,
        hasArtwork: Boolean(artworkBlob),
        savedTargetHz: input?.savedTargetHz ?? null,
        savedRetuneStyle: input?.savedRetuneStyle ?? null,
        bakedRetune: input?.bakedRetune ?? false,
        blob,
        artworkBlob,
      };
      // Split storage: meta → tracks, audio/artwork → trackBlobs.
      const { blob: _b, artworkBlob: _a, ...meta } = record;
      void _b;
      void _a;
      const blobRow: TrackBlobRow = { id, blob, artworkBlob };

      const db = await openDb();
      try {
        // Both stores in ONE transaction so a track never lands half-written.
        const tx = db.transaction(
          [STORE_TRACKS, STORE_TRACK_BLOBS],
          "readwrite",
        );
        tx.objectStore(STORE_TRACKS).put(meta);
        tx.objectStore(STORE_TRACK_BLOBS).put(blobRow);
        await txDone(tx);
      } finally {
        db.close();
      }

      // Verify the BLOB row actually landed (catches silent WebKit failures) —
      // meta alone is not proof the audio persisted.
      const savedBlob = await getTrackBlob(id);
      if (!savedBlob || savedBlob.size === 0) {
        throw new Error(
          "Saved track is missing audio data. Storage may be blocked.",
        );
      }

      created.push(trackMetaFromRecord(record));
    } catch (e) {
      console.error("[library] add track failed", fileName, e);
      errors.push(`${fallbackName}: ${idbErrorMessage(e)}`);
    }
  }

  if (!created.length && errors.length) {
    throw new Error(errors[0]);
  }
  if (errors.length && created.length) {
    console.warn("[library] partial import", errors);
  }
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
      | "savedTargetHz"
      | "savedRetuneStyle"
      | "bakedRetune"
    >
  > & { artworkBlob?: Blob | null },
): Promise<TrackMeta | null> {
  const touchesArtwork = patch.artworkBlob !== undefined;
  const db = await openDb();
  const tx = db.transaction(
    touchesArtwork ? [STORE_TRACKS, STORE_TRACK_BLOBS] : STORE_TRACKS,
    "readwrite",
  );
  const store = tx.objectStore(STORE_TRACKS);
  const existing = (await reqToPromise(store.get(id))) as
    | (Partial<TrackRecord> & { id: string })
    | undefined;
  if (!existing) {
    await txDone(tx);
    db.close();
    return null;
  }
  const base = metaFromStored(existing);
  // Meta-only patch — the audio blob is never read or rewritten here (CODE-3).
  const { artworkBlob: _artwork, ...metaPatch } = patch;
  void _artwork;
  const next: TrackMeta = {
    ...base,
    ...metaPatch,
    hasArtwork: touchesArtwork
      ? Boolean(patch.artworkBlob)
      : patch.hasArtwork ?? base.hasArtwork,
  };
  store.put(next);

  if (touchesArtwork) {
    // Route the artwork change to the blob store, preserving the audio blob.
    const blobStore = tx.objectStore(STORE_TRACK_BLOBS);
    const existingRow = (await reqToPromise(blobStore.get(id))) as
      | TrackBlobRow
      | undefined;
    if (existingRow) {
      blobStore.put({ ...existingRow, artworkBlob: patch.artworkBlob ?? null });
    }
  }

  await txDone(tx);
  db.close();
  return next;
}

export async function deleteTrack(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(
    [STORE_TRACKS, STORE_TRACK_BLOBS, STORE_PLAYLISTS],
    "readwrite",
  );
  tx.objectStore(STORE_TRACKS).delete(id);
  tx.objectStore(STORE_TRACK_BLOBS).delete(id);

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
  // Meta-only read + write — never touches the audio blob (CODE-3).
  const meta = await getTrackMeta(id);
  if (!meta) return;
  await updateTrackMeta(id, {
    playCount: (meta.playCount ?? 0) + 1,
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

// ── Pro entitlement backup (same origin as library) ─────────────────

const PRO_SETTINGS_KEY = "pro_entitlement";

/** Persist Pro session id into IndexedDB (backup for localStorage). */
export async function openDbForPro(sessionId: string | null): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE_SETTINGS, "readwrite");
  if (sessionId) {
    tx.objectStore(STORE_SETTINGS).put({
      key: PRO_SETTINGS_KEY,
      value: { sessionId, activatedAt: Date.now() },
    });
  } else {
    tx.objectStore(STORE_SETTINGS).delete(PRO_SETTINGS_KEY);
  }
  await txDone(tx);
  db.close();
}

export async function loadProFromDb(): Promise<string | null> {
  const db = await openDb();
  const tx = db.transaction(STORE_SETTINGS, "readonly");
  const row = (await reqToPromise(
    tx.objectStore(STORE_SETTINGS).get(PRO_SETTINGS_KEY),
  )) as { key: string; value?: { sessionId?: string } } | undefined;
  await txDone(tx);
  db.close();
  const id = row?.value?.sessionId;
  return typeof id === "string" && id.length > 0 ? id : null;
}
