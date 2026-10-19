import { describe, expect, it } from "vitest";

import { helpActionForKey, helpActionForPointer } from "./helpInput";

describe("helpActionForKey", () => {
  it("turns pages with the lane keys", () => {
    for (const key of ["ArrowLeft", "h", "A"]) {
      expect(helpActionForKey(key)).toEqual({ kind: "previous" });
    }
    for (const key of ["ArrowRight", "l", "D"]) {
      expect(helpActionForKey(key)).toEqual({ kind: "next" });
    }
  });

  it("presses Next with Enter and Space, and closes with Escape", () => {
    expect(helpActionForKey("Enter")).toEqual({ kind: "advance" });
    expect(helpActionForKey(" ")).toEqual({ kind: "advance" });
    expect(helpActionForKey("Escape")).toEqual({ kind: "close" });
  });

  it("ignores other keys", () => {
    for (const key of ["ArrowUp", "e", "?", "1"]) {
      expect(helpActionForKey(key)).toBeUndefined();
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
    expect(helpActionForPointer(6, { x: 300, y: 600 }, { x: 350, y: 600 })).toEqual({
      kind: "previous",
    });
  });

  it("acts on the button where a tap started", () => {
    expect(helpActionForPointer(6, { x: 300, y: 600 }, { x: 304, y: 603 })).toEqual({
      kind: "advance",
    });
  });

  it("ignores a drag that is neither a tap nor a horizontal swipe", () => {
    expect(helpActionForPointer(6, { x: 300, y: 600 }, { x: 320, y: 600 })).toBeUndefined();
    expect(helpActionForPointer(6, { x: 180, y: 300 }, { x: 190, y: 400 })).toBeUndefined();
  });
});
