import { describe, expect, it } from "vitest";

import { chooseSoundFormat, SOUND_FORMAT_MIME_TYPES } from "./soundFormat";

const browserPlaying =
  (...playable: string[]) =>
  (mimeType: string) =>
    playable.includes(mimeType) ? "maybe" : "";

describe("chooseSoundFormat", () => {
  it("picks Ogg when the browser plays both, as Chrome and Firefox do", () => {
    const both = browserPlaying(SOUND_FORMAT_MIME_TYPES.ogg, SOUND_FORMAT_MIME_TYPES.m4a);
    expect(chooseSoundFormat(both)).toBe("ogg");
  });

  it("picks AAC when the browser plays only that, as older iOS Safari does", () => {
    expect(chooseSoundFormat(browserPlaying(SOUND_FORMAT_MIME_TYPES.m4a))).toBe("m4a");
  });

  it("chooses nothing when the browser plays neither", () => {
    expect(chooseSoundFormat(browserPlaying())).toBeUndefined();
  });

  it("treats an old browser's no as cannot play", () => {
    expect(chooseSoundFormat(() => "no")).toBeUndefined();
  });

  it("asks with the types Phaser's loader checks the extension against", () => {
    expect(SOUND_FORMAT_MIME_TYPES).toEqual({
      m4a: "audio/x-m4a",
      ogg: 'audio/ogg; codecs="vorbis"',
    });
  });
});
