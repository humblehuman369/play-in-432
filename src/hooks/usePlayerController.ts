import { useCallback, useEffect, useRef, useState } from "react";
import { PlayerEngine, type PlayMode } from "../lib/playerEngine";
import * as db from "../lib/db";
import { exportRetunedFile, renderRetunedBlob } from "../lib/exportRetune";
import {
  bindMediaSessionHandlers,
  updateMediaSessionMetadata,
  updateMediaSessionPlayback,
} from "../lib/mediaSession";
import { estimateConcertA, type PitchEstimate } from "../lib/pitchDetect";
import { buildPlayOrder, resolveNext } from "../lib/queue";
import type { FrequencyAnchor } from "../lib/frequencies";
import { clampPitchA } from "../lib/retune";
import type {
  ExportFormat,
  PlayerSettings,
  RepeatMode,
  RetuneStyle,
  TrackMeta,
} from "../lib/types";
import { DEFAULT_SETTINGS } from "../lib/types";

const SLEEP_FADE_SEC = 20;

type Args = {
  tracks: TrackMeta[];
  onDurationKnown?: (id: string, duration: number) => void;
  onPlayed?: (id: string) => void;
  /** Persist a rendered (baked) retune copy as a new Library track. */
  onAddRenderedTrack?: (
    blob: Blob,
    opts: {
      name: string;
      targetHz: number;
      retuneStyle: RetuneStyle;
      format: "wav" | "mp3";
    },
  ) => Promise<unknown>;
};

export function usePlayerController({
  tracks,
  onDurationKnown,
  onPlayed,
  onAddRenderedTrack,
}: Args) {
  const engineRef = useRef<PlayerEngine | null>(null);
  const queueRef = useRef<string[]>([]);
  const activeIdRef = useRef<string | null>(null);
  const settingsRef = useRef<PlayerSettings>(DEFAULT_SETTINGS);
  const timePlayedRef = useRef(0);
  const durationRef = useRef(0);
  const playTrackRef = useRef<(id: string, autoplay?: boolean) => Promise<void>>(
    async () => {},
  );
  const artworkUrlRef = useRef<string | null>(null);

  const [settings, setSettings] = useState<PlayerSettings>(DEFAULT_SETTINGS);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [queue, setQueue] = useState<string[]>([]);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timePlayed, setTimePlayed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [percent, setPercent] = useState(0);
  const [settingsReady, setSettingsReady] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [exportEngine, setExportEngine] = useState<
    "signalsmith" | "rubberband" | "soundtouch" | null
  >(null);
  const [pitchEstimate, setPitchEstimate] = useState<PitchEstimate | null>(
    null,
  );
  const [pitchDetecting, setPitchDetecting] = useState(false);
  const [artworkUrl, setArtworkUrl] = useState<string | null>(null);
  const [sleepRemainingSec, setSleepRemainingSec] = useState<number | null>(
    null,
  );
  const [sleepMinutes, setSleepMinutesState] = useState<number | null>(null);

  const sleepEndAtRef = useRef<number | null>(null);
  const sleepBaseVolRef = useRef(DEFAULT_SETTINGS.volume);
  /** Always-current library IDs — avoids import race with playContext. */
  const tracksRef = useRef(tracks);

  activeIdRef.current = activeId;
  settingsRef.current = settings;
  queueRef.current = queue;
  timePlayedRef.current = timePlayed;
  durationRef.current = duration;
  tracksRef.current = tracks;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await db.loadSettings();
        if (!cancelled) {
          setSettings(s);
          settingsRef.current = s;
        }
      } finally {
        if (!cancelled) setSettingsReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!settingsReady) return;
    void db.saveSettings(settings);
  }, [settings, settingsReady]);

  // Artwork object URL for active track
  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;
    setArtworkUrl(null);
    artworkUrlRef.current = null;

    const track = tracks.find((t) => t.id === activeId);
    if (!activeId || !track?.hasArtwork) return;

    (async () => {
      const blob = await db.getTrackArtwork(activeId);
      if (cancelled || !blob) return;
      const u = URL.createObjectURL(blob);
      revoked = u;
      if (!cancelled) {
        setArtworkUrl(u);
        artworkUrlRef.current = u;
      }
    })();

    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [activeId, tracks]);

  const advance = useCallback((direction: 1 | -1) => {
    const s = settingsRef.current;
    const nextId = resolveNext(
      queueRef.current,
      activeIdRef.current,
      s.repeat,
      direction,
    );
    if (nextId) void playTrackRef.current(nextId, true);
    else {
      engineRef.current?.pause();
      setPlaying(false);
    }
  }, []);

  useEffect(() => {
    const engine = new PlayerEngine();
    engine.setCallbacks({
      onProgress: (d) => {
        setTimePlayed(d.timePlayed);
        setDuration(d.duration);
        setPercent(d.percentagePlayed);
        updateMediaSessionPlayback(
          engine.isPlaying ? "playing" : "paused",
          d.timePlayed,
          d.duration,
        );
      },
      onEnded: () => {
        setPlaying(false);
        updateMediaSessionPlayback("paused", 0, durationRef.current);
        if (
          settingsRef.current.repeat === "one" &&
          activeIdRef.current
        ) {
          void playTrackRef.current(activeIdRef.current, true);
          return;
        }
        advance(1);
      },
    });
    engineRef.current = engine;
    return () => engine.dispose();
  }, [advance]);

  const seekToSeconds = useCallback((seconds: number) => {
    const dur = durationRef.current;
    if (dur <= 0) return;
    const targetSec = Math.max(0, Math.min(dur, seconds));
    const p = (targetSec / dur) * 100;
    engineRef.current?.seekPercent(p);
    setPercent(p);
    setTimePlayed(targetSec);
    updateMediaSessionPlayback(
      engineRef.current?.isPlaying ? "playing" : "paused",
      targetSec,
      dur,
    );
  }, []);

  // Media Session action handlers
  useEffect(() => {
    return bindMediaSessionHandlers({
      onPlay: () => {
        void engineRef.current?.play().then(() => {
          setPlaying(true);
          updateMediaSessionPlayback(
            "playing",
            timePlayedRef.current,
            durationRef.current,
          );
        });
      },
      onPause: () => {
        engineRef.current?.pause();
        setPlaying(false);
        updateMediaSessionPlayback(
          "paused",
          timePlayedRef.current,
          durationRef.current,
        );
      },
      onPrevious: () => {
        if (timePlayedRef.current > 3) {
          seekToSeconds(0);
        } else {
          advance(-1);
        }
      },
      onNext: () => advance(1),
      onSeekTo: (sec) => seekToSeconds(sec),
      onSeekBy: (delta) =>
        seekToSeconds(timePlayedRef.current + delta),
    });
  }, [advance, seekToSeconds]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    // A baked (already-retuned) copy must never be re-pitched, even when an
    // unrelated setting (volume, bed) changes while it is the active track.
    const activeBaked = Boolean(
      tracksRef.current.find((t) => t.id === activeIdRef.current)?.bakedRetune,
    );
    engine.setVolume(settings.volume);
    engine.setMode(activeBaked ? "original" : settings.mode);
    engine.setRetuneStyle(settings.retuneStyle);
    engine.setPitchTargets(settings.sourceA, settings.targetA);
    engine.setBedEnabled(settings.bedOn);
    engine.setBedLevel(settings.bedLevel);
  }, [
    settings.volume,
    settings.mode,
    settings.retuneStyle,
    settings.sourceA,
    settings.targetA,
    settings.bedOn,
    settings.bedLevel,
  ]);

  // Keep Media Session metadata in sync
  useEffect(() => {
    const track = tracks.find((t) => t.id === activeId);
    if (!track) return;
    updateMediaSessionMetadata({
      title: track.name,
      artist: track.artist,
      album: track.album,
      artworkUrl,
    });
  }, [activeId, tracks, artworkUrl]);

  useEffect(() => {
    updateMediaSessionPlayback(
      playing ? "playing" : activeId ? "paused" : "none",
      timePlayed,
      duration,
    );
  }, [playing, activeId, timePlayed, duration]);

  const runPitchDetect = useCallback(async (buffer: AudioBuffer) => {
    setPitchDetecting(true);
    setPitchEstimate(null);
    try {
      const est = await estimateConcertA(buffer);
      setPitchEstimate(est);
    } catch (e) {
      console.warn("Pitch detect failed", e);
      setPitchEstimate(null);
    } finally {
      setPitchDetecting(false);
    }
  }, []);

  const playTrack = useCallback(
    async (id: string, autoplay = true) => {
      const engine = engineRef.current;
      if (!engine) return;
      setError(null);
      setLoading(true);
      setPlaying(false);
      setActiveId(id);
      setTimePlayed(0);
      setPercent(0);
      setPitchEstimate(null);

      try {
        const rec = await db.getTrack(id);
        if (!rec) throw new Error("Track not found in library");

        const data = await rec.blob.arrayBuffer();
        await engine.loadArrayBuffer(data);

        const s = settingsRef.current;
        // Per-track tuning takes precedence over the global default and is
        // reflected back into the live controls so the header, now-playing
        // line, and frequency strip stay a single source of truth.
        // A baked (already-retuned) copy plays ORIGINAL so it is never
        // re-pitched on top of its rendered tuning.
        const savedHz = rec.savedTargetHz;
        const savedStyle = rec.savedRetuneStyle;
        const baked = rec.bakedRetune;
        const effMode: PlayMode = baked
          ? "original"
          : savedHz != null
            ? "retuned"
            : s.mode;
        const effTarget = !baked && savedHz != null ? savedHz : s.targetA;
        const effStyle: RetuneStyle = savedStyle ?? s.retuneStyle;
        engine.setMode(effMode);
        engine.setRetuneStyle(effStyle);
        engine.setPitchTargets(s.sourceA, effTarget);
        engine.setVolume(s.volume);
        engine.setBedEnabled(s.bedOn);
        engine.setBedLevel(s.bedLevel);
        // A live-saved target is reflected into the global controls (so the
        // strip/header edit the active track). A BAKED copy is NOT reflected —
        // it plays original at the engine only, leaving the user's global
        // retune default intact so the next normal track still retunes.
        if (
          !baked &&
          savedHz != null &&
          (effTarget !== s.targetA ||
            effStyle !== s.retuneStyle ||
            effMode !== s.mode)
        ) {
          setSettings((prev) => ({
            ...prev,
            mode: effMode,
            retuneStyle: effStyle,
            targetA: effTarget,
          }));
        }

        setDuration(engine.duration);
        if (rec.duration == null && engine.duration > 0) {
          onDurationKnown?.(id, engine.duration);
        }

        if (s.autoDetectPitch) {
          const analysis = engine.getBuffer();
          if (analysis) void runPitchDetect(analysis);
        }

        if (autoplay) {
          await engine.play();
          setPlaying(true);
          onPlayed?.(id);
        }

        updateMediaSessionMetadata({
          title: rec.name,
          artist: rec.artist,
          album: rec.album,
          artworkUrl: artworkUrlRef.current,
        });
      } catch (e) {
        console.error(e);
        setError(
          e instanceof Error
            ? e.message
            : "Could not decode this audio file.",
        );
      } finally {
        setLoading(false);
      }
    },
    [onDurationKnown, onPlayed, runPitchDetect],
  );

  playTrackRef.current = playTrack;

  const playContext = useCallback(
    async (trackIds: string[], startId?: string) => {
      // Prefer IDs known in library state; if none match (common right after
      // import — tracks state hasn't re-rendered yet), trust the caller IDs.
      // playTrack loads from IndexedDB, which is already written.
      const known = new Set(tracksRef.current.map((t) => t.id));
      const inLibrary = trackIds.filter((id) => known.has(id));
      const valid =
        inLibrary.length > 0
          ? inLibrary
          : trackIds.filter((id) => typeof id === "string" && id.length > 0);

      if (!valid.length) {
        setError("No playable tracks in this list.");
        return;
      }
      setError(null);

      const s = settingsRef.current;
      let order = buildPlayOrder(valid, s.shuffle);
      if (s.shuffle && startId && order.includes(startId)) {
        order = [startId, ...order.filter((id) => id !== startId)];
      }
      // Prefer explicit start even when not shuffled
      if (startId && order.includes(startId) && !s.shuffle) {
        order = [startId, ...order.filter((id) => id !== startId)];
      }
      setQueue(order);
      queueRef.current = order;
      const start = startId && order.includes(startId) ? startId : order[0];
      await playTrack(start, true);
    },
    [playTrack],
  );

  const togglePlay = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) return;
    if (!activeIdRef.current) {
      if (queueRef.current[0]) await playTrack(queueRef.current[0], true);
      else if (tracks[0]) await playContext(tracks.map((t) => t.id));
      return;
    }
    if (!engine.hasBuffer) {
      await playTrack(activeIdRef.current, true);
      return;
    }
    await engine.toggle();
    setPlaying(engine.isPlaying);
  }, [tracks, playTrack, playContext]);

  const next = useCallback(() => advance(1), [advance]);
  const prev = useCallback(() => {
    if (timePlayed > 3) {
      engineRef.current?.seekPercent(0);
      setPercent(0);
      setTimePlayed(0);
      return;
    }
    advance(-1);
  }, [advance, timePlayed]);

  const seekPercent = useCallback((p: number) => {
    engineRef.current?.seekPercent(p);
    setPercent(p);
    setTimePlayed((p / 100) * (engineRef.current?.duration ?? 0));
  }, []);

  const patchSettings = useCallback((patch: Partial<PlayerSettings>) => {
    setSettings((prev) => {
      const next: PlayerSettings = { ...prev, ...patch };
      if (patch.sourceA != null) next.sourceA = clampPitchA(patch.sourceA);
      if (patch.targetA != null) next.targetA = clampPitchA(patch.targetA);

      const engine = engineRef.current;
      if (engine) {
        if (patch.mode != null) engine.setMode(patch.mode as PlayMode);
        if (patch.retuneStyle != null) engine.setRetuneStyle(patch.retuneStyle);
        if (patch.volume != null) engine.setVolume(patch.volume);
        if (patch.bedOn != null) engine.setBedEnabled(patch.bedOn);
        if (patch.bedLevel != null) engine.setBedLevel(patch.bedLevel);
        if (
          patch.sourceA != null ||
          patch.targetA != null ||
          patch.mode != null ||
          patch.retuneStyle != null
        ) {
          engine.setPitchTargets(next.sourceA, next.targetA);
        }
      }

      if (patch.shuffle === true && queueRef.current.length) {
        const cur = activeIdRef.current;
        const rest = queueRef.current.filter((id) => id !== cur);
        const shuffled = buildPlayOrder(rest, true);
        const order = cur ? [cur, ...shuffled] : shuffled;
        setQueue(order);
        queueRef.current = order;
      }
      if (patch.shuffle === false && queueRef.current.length) {
        const idSet = new Set(queueRef.current);
        const ordered = tracks
          .map((t) => t.id)
          .filter((id) => idSet.has(id));
        for (const id of queueRef.current) {
          if (!ordered.includes(id)) ordered.push(id);
        }
        setQueue(ordered);
        queueRef.current = ordered;
      }
      return next;
    });
  }, [tracks]);

  const setMode = useCallback(
    (mode: PlayMode) => patchSettings({ mode }),
    [patchSettings],
  );
  const setRetuneStyle = useCallback(
    (retuneStyle: RetuneStyle) => patchSettings({ retuneStyle }),
    [patchSettings],
  );
  const setVolume = useCallback(
    (volume: number) => {
      patchSettings({ volume });
      // Keep sleep fade baseline in sync when not in fade window
      const endAt = sleepEndAtRef.current;
      if (endAt != null) {
        const left = (endAt - Date.now()) / 1000;
        if (left > SLEEP_FADE_SEC) sleepBaseVolRef.current = volume;
      } else {
        sleepBaseVolRef.current = volume;
      }
    },
    [patchSettings],
  );

  const clearSleepTimer = useCallback((restoreVolume = true) => {
    sleepEndAtRef.current = null;
    setSleepRemainingSec(null);
    setSleepMinutesState(null);
    if (restoreVolume) {
      engineRef.current?.setVolume(settingsRef.current.volume);
    }
  }, []);

  const setSleepTimer = useCallback(
    (minutes: number | null) => {
      if (minutes == null || minutes <= 0) {
        clearSleepTimer(true);
        return;
      }
      sleepBaseVolRef.current = settingsRef.current.volume;
      sleepEndAtRef.current = Date.now() + minutes * 60 * 1000;
      setSleepMinutesState(minutes);
      setSleepRemainingSec(minutes * 60);
      engineRef.current?.setVolume(settingsRef.current.volume);
    },
    [clearSleepTimer],
  );

  // Sleep timer tick + fade-out
  useEffect(() => {
    const id = window.setInterval(() => {
      const endAt = sleepEndAtRef.current;
      if (endAt == null) return;

      const leftMs = endAt - Date.now();
      if (leftMs <= 0) {
        const engine = engineRef.current;
        if (engine?.isPlaying) {
          engine.pause();
          setPlaying(false);
        }
        engine?.setVolume(settingsRef.current.volume);
        sleepEndAtRef.current = null;
        setSleepRemainingSec(null);
        setSleepMinutesState(null);
        return;
      }

      const leftSec = leftMs / 1000;
      setSleepRemainingSec(leftSec);

      if (leftSec <= SLEEP_FADE_SEC) {
        const mult = Math.max(0, leftSec / SLEEP_FADE_SEC);
        engineRef.current?.setVolume(sleepBaseVolRef.current * mult);
      }
    }, 250);
    return () => window.clearInterval(id);
  }, []);

  /** One-tap frequency strip / mood guide — mid-song safe. */
  const applyFrequencyAnchor = useCallback(
    (anchor: FrequencyAnchor) => {
      if (anchor.isOriginal) {
        patchSettings({ mode: "original" });
        return;
      }
      patchSettings({
        mode: "retuned",
        targetA: anchor.hz,
      });
    },
    [patchSettings],
  );

  const applyTargetHz = useCallback(
    (hz: number) => {
      patchSettings({ mode: "retuned", targetA: hz });
    },
    [patchSettings],
  );
  const setBedOn = useCallback(
    (bedOn: boolean) => patchSettings({ bedOn }),
    [patchSettings],
  );
  const setBedLevel = useCallback(
    (bedLevel: number) => patchSettings({ bedLevel }),
    [patchSettings],
  );
  const setShuffle = useCallback(
    (shuffle: boolean) => patchSettings({ shuffle }),
    [patchSettings],
  );
  const setRepeat = useCallback(
    (repeat: RepeatMode) => patchSettings({ repeat }),
    [patchSettings],
  );
  const setSourceA = useCallback(
    (sourceA: number) => patchSettings({ sourceA }),
    [patchSettings],
  );
  const setTargetA = useCallback(
    (targetA: number) => patchSettings({ targetA }),
    [patchSettings],
  );
  const setPitchPair = useCallback(
    (sourceA: number, targetA: number) =>
      patchSettings({ sourceA, targetA, mode: "retuned" }),
    [patchSettings],
  );
  const setAutoDetectPitch = useCallback(
    (autoDetectPitch: boolean) => patchSettings({ autoDetectPitch }),
    [patchSettings],
  );

  const acceptPitchEstimate = useCallback(() => {
    if (!pitchEstimate) return;
    patchSettings({ sourceA: pitchEstimate.estimatedA, mode: "retuned" });
    setPitchEstimate(null);
  }, [pitchEstimate, patchSettings]);

  const dismissPitchEstimate = useCallback(() => {
    setPitchEstimate(null);
  }, []);

  const redetectPitch = useCallback(async () => {
    const buf = engineRef.current?.getBuffer();
    if (buf) {
      await runPitchDetect(buf);
      return;
    }
    const id = activeIdRef.current;
    if (!id) return;
    setPitchDetecting(true);
    try {
      const rec = await db.getTrack(id);
      if (!rec) return;
      const data = await rec.blob.arrayBuffer();
      const ctx = new AudioContext();
      try {
        const decoded = await ctx.decodeAudioData(data.slice(0));
        await runPitchDetect(decoded);
      } finally {
        void ctx.close();
      }
    } finally {
      setPitchDetecting(false);
    }
  }, [runPitchDetect]);

  const cycleRepeat = useCallback(() => {
    const order: RepeatMode[] = ["off", "all", "one"];
    const i = order.indexOf(settings.repeat);
    setRepeat(order[(i + 1) % order.length]);
  }, [settings.repeat, setRepeat]);

  const setExportFormat = useCallback(
    (exportFormat: ExportFormat) => patchSettings({ exportFormat }),
    [patchSettings],
  );

  const downloadRetuned = useCallback(async (): Promise<boolean> => {
    const id = activeIdRef.current;
    if (!id) {
      setError("Load a track first, then download.");
      return false;
    }
    const track = tracks.find((t) => t.id === id);
    const s = settingsRef.current;
    const format = s.exportFormat === "mp3" ? "mp3" : "wav";
    setExporting(true);
    setExportProgress(0);
    setExportStatus("Starting TrueHz Convert…");
    setExportEngine(null);
    setError(null);
    try {
      const rec = await db.getTrack(id);
      if (!rec) throw new Error("Track not found in library");
      const data = await rec.blob.arrayBuffer();
      const result = await exportRetunedFile({
        arrayBuffer: data,
        trackName: track?.name ?? rec.name,
        sourceA: s.sourceA,
        targetA: s.targetA,
        retuneStyle: s.retuneStyle,
        bedOn: s.bedOn,
        bedLevel: s.bedLevel,
        format,
        onProgress: (f, status) => {
          if (typeof f === "number" && f >= 0) setExportProgress(f);
          if (status) setExportStatus(status);
        },
      });
      setExportEngine(result.engine);
      if (result.usedFallback) {
        setError(
          "HQ TrueHz Convert was unavailable — downloaded with preview-quality engine. Try again or use a shorter track.",
        );
      }
      return true;
    } catch (e) {
      console.error(e);
      setError(
        e instanceof Error
          ? e.message
          : "HQ export failed. Try a shorter track or WAV source.",
      );
      return false;
    } finally {
      setExporting(false);
      setExportProgress(0);
      setExportStatus(null);
    }
  }, [tracks]);

  /**
   * Render the active track at the current target and save the retuned copy
   * back into the Library as a new (baked) frequency-tagged track.
   */
  const exportRetunedToLibrary = useCallback(async (): Promise<boolean> => {
    const id = activeIdRef.current;
    if (!id) {
      setError("Load a track first, then save a retuned copy.");
      return false;
    }
    if (!onAddRenderedTrack) return false;
    const track = tracks.find((t) => t.id === id);
    const s = settingsRef.current;
    const format = s.exportFormat === "mp3" ? "mp3" : "wav";
    setExporting(true);
    setExportProgress(0);
    setExportStatus("Rendering retuned copy…");
    setExportEngine(null);
    setError(null);
    try {
      const rec = await db.getTrack(id);
      if (!rec) throw new Error("Track not found in library");
      const data = await rec.blob.arrayBuffer();
      const { blob, engine, usedFallback } = await renderRetunedBlob({
        arrayBuffer: data,
        trackName: track?.name ?? rec.name,
        sourceA: s.sourceA,
        targetA: s.targetA,
        retuneStyle: s.retuneStyle,
        bedOn: s.bedOn,
        bedLevel: s.bedLevel,
        format,
        onProgress: (f, status) => {
          if (typeof f === "number" && f >= 0) setExportProgress(f);
          if (status) setExportStatus(status);
        },
      });
      setExportEngine(engine);
      const baseName = track?.name ?? rec.name;
      await onAddRenderedTrack(blob, {
        name: `${baseName} (${Math.round(s.targetA)} Hz)`,
        targetHz: Math.round(s.targetA),
        retuneStyle: s.retuneStyle,
        format,
      });
      if (usedFallback) {
        setError(
          "HQ TrueHz Convert was unavailable — saved a preview-quality copy. Try again for full quality.",
        );
      }
      return true;
    } catch (e) {
      console.error(e);
      setError(
        e instanceof Error
          ? e.message
          : "Could not render a retuned copy. Try a shorter track or WAV source.",
      );
      return false;
    } finally {
      setExporting(false);
      setExportProgress(0);
      setExportStatus(null);
    }
  }, [tracks, onAddRenderedTrack]);

  const onTrackRemoved = useCallback(
    (id: string) => {
      const nextQueue = queueRef.current.filter((x) => x !== id);
      queueRef.current = nextQueue;
      setQueue(nextQueue);

      if (activeIdRef.current === id) {
        engineRef.current?.stop();
        setPlaying(false);
        setActiveId(null);
        setDuration(0);
        setTimePlayed(0);
        setPercent(0);
        setPitchEstimate(null);
        const nextId = nextQueue[0];
        if (nextId) void playTrack(nextId, false);
      }
    },
    [playTrack],
  );

  return {
    settings,
    settingsReady,
    activeId,
    queue,
    playing,
    loading,
    error,
    setError,
    timePlayed,
    duration,
    percent,
    exporting,
    exportProgress,
    exportStatus,
    exportEngine,
    pitchEstimate,
    pitchDetecting,
    artworkUrl,
    playTrack,
    playContext,
    togglePlay,
    next,
    prev,
    seekPercent,
    setMode,
    setRetuneStyle,
    setVolume,
    setBedOn,
    setBedLevel,
    setShuffle,
    setRepeat,
    cycleRepeat,
    setSourceA,
    setTargetA,
    setPitchPair,
    setAutoDetectPitch,
    setExportFormat,
    applyFrequencyAnchor,
    applyTargetHz,
    acceptPitchEstimate,
    dismissPitchEstimate,
    redetectPitch,
    downloadRetuned,
    exportRetunedToLibrary,
    onTrackRemoved,
    sleepRemainingSec,
    sleepMinutes,
    setSleepTimer,
    clearSleepTimer,
  };
}
