export type TrackMeta = {
  id: string;
  name: string;
  size: number;
  duration: number | null;
  mimeType: string;
  addedAt: number;
  playCount: number;
  lastPlayedAt: number | null;
  favorite: boolean;
  /** ID3 / tags */
  artist: string | null;
  album: string | null;
  hasArtwork: boolean;
};

export type TrackRecord = TrackMeta & {
  blob: Blob;
  artworkBlob: Blob | null;
};

export type Playlist = {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: number;
  updatedAt: number;
};

export type RepeatMode = "off" | "all" | "one";

/** "retuned" = apply pitch scale; "original" = pitch 1.0 */
export type PlayMode = "original" | "retuned";

/** How target Hz is turned into a pitch scale (see retune.ts). */
export type RetuneStyle = "concert" | "reanchor";

export type PlayerSettings = {
  volume: number;
  mode: PlayMode;
  /**
   * concert = A_source → A_target (full ratio).
   * reanchor = Solfeggio note map (small shift; HZP-style).
   */
  retuneStyle: RetuneStyle;
  /** Assumed source concert pitch (Hz) / A4 reference for note map */
  sourceA: number;
  /**
   * Target: concert A in "concert" style, or labeled Solfeggio/anchor Hz
   * in "reanchor" style.
   */
  targetA: number;
  bedOn: boolean;
  bedLevel: number;
  shuffle: boolean;
  repeat: RepeatMode;
  /** Auto-run pitch estimate when a track loads */
  autoDetectPitch: boolean;
};

export const DEFAULT_SETTINGS: PlayerSettings = {
  volume: 0.85,
  mode: "retuned",
  retuneStyle: "reanchor",
  sourceA: 440,
  targetA: 432,
  bedOn: false,
  bedLevel: 0.08,
  shuffle: false,
  repeat: "off",
  autoDetectPitch: true,
};

/** Normalize legacy settings from older builds. */
export function normalizeSettings(
  raw: Record<string, unknown> | Partial<PlayerSettings>,
): PlayerSettings {
  const r = raw as Record<string, unknown>;
  const rawMode = r.mode;
  const mode: PlayMode =
    rawMode === "original"
      ? "original"
      : rawMode === "retune432" || rawMode === "retuned"
        ? "retuned"
        : DEFAULT_SETTINGS.mode;

  const sourceA =
    typeof r.sourceA === "number" && Number.isFinite(r.sourceA)
      ? r.sourceA
      : DEFAULT_SETTINGS.sourceA;
  const targetA =
    typeof r.targetA === "number" && Number.isFinite(r.targetA)
      ? r.targetA
      : DEFAULT_SETTINGS.targetA;

  const retuneStyle: RetuneStyle =
    r.retuneStyle === "concert" || r.retuneStyle === "reanchor"
      ? r.retuneStyle
      : DEFAULT_SETTINGS.retuneStyle;

  return {
    ...DEFAULT_SETTINGS,
    volume:
      typeof r.volume === "number" && Number.isFinite(r.volume)
        ? r.volume
        : DEFAULT_SETTINGS.volume,
    mode,
    retuneStyle,
    sourceA,
    targetA,
    bedOn: typeof r.bedOn === "boolean" ? r.bedOn : DEFAULT_SETTINGS.bedOn,
    bedLevel:
      typeof r.bedLevel === "number" && Number.isFinite(r.bedLevel)
        ? r.bedLevel
        : DEFAULT_SETTINGS.bedLevel,
    shuffle:
      typeof r.shuffle === "boolean" ? r.shuffle : DEFAULT_SETTINGS.shuffle,
    repeat:
      r.repeat === "off" || r.repeat === "all" || r.repeat === "one"
        ? r.repeat
        : DEFAULT_SETTINGS.repeat,
    autoDetectPitch:
      typeof r.autoDetectPitch === "boolean"
        ? r.autoDetectPitch
        : DEFAULT_SETTINGS.autoDetectPitch,
  };
}

export type View =
  | { kind: "library" }
  | { kind: "favorites" }
  | { kind: "playlist"; playlistId: string };

export function uid(prefix = ""): string {
  return `${prefix}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Normalize older track records missing tag fields. */
export function normalizeTrackRecord(raw: TrackRecord): TrackRecord {
  return {
    ...raw,
    artist: raw.artist ?? null,
    album: raw.album ?? null,
    hasArtwork: raw.hasArtwork ?? Boolean(raw.artworkBlob),
    artworkBlob: raw.artworkBlob ?? null,
  };
}

export function trackMetaFromRecord(record: TrackRecord): TrackMeta {
  const r = normalizeTrackRecord(record);
  return {
    id: r.id,
    name: r.name,
    size: r.size,
    duration: r.duration,
    mimeType: r.mimeType,
    addedAt: r.addedAt,
    playCount: r.playCount,
    lastPlayedAt: r.lastPlayedAt,
    favorite: r.favorite,
    artist: r.artist,
    album: r.album,
    hasArtwork: Boolean(r.artworkBlob) || r.hasArtwork,
  };
}
