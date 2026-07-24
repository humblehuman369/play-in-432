import type { RepeatMode } from "./types";

/** Build a play order from track ids (optionally shuffled). */
export function buildPlayOrder(trackIds: string[], shuffle: boolean): string[] {
  const ids = [...trackIds];
  if (!shuffle) return ids;
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}

/**
 * Resolve next track id when the user skips or the queue advances.
 * Repeat-one is handled separately on natural track end (not here).
 * Returns null when playback should stop.
 */
export function resolveNext(
  order: string[],
  currentId: string | null,
  repeat: RepeatMode,
  direction: 1 | -1 = 1,
): string | null {
  if (!order.length) return null;
  if (!currentId) return order[0] ?? null;

  const idx = order.indexOf(currentId);
  if (idx < 0) return order[0] ?? null;

  const next = idx + direction;
  if (next >= 0 && next < order.length) return order[next];

  if (repeat === "all") {
    return direction === 1 ? order[0] : order[order.length - 1];
  }
  return null;
}
