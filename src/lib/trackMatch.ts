/**
 * Match external playlist entries (M3U) to local library tracks.
 * Title + artist fuzzy matching — no audio leaves the device for matching.
 */
import type { TrackMeta } from "./types";

export type MatchQuery = {
  title?: string | null;
  artist?: string | null;
  /** File path or URL from M3U */
  location?: string | null;
  /** Explicit duration seconds if known */
  duration?: number | null;
};

export type MatchResult = {
  query: MatchQuery;
  track: TrackMeta | null;
  score: number;
  reason: string;
};

export type MatchReport = {
  results: MatchResult[];
  matchedIds: string[];
  matched: number;
  total: number;
  unmatched: MatchQuery[];
};

function stripExt(name: string): string {
  return name.replace(/\.[^/.]+$/, "");
}

/** Lowercase, strip punctuation, collapse whitespace. */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\.(mp3|wav|m4a|flac|ogg|aac|webm)$/i, "")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Basename without extension from path or URL. */
export function basenameFromLocation(location: string): string {
  const cleaned = location.split("?")[0].split("#")[0];
  const parts = cleaned.replace(/\\/g, "/").split("/");
  const last = parts[parts.length - 1] || cleaned;
  try {
    return stripExt(decodeURIComponent(last));
  } catch {
    return stripExt(last);
  }
}

function tokenSet(s: string): Set<string> {
  const n = normalizeText(s);
  if (!n) return new Set();
  return new Set(n.split(" ").filter((t) => t.length > 1));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union ? inter / union : 0;
}

function includesScore(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) {
    const shorter = Math.min(a.length, b.length);
    const longer = Math.max(a.length, b.length);
    return 0.75 + 0.25 * (shorter / longer);
  }
  return jaccard(tokenSet(a), tokenSet(b));
}

/**
 * Score 0–1 how well a library track matches a query.
 */
export function scoreTrackMatch(track: TrackMeta, q: MatchQuery): number {
  const tTitle = normalizeText(track.name);
  const tArtist = normalizeText(track.artist ?? "");
  const qTitle = normalizeText(q.title ?? "");
  const qArtist = normalizeText(q.artist ?? "");
  const locBase = q.location ? normalizeText(basenameFromLocation(q.location)) : "";

  let best = 0;

  // Filename vs track name
  if (locBase) {
    best = Math.max(best, includesScore(tTitle, locBase) * 0.95);
    if (tArtist) {
      const combined = normalizeText(`${tArtist} ${tTitle}`);
      best = Math.max(best, includesScore(combined, locBase) * 0.92);
      const dash = locBase.match(/^(.+?)\s+-\s+(.+)$/);
      if (dash) {
        best = Math.max(
          best,
          includesScore(tArtist, dash[1]) * 0.45 +
            includesScore(tTitle, dash[2]) * 0.55,
        );
      }
    }
  }

  if (qTitle) {
    const titleScore = includesScore(tTitle, qTitle);
    if (qArtist && tArtist) {
      const artistScore = includesScore(tArtist, qArtist);
      best = Math.max(best, titleScore * 0.65 + artistScore * 0.35);
      best = Math.max(best, titleScore * 0.5 + artistScore * 0.5);
    } else {
      best = Math.max(best, titleScore * (qArtist ? 0.7 : 0.9));
    }
  }

  // Duration hint (±3s)
  if (
    q.duration != null &&
    track.duration != null &&
    Number.isFinite(q.duration) &&
    Number.isFinite(track.duration)
  ) {
    const diff = Math.abs(q.duration - track.duration);
    if (diff <= 3 && best >= 0.45) best = Math.min(1, best + 0.05);
    if (diff > 15 && best < 0.85) best *= 0.9;
  }

  return best;
}

const DEFAULT_THRESHOLD = 0.55;

/**
 * Match an ordered list of queries to library tracks.
 * Prefer unique tracks; if two queries want the same track, first wins unless later scores much higher.
 */
export function matchQueriesToLibrary(
  queries: MatchQuery[],
  library: TrackMeta[],
  threshold = DEFAULT_THRESHOLD,
): MatchReport {
  const used = new Set<string>();
  const results: MatchResult[] = [];

  for (const query of queries) {
    let best: TrackMeta | null = null;
    let bestScore = 0;

    for (const track of library) {
      if (used.has(track.id)) continue;
      const s = scoreTrackMatch(track, query);
      if (s > bestScore) {
        bestScore = s;
        best = track;
      }
    }

    if (best && bestScore >= threshold) {
      used.add(best.id);
      results.push({
        query,
        track: best,
        score: bestScore,
        reason: `Matched (${Math.round(bestScore * 100)}%)`,
      });
    } else {
      results.push({
        query,
        track: null,
        score: bestScore,
        reason:
          bestScore > 0
            ? `Best candidate too weak (${Math.round(bestScore * 100)}%)`
            : "No library match",
      });
    }
  }

  const matchedIds = results
    .filter((r) => r.track)
    .map((r) => r.track!.id);
  const unmatched = results.filter((r) => !r.track).map((r) => r.query);

  return {
    results,
    matchedIds,
    matched: matchedIds.length,
    total: queries.length,
    unmatched,
  };
}

export function formatQueryLabel(q: MatchQuery): string {
  const title = q.title?.trim();
  const artist = q.artist?.trim();
  if (title && artist) return `${artist} — ${title}`;
  if (title) return title;
  if (q.location) return basenameFromLocation(q.location);
  return "(unknown)";
}
