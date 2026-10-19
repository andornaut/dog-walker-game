import { describe, expect, it } from "vitest";

import { chooseSoundFormat, SOUND_FORMAT_MIME_TYPES } from "./soundFormat";

const browserPlaying =
  (...playable: string[]) =>
  (mimeType: string) =>
    playable.includes(mimeType) ? "maybe" : "";

describe("chooseSoundFormat", () => {
  const { m4a, ogg } = SOUND_FORMAT_MIME_TYPES;

  it.each<[string, (mimeType: string) => string, string | undefined]>([
    [
      "picks Ogg when the browser plays both, as Chrome and Firefox do",
      browserPlaying(ogg, m4a),
      "ogg",
    ],
    [
      "picks AAC when the browser plays only that, as older iOS Safari does",
      browserPlaying(m4a),
      "m4a",
    ],
    ["chooses nothing when the browser plays neither", browserPlaying(), undefined],
    ["treats an old browser's no as cannot play", () => "no", undefined],
  ])("%s", (_name, canPlay, expected) => {
    expect(chooseSoundFormat(canPlay)).toBe(expected);
  });

  it("asks with the types Phaser's loader checks the extension against", () => {
    expect(SOUND_FORMAT_MIME_TYPES).toEqual({
      m4a: "audio/x-m4a",
      ogg: 'audio/ogg; codecs="vorbis"',
    });
  });
});
