import { describe, expect, it } from "vitest";

import { helpActionForKey, helpActionForPointer } from "./helpInput";

describe("helpActionForKey", () => {
  it("turns pages with the lane keys", () => {
    for (const key of ["ArrowLeft", "h", "A"]) {
      expect(helpActionForKey(false, key)).toEqual({ kind: "previous" });
    }
    for (const key of ["ArrowRight", "l", "D"]) {
      expect(helpActionForKey(false, key)).toEqual({ kind: "next" });
    }
  });

  it("presses Next with Enter and Space, and closes with Escape", () => {
    expect(helpActionForKey(false, "Enter")).toEqual({ kind: "advance" });
    expect(helpActionForKey(false, " ")).toEqual({ kind: "advance" });
    expect(helpActionForKey(false, "Escape")).toEqual({ kind: "close" });
  });

  it("ignores a held Enter, Space or Escape, so a held key cannot close the help", () => {
    for (const key of ["Enter", " ", "Escape"]) {
      expect(helpActionForKey(true, key)).toBeUndefined();
    }
  });

  it("keeps turning pages while a lane key is held", () => {
    expect(helpActionForKey(true, "ArrowRight")).toEqual({ kind: "next" });
    expect(helpActionForKey(true, "ArrowLeft")).toEqual({ kind: "previous" });
  });

  it("ignores other keys", () => {
    for (const key of ["ArrowUp", "e", "?", "1"]) {
      expect(helpActionForKey(false, key)).toBeUndefined();
    }
  });
});

describe("helpActionForPointer", () => {
  it("brings in the next page on a swipe left and the previous on a swipe right", () => {
    expect(helpActionForPointer(6, { x: 250, y: 400 }, { x: 200, y: 410 })).toEqual({
      kind: "next",
    });
    expect(helpActionForPointer(6, { x: 100, y: 400 }, { x: 160, y: 400 })).toEqual({
      kind: "previous",
    });
  });

  it("turns a page on a swipe that starts on a button, without pressing it", () => {
    expect(helpActionForPointer(6, { x: 300, y: 520 }, { x: 350, y: 520 })).toEqual({
      kind: "previous",
    });
  });

  it("acts on the button where a tap started", () => {
    expect(helpActionForPointer(6, { x: 300, y: 520 }, { x: 304, y: 523 })).toEqual({
      kind: "advance",
    });
  });

  it("ignores a drag that is neither a tap nor a horizontal swipe", () => {
    expect(helpActionForPointer(6, { x: 300, y: 520 }, { x: 320, y: 520 })).toBeUndefined();
    expect(helpActionForPointer(6, { x: 180, y: 300 }, { x: 190, y: 400 })).toBeUndefined();
  });
});
