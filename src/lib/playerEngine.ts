import { PitchShifter } from "soundtouchjs";
import type { PlayMode, RetuneStyle } from "./types";
import { clampPitchA, effectivePitchRatio } from "./retune";

export type { PlayMode };

export type ProgressDetail = {
  timePlayed: number;
  duration: number;
  percentagePlayed: number;
};

type EngineCallbacks = {
  onProgress?: (d: ProgressDetail) => void;
  onEnded?: () => void;
};

/**
 * Web Audio player that can retune by concert-pitch or Solfeggio
 * re-anchor ratio while keeping tempo ≈ 1 (SoundTouch).
 */
export class PlayerEngine {
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private bedGain: GainNode | null = null;
  private bedOsc: OscillatorNode | null = null;
  private shifter: PitchShifter | null = null;
  private buffer: AudioBuffer | null = null;
  private playing = false;
  private mode: PlayMode = "retuned";
  private retuneStyle: RetuneStyle = "reanchor";
  private sourceA = 440;
  private targetA = 432;
  private volume = 0.85;
  private bedEnabled = false;
  private bedLevel = 0.08;
  private callbacks: EngineCallbacks = {};
  private bufferSize = 8192;

  setCallbacks(cb: EngineCallbacks) {
    this.callbacks = cb;
  }

  get isPlaying() {
    return this.playing;
  }

  get duration() {
    return this.buffer?.duration ?? 0;
  }

  get hasBuffer() {
    return this.buffer != null;
  }

  /** Current decoded buffer (for analysis/export helpers). */
  getBuffer(): AudioBuffer | null {
    return this.buffer;
  }

  get playMode() {
    return this.mode;
  }

  get currentRatio() {
    return this.mode === "retuned"
      ? effectivePitchRatio(this.sourceA, this.targetA, this.retuneStyle)
      : 1;
  }

  private ensureContext() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.gain = this.ctx.createGain();
      this.gain.gain.value = this.volume;
      this.gain.connect(this.ctx.destination);

      this.bedGain = this.ctx.createGain();
      this.bedGain.gain.value = 0;
      this.bedGain.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  async resume() {
    const ctx = this.ensureContext();
    if (ctx.state === "suspended") await ctx.resume();
  }

  async loadArrayBuffer(data: ArrayBuffer) {
    const ctx = this.ensureContext();
    await this.resume();
    this.stopInternal(false);
    this.buffer = await ctx.decodeAudioData(data.slice(0));
    this.buildShifter(0);
  }

  private effectivePitch(): number {
    return this.mode === "retuned"
      ? effectivePitchRatio(this.sourceA, this.targetA, this.retuneStyle)
      : 1;
  }

  private buildShifter(startPercent: number) {
    if (!this.ctx || !this.buffer || !this.gain) return;

    if (this.shifter) {
      try {
        this.shifter.off();
        this.shifter.disconnect();
      } catch {
        /* ignore */
      }
      this.shifter = null;
    }

    const onEnd = () => {
      this.playing = false;
      this.callbacks.onEnded?.();
    };

    this.shifter = new PitchShifter(
      this.ctx,
      this.buffer,
      this.bufferSize,
      onEnd,
    );
    this.shifter.tempo = 1;
    this.shifter.pitch = this.effectivePitch();
    if (startPercent > 0) {
      this.shifter.percentagePlayed = Math.min(99.9, Math.max(0, startPercent));
    }

    this.shifter.on("play", (detail) => {
      this.callbacks.onProgress?.({
        timePlayed: detail.timePlayed,
        duration: this.buffer?.duration ?? 0,
        percentagePlayed: detail.percentagePlayed,
      });
    });
  }

  setMode(mode: PlayMode) {
    this.mode = mode;
    if (this.shifter) {
      this.shifter.pitch = this.effectivePitch();
    }
  }

  setRetuneStyle(style: RetuneStyle) {
    this.retuneStyle = style;
    if (this.shifter) {
      this.shifter.pitch = this.effectivePitch();
    }
  }

  setPitchTargets(sourceA: number, targetA: number) {
    this.sourceA = clampPitchA(sourceA);
    this.targetA = clampPitchA(targetA);
    if (this.shifter && this.mode === "retuned") {
      this.shifter.pitch = this.effectivePitch();
    }
    // TrueHz bed = exact labeled/target Hz (not the re-anchored A4)
    if (this.bedOsc) {
      this.bedOsc.frequency.value = this.targetA;
    }
  }

  setVolume(v: number) {
    this.volume = Math.min(1, Math.max(0, v));
    if (this.gain) this.gain.gain.value = this.volume;
  }

  setBedEnabled(on: boolean) {
    this.bedEnabled = on;
    this.syncBed();
  }

  setBedLevel(linear: number) {
    this.bedLevel = Math.min(0.25, Math.max(0, linear));
    if (this.bedGain && this.bedEnabled) {
      this.bedGain.gain.value = this.bedLevel;
    }
  }

  private syncBed() {
    if (!this.ctx || !this.bedGain) return;

    if (this.bedEnabled && this.playing) {
      if (!this.bedOsc) {
        this.bedOsc = this.ctx.createOscillator();
        this.bedOsc.type = "sine";
        this.bedOsc.frequency.value = this.targetA;
        this.bedOsc.connect(this.bedGain);
        this.bedOsc.start();
      } else {
        this.bedOsc.frequency.value = this.targetA;
      }
      this.bedGain.gain.value = this.bedLevel;
    } else {
      this.bedGain.gain.value = 0;
      if (this.bedOsc) {
        try {
          this.bedOsc.stop();
          this.bedOsc.disconnect();
        } catch {
          /* ignore */
        }
        this.bedOsc = null;
      }
    }
  }

  async play() {
    if (!this.buffer || !this.gain) return;
    await this.resume();
    if (!this.shifter) this.buildShifter(0);
    this.shifter!.connect(this.gain);
    this.playing = true;
    this.syncBed();
  }

  pause() {
    if (this.shifter) {
      try {
        this.shifter.disconnect();
      } catch {
        /* ignore */
      }
    }
    this.playing = false;
    this.syncBed();
  }

  async toggle() {
    if (this.playing) this.pause();
    else await this.play();
  }

  /** Seek 0–100 percent of source duration. */
  seekPercent(percent: number) {
    const p = Math.min(100, Math.max(0, percent));
    const wasPlaying = this.playing;
    if (this.shifter) {
      this.shifter.percentagePlayed = p;
      this.callbacks.onProgress?.({
        timePlayed: (p / 100) * (this.buffer?.duration ?? 0),
        duration: this.buffer?.duration ?? 0,
        percentagePlayed: p,
      });
    } else {
      this.buildShifter(p);
    }
    if (wasPlaying && this.gain && this.shifter) {
      try {
        this.shifter.connect(this.gain);
      } catch {
        /* already connected */
      }
    }
  }

  private stopInternal(emit = true) {
    if (this.shifter) {
      try {
        this.shifter.off();
        this.shifter.disconnect();
      } catch {
        /* ignore */
      }
      this.shifter = null;
    }
    this.playing = false;
    this.syncBed();
    if (emit) {
      this.callbacks.onProgress?.({
        timePlayed: 0,
        duration: this.buffer?.duration ?? 0,
        percentagePlayed: 0,
      });
    }
  }

  stop() {
    this.stopInternal(true);
    if (this.buffer) this.buildShifter(0);
  }

  dispose() {
    this.stopInternal(false);
    this.buffer = null;
    if (this.bedOsc) {
      try {
        this.bedOsc.stop();
        this.bedOsc.disconnect();
      } catch {
        /* ignore */
      }
      this.bedOsc = null;
    }
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
      this.gain = null;
      this.bedGain = null;
    }
  }
}
