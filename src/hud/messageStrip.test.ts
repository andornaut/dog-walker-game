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
  MESSAGE_TIMING,
  type MessageIcon,
  messageIconKey,
  type MessageLine,
  messageStripLayout,
  type MessageStripState,
  newestCapsTop,
  OLDER_ALPHAS,
  OLDER_LINES,
  sayLine,
  stepMessageStrip,
} from "./messageStrip";
import { RUN_TEXT_FIELDS } from "./runText";

const { dwellMs, fadeMs, lifeMs, maxWaiting } = MESSAGE_TIMING;
const line = (text: string, icon: MessageIcon = "hint"): MessageLine => ({ icon, text });

// A strip after saying each text and stepping dtMs after each.
function after(steps: readonly (readonly [string | null, number])[]): MessageStripState {
  return steps.reduce<MessageStripState>((state, [text, dtMs]) => {
    const said = text === null ? state : sayLine(MESSAGE_TIMING, line(text), state);
    return stepMessageStrip(MESSAGE_TIMING, dtMs, said);
  }, EMPTY_MESSAGE_STRIP);
}
const texts = (state: MessageStripState) => state.lines.map(({ text }) => text);

describe("sayLine", () => {
  const showing = after([["a", 0]]);
  it.each<[string, MessageStripState, string, string[]]>([
    ["waits a new line", showing, "b", ["b"]],
    ["drops a repeat of the newest line", showing, "a", []],
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
  it.each<[string, (readonly [string | null, number])[], string[]]>([
    ["shows a line at once on an empty strip", [["a", 0]], ["a"]],
    [
      "holds a waiting line until the newest has dwelt",
      [
        ["a", 0],
        ["b", dwellMs - 1],
      ],
      ["a"],
    ],
    [
      "puts the next line under the dwelt one, which steps up",
      [
        ["a", 0],
        [null, dwellMs],
        ["b", 0],
      ],
      ["b", "a"],
    ],
    [
      "keeps the newest line and the older ones that fit",
      Array.from({ length: OLDER_LINES + 2 }, (_, i) => [String(i), dwellMs] as const),
      Array.from({ length: OLDER_LINES + 1 }, (_, i) => String(OLDER_LINES + 1 - i)),
    ],
    [
      "keeps a line until the end of its life",
      [
        ["a", 0],
        [null, lifeMs - 1],
      ],
      ["a"],
    ],
    [
      "drops a line at the end of its life",
      [
        ["a", 0],
        [null, lifeMs],
      ],
      [],
    ],
  ])("%s", (_name, steps, lines) => {
    expect(texts(after(steps))).toEqual(lines);
  });

  it("tells two lines with the same text apart", () => {
    const state = after([
      ["a", 0],
      [null, dwellMs],
      ["b", 0],
      [null, dwellMs],
      ["a", 0],
    ]);
    expect(texts(state)).toEqual(["a", "b", "a"]);
    expect(new Set(state.lines.map(({ id }) => id)).size).toBe(3);
  });
});

describe("lineAlpha", () => {
  it.each<[string, number, number, number]>([
    ["the newest line is whole", 0, 0, 1],
    ["the line before it is fainter", 1, 0, OLDER_ALPHAS[0] ?? 0],
    ["the oldest is fainter still", 2, 0, OLDER_ALPHAS[1] ?? 0],
    ["a line past the last place is gone", OLDER_LINES + 1, 0, 0],
    ["a line halfway through its fade is half", 0, lifeMs - fadeMs / 2, 0.5],
    [
      "an older line fades from its place's alpha",
      1,
      lifeMs - fadeMs / 2,
      (OLDER_ALPHAS[0] ?? 0) / 2,
    ],
    ["a line at the end of its life is gone", 0, lifeMs, 0],
  ])("%s", (_name, index, ageMs, alpha) => {
    expect(lineAlpha(MESSAGE_TIMING, index, { ...line("a"), ageMs, id: 0 })).toBeCloseTo(alpha);
  });

  it("makes each place fainter than the one below it", () => {
    const places = [1, ...OLDER_ALPHAS, 0];
    places.slice(1).forEach((alpha, i) => expect(alpha).toBeLessThan(places[i] ?? 0));
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
  const { backdrop, topBar } = screenLayout(SCREEN_CONFIG);
  const inside = (inner: Rect, outer: Rect) =>
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height;
  // The body font's capitals are 5 rows at 1x, its lowest ink 2 rows under them.
  const lineRows = (top: number, scale: number) => ({ height: 7 * scale, top });
  const textRect = (top: number, scale: number): Rect => ({
    height: lineRows(top, scale).height,
    width: strip.room,
    x: strip.textX,
    y: top,
  });
  const iconRect = { ...strip.icon, height: 16, width: 16 };

  it.each<[string, Rect, Rect]>([
    ["the strip in the backdrop band", strip.panel, backdrop],
    ["the icon in the strip", iconRect, strip.panel],
    ["the newest line in the strip", textRect(newestCapsTop(strip, 2), 2), strip.panel],
    ...strip.olderTops.map((top, i): [string, Rect, Rect] => [
      `older line ${i + 1} in the strip`,
      textRect(top, 1),
      strip.panel,
    ]),
  ])("keeps %s", (_name, inner, outer) => {
    expect(inside(inner, outer)).toBe(true);
  });

  it("stacks the older lines above the newest, the line before it lowest", () => {
    const bottoms = strip.olderTops.map((top) => top + lineRows(top, 1).height);
    expect(Math.max(...bottoms)).toBeLessThanOrEqual(strip.icon.y);
    expect([...strip.olderTops].sort((a, b) => b - a)).toEqual(strip.olderTops);
  });

  it("starts under the top bar", () => {
    expect(strip.panel.y).toBeGreaterThan(topBar.y + topBar.height);
  });

  it.each([1, 2])("centres the newest line's capitals at %ix on the icon", (scale) => {
    const top = newestCapsTop(strip, scale);
    const capsMiddle = top + (5 * scale) / 2;
    expect(Math.abs(capsMiddle - (strip.icon.y + 8))).toBeLessThanOrEqual(0.5);
  });
});

// Every hint fits the newest line on one line at 1x, the smallest it is drawn before wrapping.
describe("the strip's lines", () => {
  const { room } = messageStripLayout();
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
  ])("fits %s at 1x", (_name, text) => {
    expect(bodyTextWidth(1, text)).toBeLessThanOrEqual(room);
  });
});
