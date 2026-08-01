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
  fetchPlaylistTracks,
  fetchUserPlaylists,
  getSpotifyClientId,
  getSpotifyDashboardRedirectHints,
  getSpotifyRedirectUri,
  hasSpotifyLibraryScope,
  isSpotifyConnected,
  SPOTIFY_LIKED_SONGS_ID,
  spotifyTracksToQueries,
  type SpotifyPlaylistSummary,
  type SpotifyPlaylistTrack,
} from "../lib/spotify";
import { isNativeApp } from "../lib/native";
import type { TrackMeta } from "../lib/types";

type Props = {
  tracks: TrackMeta[];
  onCreatePlaylist: (
    name: string,
    trackIds: string[],
  ) => Promise<{ id: string; name: string } | null>;
  onSelectPlaylist?: (id: string) => void;
  onError?: (message: string | null) => void;
  /** Jump user to Library tab to add files */
  onOpenLibrary?: () => void;
};

export function PlaylistImportPanel({
  tracks,
  onCreatePlaylist,
  onSelectPlaylist,
  onError,
  onOpenLibrary,
}: Props) {
  const m3uInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [lastReport, setLastReport] = useState<MatchReport | null>(null);
  const [lastName, setLastName] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    name: string;
    tracks: SpotifyPlaylistTrack[];
    report: MatchReport | null;
  } | null>(null);

  const [spotifyOk, setSpotifyOk] = useState(isSpotifyConnected);
  const [spotifyLists, setSpotifyLists] = useState<SpotifyPlaylistSummary[]>(
    [],
  );
  const [spotifyLoading, setSpotifyLoading] = useState(false);
  const clientId = getSpotifyClientId();
  const libraryCount = tracks.length;

  const finishImport = useCallback(
    async (name: string, report: MatchReport) => {
      setLastReport(report);
      setLastName(name);
      if (!report.matchedIds.length) {
        setStatus(
          libraryCount === 0
            ? `“${name}” has ${report.total} Spotify songs listed below — but your library is empty. Add those audio files first (Library → Add music), then match again.`
            : `Found ${report.total} Spotify songs, but 0 matched files in your library (${libraryCount} local tracks). Titles must match files you already imported.`,
        );
        return;
      }
      const pl = await onCreatePlaylist(name, report.matchedIds);
      if (pl) {
        setStatus(
          `Created “${pl.name}” with ${report.matched} of ${report.total} tracks from your library. Unmatched Spotify songs stay listed below — import those files to add them.`,
        );
        onSelectPlaylist?.(pl.id);
      }
    },
    [onCreatePlaylist, onSelectPlaylist, libraryCount],
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

  // OAuth code exchange runs in App root (so it works after redirect to /).
  // Here we only hydrate UI if tokens already exist or become available.
  useEffect(() => {
    if (isSpotifyConnected()) {
      setSpotifyOk(true);
      void loadSpotifyPlaylists();
      return;
    }
    // After App root completes OAuth, URL is cleaned; re-check shortly
    const t = window.setTimeout(() => {
      if (isSpotifyConnected()) {
        setSpotifyOk(true);
        setStatus("Connected to Spotify. Choose a playlist to match.");
        void loadSpotifyPlaylists();
      }
    }, 400);
    return () => window.clearTimeout(t);
  }, [loadSpotifyPlaylists]);

  const openSpotifyPlaylist = useCallback(
    async (pl: SpotifyPlaylistSummary) => {
      setBusy(true);
      setStatus(null);
      onError?.(null);
      setPreview(null);
      try {
        const spTracks = await fetchPlaylistTracks(pl.id);
        if (!spTracks.length) {
          const liked = pl.isLikedSongs || pl.id === SPOTIFY_LIKED_SONGS_ID;
          setStatus(
            liked
              ? `Could not load Liked Songs. Disconnect Spotify and connect again so Spotify can grant “View your library” (user-library-read).`
              : `“${pl.name}” returned no song titles from Spotify (empty playlist, private, or region-locked).`,
          );
          return;
        }
        const queries = spotifyTracksToQueries(spTracks);
        const report =
          libraryCount > 0 ? matchQueriesToLibrary(queries, tracks) : null;
        setPreview({ name: pl.name, tracks: spTracks, report });
        setLastReport(report);
        setLastName(pl.name);

        if (!libraryCount) {
          setStatus(
            `Showing ${spTracks.length} song titles from “${pl.name}”. Spotify never sends audio — only names. Add matching MP3/WAV files under Library, then open this list again to match.`,
          );
          return;
        }
        await finishImport(pl.name, report!);
      } catch (e) {
        console.error(e);
        const msg =
          e instanceof Error
            ? e.message
            : "Failed to load Spotify playlist tracks.";
        // 403 often means old token without user-library-read
        if (/403|Insufficient|scope|library/i.test(msg)) {
          onError?.(
            `${msg} — Disconnect Spotify and Connect again to approve library access for Liked Songs.`,
          );
        } else {
          onError?.(msg);
        }
      } finally {
        setBusy(false);
      }
    },
    [tracks, finishImport, onError, libraryCount],
  );

  const reconnectSpotify = useCallback(() => {
    clearSpotifyTokens();
    setSpotifyOk(false);
    setSpotifyLists([]);
    setPreview(null);
    setStatus("Reconnect to grant Liked Songs / library access…");
    void beginSpotifyLogin().catch((e) => {
      onError?.(e instanceof Error ? e.message : "Spotify login failed");
    });
  }, [onError]);

  return (
    <section className="playlist-import card-block">
      <div className="playlist-import-head">
        <ListPlus size={16} />
        <h3>Import playlist</h3>
      </div>
      <p className="playlist-import-lead">
        <strong>Spotify cannot stream or retune inside this app.</strong> We
        only read playlist <em>names and song titles</em>, then match them to
        audio files you already added. Library right now:{" "}
        <strong>{libraryCount}</strong> track{libraryCount === 1 ? "" : "s"}.
        {libraryCount === 0 && onOpenLibrary && (
          <>
            {" "}
            <button type="button" className="link-btn" onClick={onOpenLibrary}>
              Add music to Library first →
            </button>
          </>
        )}
      </p>
      {spotifyOk && !hasSpotifyLibraryScope() && (
        <p className="playlist-import-hint playlist-import-warn" role="status">
          Your Spotify connection is missing library access, so{" "}
          <strong>Liked Songs</strong> may show 0 titles.{" "}
          <button type="button" className="link-btn" onClick={reconnectSpotify}>
            Disconnect & reconnect
          </button>{" "}
          and approve all permissions.
        </p>
      )}

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
            Connect, then tap a playlist to see its songs. We match titles to
            your local files and build a Play In 432 playlist from matches
            only.
          </p>

          {!clientId ? (
            <p className="playlist-import-hint">
              Set <code>VITE_SPOTIFY_CLIENT_ID</code> in <code>.env</code> (and
              Vercel env for production), then rebuild. Create an app at{" "}
              <a
                href="https://developer.spotify.com/dashboard"
                target="_blank"
                rel="noreferrer"
              >
                developer.spotify.com
              </a>
              . Add redirect URIs (exact match, trailing slash counts):
              {getSpotifyDashboardRedirectHints().map((u) => (
                <code key={u} className="spotify-redirect-uri">
                  {u}
                </code>
              ))}
            </p>
          ) : !spotifyOk ? (
            <>
              <button
                type="button"
                className="btn primary sm"
                disabled={busy}
                onClick={() => {
                  void beginSpotifyLogin().catch((e) => {
                    const msg =
                      e instanceof Error ? e.message : "Spotify login failed";
                    const redirect = getSpotifyRedirectUri();
                    onError?.(
                      /redirect/i.test(msg)
                        ? `${msg} Add this exact Redirect URI in Spotify Dashboard → your app → Settings: ${redirect}`
                        : msg,
                    );
                  });
                }}
              >
                <Link2 size={14} /> Connect Spotify
              </button>
              <p className="playlist-import-hint">
                {isNativeApp() ? (
                  <>
                    Opens Spotify login in a secure browser sheet (not inside
                    the player). After you approve, you return here
                    automatically. Redirect URI must be{" "}
                    <code className="spotify-redirect-uri">
                      {getSpotifyRedirectUri()}
                    </code>{" "}
                    in the{" "}
                    <a
                      href="https://developer.spotify.com/dashboard"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Spotify Dashboard
                    </a>
                    .
                  </>
                ) : (
                  <>
                    This session will redirect to{" "}
                    <code className="spotify-redirect-uri">
                      {getSpotifyRedirectUri()}
                    </code>
                    . That string must appear under{" "}
                    <strong>Redirect URIs</strong> in the{" "}
                    <a
                      href="https://developer.spotify.com/dashboard"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Spotify Dashboard
                    </a>{" "}
                    for your client ID (copy/paste exactly — include the
                    trailing <code>/</code>).
                  </>
                )}
              </p>
            </>
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
                    setPreview(null);
                    setStatus("Disconnected from Spotify.");
                  }}
                >
                  <LogOut size={14} /> Disconnect
                </button>
                <button
                  type="button"
                  className="btn sm"
                  onClick={reconnectSpotify}
                  title="Request latest permissions including Liked Songs"
                >
                  Reconnect
                </button>
              </div>
              {libraryCount === 0 && (
                <p className="playlist-import-hint playlist-import-warn">
                  Your library is empty. Tap a Spotify list to preview{" "}
                  <em>titles only</em>, then add those audio files under Library
                  so we can match and retune them. Streaming audio is never
                  downloaded.
                </p>
              )}
              {spotifyLists.length > 0 ? (
                <ul className="spotify-pl-list">
                  {spotifyLists.map((pl) => (
                    <li key={pl.id}>
                      <button
                        type="button"
                        className="spotify-pl-item"
                        disabled={busy}
                        onClick={() => void openSpotifyPlaylist(pl)}
                      >
                        <span className="spotify-pl-name">
                          {pl.isLikedSongs ? "♥ " : ""}
                          {pl.name}
                        </span>
                        <span className="spotify-pl-meta">
                          {pl.trackCount < 0
                            ? "needs reconnect"
                            : `${pl.trackCount} titles on Spotify`}
                          {pl.owner ? ` · ${pl.owner}` : ""}
                          {libraryCount === 0
                            ? " · tap to preview titles"
                            : " · tap to match library"}
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

      {preview && preview.tracks.length > 0 && (
        <div className="spotify-track-preview">
          <div className="spotify-track-preview-head">
            <h4>
              Songs in “{preview.name}”{" "}
              <span>
                ({preview.tracks.length}
                {preview.report
                  ? ` · ${preview.report.matched} matched in library`
                  : " · preview only"}
                )
              </span>
            </h4>
            {libraryCount === 0 && onOpenLibrary && (
              <button
                type="button"
                className="btn primary sm"
                onClick={onOpenLibrary}
              >
                Add music to Library
              </button>
            )}
          </div>
          <ul className="spotify-track-list">
            {preview.tracks.slice(0, 80).map((t, i) => {
              const matched = preview.report?.results[i]?.track;
              return (
                <li
                  key={`${t.spotifyUri || t.title}-${i}`}
                  className={matched ? "is-matched" : "is-unmatched"}
                >
                  <span className="spotify-track-label">
                    {t.artist ? `${t.artist} — ${t.title}` : t.title}
                  </span>
                  <span className="spotify-track-flag">
                    {matched ? "In library" : "Need file"}
                  </span>
                </li>
              );
            })}
            {preview.tracks.length > 80 && (
              <li className="spotify-track-more">
                …and {preview.tracks.length - 80} more
              </li>
            )}
          </ul>
          <p className="playlist-import-hint">
            “Need file” means that Spotify title is not in your Play In 432
            library yet. Import the MP3/WAV/etc., then open this playlist again
            to match.
          </p>
        </div>
      )}

      {lastReport && lastReport.unmatched.length > 0 && !preview && (
        <details className="playlist-import-unmatched" open>
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
