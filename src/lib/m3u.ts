/**
 * Parse M3U / M3U8 playlist files (local).
 * Supports extended (#EXTINF) and simple path-only lists.
 */
import type { MatchQuery } from "./trackMatch";
import { basenameFromLocation } from "./trackMatch";

export type M3uParseResult = {
  name: string | null;
  entries: MatchQuery[];
  rawLineCount: number;
};

function isComment(line: string): boolean {
  return line.startsWith("#");
}

function parseExtInf(line: string): { duration: number | null; title: string | null; artist: string | null } {
  // #EXTINF:123,Artist - Title   or  #EXTINF:123,Title
  const m = line.match(/^#EXTINF:(-?\d+(?:\.\d+)?)?\s*,?(.*)$/i);
  if (!m) return { duration: null, title: null, artist: null };
  const duration =
    m[1] != null && m[1] !== "" && Number(m[1]) >= 0 ? Number(m[1]) : null;
  const rest = (m[2] ?? "").trim();
  if (!rest) return { duration, title: null, artist: null };

  const dash = rest.match(/^(.+?)\s+-\s+(.+)$/);
  if (dash) {
    return { duration, artist: dash[1].trim(), title: dash[2].trim() };
  }
  return { duration, title: rest, artist: null };
}

/**
 * Parse M3U text into match queries (order preserved).
 */
export function parseM3u(
  text: string,
  opts?: { playlistFileName?: string },
): M3uParseResult {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const entries: MatchQuery[] = [];
  let pending: {
    duration: number | null;
    title: string | null;
    artist: string | null;
  } | null = null;
  let name: string | null = null;

  for (const line of lines) {
    if (line.toUpperCase() === "#EXTM3U") continue;

    if (line.toUpperCase().startsWith("#PLAYLIST:")) {
      name = line.slice("#PLAYLIST:".length).trim() || null;
      continue;
    }

    if (line.toUpperCase().startsWith("#EXTINF:")) {
      pending = parseExtInf(line);
      continue;
    }

    if (isComment(line)) continue;

    // Location line
    const location = line;
    const fromInf = pending;
    pending = null;

    let title = fromInf?.title ?? null;
    let artist = fromInf?.artist ?? null;
    if (!title) {
      title = basenameFromLocation(location);
    }

    entries.push({
      title,
      artist,
      location,
      duration: fromInf?.duration ?? null,
    });
  }

  if (!name && opts?.playlistFileName) {
    name = opts.playlistFileName.replace(/\.(m3u8?|pls)$/i, "").trim() || null;
  }

  return {
    name,
    entries,
    rawLineCount: lines.length,
  };
}

export function isM3uFile(file: File): boolean {
  const n = file.name.toLowerCase();
  return (
    n.endsWith(".m3u") ||
    n.endsWith(".m3u8") ||
    file.type === "audio/x-mpegurl" ||
    file.type === "application/vnd.apple.mpegurl" ||
    file.type === "audio/mpegurl"
  );
}

export async function readM3uFile(file: File): Promise<M3uParseResult> {
  const text = await file.text();
  return parseM3u(text, { playlistFileName: file.name });
}
