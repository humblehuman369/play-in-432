import { useCallback, useRef, useState } from "react";
import { Download, FileAudio, ListPlus, Loader2 } from "lucide-react";
import { isM3uFile, readM3uFile } from "../lib/m3u";
import {
  formatQueryLabel,
  matchQueriesToLibrary,
  type MatchReport,
} from "../lib/trackMatch";
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
  const libraryCount = tracks.length;

  const finishImport = useCallback(
    async (name: string, report: MatchReport) => {
      setLastReport(report);
      setLastName(name);
      if (!report.matchedIds.length) {
        setStatus(
          libraryCount === 0
            ? `“${name}” lists ${report.total} songs, but your library is empty. Add those audio files first (Library → Add music), then import the playlist again.`
            : `Found ${report.total} songs, but 0 matched files in your library (${libraryCount} local tracks). Titles must match files you already imported.`,
        );
        return;
      }
      const pl = await onCreatePlaylist(name, report.matchedIds);
      if (pl) {
        setStatus(
          `Created “${pl.name}” with ${report.matched} of ${report.total} tracks from your library. Unmatched songs stay listed below — import those files to add them.`,
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

  return (
    <section className="playlist-import card-block">
      <div className="playlist-import-head">
        <ListPlus size={16} />
        <h3>Import playlist</h3>
      </div>
      <p className="playlist-import-lead">
        Import a playlist file and we’ll match its song titles to audio you’ve
        already added. Library right now: <strong>{libraryCount}</strong> track
        {libraryCount === 1 ? "" : "s"}.
        {libraryCount === 0 && onOpenLibrary && (
          <>
            {" "}
            <button type="button" className="link-btn" onClick={onOpenLibrary}>
              Add music to Library first →
            </button>
          </>
        )}
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

        {/* Where to get retunable music */}
        <div className="playlist-import-card">
          <div className="playlist-import-card-title">
            <Download size={16} />
            <span>Get music you can retune</span>
          </div>
          <p>
            Play In 432 retunes files you own. Buy DRM-free downloads from the{" "}
            <strong>iTunes Store</strong>, <strong>Amazon Music</strong> (MP3),
            or <strong>Bandcamp</strong>, then add them here.
          </p>
          <p className="playlist-import-hint">
            Streaming services (Spotify, Apple Music) are DRM-locked and can’t
            be retuned — only files you download and own.
          </p>
          {onOpenLibrary && (
            <button
              type="button"
              className="btn sm"
              onClick={onOpenLibrary}
            >
              <Download size={14} /> Add music
            </button>
          )}
        </div>
      </div>

      {status && (
        <p className="playlist-import-status" role="status">
          {status}
        </p>
      )}

      {lastReport && lastReport.unmatched.length > 0 && (
        <details className="playlist-import-unmatched" open>
          <summary>
            Unmatched ({lastReport.unmatched.length})
            {lastName ? ` · ${lastName}` : ""}
          </summary>
          <ul>
            {lastReport.unmatched.slice(0, 40).map((q, i) => (
              <li key={`${formatQueryLabel(q)}-${i}`}>{formatQueryLabel(q)}</li>
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
