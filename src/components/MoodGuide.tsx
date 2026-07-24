import { Sparkles } from "lucide-react";
import { MOOD_GUIDES, formatHz } from "../lib/frequencies";

type Props = {
  targetA: number;
  onPick: (hz: number) => void;
};

export function MoodGuide({ targetA, onPick }: Props) {
  return (
    <section className="mood-guide card-block">
      <div className="mood-guide-title">
        <Sparkles size={16} />
        <h3>How do you want it to feel?</h3>
      </div>
      <p className="mood-guide-lead">
        Preference shortcuts — not medical advice. Each sets a concert-reference
        target (TrueHz ratio retune from your Source A).
      </p>
      <div className="mood-grid">
        {MOOD_GUIDES.map((m) => {
          const on = Math.abs(targetA - m.hz) < 0.5;
          return (
            <button
              key={m.id}
              type="button"
              className={`mood-card ${on ? "on" : ""}`}
              onClick={() => onPick(m.hz)}
            >
              <span className="mood-card-mood">{m.mood}</span>
              <span className="mood-card-hz">{formatHz(m.hz)} Hz</span>
              <span className="mood-card-blurb">{m.blurb}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
