// In-memory IndexedDB for node. Must be imported before the db module runs.
import "fake-indexeddb/auto";
import { beforeEach, describe, it, expect } from "vitest";
import {
  addTracksFromFiles,
  getTrack,
  listTracks,
  updateTrackMeta,
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

async function seedTrack(): Promise<string> {
  const [meta] = await addTracksFromFiles([
    {
      file: new Blob([new Uint8Array([1, 2, 3])], { type: "audio/mpeg" }),
      fileName: "song.mp3",
      name: "Song",
    },
  ]);
  return meta.id;
}

beforeEach(async () => {
  await del(DB_NAME);
});

describe("per-track saved retune target", () => {
  it("defaults to null on a freshly imported track", async () => {
    const id = await seedTrack();
    const [meta] = await listTracks();
    expect(meta.id).toBe(id);
    expect(meta.savedTargetHz).toBeNull();
    expect(meta.savedRetuneStyle).toBeNull();

    const rec = await getTrack(id);
    expect(rec?.savedTargetHz).toBeNull();
    expect(rec?.savedRetuneStyle).toBeNull();
  });

  it("round-trips a saved target through listTracks and getTrack", async () => {
    const id = await seedTrack();
    await updateTrackMeta(id, {
      savedTargetHz: 528,
      savedRetuneStyle: "concert",
    });

    const [meta] = await listTracks();
    expect(meta.savedTargetHz).toBe(528);
    expect(meta.savedRetuneStyle).toBe("concert");

    // getTrack (used by playback) must carry the saved target too.
    const rec = await getTrack(id);
    expect(rec?.savedTargetHz).toBe(528);
    expect(rec?.savedRetuneStyle).toBe("concert");
  });

  it("preserves the saved target across an unrelated meta update", async () => {
    const id = await seedTrack();
    await updateTrackMeta(id, {
      savedTargetHz: 432,
      savedRetuneStyle: "reanchor",
    });
    // A favorite toggle must not wipe the saved target.
    await updateTrackMeta(id, { favorite: true });

    const [meta] = await listTracks();
    expect(meta.favorite).toBe(true);
    expect(meta.savedTargetHz).toBe(432);
    expect(meta.savedRetuneStyle).toBe("reanchor");
  });

  it("clears the saved target (and its style) when set back to null", async () => {
    const id = await seedTrack();
    await updateTrackMeta(id, {
      savedTargetHz: 741,
      savedRetuneStyle: "concert",
    });
    await updateTrackMeta(id, {
      savedTargetHz: null,
      savedRetuneStyle: null,
    });

    const rec = await getTrack(id);
    expect(rec?.savedTargetHz).toBeNull();
    expect(rec?.savedRetuneStyle).toBeNull();
  });
});
