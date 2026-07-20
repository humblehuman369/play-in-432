/**
 * TrueHz Convert engine — Rubber Band offline pitch-shift (Web Worker).
 * Same concert-pitch ratio as live preview; higher music quality for download.
 */
import {
  RubberBandInterface,
  RubberBandOption,
} from "rubberband-wasm";
import wasmUrl from "rubberband-wasm/dist/rubberband.wasm?url";

export type RubberBandWorkerIn = {
  type: "process";
  channelBuffers: Float32Array[];
  sampleRate: number;
  /** Pitch scale = targetA / sourceA (e.g. 432/440). */
  pitchScale: number;
  /** Time ratio; 1.0 keeps duration (TrueHz Convert default). */
  timeRatio?: number;
};

export type RubberBandWorkerOut =
  | { type: "ready" }
  | { type: "status"; status: string }
  | { type: "progress"; progress: number }
  | { type: "done"; channelBuffers: Float32Array[] }
  | { type: "error"; message: string };

let rbApi: RubberBandInterface | null = null;

const HQ_OPTIONS =
  RubberBandOption.RubberBandOptionProcessOffline |
  RubberBandOption.RubberBandOptionPitchHighQuality |
  RubberBandOption.RubberBandOptionEngineFiner |
  RubberBandOption.RubberBandOptionFormantPreserved |
  RubberBandOption.RubberBandOptionChannelsTogether |
  RubberBandOption.RubberBandOptionThreadingNever |
  RubberBandOption.RubberBandOptionStretchPrecise;

async function ensureApi(): Promise<RubberBandInterface> {
  if (rbApi) return rbApi;
  const response = await fetch(wasmUrl);
  if (!response.ok) {
    throw new Error(`Failed to load Rubber Band WASM (${response.status})`);
  }
  const wasm = await WebAssembly.compileStreaming(response);
  rbApi = await RubberBandInterface.initialize(wasm);
  return rbApi;
}

function post(msg: RubberBandWorkerOut) {
  self.postMessage(msg);
}

function processPitchShift(
  api: RubberBandInterface,
  channelBuffers: Float32Array[],
  sampleRate: number,
  pitchScale: number,
  timeRatio: number,
): Float32Array[] {
  const channels = channelBuffers.length;
  const inputFrames = channelBuffers[0]?.length ?? 0;
  if (channels < 1 || inputFrames < 1) {
    throw new Error("No audio data to process");
  }

  const expectedOut = Math.max(
    1,
    Math.ceil(inputFrames * timeRatio) + 8192,
  );
  const outputBuffers = Array.from(
    { length: channels },
    () => new Float32Array(expectedOut),
  );

  const state = api.rubberband_new(
    sampleRate,
    channels,
    HQ_OPTIONS,
    timeRatio,
    pitchScale,
  );

  try {
    api.rubberband_set_pitch_scale(state, pitchScale);
    api.rubberband_set_time_ratio(state, timeRatio);
    api.rubberband_set_expected_input_duration(state, inputFrames);

    const samplesRequired = Math.max(
      64,
      api.rubberband_get_samples_required(state),
    );

    const channelArrayPtr = api.malloc(channels * 4);
    const channelDataPtr: number[] = [];
    for (let c = 0; c < channels; c++) {
      const bufferPtr = api.malloc(samplesRequired * 4);
      channelDataPtr.push(bufferPtr);
      api.memWritePtr(channelArrayPtr + c * 4, bufferPtr);
    }

    let lastReport = 0;
    const report = (p: number) => {
      const now = Date.now();
      if (now - lastReport > 80) {
        post({ type: "progress", progress: Math.min(0.99, p) });
        lastReport = now;
      }
    };

    // Study pass (offline)
    post({ type: "status", status: "Analyzing (TrueHz Convert)…" });
    let read = 0;
    while (read < inputFrames) {
      report((read / inputFrames) * 0.12);
      const remaining = Math.min(samplesRequired, inputFrames - read);
      for (let c = 0; c < channels; c++) {
        api.memWrite(
          channelDataPtr[c],
          channelBuffers[c].subarray(read, read + remaining),
        );
      }
      read += remaining;
      const isFinal = read >= inputFrames ? 1 : 0;
      api.rubberband_study(state, channelArrayPtr, remaining, isFinal);
    }

    // Process + retrieve
    post({ type: "status", status: "Pitch-shifting (Rubber Band HQ)…" });
    read = 0;
    let write = 0;

    const ensureCapacity = (need: number) => {
      if (need <= outputBuffers[0].length) return;
      const next = Math.ceil(need * 1.5);
      for (let c = 0; c < channels; c++) {
        const grown = new Float32Array(next);
        grown.set(outputBuffers[c]);
        outputBuffers[c] = grown;
      }
    };

    const tryRetrieve = (final: boolean) => {
      while (true) {
        const available = api.rubberband_available(state);
        if (available < 1) break;
        if (!final && available < samplesRequired) break;
        const take = Math.min(samplesRequired, available);
        const recv = api.rubberband_retrieve(state, channelArrayPtr, take);
        if (recv < 1) break;
        ensureCapacity(write + recv);
        for (let c = 0; c < channels; c++) {
          const chunk = api.memReadF32(channelDataPtr[c], recv);
          outputBuffers[c].set(chunk, write);
        }
        write += recv;
      }
    };

    while (read < inputFrames) {
      report(0.12 + (read / inputFrames) * 0.86);
      const remaining = Math.min(samplesRequired, inputFrames - read);
      for (let c = 0; c < channels; c++) {
        api.memWrite(
          channelDataPtr[c],
          channelBuffers[c].subarray(read, read + remaining),
        );
      }
      read += remaining;
      const isFinal = read >= inputFrames ? 1 : 0;
      api.rubberband_process(state, channelArrayPtr, remaining, isFinal);
      tryRetrieve(false);
    }
    tryRetrieve(true);

    for (const ptr of channelDataPtr) api.free(ptr);
    api.free(channelArrayPtr);

    // Trim to actual output length
    const frames = Math.max(1, write);
    return outputBuffers.map((buf) => buf.subarray(0, frames));
  } finally {
    api.rubberband_delete(state);
  }
}

void (async () => {
  try {
    await ensureApi();
    post({ type: "ready" });
  } catch (e) {
    post({
      type: "error",
      message:
        e instanceof Error
          ? e.message
          : "Failed to initialize Rubber Band WASM",
    });
  }
})();

self.onmessage = (e: MessageEvent<RubberBandWorkerIn>) => {
  const data = e.data;
  if (!data || data.type !== "process") return;

  void (async () => {
    try {
      const api = await ensureApi();
      const timeRatio = data.timeRatio ?? 1;
      const outs = processPitchShift(
        api,
        data.channelBuffers,
        data.sampleRate,
        data.pitchScale,
        timeRatio,
      );
      post({ type: "progress", progress: 1 });
      // Transfer ownership of buffers back to main thread
      const transfer = outs.map((b) => b.buffer);
      (self as unknown as Worker).postMessage(
        { type: "done", channelBuffers: outs } satisfies RubberBandWorkerOut,
        transfer as unknown as Transferable[],
      );
    } catch (err) {
      post({
        type: "error",
        message:
          err instanceof Error
            ? err.message
            : "Rubber Band processing failed",
      });
    }
  })();
};
