import { Moon } from "lucide-react";
import { SLEEP_TIMER_PRESETS_MIN } from "../lib/frequencies";
import { formatTime } from "../lib/retune";

type Props = {
  /** Seconds remaining, or null if off */
  remainingSec: number | null;
  /** Active preset minutes (for chip highlight) */
  activeMinutes: number | null;
  onSetMinutes: (minutes: number | null) => void;
};

export function SleepTimer({
  remainingSec,
  activeMinutes,
  onSetMinutes,
}: Props) {
  const active = remainingSec != null && remainingSec > 0;

  return (
    <section className="sleep-timer card-block">
      <div className="sleep-timer-title">
        <Moon size={16} />
        <h3>Sleep timer</h3>
        {active && remainingSec != null && (
          <span className="sleep-timer-remaining" aria-live="polite">
            {formatTime(remainingSec)} left · fades out
          </span>
        )}
      </div>
      <div className="sleep-timer-presets">
        <button
          type="button"
          className={`chip ${!active ? "on" : ""}`}
          onClick={() => onSetMinutes(null)}
        >
          Off
        </button>
        {SLEEP_TIMER_PRESETS_MIN.map((m) => (
          <button
            key={m}
            type="button"
            className={`chip ${active && activeMinutes === m ? "on" : ""}`}
            onClick={() => onSetMinutes(m)}
          >
            {m} min
          </button>
        ))}
      </div>
      <p className="sleep-timer-note">
        Pauses playback when time is up. Volume fades in the last ~20 seconds
        (your saved volume is restored).
      </p>
    </section>
  );
}
