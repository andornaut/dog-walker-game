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
  type MoneyTick,
  retarget,
  tickMs,
  tickShown,
} from "./feedback";

describe("heartLabelAt", () => {
  it("sets the number right of the heart, left of it at the screen's edge, and out of the lane below", () => {
    const bounds = { bottom: 460, screenWidth: 360 };
    const at = (x: number, top: number) => heartLabelAt(bounds, heartPopFrame({ x, y: top }), 20);
    expect(at(100, 400)).toEqual({ x: 115, y: 387 });
    expect(at(330, 400)).toEqual({ x: 295, y: 387 });
    expect(at(100, 470)).toEqual({ x: 115, y: 455 });
  });
});

describe("the labels floated over a dog", () => {
  const screenWidth = SCREEN_CONFIG.width;

  it("centres the chip on the dog, moved in from the screen's edges", () => {
    expect(chipLeft(screenWidth, 180, 40)).toBe(160);
    expect(chipLeft(screenWidth, 10, 40)).toBe(0);
    expect(chipLeft(screenWidth, 350, 40)).toBe(screenWidth - 40);
  });

  it.each(["dodge", "forgiven"] as const)(
    "holds the %s label opaque for most of its time, then fades it before the time is up",
    (label) => {
      const { holdMs, ms } = FEEDBACK[label];
      expect(holdMs).toBeGreaterThan(ms / 2);
      expect(holdMs).toBeLessThan(ms);
    },
  );

  // font-title at 2x in capitals, as Phaser sizes it, on a chip 2px wider each side.
  it("fits the dodge and forgiven labels' chips on the screen", () => {
    const { glyphs } = readBitmapFont("font-title");
    const chipWidth = (text: string) =>
      4 +
      2 *
        [...plainMarks(text).toUpperCase()].reduce(
          (sum, c) => sum + (glyphs.get(c)?.advance ?? 0),
          0,
        );
    const labels = [gameData.runText.dodge, gameData.runText.forgiven];
    expect(labels.filter((text) => chipWidth(text) > screenWidth)).toEqual([]);
  });
});

describe("heartPopBlocked", () => {
  it("blocks a pop under a bubble or face over its frame, chip or flight, and not one clear of them", () => {
    // A pop over a dog at (180, 400) whose heart flies down to its band's top at (180, 534), and
    // a fired line's bubble and face over the middle doghouse.
    const frame = heartPopFrame({ x: 180, y: 400 });
    const chip = { height: 9, width: 14, x: frame.x + 29, y: frame.y + 12 };
    const covers = heartPopCovers({ chip, frame, to: { x: 180, y: 534 } }, FEEDBACK.heart.peak);
    const cases: [string, { height: number; width: number; x: number; y: number }[], boolean][] = [
      ["nothing on screen", [], false],
      ["a bubble over its frame", [{ height: 40, width: 120, x: 120, y: 350 }], true],
      ["a face on its flight down", [{ height: 64, width: 64, x: 148, y: 470 }], true],
      [
        "a bubble over its chip alone",
        [{ height: 4, width: 4, x: chip.x + 2, y: chip.y + 2 }],
        true,
      ],
      ["a face in the next doghouse", [{ height: 64, width: 64, x: 268, y: 470 }], false],
      ["a bubble above the arc's peak", [{ height: 20, width: 120, x: 120, y: 300 }], false],
    ];
    for (const [name, clearOf, blocked] of cases) {
      expect(heartPopBlocked(clearOf, covers), name).toBe(blocked);
    }
  });
});

describe("money tick", () => {
  const tick: MoneyTick = { from: cents(4_299), startMs: 1_000, to: cents(4_099) };

  it("counts a dollar a step up to its cap, and takes no time for no change", () => {
    expect(tickMs(cents(4_000), cents(4_100))).toBe(150);
    expect(tickMs(cents(0), cents(100_000))).toBe(600);
    expect(tickMs(cents(500), cents(500))).toBe(0);
  });

  it("shows the start's dollars, each dollar as it passes, then the amount itself", () => {
    expect([1_000, 1_200, 1_300, 9_000].map((now) => tickShown(now, tick))).toEqual([
      4_200, 4_100, 4_099, 4_099,
    ]);
  });

  it("retargets from what it shows while counting, and jumps there when not", () => {
    const to = cents(4_099);
    const settled = { from: to, startMs: 1_200, to };
    expect(retarget(true, 1_200, to, tick)).toEqual(tick);
    expect(retarget(true, 1_200, to, { ...tick, to: cents(4_299) })).toEqual({
      from: cents(4_299),
      startMs: 1_200,
      to,
    });
    expect(retarget(true, 1_200, to, undefined)).toEqual(settled);
    expect(retarget(false, 1_200, to, { ...tick, to: cents(9_999) })).toEqual(settled);
  });
});
