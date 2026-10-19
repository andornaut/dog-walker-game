import { describe, expect, it } from "vitest";

import type { Point } from "../layout/rect";
import { helpActionForKey, helpActionForPointer } from "./helpInput";
import type { HelpAction } from "./helpPaging";

const advance: HelpAction = { kind: "advance" };
const close: HelpAction = { kind: "close" };
const next: HelpAction = { kind: "next" };
const previous: HelpAction = { kind: "previous" };

describe("helpActionForKey", () => {
  it.each<[string, boolean, Record<string, HelpAction | undefined>]>([
    [
      "turns pages with the lane keys, presses Next with Enter and Space, closes with Escape, and ignores other keys",
      false,
      {
        " ": advance,
        "1": undefined,
        "?": undefined,
        A: previous,
        ArrowLeft: previous,
        ArrowRight: next,
        ArrowUp: undefined,
        D: next,
        Enter: advance,
        Escape: close,
        e: undefined,
        h: previous,
        l: next,
      },
    ],
    [
      "keeps turning pages on a held lane key, but ignores a held Enter, Space or Escape",
      true,
      {
        " ": undefined,
        ArrowLeft: previous,
        ArrowRight: next,
        Enter: undefined,
        Escape: undefined,
      },
    ],
  ])("%s", (_name, repeat, expected) => {
    for (const [key, action] of Object.entries(expected)) {
      expect(helpActionForKey(repeat, key), JSON.stringify(key)).toEqual(action);
    }
  });
});

describe("helpActionForPointer", () => {
  it.each<[string, Point, Point, HelpAction | undefined]>([
    ["brings in the next page on a swipe left", { x: 250, y: 400 }, { x: 200, y: 410 }, next],
    [
      "brings in the previous page on a swipe right",
      { x: 100, y: 400 },
      { x: 160, y: 400 },
      previous,
    ],
    [
      "turns a page on a swipe that starts on a button, without pressing it",
      { x: 300, y: 520 },
      { x: 350, y: 520 },
      previous,
    ],
    ["acts on the button where a tap started", { x: 300, y: 520 }, { x: 304, y: 523 }, advance],
    ["ignores a drag too short to swipe", { x: 300, y: 520 }, { x: 320, y: 520 }, undefined],
    ["ignores a vertical drag", { x: 180, y: 300 }, { x: 190, y: 400 }, undefined],
  ])("%s", (_name, from, to, expected) => {
    expect(helpActionForPointer(6, from, to)).toEqual(expected);
  });
});
