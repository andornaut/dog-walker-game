import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import { cents } from "../rules/units";
import { readBitmapFont } from "../tools/fontFile";
import { plainMarks } from "../ui/pixelFont";
import {
  chipLeft,
  FEEDBACK,
  heartLabelAt,
  heartPopBlocked,
  heartPopCovers,
  heartPopFrame,
  heartPopText,
  type MoneyTick,
  retarget,
  tickMs,
  tickShown,
} from "./feedback";

describe("heartPopText", () => {
  it.each([
    [-1, "−1"],
    [-2, "−2"],
    [1, "+1"],
    [3, "+3"],
  ])("shows %i as %s, with a real minus sign", (amount, text) => {
    expect(heartPopText(amount)).toBe(text);
  });
});

describe("heartLabelAt", () => {
  const bounds = { bottom: 460, screenWidth: 360 };

  it.each([
    [
      "sets the number right of the heart, its capitals centred on the frame's middle row",
      100,
      400,
      { x: 115, y: 387 },
    ],
    [
      "sets it left of the heart when the right would run off the screen",
      330,
      400,
      { x: 295, y: 387 },
    ],
    ["raises it out of the lane below", 100, 470, { x: 115, y: 455 }],
  ])("%s", (_, x, top, at) => {
    expect(heartLabelAt(bounds, heartPopFrame({ x, y: top }), 20)).toEqual(at);
  });
});

describe("the labels floated over a dog", () => {
  const screenWidth = SCREEN_CONFIG.width;

  it.each([
    ["centres the chip on the dog", 180, 40, 160],
    ["moves it in from the left edge", 10, 40, 0],
    ["moves it in from the right edge", 350, 40, screenWidth - 40],
  ])("%s", (_, centreX, width, left) => {
    expect(chipLeft(screenWidth, centreX, width)).toBe(left);
  });

  // font-title at 2x in capitals, as Phaser sizes it, on a chip 2px wider each side.
  const { glyphs } = readBitmapFont("font-title");
  const chipWidth = (text: string) =>
    4 +
    2 *
      [...plainMarks(text).toUpperCase()].reduce(
        (sum, c) => sum + (glyphs.get(c)?.advance ?? 0),
        0,
      );

  it.each([
    ["dodge", gameData.runText.dodge],
    ["forgiven", gameData.runText.forgiven],
  ])("fits the %s label's chip on the screen", (_, text) => {
    expect(chipWidth(text)).toBeLessThanOrEqual(screenWidth);
  });
});

describe("heartPopBlocked", () => {
  // A pop over a dog at (180, 400) whose heart flies down to its band's top at (180, 534), and a
  // fired line's bubble and face over the middle doghouse.
  const frame = heartPopFrame({ x: 180, y: 400 });
  const chip = { height: 9, width: 14, x: frame.x + 29, y: frame.y + 12 };
  const covers = heartPopCovers({ chip, frame, to: { x: 180, y: 534 } }, FEEDBACK.heart.peak);

  it.each([
    ["nothing on screen", [], false],
    ["a bubble over its frame", [{ height: 40, width: 120, x: 120, y: 350 }], true],
    ["a face on its flight down", [{ height: 64, width: 64, x: 148, y: 470 }], true],
    ["a bubble over its chip alone", [{ height: 4, width: 4, x: chip.x + 2, y: chip.y + 2 }], true],
    ["a face in the next doghouse", [{ height: 64, width: 64, x: 268, y: 470 }], false],
    ["a bubble above the arc's peak", [{ height: 20, width: 120, x: 120, y: 300 }], false],
  ])("with %s: %s", (_, clearOf, blocked) => {
    expect(heartPopBlocked(clearOf, covers)).toBe(blocked);
  });
});

describe("money tick", () => {
  const tick: MoneyTick = { from: cents(4_299), startMs: 1_000, to: cents(4_099) };

  it.each([
    ["counts $1 a dollar's step", cents(4_000), cents(4_100), 150],
    ["takes at most its cap however far it counts", cents(0), cents(100_000), 600],
    ["takes no time for no change", cents(500), cents(500), 0],
  ])("%s", (_, from, to, ms) => {
    expect(tickMs(from, to)).toBe(ms);
  });

  it.each([
    ["shows the start's dollars as it starts", 1_000, 4_200],
    ["shows each dollar as it passes", 1_200, 4_100],
    ["shows the amount itself once there", 1_300, 4_099],
    ["shows the amount itself long after", 9_000, 4_099],
  ])("%s", (_, now, shown) => {
    expect(tickShown(now, tick)).toBe(shown);
  });

  it.each<[string, boolean, number, MoneyTick | undefined, MoneyTick]>([
    ["keeps counting toward the same amount", true, 1_200, tick, tick],
    [
      "counts from what it shows to a new amount",
      true,
      1_200,
      { ...tick, to: cents(4_299) },
      { from: cents(4_299), startMs: 1_200, to: cents(4_099) },
    ],
    [
      "starts at the amount with nothing shown yet",
      true,
      1_200,
      undefined,
      { from: cents(4_099), startMs: 1_200, to: cents(4_099) },
    ],
    [
      "jumps there when not counting",
      false,
      1_200,
      { ...tick, to: cents(9_999) },
      { from: cents(4_099), startMs: 1_200, to: cents(4_099) },
    ],
  ])("%s", (_, counting, now, from, expected) => {
    expect(retarget(counting, now, cents(4_099), from)).toEqual(expected);
  });
});
