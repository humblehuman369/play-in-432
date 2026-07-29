/**
 * Phase 2 — Batch export queue (Pro).
 * Sequential TrueHz Convert + optional ZIP download.
 */
import { useCallback, useState } from "react";
import {
  Download,
  Loader2,
  Package,
  Plus,
  Trash2,
  XCircle,
} from "lucide-react";
import * as db from "../lib/db";
import { type ExportFormat } from "../lib/exportRetune";
import { BRAND } from "../lib/brand";
import type { TrackMeta } from "../lib/types";
import { zipSync } from "fflate";

export type BatchItem = {
  id: string;
  name: string;
  status: "pending" | "processing" | "done" | "error";
  progress: number;
  error?: string;
  blob?: Blob;
  filename?: string;
};

type Props = {
  tracks: TrackMeta[];
  sourceA: number;
  targetA: number;
  retuneStyle: "concert" | "reanchor";
  bedOn: boolean;
  bedLevel: number;
  enabled: boolean;
  onNeedPro: () => void;
  onError?: (msg: string | null) => void;
};

export function BatchExportPanel({
  tracks,
  sourceA,
  targetA,
  retuneStyle,
  bedOn,
  bedLevel,
  enabled,
  onNeedPro,
  onError,
}: Props) {
  const [queue, setQueue] = useState<BatchItem[]>([]);
  const [format, setFormat] = useState<ExportFormat>("wav");
  const [running, setRunning] = useState(false);
  const [overall, setOverall] = useState(0);

  const addFromLibrary = (ids: string[]) => {
    if (!enabled) {
      onNeedPro();
      return;
    }
    setQueue((q) => {
      const have = new Set(q.map((i) => i.id));
      const add: BatchItem[] = [];
      for (const id of ids) {
        if (have.has(id)) continue;
        const t = tracks.find((x) => x.id === id);
        if (!t) continue;
        add.push({
          id,
          name: t.name,
          status: "pending",
          progress: 0,
        });
      }
      return [...q, ...add];
    });
  };

  const removeItem = (id: string) => {
    if (running) return;
    setQueue((q) => q.filter((i) => i.id !== id));
  };

  const clearDone = () => {
    setQueue((q) => q.filter((i) => i.status !== "done"));
  };

  const runQueue = useCallback(async () => {
    if (!enabled) {
      onNeedPro();
      return;
    }
    if (running) return;
    const pending = queue.filter((i) => i.status === "pending" || i.status === "error");
    if (!pending.length) {
      onError?.("Add tracks to the batch queue first.");
      return;
    }

    setRunning(true);
    onError?.(null);
    const total = pending.length;
    let doneCount = 0;

    for (const item of pending) {
      setQueue((q) =>
        q.map((i) =>
          i.id === item.id
            ? { ...i, status: "processing", progress: 0, error: undefined }
            : i,
        ),
      );

      try {
        const rec = await db.getTrack(item.id);
        if (!rec) throw new Error("Track not found");
        const data = await rec.blob.arrayBuffer();

        const resultBlob = await processOne({
          arrayBuffer: data,
          trackName: item.name,
          sourceA,
          targetA,
          retuneStyle,
          bedOn,
          bedLevel,
          format,
          onProgress: (f) => {
            setQueue((q) =>
              q.map((i) =>
                i.id === item.id ? { ...i, progress: f } : i,
              ),
            );
          },
        });

        setQueue((q) =>
          q.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  status: "done",
                  progress: 1,
                  blob: resultBlob.blob,
                  filename: resultBlob.filename,
                }
              : i,
          ),
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Export failed";
        setQueue((q) =>
          q.map((i) =>
            i.id === item.id
              ? { ...i, status: "error", error: msg, progress: 0 }
              : i,
          ),
        );
      }

      doneCount += 1;
      setOverall(doneCount / total);
    }

    setRunning(false);
    setOverall(1);
  }, [
    enabled,
    running,
    queue,
    sourceA,
    targetA,
    retuneStyle,
    bedOn,
    bedLevel,
    format,
    onNeedPro,
    onError,
  ]);

  const downloadZip = async () => {
    const done = queue.filter((i) => i.status === "done" && i.blob && i.filename);
    if (!done.length) {
      onError?.("No completed exports to zip.");
      return;
    }
    const files: Record<string, Uint8Array> = {};
    for (const item of done) {
      const buf = new Uint8Array(await item.blob!.arrayBuffer());
      const name = item.filename || `${item.name}.wav`;
      files[name] = buf;
    }
    const zipped = zipSync(files, { level: 1 });
    const blob = new Blob([zipped.buffer], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `PlayIn432_batch_${Math.round(targetA)}Hz.zip`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  const downloadOne = (item: BatchItem) => {
    if (!item.blob || !item.filename) return;
    const url = URL.createObjectURL(item.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = item.filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  if (!enabled) {
    return (
      <div className="batch-panel batch-locked">
        <Package size={20} />
        <div>
          <h3>Batch export</h3>
          <p>
            Queue an album, set one target frequency, export WAV or MP3 with{" "}
            {BRAND.convertProduct}. <strong>TrueHz Pro</strong> required.
          </p>
          <button type="button" className="btn primary sm" onClick={onNeedPro}>
            Unlock Pro for batch export
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="batch-panel">
      <div className="batch-header">
        <h3>
          <Package size={18} /> Batch export
        </h3>
        <p>
          Target <strong>{targetA} Hz</strong> · {retuneStyle} · format{" "}
          <select
            value={format}
            disabled={running}
            onChange={(e) => setFormat(e.target.value as ExportFormat)}
          >
            <option value="wav">WAV</option>
            <option value="mp3">MP3</option>
          </select>
        </p>
      </div>

      <div className="batch-add">
        <label className="btn sm">
          <Plus size={14} /> Add from library
          <select
            multiple
            size={1}
            value={[]}
            onChange={(e) => {
              const ids = Array.from(e.target.selectedOptions).map((o) => o.value);
              addFromLibrary(ids);
              e.target.selectedIndex = -1;
            }}
          >
            <option value="" disabled>
              Select tracks…
            </option>
            {tracks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="btn primary sm"
          disabled={running || !queue.some((i) => i.status === "pending" || i.status === "error")}
          onClick={() => void runQueue()}
        >
          {running ? (
            <>
              <Loader2 size={14} className="spin" /> Processing…
            </>
          ) : (
            <>
              <Download size={14} /> Run batch
            </>
          )}
        </button>
        <button
          type="button"
          className="btn sm"
          disabled={running || !queue.some((i) => i.status === "done")}
          onClick={() => void downloadZip()}
        >
          Download ZIP
        </button>
        <button
          type="button"
          className="btn ghost sm"
          disabled={running}
          onClick={clearDone}
        >
          Clear done
        </button>
      </div>

      {running && (
        <div className="export-bar batch-overall">
          <div
            className="export-bar-fill"
            style={{ width: `${Math.round(overall * 100)}%` }}
          />
        </div>
      )}

      <ul className="batch-list">
        {queue.length === 0 && (
          <li className="batch-empty">Queue is empty — add library tracks.</li>
        )}
        {queue.map((item) => (
          <li key={item.id} className={`batch-item status-${item.status}`}>
            <div className="batch-item-main">
              <span className="batch-name">{item.name}</span>
              <span className="batch-status">
                {item.status === "pending" && "Pending"}
                {item.status === "processing" &&
                  `Processing ${Math.round(item.progress * 100)}%`}
                {item.status === "done" && "Done"}
                {item.status === "error" && (item.error || "Error")}
              </span>
            </div>
            {item.status === "processing" && (
              <div className="export-bar">
                <div
                  className="export-bar-fill"
                  style={{ width: `${Math.round(item.progress * 100)}%` }}
                />
              </div>
            )}
            <div className="batch-item-actions">
              {item.status === "done" && (
                <button
                  type="button"
                  className="btn ghost sm"
                  onClick={() => downloadOne(item)}
                >
                  <Download size={12} />
                </button>
              )}
              {!running && item.status !== "processing" && (
                <button
                  type="button"
                  className="btn ghost sm"
                  onClick={() => removeItem(item.id)}
                  aria-label="Remove"
                >
                  <Trash2 size={12} />
                </button>
              )}
              {item.status === "error" && (
                <XCircle size={14} className="batch-err-icon" />
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Process one track to blob without triggering browser download. */
async function processOne(opts: {
  arrayBuffer: ArrayBuffer;
  trackName: string;
  sourceA: number;
  targetA: number;
  retuneStyle: "concert" | "reanchor";
  bedOn: boolean;
  bedLevel: number;
  format: ExportFormat;
  onProgress: (f: number) => void;
}): Promise<{ blob: Blob; filename: string }> {
  // Dynamic import full pipeline pieces
  const exp = await import("../lib/exportRetune");

  const ctx = new AudioContext();
  try {
    opts.onProgress(0.02);
    const buffer = await ctx.decodeAudioData(opts.arrayBuffer.slice(0));
    const { buffer: rendered, engine } = await exp.renderRetunedHq(
      buffer,
      opts.sourceA,
      opts.targetA,
      (f) => {
        if (typeof f === "number" && f >= 0) opts.onProgress(Math.min(0.95, f));
      },
      opts.retuneStyle,
    );
    let finalBuf = rendered;
    if (opts.bedOn && opts.bedLevel > 0) {
      finalBuf = exp.mixTrueHzBed(rendered, opts.targetA, opts.bedLevel);
    }
    opts.onProgress(0.97);
    const blob =
      opts.format === "mp3"
        ? await exp.audioBufferToMp3Blob(finalBuf, (f) =>
            opts.onProgress(0.97 + f * 0.03),
          )
        : exp.audioBufferToWavBlob(finalBuf);
    const filename = exp.retunedDownloadName(
      opts.trackName,
      opts.sourceA,
      opts.targetA,
      engine,
      opts.format,
    );
    opts.onProgress(1);
    return { blob, filename };
  } finally {
    await ctx.close();
  }
}
