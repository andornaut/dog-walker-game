import { describe, expect, it } from "vitest";

import type { Point } from "../layout/rect";
import { helpActionForKey, helpActionForPointer } from "./helpInput";
import type { HelpAction } from "./helpPaging";

const advance: HelpAction = { kind: "advance" };
const close: HelpAction = { kind: "close" };
const next: HelpAction = { kind: "next" };
const previous: HelpAction = { kind: "previous" };

describe("helpActionForKey", () => {
  it("turns pages with lane keys, held or not, and presses Next or closes only on a fresh press", () => {
    const cases: readonly [string, boolean, Record<string, HelpAction | undefined>][] = [
      [
        "turns pages with lane keys, presses Next with Enter or Space, closes with Escape or P, ignores the rest",
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
          P: close,
          e: undefined,
          h: previous,
          l: next,
        },
      ],
      [
        "keeps turning pages on a held lane key, but ignores a held Enter, Space, Escape or P",
        true,
        {
          " ": undefined,
          ArrowLeft: previous,
          ArrowRight: next,
          Enter: undefined,
          Escape: undefined,
          p: undefined,
        },
      ],
    ];
    for (const [, repeat, expected] of cases) {
      for (const [key, action] of Object.entries(expected)) {
        expect(helpActionForKey(repeat, key), JSON.stringify(key)).toEqual(action);
      }
    }
  });
});

describe("helpActionForPointer", () => {
  it("turns a page on a swipe, acts on the button a tap started on, and ignores short or vertical drags", () => {
    const cases: readonly [string, Point, Point, HelpAction | undefined][] = [
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
    ];
    for (const [, from, to, expected] of cases) {
      expect(helpActionForPointer(6, from, to)).toEqual(expected);
    }
  });
});
