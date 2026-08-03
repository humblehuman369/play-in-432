// In-memory IndexedDB for node. Must be imported before the db module runs.
import "fake-indexeddb/auto";
import { beforeEach, describe, it, expect } from "vitest";
import {
  addTracksFromFiles,
  deleteTrack,
  getTrack,
  listTracks,
  recordPlay,
} from "../../src/lib/db";

const DB_NAME = "truehz-player";

function del(name: string): Promise<void> {
  return new Promise((res) => {
    const r = indexedDB.deleteDatabase(name);
    r.onsuccess = () => res();
    r.onerror = () => res();
    r.onblocked = () => res();
  });
}

/** Seed a v1 database (old schema: blobs stored inline on the track record). */
function seedV1(records: Record<string, unknown>[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      const tracks = db.createObjectStore("tracks", { keyPath: "id" });
      tracks.createIndex("name", "name");
      tracks.createIndex("addedAt", "addedAt");
      tracks.createIndex("favorite", "favorite");
      db.createObjectStore("playlists", { keyPath: "id" });
      db.createObjectStore("settings", { keyPath: "key" });
    };
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction("tracks", "readwrite");
      for (const r of records) tx.objectStore("tracks").put(r);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  });
}

/** Read a raw row from the current DB version (no migration side effects). */
function getRaw(store: string, key: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME);
    req.onsuccess = () => {
      const db = req.result;
      const g = db.transaction(store, "readonly").objectStore(store).get(key);
      g.onsuccess = () => {
        db.close();
        resolve(g.result);
      };
      g.onerror = () => {
        db.close();
        reject(g.error);
      };
    };
    req.onerror = () => reject(req.error);
  });
}

function storeNames(): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME);
    req.onsuccess = () => {
      const db = req.result;
      const names = Array.from(db.objectStoreNames);
      db.close();
      resolve(names);
    };
    req.onerror = () => reject(req.error);
  });
}

function v1Record(over: Record<string, unknown>): Record<string, unknown> {
  return {
    duration: null,
    mimeType: "audio/mpeg",
    addedAt: 100,
    playCount: 0,
    lastPlayedAt: null,
    favorite: false,
    artist: null,
    album: null,
    hasArtwork: false,
    ...over,
  };
}

beforeEach(async () => {
  await del(DB_NAME);
});

describe("v1 → v2 migration", () => {
  it("moves inline blobs into trackBlobs and strips the meta record", async () => {
    await seedV1([
      v1Record({
        id: "trk_1",
        name: "Song One",
        size: 3,
        favorite: true,
        hasArtwork: true,
        blob: new Blob([new Uint8Array([1, 2, 3])], { type: "audio/mpeg" }),
        artworkBlob: new Blob([new Uint8Array([9, 9])], { type: "image/jpeg" }),
      }),
      v1Record({
        id: "trk_2",
        name: "Song Two",
        size: 2,
        blob: new Blob([new Uint8Array([4, 5])], { type: "audio/mpeg" }),
        artworkBlob: null,
      }),
    ]);

    // First db-module call triggers the v2 upgrade + migration.
    const list = await listTracks();
    expect(list.map((t) => t.id).sort()).toEqual(["trk_1", "trk_2"]);
    const one = list.find((t) => t.id === "trk_1")!;
    expect(one.name).toBe("Song One");
    expect(one.favorite).toBe(true);
    expect(one.hasArtwork).toBe(true);

    // Audio + artwork reassemble via getTrack.
    const rec = await getTrack("trk_1");
    expect(rec?.blob.size).toBe(3);
    expect(rec?.artworkBlob?.size).toBe(2);

    // tracks store is meta-only now; blobs live in trackBlobs.
    const rawMeta = await getRaw("tracks", "trk_1");
    expect(rawMeta.blob).toBeUndefined();
    expect(rawMeta.artworkBlob).toBeUndefined();
    const rawBlob = await getRaw("trackBlobs", "trk_1");
    expect(rawBlob.blob.size).toBe(3);
    expect(rawBlob.artworkBlob.size).toBe(2);
  });
});

describe("v2 API round-trip", () => {
  it("imports (cleaning the name), plays without rewriting audio, and deletes both stores", async () => {
    const [meta] = await addTracksFromFiles([
      {
        file: new Blob([new Uint8Array([1, 2, 3, 4])], { type: "audio/mpeg" }),
        fileName: "my song_a1b2c3d4.mp3",
      },
    ]);
    // UX-4 name cleanup strips the trailing _<8-hex> suffix.
    expect(meta.name).toBe("my song");
    const id = meta.id;

    const rec = await getTrack(id);
    expect(rec?.blob.size).toBe(4);

    // recordPlay bumps meta but must NOT touch the audio blob (CODE-3).
    await recordPlay(id);
    const after = await getTrack(id);
    expect(after?.playCount).toBe(1);
    expect(after?.blob.size).toBe(4);
    expect((await getRaw("trackBlobs", id)).blob.size).toBe(4);

    await deleteTrack(id);
    expect(await getTrack(id)).toBeNull();
    expect(await getRaw("tracks", id)).toBeUndefined();
    expect(await getRaw("trackBlobs", id)).toBeUndefined();
  });
});

describe("migration failure safety", () => {
  it("rolls back atomically when the upgrade transaction aborts mid-migration", async () => {
    await seedV1([
      v1Record({
        id: "trk_1",
        name: "Keep Me",
        size: 3,
        blob: new Blob([new Uint8Array([1, 2, 3])], { type: "audio/mpeg" }),
        artworkBlob: null,
      }),
    ]);

    // Simulate a fault partway through a v2 upgrade: create the new store,
    // migrate one row, then abort. IndexedDB must roll the whole thing back.
    await expect(
      new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 2);
        req.onupgradeneeded = () => {
          const tx = req.transaction!;
          req.result.createObjectStore("trackBlobs", { keyPath: "id" });
          tx.objectStore("trackBlobs").put({
            id: "trk_1",
            blob: new Blob([new Uint8Array([1])]),
            artworkBlob: null,
          });
          tx.abort();
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error("aborted"));
      }),
    ).rejects.toBeTruthy();

    // DB is still v1: original inline blob intact, no trackBlobs store.
    const rawMeta = await getRaw("tracks", "trk_1");
    expect(rawMeta.blob).toBeInstanceOf(Blob);
    expect(await storeNames()).not.toContain("trackBlobs");
  });
});
