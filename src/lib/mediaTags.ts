/**
 * ID3 / media tag reading via music-metadata (browser-safe).
 */
import { parseBlob } from "music-metadata";

export type MediaTags = {
  title: string | null;
  artist: string | null;
  album: string | null;
  artworkBlob: Blob | null;
};

function firstPictureToBlob(
  picture:
    | { data: Uint8Array; format?: string }[]
    | undefined,
): Blob | null {
  const pic = picture?.[0];
  if (!pic?.data?.byteLength) return null;
  try {
    const copy = new Uint8Array(pic.data.byteLength);
    copy.set(pic.data);
    return new Blob([copy], {
      type: pic.format || "image/jpeg",
    });
  } catch {
    return null;
  }
}

export async function readMediaTags(file: Blob): Promise<MediaTags> {
  try {
    const meta = await parseBlob(file, {
      duration: false,
      skipCovers: false,
    });
    const common = meta.common;
    const title =
      typeof common.title === "string" && common.title.trim()
        ? common.title.trim()
        : null;
    const artist =
      typeof common.artist === "string" && common.artist.trim()
        ? common.artist.trim()
        : Array.isArray(common.artists) && common.artists[0]
          ? String(common.artists[0]).trim()
          : null;
    const album =
      typeof common.album === "string" && common.album.trim()
        ? common.album.trim()
        : null;

    return {
      title,
      artist,
      album,
      artworkBlob: firstPictureToBlob(
        common.picture as
          | { data: Uint8Array; format?: string }[]
          | undefined,
      ),
    };
  } catch {
    return {
      title: null,
      artist: null,
      album: null,
      artworkBlob: null,
    };
  }
}
