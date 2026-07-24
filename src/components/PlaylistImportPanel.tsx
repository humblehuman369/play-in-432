import { useCallback, useEffect, useRef, useState } from "react";
import {
  FileAudio,
  Link2,
  ListPlus,
  Loader2,
  LogOut,
  Music2,
} from "lucide-react";
import { isM3uFile, readM3uFile } from "../lib/m3u";
import {
  formatQueryLabel,
  matchQueriesToLibrary,
  type MatchReport,
} from "../lib/trackMatch";
import {
  beginSpotifyLogin,
  clearSpotifyTokens,
  completeSpotifyLoginFromUrl,
  fetchPlaylistTracks,
  fetchUserPlaylists,
  getSpotifyClientId,
  isSpotifyConnected,
  spotifyTracksToQueries,
  type SpotifyPlaylistSummary,
} from "../lib/spotify";
import type { TrackMeta } from "../lib/types";

type Props = {
  tracks: TrackMeta[];
  onCreatePlaylist: (
    name: string,
    trackIds: string[],
  ) => Promise<{ id: string; name: string } | null>;
  onSelectPlaylist?: (id: string) => void;
  onError?: (message: string | null) => void;
};

export function PlaylistImportPanel({
  tracks,
  onCreatePlaylist,
  onSelectPlaylist,
  onError,
}: Props) {
  const m3uInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [lastReport, setLastReport] = useState<MatchReport | null>(null);
  const [lastName, setLastName] = useState<string | null>(null);

  const [spotifyOk, setSpotifyOk] = useState(isSpotifyConnected);
  const [spotifyLists, setSpotifyLists] = useState<SpotifyPlaylistSummary[]>(
    [],
  );
  const [spotifyLoading, setSpotifyLoading] = useState(false);
  const clientId = getSpotifyClientId();

  const finishImport = useCallback(
    async (name: string, report: MatchReport) => {
      setLastReport(report);
      setLastName(name);
      if (!report.matchedIds.length) {
        setStatus(
          `No matches in your library (0 / ${report.total}). Import the audio files first, then try again.`,
        );
        return;
      }
      const pl = await onCreatePlaylist(name, report.matchedIds);
      if (pl) {
        setStatus(
          `Created “${pl.name}” with ${report.matched} of ${report.total} tracks matched from your library.`,
        );
        onSelectPlaylist?.(pl.id);
      }
    },
    [onCreatePlaylist, onSelectPlaylist],
  );

  const importM3u = useCallback(
    async (file: File) => {
      if (!isM3uFile(file)) {
        onError?.("Please choose an .m3u or .m3u8 playlist file.");
        return;
      }
      setBusy(true);
      setStatus(null);
      onError?.(null);
      try {
        const parsed = await readM3uFile(file);
        if (!parsed.entries.length) {
          setStatus("That M3U file has no track entries.");
          return;
        }
        const report = matchQueriesToLibrary(parsed.entries, tracks);
        const name =
          parsed.name ||
          file.name.replace(/\.(m3u8?)$/i, "") ||
          "Imported playlist";
        await finishImport(name, report);
      } catch (e) {
        console.error(e);
        onError?.(
          e instanceof Error ? e.message : "Failed to import M3U playlist.",
        );
      } finally {
        setBusy(false);
      }
    },
    [tracks, finishImport, onError],
  );

  const loadSpotifyPlaylists = useCallback(async () => {
    if (!isSpotifyConnected()) {
      setSpotifyOk(false);
      setSpotifyLists([]);
      return;
    }
    setSpotifyLoading(true);
    onError?.(null);
    try {
      const list = await fetchUserPlaylists();
      setSpotifyLists(list);
      setSpotifyOk(true);
    } catch (e) {
      console.error(e);
      setSpotifyOk(false);
      onError?.(
        e instanceof Error ? e.message : "Could not load Spotify playlists.",
      );
    } finally {
      setSpotifyLoading(false);
    }
  }, [onError]);

  // Complete OAuth redirect once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const done = await completeSpotifyLoginFromUrl();
        if (cancelled) return;
        if (done) {
          setSpotifyOk(true);
          setStatus("Connected to Spotify. Choose a playlist to match.");
          await loadSpotifyPlaylists();
        } else if (isSpotifyConnected()) {
          setSpotifyOk(true);
          void loadSpotifyPlaylists();
        }
      } catch (e) {
        if (!cancelled) {
          onError?.(
            e instanceof Error ? e.message : "Spotify login failed.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadSpotifyPlaylists, onError]);

  const importSpotifyPlaylist = useCallback(
    async (pl: SpotifyPlaylistSummary) => {
      setBusy(true);
      setStatus(null);
      onError?.(null);
      try {
        const spTracks = await fetchPlaylistTracks(pl.id);
        const queries = spotifyTracksToQueries(spTracks);
        if (!queries.length) {
          setStatus(`“${pl.name}” has no importable tracks.`);
          return;
        }
        const report = matchQueriesToLibrary(queries, tracks);
        await finishImport(pl.name, report);
      } catch (e) {
        console.error(e);
        onError?.(
          e instanceof Error
            ? e.message
            : "Failed to import Spotify playlist.",
        );
      } finally {
        setBusy(false);
      }
    },
    [tracks, finishImport, onError],
  );

  return (
    <section className="playlist-import card-block">
      <div className="playlist-import-head">
        <ListPlus size={16} />
        <h3>Import playlist</h3>
      </div>
      <p className="playlist-import-lead">
        Build a Play In 432 playlist from tracks <strong>already in your
        library</strong>. Streaming services only provide titles — we match
        them locally. TrueHz retune still needs your files.
      </p>

      <div className="playlist-import-grid">
        {/* M3U */}
        <div className="playlist-import-card">
          <div className="playlist-import-card-title">
            <FileAudio size={16} />
            <span>M3U file (local)</span>
          </div>
          <p>
            Export a playlist as <code>.m3u</code> / <code>.m3u8</code> from
            another app, then match paths and titles to your library.
          </p>
          <input
            ref={m3uInputRef}
            type="file"
            accept=".m3u,.m3u8,audio/x-mpegurl,application/vnd.apple.mpegurl"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importM3u(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            className="btn primary sm"
            disabled={busy || !tracks.length}
            onClick={() => m3uInputRef.current?.click()}
          >
            {busy ? (
              <>
                <Loader2 size={14} className="spin" /> Working…
              </>
            ) : (
              <>
                <FileAudio size={14} /> Choose M3U…
              </>
            )}
          </button>
          {!tracks.length && (
            <p className="playlist-import-hint">
              Import audio into Library first.
            </p>
          )}
        </div>

        {/* Spotify */}
        <div className="playlist-import-card">
          <div className="playlist-import-card-title">
            <Music2 size={16} />
            <span>Spotify playlist</span>
          </div>
          <p>
            Connect Spotify, pick a playlist, match song titles to your local
            library. No Spotify audio is downloaded or retuned.
          </p>

          {!clientId ? (
            <p className="playlist-import-hint">
              Set <code>VITE_SPOTIFY_CLIENT_ID</code> in <code>.env</code> (see{" "}
              <code>.env.example</code>). Create an app at{" "}
              <a
                href="https://developer.spotify.com/dashboard"
                target="_blank"
                rel="noreferrer"
              >
                developer.spotify.com
              </a>
              . Redirect URI must be{" "}
              <code>http://127.0.0.1:5173/</code> (Spotify rejects{" "}
              <code>localhost</code>). Open the app at that same URL.
            </p>
          ) : !spotifyOk ? (
            <button
              type="button"
              className="btn primary sm"
              disabled={busy}
              onClick={() => {
                void beginSpotifyLogin().catch((e) =>
                  onError?.(
                    e instanceof Error ? e.message : "Spotify login failed",
                  ),
                );
              }}
            >
              <Link2 size={14} /> Connect Spotify
            </button>
          ) : (
            <div className="spotify-connected">
              <div className="spotify-connected-actions">
                <button
                  type="button"
                  className="btn sm"
                  disabled={spotifyLoading || busy}
                  onClick={() => void loadSpotifyPlaylists()}
                >
                  {spotifyLoading ? (
                    <>
                      <Loader2 size={14} className="spin" /> Loading…
                    </>
                  ) : (
                    "Refresh playlists"
                  )}
                </button>
                <button
                  type="button"
                  className="btn sm"
                  onClick={() => {
                    clearSpotifyTokens();
                    setSpotifyOk(false);
                    setSpotifyLists([]);
                    setStatus("Disconnected from Spotify.");
                  }}
                >
                  <LogOut size={14} /> Disconnect
                </button>
              </div>
              {spotifyLists.length > 0 ? (
                <ul className="spotify-pl-list">
                  {spotifyLists.map((pl) => (
                    <li key={pl.id}>
                      <button
                        type="button"
                        className="spotify-pl-item"
                        disabled={busy || !tracks.length}
                        onClick={() => void importSpotifyPlaylist(pl)}
                      >
                        <span className="spotify-pl-name">{pl.name}</span>
                        <span className="spotify-pl-meta">
                          {pl.trackCount} tracks
                          {pl.owner ? ` · ${pl.owner}` : ""}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                !spotifyLoading && (
                  <p className="playlist-import-hint">
                    No playlists found (or still loading).
                  </p>
                )
              )}
            </div>
          )}
        </div>
      </div>

      {status && (
        <p className="playlist-import-status" role="status">
          {status}
        </p>
      )}

      {lastReport && lastReport.unmatched.length > 0 && (
        <details className="playlist-import-unmatched">
          <summary>
            Unmatched ({lastReport.unmatched.length})
            {lastName ? ` · ${lastName}` : ""}
          </summary>
          <ul>
            {lastReport.unmatched.slice(0, 40).map((q, i) => (
              <li key={`${formatQueryLabel(q)}-${i}`}>
                {formatQueryLabel(q)}
              </li>
            ))}
            {lastReport.unmatched.length > 40 && (
              <li>…and {lastReport.unmatched.length - 40} more</li>
            )}
          </ul>
          <p className="playlist-import-hint">
            Import the missing audio files into Library, then import the
            playlist again.
          </p>
        </details>
      )}
    </section>
  );
}
