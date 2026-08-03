import { useState } from "react";
import {
  BookOpen,
  Check,
  Download,
  FolderOpen,
  ListMusic,
  Lock,
  Music2,
  Play,
  Shield,
  Sparkles,
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
  /** Open Playlists tab (import M3U / local list) */
  onOpenPlaylists?: () => void;
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
    body: "Need a file for other apps? Download high-quality offline WAV with TrueHz Convert — not a cheap real-time dump.",
  },
  {
    icon: Lock,
    title: "Private by design",
    body: "Files stay on your device (IndexedDB). No account. No upload server for your library.",
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
    title: "Add your music",
    body: "Import files from your phone or computer, or match an M3U playlist against songs you already own.",
  },
  {
    n: "2",
    title: "Choose 432 (or another target)",
    body: "One tap for A=440 → A=432. Or try 528, Solfeggio, and custom targets when you upgrade.",
  },
  {
    n: "3",
    title: "Listen — export if you need a file",
    body: "Hear the retune live. Download HQ WAV/MP3 when you want the file offline.",
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
    a: "No — and it can’t. Streaming services are DRM-locked, so their audio can’t be retuned. Play In 432 only retunes files you own: buy DRM-free downloads (iTunes Store, Amazon MP3, Bandcamp), then import them.",
  },
  {
    q: "Is my music uploaded?",
    a: "No. Decoding, retune, and library storage run in your browser. Files don’t go to our servers for playback.",
  },
  {
    q: "What is TrueHz™?",
    a: "TrueHz is the precision retune layer: accurate source→target ratios, pure-tone bed integrity, and TrueHz Convert for high-quality offline WAV export.",
  },
  {
    q: "440 to 432 — how far is that?",
    a: "About −31.8 cents (ratio 432/440). Tempo can stay the same with pitch-preserving stretch. Open Learn for the full math.",
  },
] as const;

export function LandingView({
  onOpenPlayer,
  onUploadClick,
  onOpenPlaylists,
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
  const openPlaylists = onOpenPlaylists ?? onOpenPlayer;

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
            <FolderOpen size={15} />
            Add music
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
            Private player · Free 432 listening · No account
          </p>
          <h1 className="landing-title">
            Your music.
            <br />
            <span className="landing-title-accent">Retuned to 432.</span>
          </h1>
          <p className="landing-lead">
            Add songs you already own, retune them live to{" "}
            <span className="gold-hz">A=432</span> (or other targets), and play
            privately on this device. We never stream Spotify audio — Play In
            432 retunes only the files you own and import.
          </p>

          <p className="landing-start-label">How do you want to start?</p>
          <div
            className={`landing-start-grid ${dragOver ? "drag-over" : ""}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            <button
              type="button"
              className="landing-start-card landing-start-primary"
              onClick={onUploadClick}
              disabled={importing}
            >
              <span className="landing-start-icon" aria-hidden>
                <FolderOpen size={22} />
              </span>
              <span className="landing-start-title">
                {importing ? "Importing…" : "Add music files"}
              </span>
              <span className="landing-start-desc">
                From your phone or computer — MP3, WAV, FLAC, M4A. Stays on
                this device.
              </span>
              <span className="landing-start-hint">
                Tip: on a computer you can also drag files onto this page
              </span>
            </button>

            <button
              type="button"
              className="landing-start-card"
              onClick={openPlaylists}
            >
              <span className="landing-start-icon" aria-hidden>
                <ListMusic size={22} />
              </span>
              <span className="landing-start-title">Import a playlist</span>
              <span className="landing-start-desc">
                Bring an M3U or build lists inside the app after you add
                tracks.
              </span>
            </button>
          </div>

          <div className="landing-cta-row landing-cta-secondary">
            <button type="button" className="btn ghost" onClick={onOpenPlayer}>
              <Play size={16} />
              Skip to player
            </button>
          </div>

          <ul className="landing-trust" aria-label="Trust points">
            <li>
              <Shield size={14} /> Free · no sign-up
            </li>
            <li>
              <Lock size={14} /> Files stay on your device
            </li>
            <li>
              <Check size={14} /> {BRAND.techMark} retune
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
              <li>M3U playlist match to <em>your</em> files only</li>
              <li>Live play + optional HQ TrueHz Convert export</li>
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
          No account. Add a few tracks you love — or match a playlist — and hear
          them retuned with {BRAND.techMark}.
        </p>
        <div className="landing-cta-row">
          <button type="button" className="btn primary lg" onClick={onUploadClick}>
            <FolderOpen size={18} />
            Add music
          </button>
          <button type="button" className="btn ghost lg" onClick={onOpenPlayer}>
            Open player
          </button>
        </div>
        <p className="landing-final-foot">{BRAND.footer}</p>
      </section>
    </div>
  );
}
