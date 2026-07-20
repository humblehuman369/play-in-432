import { useEffect, useState } from "react";
import * as db from "../lib/db";

/** Load track artwork blob → object URL; revokes on change/unmount. */
export function useArtworkUrl(
  trackId: string | null | undefined,
  hasArtwork: boolean | undefined,
): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;

    if (!trackId || !hasArtwork) {
      setUrl(null);
      return;
    }

    (async () => {
      const blob = await db.getTrackArtwork(trackId);
      if (cancelled || !blob) {
        if (!cancelled) setUrl(null);
        return;
      }
      const u = URL.createObjectURL(blob);
      revoked = u;
      if (!cancelled) setUrl(u);
    })();

    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [trackId, hasArtwork]);

  return url;
}
