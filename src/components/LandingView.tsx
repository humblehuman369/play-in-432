import { useState } from "react";
import {
  BookOpen,
  Check,
  Download,
  Lock,
  Music2,
  Play,
  Shield,
  Sparkles,
  Upload,
  Waves,
  X,
} from "lucide-react";
import { HearTheDifference } from "./HearTheDifference";
import { PricingSection } from "./PricingSection";
import { BRAND } from "../lib/brand";
import { LANDING_TONES, formatHz } from "../lib/frequencies";
import { canUseTargetHz } from "../lib/pro";

type Props = {
  onOpenPlayer: () => void;
  onUploadClick: () => void;
  /** Apply a target concert A and open the player */
  onPickFrequency?: (hz: number) => void;
  onOpenLearn?: () => void;
  onUpgrade?: (opts?: { tier?: "lite" | "pro"; gift?: boolean }) => void;
  onRestore?: () => void;
  onRestoreAccess?: (input: {
    email?: string;
    sessionId?: string;
  }) => Promise<boolean>;
  isPro?: boolean;
  tier?: "free" | "lite" | "pro";
  checkoutBusy?: boolean;
  checkoutError?: string | null;
  nativeBilling?: boolean;
  dragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  importing?: boolean;
};

const OFFERS = [
  {
    icon: Music2,
    title: "Your music, retuned live",
    body: "Drop MP3, WAV, FLAC, M4A, OGG. Hear A=440 → A=432 (or 528, custom) as it plays — tempo held, originals untouched.",
  },
  {
    icon: Download,
    title: "TrueHz Convert · HQ export",
    body: "Need a file for other apps? Download high-quality offline WAV with Rubber Band — not a cheap real-time dump.",
  },
  {
    icon: Lock,
    title: "Private by design",
    body: "Files stay on your device (IndexedDB). No account. No upload server for your library. Spotify is metadata-only.",
  },
  {
    icon: BookOpen,
    title: "Honest science",
    body: "Learn what the ratio actually is — and what we will never claim. No DNA repair. No “pure 432 masters.”",
  },
] as const;

const STEPS = [
  {
    n: "1",
    title: "Drop a track",
    body: "Your files. Your library. Import once — it stays in the browser until you delete it.",
  },
  {
    n: "2",
    title: "Pick source → target",
    body: "Presets for 440→432, 528, reverse, or dial custom concert A. Re-anchor or full ratio.",
  },
  {
    n: "3",
    title: "Listen or export HQ",
    body: "Play retuned live. Optional pure-tone bed. Download HQ WAV when you want TrueHz Convert quality offline.",
  },
] as const;

const FOR = [
  "You own the files (or ripped them legally) and want 432 listening",
  "You’re tired of “magic Spotify 432” apps that overpromise",
  "You care about pitch accuracy and honest claims",
  "You want private, browser-first — no new account",
] as const;

const NOT_FOR = [
  "Streaming Spotify/YouTube audio retuned inside their apps",
  "Medical or “healing frequency” guarantees",
  "Zero-artifact magic (real-time DSP has limits — HQ export is better)",
] as const;

const FAQS = [
  {
    q: "Does this stream Spotify in 432?",
    a: "No. Spotify Web API is used only for playlist metadata so you can match titles against music you already imported. We never stream or retune Spotify’s audio.",
  },
  {
    q: "Is my music uploaded?",
    a: "No. Decoding, retune, and library storage run in your browser. Files don’t go to our servers for playback.",
  },
  {
    q: "What is TrueHz™?",
    a: "TrueHz is the precision retune layer: accurate source→target ratios, pure-tone bed integrity, and TrueHz Convert (Rubber Band) for high-quality offline WAV export.",
  },
  {
    q: "440 to 432 — how far is that?",
    a: "About −31.8 cents (ratio 432/440). Tempo can stay the same with pitch-preserving stretch. Open Learn for the full math.",
  },
] as const;

export function LandingView({
  onOpenPlayer,
  onUploadClick,
  onPickFrequency,
  onOpenLearn,
  onUpgrade,
  onRestore,
  onRestoreAccess,
  isPro,
  tier = "free",
  checkoutBusy,
  checkoutError,
  nativeBilling,
  dragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  importing,
}: Props) {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="landing">
      <nav className="landing-nav" aria-label="Landing">
        <div className="landing-nav-brand">
          <div className="brand-mark landing-mark">
            <Waves size={20} strokeWidth={2.25} />
          </div>
          <div>
            <strong>{BRAND.product}</strong>
            <span className="landing-nav-tech">{BRAND.techMark}</span>
          </div>
        </div>
        <div className="landing-nav-actions">
          <button type="button" className="btn ghost sm" onClick={onOpenPlayer}>
            Open player
          </button>
          <button type="button" className="btn primary sm" onClick={onUploadClick}>
            <Upload size={15} />
            Drop music
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section className="landing-hero">
        <div className="landing-hero-art" aria-hidden>
          <img
            src="/hero-wave.jpg"
            alt=""
            className="landing-hero-img"
            width={1920}
            height={1080}
            decoding="async"
            fetchPriority="high"
          />
          <div className="landing-hero-fade" />
        </div>

        <div className="landing-hero-copy">
          <p className="landing-kicker">
            <Sparkles size={14} />
            Real retune · Honest claims · Private by default
          </p>
          <h1 className="landing-title">
            Your music.
            <br />
            <span className="landing-title-accent">Retuned to 432.</span>
          </h1>
          <p className="landing-lead">
            {BRAND.product} is a browser player for{" "}
            <strong>music you already own</strong>. Retune live with{" "}
            {BRAND.techMark} technology — A=440 →{" "}
            <span className="gold-hz">A=432</span>, 528, or custom — without
            uploading your library or pretending we stream Spotify in “pure 432.”
          </p>

          <div
            className={`landing-drop ${dragOver ? "over" : ""}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={onUploadClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") onUploadClick();
            }}
          >
            <Upload size={26} className="drop-icon" />
            <h2>
              {importing ? "Importing…" : "Drop a track to hear the difference"}
            </h2>
            <p>MP3 · WAV · FLAC · M4A · OGG — stays on this device</p>
          </div>

          <div className="landing-cta-row">
            <button
              type="button"
              className="btn primary lg"
              onClick={onUploadClick}
            >
              <Play size={18} />
              Start free — no account
            </button>
            <button type="button" className="btn ghost lg" onClick={onOpenPlayer}>
              Explore the player
            </button>
          </div>

          <ul className="landing-trust" aria-label="Trust points">
            <li>
              <Shield size={14} /> Free · no sign-up
            </li>
            <li>
              <Lock size={14} /> Files never leave your device
            </li>
            <li>
              <Check size={14} /> Powered by {BRAND.techMark}
            </li>
          </ul>
        </div>
      </section>

      {/* WHO */}
      <section className="landing-section">
        <h2 className="landing-h2">Built for listeners who want the truth</h2>
        <p className="landing-section-lead">
          If you’ve been sold “432 on every streaming app with zero catch,” this
          is the opposite: precise, private, and clear about limits.
        </p>
        <div className="landing-split">
          <div className="landing-card yes">
            <h3>
              <Check size={16} /> Perfect if…
            </h3>
            <ul>
              {FOR.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          <div className="landing-card no">
            <h3>
              <X size={16} /> Not for…
            </h3>
            <ul>
              {NOT_FOR.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* FREQUENCIES / BENEFITS */}
      <section className="landing-section landing-tones" id="frequencies">
        <p className="landing-section-kicker">Frequencies you can tune to</p>
        <h2 className="landing-h2">Ten tones to shape how you listen</h2>
        <p className="landing-section-lead">
          Each target sets a <strong>concert-reference retune</strong> for your
          own files (TrueHz ratio from Source A). Labels below are{" "}
          <strong>traditional associations</strong> people use — not medical
          claims, and not a promise that a mixed song becomes “pure X Hz.”
        </p>
        {onOpenLearn && (
          <div className="landing-tones-actions">
            <button type="button" className="btn ghost sm" onClick={onOpenLearn}>
              What does retune actually mean? →
            </button>
          </div>
        )}
        <div className="landing-tone-grid">
          {LANDING_TONES.map((tone) => {
            const featured = tone.featured;
            const locked = !canUseTargetHz(tone.hz);
            return (
              <button
                key={tone.hz}
                type="button"
                className={`landing-tone-card ${featured ? "featured" : ""} ${locked ? "locked" : ""}`}
                onClick={() => {
                  if (onPickFrequency) onPickFrequency(tone.hz);
                  else onOpenPlayer();
                }}
              >
                <span className="landing-tone-hz">
                  {formatHz(tone.hz)}
                  <small>Hz</small>
                  {locked && <small className="tone-pro-tag">Pro</small>}
                </span>
                <span className="landing-tone-name">{tone.name}</span>
                <span className="landing-tone-body">
                  {tone.association ?? tone.note}
                </span>
                <span className="landing-tone-cta">
                  {locked ? "Unlock with Pro →" : "Try as target →"}
                </span>
              </button>
            );
          })}
        </div>
        <p className="landing-tones-disclaimer">
          Honest note: retuning shifts the whole mix by a pitch ratio. It does
          not insert a continuous pure tone at that Hz (use the optional TrueHz
          bed if you want an exact sine). Benefits are personal preference —
          switch anytime.
        </p>
      </section>

      {/* OFFER */}
      <section className="landing-section">
        <h2 className="landing-h2">What you get</h2>
        <div className="landing-features">
          {OFFERS.map(({ icon: Icon, title, body }) => (
            <article key={title} className="landing-feature">
              <div className="landing-feature-icon">
                <Icon size={18} />
              </div>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* STEPS */}
      <section className="landing-section">
        <h2 className="landing-h2">Three steps</h2>
        <ol className="landing-steps">
          {STEPS.map((s) => (
            <li key={s.n}>
              <span className="landing-step-n">{s.n}</span>
              <div>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* VS */}
      <section className="landing-section landing-vs">
        <h2 className="landing-h2">Not another “retunes Spotify for free” app</h2>
        <p className="landing-section-lead">
          Many 432 apps pitch-shift tab audio or radio streams and market it as
          magic. We do one job exceptionally well:{" "}
          <strong>your files, accurate retune, honest labels</strong>.
        </p>
        <div className="landing-compare">
          <div>
            <h3>Them (typical)</h3>
            <ul>
              <li>Browser extension / radio catalog focus</li>
              <li>“Spotify · YouTube · Apple Music” as audio sources</li>
              <li>“No quality loss” as a slogan</li>
              <li>Healing / solfeggio hype mixed with product</li>
            </ul>
          </div>
          <div className="landing-compare-us">
            <h3>{BRAND.product}</h3>
            <ul>
              <li>Local library player first</li>
              <li>Spotify = playlist match to <em>your</em> files only</li>
              <li>Live play + optional HQ Rubber Band export</li>
              <li>Learn tab with claims we reject</li>
            </ul>
          </div>
        </div>
      </section>

      {/* DEMO */}
      <section className="landing-section">
        <h2 className="landing-h2">Hear the difference</h2>
        <p className="landing-section-lead">
          Pure A4 tones — source concert pitch vs target. Headphones help. This
          is the same ratio applied to your music.
        </p>
        <div className="landing-demo-grid">
          <div className="landing-demo-art" aria-hidden>
            <img
              src="/hero-rings.jpg"
              alt=""
              className="landing-rings-img"
              width={1200}
              height={900}
              loading="lazy"
              decoding="async"
            />
          </div>
          <div className="landing-demo-wrap">
            <HearTheDifference
              sourceA={440}
              targetA={432}
              retuneStyle="concert"
            />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="landing-section">
        <h2 className="landing-h2">Questions</h2>
        <div className="landing-faq">
          {FAQS.map((item, i) => {
            const open = openFaq === i;
            return (
              <div key={item.q} className={`landing-faq-item ${open ? "open" : ""}`}>
                <button
                  type="button"
                  className="landing-faq-q"
                  aria-expanded={open}
                  onClick={() => setOpenFaq(open ? null : i)}
                >
                  {item.q}
                  <span aria-hidden>{open ? "−" : "+"}</span>
                </button>
                {open && <p className="landing-faq-a">{item.a}</p>}
              </div>
            );
          })}
        </div>
      </section>

      {/* PRICING */}
      {onUpgrade && (
        <PricingSection
          tier={tier}
          isPro={Boolean(isPro)}
          checkoutBusy={checkoutBusy}
          checkoutError={checkoutError}
          onUpgrade={onUpgrade}
          onRestore={onRestore}
          onRestoreAccess={onRestoreAccess}
          nativeBilling={nativeBilling}
        />
      )}

      {/* FINAL CTA */}
      <section className="landing-final">
        <h2>Ready when you are</h2>
        <p>
          No account. No waitlist. Drop a song you love and hear it retuned with{" "}
          {BRAND.techMark}.
        </p>
        <div className="landing-cta-row">
          <button type="button" className="btn primary lg" onClick={onUploadClick}>
            <Upload size={18} />
            Drop music now
          </button>
          <button type="button" className="btn ghost lg" onClick={onOpenPlayer}>
            Open full player
          </button>
        </div>
        <p className="landing-final-foot">{BRAND.footer}</p>
      </section>
    </div>
  );
}
