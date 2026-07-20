/**
 * Optional full-width player bar (not used by default shell;
 * kept for embedding in other layouts).
 */
import {
  Music2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
} from "lucide-react";
import type { PlayMode } from "../lib/playerEngine";
import type { PlayerSettings, TrackMeta } from "../lib/types";
import {
  centsBetween,
  formatCents,
  formatTime,
} from "../lib/retune";

type Props = {
  track: TrackMeta | null;
  playing: boolean;
  loading: boolean;
  timePlayed: number;
  duration: number;
  percent: number;
  settings: PlayerSettings;
  onToggle: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeek: (percent: number) => void;
  onVolume: (v: number) => void;
  onMode: (m: PlayMode) => void;
  onShuffle: (on: boolean) => void;
  onCycleRepeat: () => void;
  onBedOn: (on: boolean) => void;
  onBedLevel: (v: number) => void;
};

export function PlayerBar({
  track,
  playing,
  loading,
  timePlayed,
  duration,
  percent,
  settings,
  onToggle,
  onPrev,
  onNext,
  onSeek,
  onVolume,
  onMode,
  onShuffle,
  onCycleRepeat,
  onBedOn,
  onBedLevel,
}: Props) {
  const RepeatIcon = settings.repeat === "one" ? Repeat1 : Repeat;
  const cents = centsBetween(settings.sourceA, settings.targetA);

  return (
    <footer className="player-bar">
      <div className="pb-track">
        <div className={`art sm ${playing ? "pulse" : ""}`}>
          <Music2 size={20} />
        </div>
        <div className="pb-meta">
          <div className="pb-title">{track?.name ?? "Nothing playing"}</div>
          <div className="pb-sub">
            {track
              ? settings.mode === "retuned"
                ? `A=${Math.round(settings.sourceA)} → A=${Math.round(settings.targetA)} · ${formatCents(cents)}`
                : "Original pitch"
              : "Pick a track from your library"}
          </div>
        </div>
      </div>

      <div className="pb-center">
        <div className="pb-controls">
          <button
            type="button"
            className={`icon-btn ghost sm ${settings.shuffle ? "on" : ""}`}
            onClick={() => onShuffle(!settings.shuffle)}
            aria-label="Shuffle"
            title="Shuffle"
          >
            <Shuffle size={16} />
          </button>
          <button
            type="button"
            className="icon-btn ghost"
            onClick={onPrev}
            disabled={!track}
            aria-label="Previous"
          >
            <SkipBack size={18} />
          </button>
          <button
            type="button"
            className="play-btn sm"
            onClick={onToggle}
            disabled={loading}
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause size={20} /> : <Play size={20} className="play-icon" />}
          </button>
          <button
            type="button"
            className="icon-btn ghost"
            onClick={onNext}
            disabled={!track}
            aria-label="Next"
          >
            <SkipForward size={18} />
          </button>
          <button
            type="button"
            className={`icon-btn ghost sm ${settings.repeat !== "off" ? "on" : ""}`}
            onClick={onCycleRepeat}
            aria-label={`Repeat: ${settings.repeat}`}
            title={`Repeat: ${settings.repeat}`}
          >
            <RepeatIcon size={16} />
          </button>
        </div>
        <div className="seek-row compact">
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
      </div>

      <div className="pb-right">
        <div className="mode-toggle compact" role="group" aria-label="Pitch mode">
          <button
            type="button"
            className={settings.mode === "original" ? "active" : ""}
            onClick={() => onMode("original")}
          >
            Orig
          </button>
          <button
            type="button"
            className={settings.mode === "retuned" ? "active" : ""}
            onClick={() => onMode("retuned")}
          >
            Retune
          </button>
        </div>
        <div className="volume-row compact">
          <Volume2 size={15} />
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={settings.volume}
            onChange={(e) => onVolume(Number(e.target.value))}
            aria-label="Volume"
          />
        </div>
        <label className="bed-mini" title="Mix a pure sine under the track">
          <input
            type="checkbox"
            checked={settings.bedOn}
            onChange={(e) => onBedOn(e.target.checked)}
          />
          <span>Bed</span>
        </label>
        {settings.bedOn && (
          <input
            type="range"
            className="bed-slider"
            min={0}
            max={0.2}
            step={0.005}
            value={settings.bedLevel}
            onChange={(e) => onBedLevel(Number(e.target.value))}
            aria-label="Bed level"
          />
        )}
      </div>
    </footer>
  );
}
