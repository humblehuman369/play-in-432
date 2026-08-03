import { describe, it, expect } from "vitest";
import { retunedDownloadName } from "../../src/lib/exportRetune";

/**
 * Filename tagging: HQ-engine exports carry the "TrueHz-HQ" tag; only the
 * SoundTouch fallback is tagged "preview". Format drives the extension.
 */
describe("retunedDownloadName", () => {
  it("tags the HQ engine output TrueHz-HQ", () => {
    expect(retunedDownloadName("Song", 440, 432, "rubberband", "wav")).toBe(
      "Song_A440-A432_TrueHz-HQ.wav",
    );
  });

  it("tags the SoundTouch fallback preview", () => {
    expect(retunedDownloadName("Song", 440, 432, "soundtouch", "wav")).toBe(
      "Song_A440-A432_preview.wav",
    );
  });

  it("uses the mp3 extension for mp3 exports", () => {
    expect(retunedDownloadName("Song", 440, 528, "rubberband", "mp3")).toBe(
      "Song_A440-A528_TrueHz-HQ.mp3",
    );
  });

  it("rounds source/target Hz into the filename", () => {
    expect(retunedDownloadName("Song", 440.4, 431.6, "rubberband", "wav")).toBe(
      "Song_A440-A432_TrueHz-HQ.wav",
    );
  });

  it("sanitises the track name into a safe stem", () => {
    const name = retunedDownloadName("My / Song?", 440, 432, "soundtouch", "wav");
    expect(name.endsWith("_A440-A432_preview.wav")).toBe(true);
    expect(name).not.toMatch(/[/?]/);
  });
});
