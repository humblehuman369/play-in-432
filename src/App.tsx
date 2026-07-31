import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Crown,
  Download,
  Heart,
  Info,
  Library,
  ListMusic,
  ListPlus,
  Loader2,
  Music2,
  Pause,
  Pencil,
  Play,
  Search,
  SkipBack,
  SkipForward,
  Trash2,
  Upload,
  Volume2,
  Waves,
} from "lucide-react";
import { TrackList } from "./components/TrackList";
import { LearnView } from "./components/LearnView";
import { LandingView } from "./components/LandingView";
import { Modal } from "./components/Modal";
import { FrequencyStrip } from "./components/FrequencyStrip";
import { HearTheDifference } from "./components/HearTheDifference";
import { MoodGuide } from "./components/MoodGuide";
import { SleepTimer } from "./components/SleepTimer";
import { PlaylistImportPanel } from "./components/PlaylistImportPanel";
import {
  UpgradeModal,
  type UpgradeReason,
} from "./components/UpgradeModal";
import { useLibrary } from "./hooks/useLibrary";
import { usePlayerController } from "./hooks/usePlayerController";
import { usePro } from "./hooks/usePro";
import type { Playlist, TrackMeta } from "./lib/types";
import { BRAND } from "./lib/brand";
import {
  FREE_HQ_EXPORT_LIMIT,
  handleCheckoutReturn,
  recordHqExport,
  stripCheckoutParams,
} from "./lib/pro";
import {
  completeSpotifyLoginFromDeepLink,
  completeSpotifyLoginFromUrl,
} from "./lib/spotify";
import { isNativeApp } from "./lib/native";
import { BatchExportPanel } from "./components/BatchExportPanel";
import {
  ShareDemoView,
  parseShareParams,
} from "./components/ShareDemoView";
import {
  PITCH_PRESETS,
  centsFromRatio,
  effectivePitchRatio,
  formatBytes,
  formatCents,
  formatRatio,
  formatTime,
  impliedConcertA,
} from "./lib/retune";
import "./App.css";

type Tab = "player" | "library" | "playlists" | "learn" | "share";
type Shell = "landing" | "app";

/** `/` = marketing homepage, `/app` = player shell (web path + in-app navigation). */
function pathWantsApp(): boolean {
  try {
    const p = window.location.pathname.replace(/\/+$/, "") || "/";
    return p === "/app" || p.startsWith("/app/");
  } catch {
    return false;
  }
}

function readShell(): Shell {
  // Cold start (web or native) → homepage unless path/query needs the player.
  if (pathWantsApp()) return "app";
  // OAuth / checkout / gift returns — open app shell so homepage does not flash.
  try {
    const sp = new URLSearchParams(window.location.search);
    if (
      sp.has("checkout") ||
      sp.has("session_id") ||
      sp.has("redeem") ||
      (sp.has("code") && sp.has("state"))
    ) {
      return "app";
    }
  } catch {
    /* ignore */
  }
  return "landing";
}

function setWebShellPath(shell: Shell, mode: "push" | "replace" = "push") {
  if (isNativeApp()) return;
  try {
    const url = new URL(window.location.href);
    const nextPath = shell === "app" ? "/app" : "/";
    const curPath = url.pathname.replace(/\/+$/, "") || "/";
    const already =
      shell === "app" ? curPath === "/app" : curPath === "/" || curPath === "";
    if (already) return;
    url.pathname = nextPath;
    const next = url.pathname + url.search + url.hash;
    if (mode === "replace") window.history.replaceState({}, "", next);
    else window.history.pushState({}, "", next);
  } catch {
    /* ignore */
  }
}

export default function App() {
  // Phase 3 public share page (no shell chrome)
  const shareParams = useMemo(
    () => parseShareParams(window.location.search),
    [],
  );
  // Gift redeem deep link: /?redeem=cs_…
  const redeemCode = useMemo(() => {
    try {
      return new URLSearchParams(window.location.search).get("redeem");
    } catch {
      return null;
    }
  }, []);

  if (shareParams.isShare) {
    return (
      <ShareDemoView
        embedded
        initialClip={shareParams.clip}
        initialTarget={shareParams.hz}
      />
    );
  }

  return <AppMain initialRedeemCode={redeemCode} />;
}

function AppMain({
  initialRedeemCode,
}: {
  initialRedeemCode?: string | null;
}) {
  const lib = useLibrary();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const player = usePlayerController({
    tracks: lib.tracks,
    onDurationKnown: (id, duration) => void lib.setDuration(id, duration),
    onPlayed: (id) => void lib.recordPlay(id),
  });

  const [shell, setShell] = useState<Shell>(readShell);
  const [tab, setTab] = useState<Tab>("player");
  const pro = usePro();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeReason, setUpgradeReason] =
    useState<UpgradeReason>("general");
  const [proToast, setProToast] = useState<string | null>(null);

  const openUpgrade = useCallback((reason: UpgradeReason = "general") => {
    setUpgradeReason(reason);
    setUpgradeOpen(true);
  }, []);

  const requestTargetHz = useCallback(
    (hz: number) => {
      if (!pro.canUseTargetHz(hz)) {
        openUpgrade("frequency");
        return false;
      }
      player.applyTargetHz(hz);
      return true;
    },
    [player, openUpgrade, pro],
  );

  const requestDownloadHq = useCallback(async () => {
    if (!pro.exportGate.ok) {
      openUpgrade("export");
      return;
    }
    const ok = await player.downloadRetuned();
    if (ok) recordHqExport();
  }, [pro.exportGate.ok, player, openUpgrade]);

  const enterApp = useCallback((nextTab: Tab = "player") => {
    setShell("app");
    setTab(nextTab);
    setWebShellPath("app", "push");
  }, []);

  const showLanding = useCallback(() => {
    setShell("landing");
    setWebShellPath("landing", "push");
  }, []);

  // Keep shell in sync with browser back/forward (/ ↔ /app).
  useEffect(() => {
    if (isNativeApp()) return;
    const onPop = () => {
      setShell(pathWantsApp() ? "app" : "landing");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Stripe Checkout return (?checkout=success&session_id=…)
  // Spotify OAuth return (?code=&state=) — must run at app root, not only on
  // the Playlists tab (that panel is unmounted on redirect back to /).
  // Also re-runs on native deep link after external Safari checkout.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      // Spotify: native HTTPS bridge returns tokens on playin432://oauth#…
      // Web PKCE returns ?code=&state= on the site origin.
      try {
        const fromDeepLink = completeSpotifyLoginFromDeepLink(
          window.location.href,
        );
        const spotifyDone =
          fromDeepLink || (await completeSpotifyLoginFromUrl());
        if (cancelled) return;
        if (spotifyDone) {
          setProToast(
            "Spotify connected. Open Playlists to import a playlist.",
          );
          enterApp("playlists");
          return;
        }
      } catch (e) {
        if (!cancelled) {
          player.setError(
            e instanceof Error ? e.message : "Spotify login failed.",
          );
          enterApp("playlists");
        }
      }

      const result = await handleCheckoutReturn(window.location.search);
      if (cancelled) return;
      if (result === "activated") {
        setProToast(
          "Purchase unlocked on this device. Your library stays local — re-import only if you left during checkout.",
        );
        pro.refresh();
        stripCheckoutParams();
        enterApp("player");
        void lib.refresh();
      } else if (typeof result === "object" && result.kind === "gift") {
        setProToast(
          `Gift code (${result.tier.toUpperCase()}): ${result.code} — copy & send, or we email them if they entered a recipient on Stripe. They open the link or use Restore / redeem gift.`,
        );
        stripCheckoutParams();
        enterApp("player");
      } else if (result === "cancel") {
        setProToast("Checkout canceled — Free forever still works.");
        stripCheckoutParams();
      } else if (result === "error") {
        setProToast(
          "Could not verify payment. Contact support with your receipt.",
        );
        stripCheckoutParams();
      }
    };
    void run();
    const onDeep = () => void run();
    window.addEventListener("playin432-deep-link", onDeep);
    window.addEventListener("popstate", onDeep);
    return () => {
      cancelled = true;
      window.removeEventListener("playin432-deep-link", onDeep);
      window.removeEventListener("popstate", onDeep);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount + deep links
  }, []);

  // Auto-redeem gift link ?redeem=cs_…
  useEffect(() => {
    if (!initialRedeemCode?.startsWith("cs_")) return;
    let cancelled = false;
    void (async () => {
      const ok = await pro.restoreAccess({ code: initialRedeemCode });
      if (cancelled) return;
      if (ok) {
        setProToast("Gift redeemed — access unlocked on this device.");
        enterApp("player");
      } else {
        setProToast(
          pro.checkoutError ||
            "Could not redeem gift. Check the code under Pricing → Restore.",
        );
        enterApp("player");
      }
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("redeem");
        window.history.replaceState({}, "", url.pathname + url.search);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Deep-link into Learn (e.g. how-far-to-retune from frequency strip) */
  const [learnArticleId, setLearnArticleId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newPlName, setNewPlName] = useState("");
  const [renamePlOpen, setRenamePlOpen] = useState(false);
  const [renamePlName, setRenamePlName] = useState("");
  const [addToPlOpen, setAddToPlOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(
    null,
  );
  const [libraryFilter, setLibraryFilter] = useState<"all" | "favorites">(
    "all",
  );

  const activeTrack = useMemo(
    () => lib.tracks.find((t) => t.id === player.activeId) ?? null,
    [lib.tracks, player.activeId],
  );

  const favoriteTracks = useMemo(
    () => lib.tracks.filter((t) => t.favorite),
    [lib.tracks],
  );

  const selectedPlaylist = useMemo(
    () =>
      selectedPlaylistId
        ? lib.playlists.find((p) => p.id === selectedPlaylistId) ?? null
        : null,
    [selectedPlaylistId, lib.playlists],
  );

  const libraryTracks = useMemo(() => {
    let list = libraryFilter === "favorites" ? favoriteTracks : lib.tracks;
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((t) => t.name.toLowerCase().includes(q));
    return list;
  }, [lib.tracks, favoriteTracks, libraryFilter, query]);

  const playlistTracks = useMemo(() => {
    if (!selectedPlaylist) return [] as TrackMeta[];
    let list = selectedPlaylist.trackIds
      .map((id) => lib.tracks.find((t) => t.id === id))
      .filter((t): t is TrackMeta => Boolean(t));
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((t) => t.name.toLowerCase().includes(q));
    return list;
  }, [selectedPlaylist, lib.tracks, query]);

  /** Session queue for player page (current play order) */
  const queueTracks = useMemo(() => {
    if (player.queue.length) {
      return player.queue
        .map((id) => lib.tracks.find((t) => t.id === id))
        .filter((t): t is TrackMeta => Boolean(t));
    }
    return lib.tracks;
  }, [player.queue, lib.tracks]);

  const handleImport = useCallback(
    async (files: FileList | File[]) => {
      const created = await lib.importFiles(files);
      if (!created.length) return;

      enterApp("player");

      // Start first new track when nothing is loaded. playContext reads
      // blobs from IndexedDB (already written) even if React tracks state
      // has not re-rendered yet.
      if (!player.activeId) {
        const ids = created.map((t) => t.id);
        await player.playContext(ids, ids[0]);
      }
    },
    [lib, player, enterApp],
  );

  const playTrackInList = useCallback(
    async (trackId: string, listIds: string[]) => {
      if (player.activeId === trackId) {
        await player.togglePlay();
        return;
      }
      await player.playContext(listIds, trackId);
    },
    [player],
  );

  const onDeleteTrack = useCallback(
    async (id: string) => {
      if (
        !confirm(
          "Delete this track from your library? This cannot be undone.",
        )
      ) {
        return;
      }
      await lib.removeTrack(id);
      player.onTrackRemoved(id);
    },
    [lib, player],
  );

  const createPlaylist = async () => {
    const pl = await lib.createPlaylist(newPlName || "New playlist");
    setNewPlName("");
    setCreateOpen(false);
    setSelectedPlaylistId(pl.id);
    setTab("playlists");
  };

  const deleteCurrentPlaylist = async () => {
    if (!selectedPlaylist) return;
    if (
      !confirm(
        `Delete playlist “${selectedPlaylist.name}”? Tracks stay in library.`,
      )
    ) {
      return;
    }
    await lib.removePlaylist(selectedPlaylist.id);
    setSelectedPlaylistId(null);
  };

  const renameCurrentPlaylist = async () => {
    if (!selectedPlaylist) return;
    await lib.renamePlaylist(selectedPlaylist.id, renamePlName);
    setRenamePlOpen(false);
  };

  const error = lib.error || player.error;

  const ratio = effectivePitchRatio(
    player.settings.sourceA,
    player.settings.targetA,
    player.settings.retuneStyle,
  );
  const cents = centsFromRatio(ratio);
  const impliedA = impliedConcertA(
    player.settings.sourceA,
    player.settings.targetA,
    player.settings.retuneStyle,
  );

  const onDropFiles = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) void handleImport(e.dataTransfer.files);
  };

  const openFilePicker = () => fileInputRef.current?.click();

  if (shell === "landing") {
    return (
      <div className="app landing-mode">
        <div className="bg-glow" aria-hidden />
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,.mp3,.wav,.m4a,.flac,.ogg,.webm,.aac"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) void handleImport(e.target.files);
            e.target.value = "";
          }}
        />
        <LandingView
          onOpenPlayer={() => enterApp("player")}
          onUploadClick={openFilePicker}
          onOpenPlaylists={() => enterApp("playlists")}
          onConnectSpotify={() => {
            enterApp("playlists");
            void import("./lib/spotify")
              .then(({ beginSpotifyLogin, isSpotifyConnected }) => {
                if (isSpotifyConnected()) return;
                return beginSpotifyLogin();
              })
              .catch((e) => {
                player.setError(
                  e instanceof Error ? e.message : "Spotify login failed.",
                );
              });
          }}
          onPickFrequency={(hz) => {
            if (!pro.canUseTargetHz(hz)) {
              openUpgrade("frequency");
              return;
            }
            player.applyTargetHz(hz);
            enterApp("player");
          }}
          onOpenLearn={() => enterApp("learn")}
          onUpgrade={(opts) => void pro.upgrade(opts)}
          onRestore={() => void pro.restore()}
          onRestoreAccess={(input) => pro.restoreAccess(input)}
          isPro={pro.isPro}
          tier={pro.tier}
          checkoutBusy={pro.checkoutBusy}
          checkoutError={pro.checkoutError}
          nativeBilling={pro.nativeBilling}
          dragOver={dragOver}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDropFiles}
          importing={lib.importing}
        />
        <UpgradeModal
          open={upgradeOpen}
          reason={upgradeReason}
          busy={pro.checkoutBusy}
          error={pro.checkoutError}
          onClose={() => setUpgradeOpen(false)}
          onUpgrade={() => void pro.upgrade({ tier: "pro" })}
          onRestoreAccess={(input) => pro.restoreAccess(input)}
          onRestoreStore={() => void pro.restore()}
          nativeBilling={pro.nativeBilling}
        />
        {proToast && (
          <div className="pro-toast" role="status">
            {proToast}
            <button
              type="button"
              className="link-btn"
              onClick={() => setProToast(null)}
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="app">
      <div className="bg-glow" aria-hidden />

      <header className="header">
        <button
          type="button"
          className="brand brand-btn"
          onClick={showLanding}
          title="Back to home"
        >
          <div className="brand-mark">
            <Waves size={22} strokeWidth={2.25} />
          </div>
          <div>
            <h1>{BRAND.product}</h1>
            <p className="tagline">{BRAND.taglineShort}</p>
          </div>
        </button>
        <div className="badge-row">
          <span className="badge tech-badge">{BRAND.techMark}</span>
          {pro.isPro ? (
            <span className="badge pro-badge">
              <Crown size={12} /> Pro
            </span>
          ) : (
            <button
              type="button"
              className="badge pro-upgrade-badge"
              onClick={() => openUpgrade("general")}
            >
              <Crown size={12} /> Upgrade
            </button>
          )}
          <span className="badge">
            {player.settings.retuneStyle === "reanchor"
              ? `Re-anchor ${Math.round(player.settings.targetA)} · A≈${Math.round(impliedA)}`
              : `A=${Math.round(player.settings.sourceA)} → A=${Math.round(player.settings.targetA)}`}
          </span>
          <span className="badge muted">{formatCents(cents)}</span>
        </div>
      </header>

      {/* Tab navigation — Player first, library/playlists as additions */}
      <nav className="tabs" role="tablist" aria-label="Main">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "player"}
          className={tab === "player" ? "active" : ""}
          onClick={() => setTab("player")}
        >
          <Music2 size={16} />
          Player
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "library"}
          className={tab === "library" ? "active" : ""}
          onClick={() => {
            setTab("library");
            setQuery("");
          }}
        >
          <Library size={16} />
          Library
          <span className="tab-count">{lib.tracks.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "playlists"}
          className={tab === "playlists" ? "active" : ""}
          onClick={() => {
            setTab("playlists");
            setQuery("");
          }}
        >
          <ListMusic size={16} />
          Playlists
          <span className="tab-count">{lib.playlists.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "learn"}
          className={tab === "learn" ? "active" : ""}
          onClick={() => {
            setLearnArticleId(null);
            setTab("learn");
          }}
        >
          <BookOpen size={16} />
          Learn
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "share"}
          className={tab === "share" ? "active" : ""}
          onClick={() => setTab("share")}
        >
          Share
        </button>
      </nav>

      <main className="main">
        {error && (
          <div className="error-banner">
            {error}
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                lib.setError(null);
                player.setError(null);
              }}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ═══════════════ PLAYER TAB (original experience) ═══════════════ */}
        {tab === "player" && (
          <>
            <section
              className={`dropzone ${dragOver ? "over" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDropFiles}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ")
                  fileInputRef.current?.click();
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,.mp3,.wav,.m4a,.flac,.ogg,.webm,.aac"
                multiple
                hidden
                onChange={(e) => {
                  if (e.target.files) void handleImport(e.target.files);
                  e.target.value = "";
                }}
              />
              <Upload size={28} className="drop-icon" />
              <h2>{lib.importing ? "Reading tags…" : "Drop music here"}</h2>
              <p>
                {lib.importing
                  ? "Importing metadata and cover art"
                  : "or click to browse · MP3, WAV, M4A, FLAC, OGG"}
              </p>
              {lib.tracks.length > 0 && !lib.importing && (
                <p className="drop-hint">
                  Saved to Library · {lib.tracks.length} track
                  {lib.tracks.length === 1 ? "" : "s"}
                </p>
              )}
            </section>

            <section className="player-card">
              <div className="now-playing">
                <div className={`art ${player.playing ? "pulse" : ""}`}>
                  {player.artworkUrl ? (
                    <img
                      src={player.artworkUrl}
                      alt=""
                      className="art-img"
                    />
                  ) : (
                    <Music2 size={32} />
                  )}
                </div>
                <div className="meta">
                  <h2 title={activeTrack?.name ?? undefined}>
                    {activeTrack?.name ?? "No track selected"}
                  </h2>
                  <p>
                    {player.loading
                      ? "Decoding…"
                      : activeTrack
                        ? [
                            activeTrack.artist,
                            player.settings.mode === "retuned"
                              ? player.settings.retuneStyle === "reanchor"
                                ? `Re-anchor ${Math.round(player.settings.targetA)} Hz · ${formatCents(cents)} · A≈${Math.round(impliedA)}`
                                : `A=${Math.round(player.settings.sourceA)} → A=${Math.round(player.settings.targetA)} · ${formatCents(cents)}`
                              : "Original concert pitch",
                          ]
                            .filter(Boolean)
                            .join(" · ")
                        : "Upload a song to begin"}
                  </p>
                  {activeTrack?.album && (
                    <p className="album-line">{activeTrack.album}</p>
                  )}
                </div>
              </div>

              {(player.pitchDetecting || player.pitchEstimate) && (
                <div className="pitch-estimate">
                  {player.pitchDetecting && !player.pitchEstimate && (
                    <p className="pe-status">
                      <Loader2 size={14} className="spin" />
                      Estimating source concert pitch…
                    </p>
                  )}
                  {player.pitchEstimate && (
                    <>
                      <div className="pe-body">
                        <strong>
                          Estimated A ≈ {player.pitchEstimate.estimatedA} Hz
                        </strong>
                        <span className="pe-meta">
                          heard {player.pitchEstimate.fundamentalHz} Hz (
                          {player.pitchEstimate.noteName}) · confidence{" "}
                          {Math.round(player.pitchEstimate.confidence * 100)}%
                        </span>
                        <span className="pe-note">
                          Best-effort only — accept to set Source A, or ignore
                          and keep your value.
                        </span>
                      </div>
                      <div className="pe-actions">
                        <button
                          type="button"
                          className="btn primary sm"
                          onClick={player.acceptPitchEstimate}
                        >
                          Use as Source A
                        </button>
                        <button
                          type="button"
                          className="btn sm"
                          onClick={player.dismissPitchEstimate}
                        >
                          Dismiss
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="mode-toggle" role="group" aria-label="Pitch mode">
                <button
                  type="button"
                  className={
                    player.settings.mode === "original" ? "active" : ""
                  }
                  onClick={() => player.setMode("original")}
                >
                  Original
                </button>
                <button
                  type="button"
                  className={
                    player.settings.mode === "retuned" ? "active" : ""
                  }
                  onClick={() => player.setMode("retuned")}
                >
                  Retune
                </button>
              </div>

              <FrequencyStrip
                sourceA={player.settings.sourceA}
                targetA={player.settings.targetA}
                mode={player.settings.mode}
                retuneStyle={player.settings.retuneStyle}
                showProLocks={!pro.isLiteOrPro}
                onSelect={(anchor) => {
                  if (anchor.isOriginal) {
                    player.applyFrequencyAnchor(anchor);
                    return;
                  }
                  if (!pro.canUseTargetHz(anchor.hz)) {
                    openUpgrade("frequency");
                    return;
                  }
                  player.applyFrequencyAnchor(anchor);
                }}
                onRetuneStyleChange={player.setRetuneStyle}
                onOpenHowFarLearn={() => {
                  setLearnArticleId("how-far-to-retune");
                  setTab("learn");
                }}
                onOpenReanchorLearn={() => {
                  setLearnArticleId("reanchor-vs-concert");
                  setTab("learn");
                }}
              />

              <div className="pitch-panel">
                <div className="pitch-presets">
                  <span className="pitch-presets-label">Quick pairs</span>
                  {PITCH_PRESETS.map((p) => {
                    const on =
                      Math.abs(player.settings.sourceA - p.sourceA) < 0.01 &&
                      Math.abs(player.settings.targetA - p.targetA) < 0.01 &&
                      player.settings.mode === "retuned";
                    const locked = !pro.canUseTargetHz(p.targetA);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        className={`chip ${on ? "on" : ""} ${locked ? "locked" : ""}`}
                        onClick={() => {
                          if (!pro.canUseTargetHz(p.targetA)) {
                            openUpgrade("frequency");
                            return;
                          }
                          player.setPitchPair(p.sourceA, p.targetA);
                        }}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
                <div className="pitch-inputs">
                  <label className="pitch-field">
                    <span>Source A</span>
                    <input
                      type="number"
                      min={100}
                      max={2000}
                      step={0.1}
                      value={player.settings.sourceA}
                      onChange={(e) =>
                        player.setSourceA(Number(e.target.value))
                      }
                    />
                    <span className="unit">Hz</span>
                  </label>
                  <span className="pitch-arrow" aria-hidden>
                    →
                  </span>
                  <label className="pitch-field">
                    <span>Target A</span>
                    <input
                      type="number"
                      min={100}
                      max={2000}
                      step={0.1}
                      value={player.settings.targetA}
                      onChange={(e) => {
                        const hz = Number(e.target.value);
                        if (!Number.isFinite(hz)) return;
                        if (!pro.canUseTargetHz(hz)) {
                          openUpgrade("frequency");
                          return;
                        }
                        player.setTargetA(hz);
                      }}
                    />
                    <span className="unit">Hz</span>
                  </label>
                </div>
                <div className="pitch-math">
                  <span>
                    Ratio <code>{formatRatio(ratio)}</code>
                  </span>
                  <span>{formatCents(cents)}</span>
                  {player.settings.retuneStyle === "reanchor" && (
                    <span>
                      Implied A4 ≈{" "}
                      <code>{impliedA.toFixed(1)} Hz</code>
                    </span>
                  )}
                  <span className="muted-note">
                    Tempo held at 1.0 ·{" "}
                    {player.settings.retuneStyle === "reanchor"
                      ? "note re-anchor"
                      : "concert A"}
                  </span>
                </div>
                {player.settings.retuneStyle === "concert" &&
                  Math.abs(player.settings.targetA - 528) < 0.5 && (
                  <p className="pitch-disclaimer">
                    *528 as a concert-A retune is a whole-mix pitch shift only —
                    not “this song is pure 528 Hz.”
                  </p>
                )}
                {player.settings.retuneStyle === "concert" &&
                  player.settings.targetA > 600 && (
                  <p className="pitch-disclaimer">
                    Large concert-A targets (741+) transpose the mix a lot. Switch
                    to <strong>Re-anchor</strong> for HZP-style small shifts, or
                    use the TrueHz bed for an exact labeled sine.
                  </p>
                )}
                <div className="pitch-tools">
                  <label className="check tight">
                    <input
                      type="checkbox"
                      checked={player.settings.autoDetectPitch}
                      onChange={(e) =>
                        player.setAutoDetectPitch(e.target.checked)
                      }
                    />
                    <span>Auto-estimate source A on load</span>
                  </label>
                  <button
                    type="button"
                    className="btn sm"
                    disabled={!activeTrack || player.pitchDetecting}
                    onClick={() => void player.redetectPitch()}
                  >
                    {player.pitchDetecting ? (
                      <>
                        <Loader2 size={14} className="spin" /> Detecting…
                      </>
                    ) : (
                      "Re-detect pitch"
                    )}
                  </button>
                </div>
              </div>

              <div className="seek-row">
                <span className="time">{formatTime(player.timePlayed)}</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={0.05}
                  value={
                    Number.isFinite(player.percent) ? player.percent : 0
                  }
                  disabled={!activeTrack || player.loading}
                  onChange={(e) =>
                    player.seekPercent(Number(e.target.value))
                  }
                  aria-label="Seek"
                />
                <span className="time">{formatTime(player.duration)}</span>
              </div>

              <div className="transport">
                <button
                  type="button"
                  className="icon-btn"
                  onClick={player.prev}
                  disabled={!activeTrack}
                  aria-label="Previous"
                >
                  <SkipBack size={20} />
                </button>
                <button
                  type="button"
                  className="play-btn"
                  onClick={() => void player.togglePlay()}
                  disabled={player.loading || !lib.tracks.length}
                  aria-label={player.playing ? "Pause" : "Play"}
                >
                  {player.playing ? (
                    <Pause size={26} />
                  ) : (
                    <Play size={26} className="play-icon" />
                  )}
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={player.next}
                  disabled={!activeTrack}
                  aria-label="Next"
                >
                  <SkipForward size={20} />
                </button>
              </div>

              <div className="player-extras">
                <button
                  type="button"
                  className={`chip ${player.settings.shuffle ? "on" : ""}`}
                  onClick={() =>
                    player.setShuffle(!player.settings.shuffle)
                  }
                >
                  Shuffle {player.settings.shuffle ? "on" : "off"}
                </button>
                <button
                  type="button"
                  className={`chip ${player.settings.repeat !== "off" ? "on" : ""}`}
                  onClick={player.cycleRepeat}
                >
                  Repeat: {player.settings.repeat}
                </button>
                <div className="export-format" role="group" aria-label="Download format">
                  <button
                    type="button"
                    className={`chip ${player.settings.exportFormat === "wav" ? "on" : ""}`}
                    disabled={player.exporting}
                    onClick={() => player.setExportFormat("wav")}
                    title="16-bit PCM WAV — highest quality TrueHz Convert file"
                  >
                    WAV
                  </button>
                  <button
                    type="button"
                    className={`chip ${player.settings.exportFormat === "mp3" ? "on" : ""}`}
                    disabled={player.exporting}
                    onClick={() => player.setExportFormat("mp3")}
                    title="320 kbps MP3 — smaller file, widely compatible"
                  >
                    MP3
                  </button>
                </div>
                <button
                  type="button"
                  className="btn primary sm download-btn"
                  disabled={!activeTrack || player.exporting || player.loading}
                  onClick={() => void requestDownloadHq()}
                  title={
                    pro.isPro
                      ? `${BRAND.downloadHqTitle} · ${player.settings.exportFormat.toUpperCase()}`
                      : pro.exportGate.ok
                        ? `${BRAND.downloadHqTitle} · ${player.settings.exportFormat.toUpperCase()} · ${pro.exportGate.remaining} free left`
                        : `Free limit (${FREE_HQ_EXPORT_LIMIT}) reached — TrueHz Pro`
                  }
                >
                  {player.exporting ? (
                    <>
                      <Loader2 size={14} className="spin" />
                      {BRAND.downloadHqProgress}{" "}
                      {Math.round(player.exportProgress * 100)}%
                    </>
                  ) : (
                    <>
                      <Download size={14} />
                      {BRAND.downloadHqLabel}{" "}
                      {player.settings.exportFormat.toUpperCase()}
                      {!pro.isPro &&
                        pro.exportGate.ok &&
                        Number.isFinite(pro.exportGate.remaining) && (
                        <span className="export-left">
                          {pro.exportGate.remaining}
                        </span>
                      )}
                    </>
                  )}
                </button>
              </div>

              {player.exporting && (
                <div className="export-progress-block" aria-live="polite">
                  <div className="export-bar">
                    <div
                      className="export-bar-fill"
                      style={{
                        width: `${Math.round(player.exportProgress * 100)}%`,
                      }}
                    />
                  </div>
                  <p className="export-status">
                    {player.exportStatus ??
                      `${BRAND.convertProduct} · Rubber Band HQ`}
                    {player.settings.bedOn
                      ? ` · + ${BRAND.bedLabel}`
                      : ""}
                    {` · ${player.settings.exportFormat.toUpperCase()}`}
                  </p>
                </div>
              )}

              <BatchExportPanel
                tracks={lib.tracks}
                sourceA={player.settings.sourceA}
                targetA={player.settings.targetA}
                retuneStyle={player.settings.retuneStyle}
                bedOn={player.settings.bedOn}
                bedLevel={player.settings.bedLevel}
                enabled={pro.canBatchExport}
                onNeedPro={() => openUpgrade("export")}
                onError={(msg) => player.setError(msg)}
              />

              <div className="volume-row">
                <Volume2 size={16} />
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={player.settings.volume}
                  onChange={(e) =>
                    player.setVolume(Number(e.target.value))
                  }
                  aria-label="Volume"
                />
              </div>

              <div className="bed-row">
                <label className="check">
                  <input
                    type="checkbox"
                    checked={player.settings.bedOn}
                    onChange={(e) => player.setBedOn(e.target.checked)}
                  />
                  <span>
                    {BRAND.bedLabel}{" "}
                    <strong>
                      {player.settings.targetA.toFixed(2)} Hz
                    </strong>{" "}
                    (generated sine under the track)
                  </span>
                </label>
                {player.settings.bedOn && (
                  <div className="bed-level">
                    <span>Bed level</span>
                    <input
                      type="range"
                      min={0}
                      max={0.2}
                      step={0.005}
                      value={player.settings.bedLevel}
                      onChange={(e) =>
                        player.setBedLevel(Number(e.target.value))
                      }
                      aria-label="Bed level"
                    />
                  </div>
                )}
              </div>

              <SleepTimer
                remainingSec={player.sleepRemainingSec}
                activeMinutes={player.sleepMinutes}
                onSetMinutes={player.setSleepTimer}
              />
            </section>

            <HearTheDifference
              sourceA={player.settings.sourceA}
              targetA={player.settings.targetA}
              retuneStyle={player.settings.retuneStyle}
            />

            <MoodGuide
              targetA={player.settings.targetA}
              onPick={(hz) => {
                requestTargetHz(hz);
              }}
            />

            <section className="playlist-card">
              <div className="playlist-head">
                <h3>
                  {player.queue.length ? "Now playing queue" : "Library queue"}
                </h3>
                <span>
                  {queueTracks.length} track
                  {queueTracks.length === 1 ? "" : "s"}
                </span>
              </div>
              {queueTracks.length === 0 ? (
                <p className="empty">
                  Your uploads will appear here and save to Library.
                </p>
              ) : (
                <ul className="playlist simple">
                  {queueTracks.map((t, i) => (
                    <li
                      key={t.id}
                      className={t.id === player.activeId ? "active" : ""}
                    >
                      <button
                        type="button"
                        className="track-main"
                        onClick={() =>
                          void playTrackInList(
                            t.id,
                            queueTracks.map((x) => x.id),
                          )
                        }
                      >
                        <span className="idx">{i + 1}</span>
                        <span className="tname">
                          {t.name}
                          {t.artist ? (
                            <span className="tartist">{t.artist}</span>
                          ) : null}
                        </span>
                        <span className="tdur">
                          {t.duration != null
                            ? formatTime(t.duration)
                            : formatBytes(t.size)}
                        </span>
                      </button>
                      <button
                        type="button"
                        className={`icon-btn ghost ${t.favorite ? "fav-on" : ""}`}
                        onClick={() => void lib.toggleFavorite(t.id)}
                        aria-label={
                          t.favorite ? "Unfavorite" : "Favorite"
                        }
                      >
                        <Heart
                          size={16}
                          fill={t.favorite ? "currentColor" : "none"}
                        />
                      </button>
                      <button
                        type="button"
                        className="icon-btn ghost"
                        onClick={() => void onDeleteTrack(t.id)}
                        aria-label={`Remove ${t.name}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {lib.tracks.length > 0 && (
                <p className="card-foot">
                  Manage all tracks in the{" "}
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => setTab("library")}
                  >
                    Library
                  </button>{" "}
                  tab · organize in{" "}
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => setTab("playlists")}
                  >
                    Playlists
                  </button>
                </p>
              )}
            </section>

            <section className="info-card">
              <div className="info-title">
                <Info size={16} />
                <h3>Play In 432 · TrueHz technology</h3>
              </div>
              <ul>
                <li>
                  <strong>{BRAND.product}</strong> retunes your music by concert
                  pitch so you can listen at A=432 (or any target you choose).
                  Powered by <strong>{BRAND.techMark} technology</strong>.
                </li>
                <li>
                  <strong>Retune</strong> pitch-shifts the whole mix by ratio{" "}
                  <code>{formatRatio(ratio)}</code> ({formatCents(cents)}) with
                  tempo held at 1.0. Style:{" "}
                  <strong>
                    {player.settings.retuneStyle === "reanchor"
                      ? "Re-anchor"
                      : "Concert A"}
                  </strong>
                  {player.settings.retuneStyle === "reanchor"
                    ? ` · label ${Math.round(player.settings.targetA)} Hz · implied A≈${Math.round(impliedA)}`
                    : ` · A=${Math.round(player.settings.sourceA)} → A=${Math.round(player.settings.targetA)}`}
                  .
                </li>
                <li>
                  This is <strong>not</strong> a claim that every peak in a
                  mixed song is “exactly {player.settings.targetA.toFixed(0)}{" "}
                  Hz.” Only the optional {BRAND.tech} pure-tone bed is a
                  generated sine at that exact frequency.
                </li>
                <li>
                  <strong>{BRAND.downloadHqLabel}</strong> uses the{" "}
                  <strong>{BRAND.convertProduct}</strong> engine (Rubber Band)
                  for high-quality offline WAV or MP3. Live listening stays fast
                  (SoundTouch). Same ratio math either way.
                </li>
                <li>
                  <strong>One-tap frequencies</strong> switch target concert
                  pitch mid-song. Mood shortcuts and the pure-tone A/B demo use
                  the same honest ratio model — not medical claims.
                </li>
              </ul>
              <button
                type="button"
                className="btn sm learn-cta"
                onClick={() => {
                  setLearnArticleId(null);
                  setTab("learn");
                }}
              >
                <BookOpen size={14} />
                Open Learn — science & honest claims
              </button>
            </section>
          </>
        )}

        {/* ═══════════════ LEARN TAB ═══════════════ */}
        {tab === "learn" && (
          <LearnView
            key={learnArticleId ?? "learn-index"}
            initialArticleId={learnArticleId}
            onOpenPlayer={() => setTab("player")}
          />
        )}

        {/* ═══════════════ SHARE TAB (Phase 3) ═══════════════ */}
        {tab === "share" && (
          <ShareDemoView />
        )}

        {/* ═══════════════ LIBRARY TAB ═══════════════ */}
        {tab === "library" && (
          <>
            <div className="page-toolbar">
              <div className="page-title-block">
                <h2>Library</h2>
                <p>
                  {lib.tracks.length} track
                  {lib.tracks.length === 1 ? "" : "s"}
                  {lib.tracks.length > 0 && (
                    <>
                      {" "}
                      ·{" "}
                      {formatBytes(
                        lib.tracks.reduce((s, t) => s + t.size, 0),
                      )}
                    </>
                  )}
                </p>
              </div>
              <div className="page-actions">
                <div className="search">
                  <Search size={15} />
                  <input
                    type="search"
                    placeholder="Search library…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={16} />
                  Import
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*,.mp3,.wav,.m4a,.flac,.ogg,.webm,.aac"
                  multiple
                  hidden
                  onChange={(e) => {
                    if (e.target.files) void handleImport(e.target.files);
                    e.target.value = "";
                  }}
                />
              </div>
            </div>

            <div className="filter-row">
              <button
                type="button"
                className={`chip ${libraryFilter === "all" ? "on" : ""}`}
                onClick={() => setLibraryFilter("all")}
              >
                All
              </button>
              <button
                type="button"
                className={`chip ${libraryFilter === "favorites" ? "on" : ""}`}
                onClick={() => setLibraryFilter("favorites")}
              >
                <Heart size={13} /> Favorites ({favoriteTracks.length})
              </button>
              <button
                type="button"
                className="btn primary sm"
                disabled={!libraryTracks.length}
                onClick={() =>
                  void player.playContext(
                    libraryTracks.map((t) => t.id),
                    libraryTracks[0]?.id,
                  )
                }
              >
                <Play size={14} className="play-icon" />
                Play all
              </button>
            </div>

            <section className="panel">
              {!lib.ready ? (
                <p className="empty">Loading library…</p>
              ) : (
                <TrackList
                  tracks={libraryTracks}
                  activeId={player.activeId}
                  playing={player.playing}
                  playlists={lib.playlists}
                  emptyMessage={
                    libraryFilter === "favorites"
                      ? "No favorites yet. Heart a track to save it here."
                      : "Your library is empty. Import or drop audio on the Player tab."
                  }
                  onPlay={(id) =>
                    void playTrackInList(
                      id,
                      libraryTracks.map((t) => t.id),
                    )
                  }
                  onToggleFavorite={(id) => void lib.toggleFavorite(id)}
                  onDelete={(id) => void onDeleteTrack(id)}
                  onAddToPlaylist={(plId, trackId) =>
                    void lib.addToPlaylist(plId, [trackId])
                  }
                  onRename={(id, name) => void lib.renameTrack(id, name)}
                />
              )}
            </section>
          </>
        )}

        {/* ═══════════════ PLAYLISTS TAB ═══════════════ */}
        {tab === "playlists" && (
          <>
            <div className="page-toolbar">
              <div className="page-title-block">
                <h2>Playlists</h2>
                <p>
                  {lib.playlists.length} playlist
                  {lib.playlists.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="page-actions">
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => {
                    setNewPlName("");
                    setCreateOpen(true);
                  }}
                >
                  <ListPlus size={16} />
                  New playlist
                </button>
              </div>
            </div>

            <PlaylistImportPanel
              tracks={lib.tracks}
              onError={(msg) => {
                if (msg) player.setError(msg);
                else player.setError(null);
              }}
              onCreatePlaylist={async (name, trackIds) => {
                const pl = await lib.createPlaylistWithTracks(name, trackIds);
                return pl;
              }}
              onSelectPlaylist={(id) => setSelectedPlaylistId(id)}
              onOpenLibrary={() => setTab("library")}
            />

            <div className="playlist-layout">
              <aside className="playlist-picker">
                {lib.playlists.length === 0 ? (
                  <p className="empty tight">
                    Create a playlist to organize tracks from your library.
                  </p>
                ) : (
                  <ul className="pl-list">
                    {lib.playlists.map((pl) => (
                      <li key={pl.id}>
                        <button
                          type="button"
                          className={`pl-item ${
                            selectedPlaylistId === pl.id ? "active" : ""
                          }`}
                          onClick={() => setSelectedPlaylistId(pl.id)}
                        >
                          <ListMusic size={16} />
                          <span className="pl-name">{pl.name}</span>
                          <span className="pl-count">
                            {pl.trackIds.length}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </aside>

              <section className="panel playlist-detail">
                {!selectedPlaylist ? (
                  <p className="empty">
                    {lib.playlists.length
                      ? "Select a playlist to view and edit tracks."
                      : "No playlist selected."}
                  </p>
                ) : (
                  <>
                    <div className="playlist-detail-head">
                      <div>
                        <h3>{selectedPlaylist.name}</h3>
                        <p>
                          {playlistTracks.length} track
                          {playlistTracks.length === 1 ? "" : "s"}
                        </p>
                      </div>
                      <div className="page-actions">
                        <div className="search">
                          <Search size={15} />
                          <input
                            type="search"
                            placeholder="Filter…"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                          />
                        </div>
                        <button
                          type="button"
                          className="btn primary sm"
                          disabled={!playlistTracks.length}
                          onClick={() =>
                            void player.playContext(
                              playlistTracks.map((t) => t.id),
                              playlistTracks[0]?.id,
                            )
                          }
                        >
                          <Play size={14} className="play-icon" />
                          Play
                        </button>
                        <button
                          type="button"
                          className="btn sm"
                          onClick={() => setAddToPlOpen(true)}
                          disabled={!lib.tracks.length}
                        >
                          <ListPlus size={14} />
                          Add
                        </button>
                        <button
                          type="button"
                          className="btn sm"
                          onClick={() => {
                            setRenamePlName(selectedPlaylist.name);
                            setRenamePlOpen(true);
                          }}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn sm danger"
                          onClick={() => void deleteCurrentPlaylist()}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <TrackList
                      tracks={playlistTracks}
                      activeId={player.activeId}
                      playing={player.playing}
                      playlists={lib.playlists}
                      playlistId={selectedPlaylist.id}
                      emptyMessage="This playlist is empty. Click Add to pull tracks from your library."
                      onPlay={(id) =>
                        void playTrackInList(
                          id,
                          playlistTracks.map((t) => t.id),
                        )
                      }
                      onToggleFavorite={(id) => void lib.toggleFavorite(id)}
                      onDelete={(id) => void onDeleteTrack(id)}
                      onRemoveFromPlaylist={(id) =>
                        void lib.removeFromPlaylist(
                          selectedPlaylist.id,
                          id,
                        )
                      }
                      onAddToPlaylist={(plId, trackId) =>
                        void lib.addToPlaylist(plId, [trackId])
                      }
                      onReorder={(from, to) =>
                        void lib.reorderPlaylist(
                          selectedPlaylist.id,
                          from,
                          to,
                        )
                      }
                      onRename={(id, name) =>
                        void lib.renameTrack(id, name)
                      }
                    />
                  </>
                )}
              </section>
            </div>
          </>
        )}
      </main>

      {/* Mini bar when not on Player tab so playback continues with controls */}
      {tab !== "player" && (
        <MiniPlayerBar
          track={activeTrack}
          playing={player.playing}
          loading={player.loading}
          timePlayed={player.timePlayed}
          duration={player.duration}
          percent={player.percent}
          mode={player.settings.mode}
          sourceA={player.settings.sourceA}
          targetA={player.settings.targetA}
          volume={player.settings.volume}
          onToggle={() => void player.togglePlay()}
          onPrev={player.prev}
          onNext={player.next}
          onSeek={player.seekPercent}
          onVolume={player.setVolume}
          onMode={player.setMode}
          onOpenPlayer={() => setTab("player")}
        />
      )}

      <footer className="footer">
        {BRAND.footer} ·{" "}
        <a href={BRAND.url} target="_blank" rel="noopener noreferrer">
          {BRAND.domain}
        </a>
      </footer>

      {createOpen && (
        <Modal
          title="New playlist"
          onClose={() => setCreateOpen(false)}
          footer={
            <>
              <button
                type="button"
                className="btn"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={() => void createPlaylist()}
              >
                Create
              </button>
            </>
          }
        >
          <label className="field">
            <span>Name</span>
            <input
              autoFocus
              value={newPlName}
              placeholder="e.g. Morning calm"
              onChange={(e) => setNewPlName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void createPlaylist();
              }}
            />
          </label>
        </Modal>
      )}

      {renamePlOpen && selectedPlaylist && (
        <Modal
          title="Rename playlist"
          onClose={() => setRenamePlOpen(false)}
          footer={
            <>
              <button
                type="button"
                className="btn"
                onClick={() => setRenamePlOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={() => void renameCurrentPlaylist()}
              >
                Save
              </button>
            </>
          }
        >
          <label className="field">
            <span>Name</span>
            <input
              autoFocus
              value={renamePlName}
              onChange={(e) => setRenamePlName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void renameCurrentPlaylist();
              }}
            />
          </label>
        </Modal>
      )}

      {addToPlOpen && selectedPlaylist && (
        <AddTracksModal
          playlist={selectedPlaylist}
          tracks={lib.tracks}
          selectedIds={selectedIds}
          setSelectedIds={setSelectedIds}
          onClose={() => {
            setAddToPlOpen(false);
            setSelectedIds(new Set());
          }}
          onAdd={async () => {
            await lib.addToPlaylist(
              selectedPlaylist.id,
              Array.from(selectedIds),
            );
            setAddToPlOpen(false);
            setSelectedIds(new Set());
          }}
        />
      )}

      <UpgradeModal
        open={upgradeOpen}
        reason={upgradeReason}
        busy={pro.checkoutBusy}
        error={pro.checkoutError}
        onClose={() => setUpgradeOpen(false)}
        onUpgrade={() => void pro.upgrade({ tier: "pro" })}
        onRestoreAccess={(input) => pro.restoreAccess(input)}
        onRestoreStore={() => void pro.restore()}
        nativeBilling={pro.nativeBilling}
      />
      {proToast && (
        <div className="pro-toast" role="status">
          {proToast}
          <button
            type="button"
            className="link-btn"
            onClick={() => setProToast(null)}
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}

function MiniPlayerBar({
  track,
  playing,
  loading,
  timePlayed,
  duration,
  percent,
  mode,
  sourceA,
  targetA,
  volume,
  onToggle,
  onPrev,
  onNext,
  onSeek,
  onVolume,
  onMode,
  onOpenPlayer,
}: {
  track: TrackMeta | null;
  playing: boolean;
  loading: boolean;
  timePlayed: number;
  duration: number;
  percent: number;
  mode: "original" | "retuned";
  sourceA: number;
  targetA: number;
  volume: number;
  onToggle: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeek: (p: number) => void;
  onVolume: (v: number) => void;
  onMode: (m: "original" | "retuned") => void;
  onOpenPlayer: () => void;
}) {
  return (
    <div className="mini-bar">
      <button type="button" className="mini-track" onClick={onOpenPlayer}>
        <div className={`art xs ${playing ? "pulse" : ""}`}>
          <Music2 size={16} />
        </div>
        <div className="mini-meta">
          <span className="pb-title">
            {track?.name ?? "Nothing playing"}
          </span>
          <span className="pb-sub">
            {track?.artist ? `${track.artist} · ` : ""}
            {mode === "retuned"
              ? `A${Math.round(sourceA)}→A${Math.round(targetA)}`
              : "Original"}{" "}
            · open Player
          </span>
        </div>
      </button>
      <div className="mini-controls">
        <button
          type="button"
          className="icon-btn ghost"
          onClick={onPrev}
          disabled={!track}
          aria-label="Previous"
        >
          <SkipBack size={16} />
        </button>
        <button
          type="button"
          className="play-btn xs"
          onClick={onToggle}
          disabled={loading}
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? (
            <Pause size={18} />
          ) : (
            <Play size={18} className="play-icon" />
          )}
        </button>
        <button
          type="button"
          className="icon-btn ghost"
          onClick={onNext}
          disabled={!track}
          aria-label="Next"
        >
          <SkipForward size={16} />
        </button>
      </div>
      <div className="mini-seek">
        <span className="time">{formatTime(timePlayed)}</span>
        <input
          type="range"
          min={0}
          max={100}
          step={0.05}
          value={Number.isFinite(percent) ? percent : 0}
          disabled={!track || loading}
          onChange={(e) => onSeek(Number(e.target.value))}
          aria-label="Seek"
        />
        <span className="time">{formatTime(duration)}</span>
      </div>
      <div className="mode-toggle compact">
        <button
          type="button"
          className={mode === "original" ? "active" : ""}
          onClick={() => onMode("original")}
        >
          Orig
        </button>
        <button
          type="button"
          className={mode === "retuned" ? "active" : ""}
          onClick={() => onMode("retuned")}
        >
          Retune
        </button>
      </div>
      <div className="volume-row compact hide-sm">
        <Volume2 size={14} />
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => onVolume(Number(e.target.value))}
          aria-label="Volume"
        />
      </div>
    </div>
  );
}

function AddTracksModal({
  playlist,
  tracks,
  selectedIds,
  setSelectedIds,
  onClose,
  onAdd,
}: {
  playlist: Playlist;
  tracks: TrackMeta[];
  selectedIds: Set<string>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  onClose: () => void;
  onAdd: () => Promise<void>;
}) {
  const available = tracks.filter((t) => !playlist.trackIds.includes(t.id));
  return (
    <Modal
      title={`Add to “${playlist.name}”`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={!selectedIds.size}
            onClick={() => void onAdd()}
          >
            Add {selectedIds.size || ""} track
            {selectedIds.size === 1 ? "" : "s"}
          </button>
        </>
      }
    >
      <p className="modal-hint">
        Select library tracks that are not already in this playlist.
      </p>
      <ul className="pick-list">
        {available.map((t) => {
          const checked = selectedIds.has(t.id);
          return (
            <li key={t.id}>
              <label className="pick-row">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    setSelectedIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(t.id)) next.delete(t.id);
                      else next.add(t.id);
                      return next;
                    });
                  }}
                />
                <span>{t.name}</span>
              </label>
            </li>
          );
        })}
        {available.length === 0 && (
          <li className="empty">
            All library tracks are already in this playlist.
          </li>
        )}
      </ul>
    </Modal>
  );
}
