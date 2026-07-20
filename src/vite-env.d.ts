/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SPOTIFY_CLIENT_ID?: string;
  readonly VITE_SPOTIFY_REDIRECT_URI?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "rubberband-wasm/dist/rubberband.wasm?url" {
  const url: string;
  export default url;
}

declare module "soundtouchjs" {
  export class SoundTouch {
    tempo: number;
    rate: number;
    pitch: number;
    pitchSemitones: number;
    clear(): void;
    process(): void;
  }

  export class WebAudioBufferSource {
    constructor(buffer: AudioBuffer);
    position: number;
    extract(target: Float32Array, numFrames?: number, position?: number): number;
  }

  export class SimpleFilter {
    constructor(
      sourceSound: WebAudioBufferSource,
      pipe: SoundTouch,
      callback?: () => void,
    );
    sourcePosition: number;
    extract(target: Float32Array, numFrames?: number): number;
    clear(): void;
  }

  export class PitchShifter {
    constructor(
      context: AudioContext,
      buffer: AudioBuffer,
      bufferSize: number,
      onEnd?: () => void,
    );
    tempo: number;
    rate: number;
    pitch: number;
    pitchSemitones: number;
    duration: number;
    sampleRate: number;
    timePlayed: number;
    sourcePosition: number;
    readonly formattedDuration: string;
    readonly formattedTimePlayed: string;
    percentagePlayed: number;
    readonly node: AudioNode;
    connect(toNode: AudioNode): void;
    disconnect(): void;
    on(
      eventName: "play",
      cb: (detail: {
        timePlayed: number;
        formattedTimePlayed: string;
        percentagePlayed: number;
      }) => void,
    ): void;
    off(eventName?: string | null): void;
  }
}
