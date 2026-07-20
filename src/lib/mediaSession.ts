/**
 * Media Session API — lock screen / headset / OS media keys.
 */

export type MediaSessionHandlers = {
  onPlay?: () => void;
  onPause?: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  /** Absolute position in seconds */
  onSeekTo?: (seconds: number) => void;
  /** Relative skip in seconds (negative = back) */
  onSeekBy?: (deltaSeconds: number) => void;
};

export function mediaSessionSupported(): boolean {
  return typeof navigator !== "undefined" && "mediaSession" in navigator;
}

export function updateMediaSessionMetadata(opts: {
  title: string;
  artist?: string | null;
  album?: string | null;
  artworkUrl?: string | null;
}) {
  if (!mediaSessionSupported()) return;
  try {
    const artwork = opts.artworkUrl
      ? [
          { src: opts.artworkUrl, sizes: "96x96" },
          { src: opts.artworkUrl, sizes: "256x256" },
          { src: opts.artworkUrl, sizes: "512x512" },
        ]
      : [];
    navigator.mediaSession.metadata = new MediaMetadata({
      title: opts.title || "Play In 432",
      artist: opts.artist || "Play In 432",
      album: opts.album || "Local library · TrueHz",
      artwork,
    });
  } catch {
    /* Safari / locked-down environments */
  }
}

export function updateMediaSessionPlayback(
  state: "none" | "paused" | "playing",
  positionSec: number,
  durationSec: number,
) {
  if (!mediaSessionSupported()) return;
  try {
    navigator.mediaSession.playbackState = state;
    if (
      "setPositionState" in navigator.mediaSession &&
      durationSec > 0 &&
      Number.isFinite(positionSec)
    ) {
      navigator.mediaSession.setPositionState({
        duration: durationSec,
        position: Math.min(Math.max(0, positionSec), durationSec),
        playbackRate: 1,
      });
    }
  } catch {
    /* ignore invalid position */
  }
}

export function bindMediaSessionHandlers(handlers: MediaSessionHandlers) {
  if (!mediaSessionSupported()) return () => {};

  const set = (
    action: MediaSessionAction,
    fn: MediaSessionActionHandler | null,
  ) => {
    try {
      navigator.mediaSession.setActionHandler(action, fn);
    } catch {
      /* action not supported */
    }
  };

  set("play", handlers.onPlay ? () => handlers.onPlay!() : null);
  set("pause", handlers.onPause ? () => handlers.onPause!() : null);
  set(
    "previoustrack",
    handlers.onPrevious ? () => handlers.onPrevious!() : null,
  );
  set("nexttrack", handlers.onNext ? () => handlers.onNext!() : null);
  set(
    "seekto",
    handlers.onSeekTo
      ? (details) => {
          if (details.seekTime != null) handlers.onSeekTo!(details.seekTime);
        }
      : null,
  );
  set(
    "seekbackward",
    handlers.onSeekBy
      ? (details) => {
          handlers.onSeekBy!(-(details.seekOffset ?? 10));
        }
      : null,
  );
  set(
    "seekforward",
    handlers.onSeekBy
      ? (details) => {
          handlers.onSeekBy!(details.seekOffset ?? 10);
        }
      : null,
  );

  return () => {
    set("play", null);
    set("pause", null);
    set("previoustrack", null);
    set("nexttrack", null);
    set("seekto", null);
    set("seekbackward", null);
    set("seekforward", null);
  };
}
