/**
 * Type declarations for the "signalsmith-stretch" npm package (v1.3.x),
 * which ships no types. API per the package README (official Signalsmith
 * Audio Web Audio release, MIT).
 *
 * Place at: src/types/signalsmith-stretch.d.ts
 * (Ensure tsconfig "include" covers src — it already does in this repo.)
 */
declare module "signalsmith-stretch" {
  export interface StretchScheduleOptions {
    /** AudioContext time (seconds) for this change. Node compensates its own latency. */
    output?: number;
    /** Whether the node is processing audio. */
    active?: boolean;
    /** Position in the input buffer, seconds. Ignored in live-input mode. */
    input?: number;
    /** Playback rate; 1 = original speed/duration. */
    rate?: number;
    /** Pitch shift in semitones. Fractional values are supported. */
    semitones?: number;
    /** Tonality limit in Hz (default 8000). */
    tonalityHz?: number;
    formantSemitones?: number;
    formantCompensation?: boolean;
    /** Rough fundamental for formant analysis, or 0 for pitch-tracking. */
    formantBaseHz?: number;
    loopStart?: number;
    loopEnd?: number;
  }

  export interface StretchConfigureOptions {
    blockMs?: number | null;
    intervalMs?: number;
    splitComputation?: boolean;
    preset?: "default" | "cheaper";
  }

  export interface SignalsmithStretchNode extends AudioWorkletNode {
    schedule(opts: StretchScheduleOptions): void;
    /** AudioBufferSourceNode-like start. */
    start(when?: number, offset?: number, duration?: number): void;
    stop(when?: number): void;
    /**
     * Append sample buffers (one Float32Array per channel, equal lengths).
     * Resolves to the new input-buffer end time in seconds.
     */
    addBuffers(buffers: Float32Array[]): Promise<number>;
    dropBuffers(
      toSeconds?: number,
    ): Promise<{ start: number; end: number } | void>;
    /** Live-input latency in seconds; also a good schedule-ahead margin. */
    latency(): number;
    configure(opts: StretchConfigureOptions): void;
    readonly inputTime: number;
    setUpdateInterval(seconds: number, callback?: () => void): void;
  }

  /**
   * Registers the worklet on the given context and resolves when the
   * node is ready. Works with both AudioContext and OfflineAudioContext.
   */
  export default function SignalsmithStretch(
    context: BaseAudioContext,
    channelOptions?: Partial<AudioWorkletNodeOptions>,
  ): Promise<SignalsmithStretchNode>;
}
