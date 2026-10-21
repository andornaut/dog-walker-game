import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import { type Rect } from "../layout/rect";
import { screenLayout } from "../layout/screenLayout";
import { bodyTextWidth } from "../testing/bodyFont";
import { fillLine } from "../text/lines";
import {
  EMPTY_MESSAGE_STRIP,
  lineAlpha,
  MESSAGE_ICONS,
  MESSAGE_STRIP,
  MESSAGE_TIMING,
  type MessageIcon,
  messageIconKey,
  type MessageLine,
  messagePanel,
  messageRows,
  messageStripLayout,
  type MessageStripState,
  sayLine,
  stepMessageStrip,
} from "./messageStrip";
import { RUN_TEXT_FIELDS } from "./runText";
import { stripItems, stripLayout } from "./stateStrip";

const { dwellMs, fadeMs, lifeMs, maxWaiting } = MESSAGE_TIMING;
const line = (text: string, icon: MessageIcon = "hint"): MessageLine => ({ icon, text });

// A strip after saying each text and stepping dtMs after each.
function after(steps: readonly (readonly [string | null, number])[]): MessageStripState {
  return steps.reduce<MessageStripState>((state, [text, dtMs]) => {
    const said = text === null ? state : sayLine(MESSAGE_TIMING, line(text), state);
    return stepMessageStrip(MESSAGE_TIMING, dtMs, said);
  }, EMPTY_MESSAGE_STRIP);
}

describe("sayLine", () => {
  const showing = after([["a", 0]]);
  it.each<[string, MessageStripState, string, string[]]>([
    ["waits a new line", showing, "b", ["b"]],
    ["drops a repeat of the shown line", showing, "a", []],
    ["drops a repeat of a waiting line", sayLine(MESSAGE_TIMING, line("b"), showing), "b", ["b"]],
  ])("%s", (_name, state, text, waiting) => {
    expect(sayLine(MESSAGE_TIMING, line(text), state).waiting.map(({ text }) => text)).toEqual(
      waiting,
    );
  });

  it("keeps the newest waiting lines, dropping the oldest", () => {
    const said = Array.from({ length: maxWaiting + 2 }, (_, i) => String(i));
    const state = said.reduce(
      (strip, text) => sayLine(MESSAGE_TIMING, line(text), strip),
      EMPTY_MESSAGE_STRIP,
    );
    expect(state.waiting.map(({ text }) => text)).toEqual(said.slice(-maxWaiting));
  });
});

describe("stepMessageStrip", () => {
  it.each<[string, (readonly [string | null, number])[], string | undefined]>([
    ["shows a line at once on an empty strip", [["a", 0]], "a"],
    [
      "holds a waiting line until the shown one has dwelt",
      [
        ["a", 0],
        ["b", dwellMs - 1],
      ],
      "a",
    ],
    [
      "replaces the dwelt line with the next",
      [
        ["a", 0],
        [null, dwellMs],
        ["b", 0],
      ],
      "b",
    ],
    [
      "keeps a line until the end of its life",
      [
        ["a", 0],
        [null, lifeMs - 1],
      ],
      "a",
    ],
    [
      "drops a line at the end of its life",
      [
        ["a", 0],
        [null, lifeMs],
      ],
      undefined,
    ],
  ])("%s", (_name, steps, text) => {
    expect(after(steps).shown?.text).toBe(text);
  });

  it("tells two lines with the same text apart", () => {
    const first = after([["a", 0]]);
    const again = after([
      ["a", 0],
      [null, dwellMs],
      ["b", 0],
      [null, dwellMs],
      ["a", 0],
    ]);
    expect(again.shown?.text).toBe("a");
    expect(again.shown?.id).not.toBe(first.shown?.id);
  });
});

describe("lineAlpha", () => {
  it.each<[string, number, number]>([
    ["a new line is whole", 0, 1],
    ["a line halfway through its fade is half", lifeMs - fadeMs / 2, 0.5],
    ["a line at the end of its life is gone", lifeMs, 0],
  ])("%s", (_name, ageMs, alpha) => {
    expect(lineAlpha(MESSAGE_TIMING, { ...line("a"), ageMs, id: 0 })).toBeCloseTo(alpha);
  });
});

// An image's size, from its PNG header.
function pngSize(key: string): { height: number; width: number } {
  const png = readFileSync(new URL(`../../public/art/images/${key}.png`, import.meta.url));
  return { height: png.readUInt32BE(20), width: png.readUInt32BE(16) };
}

describe("messageIconKey", () => {
  it.each(Object.keys(MESSAGE_ICONS) as MessageIcon[])(
    "leads a %s line with a 16x16 icon",
    (icon) => {
      expect(pngSize(messageIconKey(icon))).toEqual({ height: 16, width: 16 });
    },
  );
});

describe("messageStripLayout", () => {
  const strip = messageStripLayout();
  const { backdrop } = screenLayout(SCREEN_CONFIG);
  const { scale } = MESSAGE_STRIP;
  const inside = (inner: Rect, outer: Rect) =>
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height;
  const overlaps = (a: Rect, b: Rect) =>
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
  // The body font's capitals are 5 rows at 1x, its lowest ink 2 rows under them.
  const rowRect = (top: number): Rect => ({
    height: 7 * scale,
    width: strip.room,
    x: strip.textX,
    y: top,
  });
  const iconRect = { ...strip.icon, height: 16, width: 16 };
  // Every item the state strip can hold at once: each upgrade, gear, pace, style.
  const mostItems = Object.keys(gameData.upgrades).length + 3;
  // The walker's pace and style, which the strip always holds.
  const fewestItems = stripItems(gameData, {
    gear: null,
    immunities: [],
    modifiers: [],
    upgradesPicked: [],
    walker: "casey",
  }).length;

  it.each<[string, Rect, Rect]>([
    ["the strip in the backdrop band", strip.panel, backdrop],
    ["the icon in a one-row strip", iconRect, messagePanel(1)],
    ...strip.rowTops.map((top, row): [string, Rect, Rect] => [
      `row ${row + 1} in a ${row + 1}-row strip`,
      rowRect(top),
      messagePanel(row + 1),
    ]),
  ])("keeps %s", (_name, inner, outer) => {
    expect(inside(inner, outer)).toBe(true);
  });

  it("holds at most two rows, each a 2x line of the body font below the last", () => {
    expect(MESSAGE_STRIP.rows).toBe(2);
    expect(strip.panel).toEqual(messagePanel(MESSAGE_STRIP.rows));
    strip.rowTops.slice(1).forEach((top, i) => {
      expect(top - (strip.rowTops[i] ?? 0)).toBe(10 * scale);
    });
  });

  it.each(Array.from({ length: mostItems - fewestItems + 1 }, (_, i) => fewestItems + i))(
    "keeps clear of the state strip's tab with %i items",
    (count) => {
      const tab = stripLayout(count)?.tab;
      expect(tab).toBeDefined();
      expect(overlaps(strip.panel, tab ?? strip.panel)).toBe(false);
    },
  );

  it("centres the first row's capitals on the icon", () => {
    const capsMiddle = (strip.rowTops[0] ?? 0) + (5 * scale) / 2;
    expect(Math.abs(capsMiddle - (strip.icon.y + 8))).toBeLessThanOrEqual(0.5);
  });
});

// Every hint and badge line wraps at 2x onto the strip's rows, each no wider than its room,
// and none left out.
describe("the strip's lines", () => {
  const { room } = messageStripLayout();
  const width = (row: string) => bodyTextWidth(MESSAGE_STRIP.scale, row);
  const longestName = gameData.achievements
    .map(({ name }) => name)
    .reduce((a, b) => (bodyTextWidth(1, b) > bodyTextWidth(1, a) ? b : a), "");
  it.each([
    ...Object.entries(gameData.hints).map(([id, { text }]) => [`the ${id} hint`, text] as const),
    [
      "the longest achievement",
      fillLine(RUN_TEXT_FIELDS.strip, gameData.runText.strip, "achievement", {
        name: longestName,
      }),
    ] as const,
  ])("fits %s at 2x", (_name, text) => {
    const rows = messageRows(width, room, text);
    expect(rows.join(" ")).toBe(text.split(/\s+/).join(" "));
    expect(rows.length).toBeLessThanOrEqual(MESSAGE_STRIP.rows);
    for (const row of rows) {
      expect(width(row)).toBeLessThanOrEqual(room);
    }
  });

  it("leaves out text past the last row", () => {
    const word = "Woof";
    const many = Array.from({ length: 200 }, () => word).join(" ");
    const rows = messageRows(width, room, many);
    expect(rows).toHaveLength(MESSAGE_STRIP.rows);
  });
});
