import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { newPlayerSave } from "../save/fixtures";
import { badgeStrip, badgeWall, celebrationTitle, earnedText, wallRects } from "./badgesView";

describe("badgeWall", () => {
  it("lists every badge in wall order, earned by the save or locked", () => {
    const wall = badgeWall(gameData, { achievements: { firstSteps: 1, squirrel: 2 } });
    expect(wall).toHaveLength(gameData.achievements.length);
    expect(wall[0]).toMatchObject({ art: "badge-first-steps", earned: true, name: "First Steps" });
    expect(wall.filter(({ earned }) => earned).map(({ id }) => id)).toEqual([
      "firstSteps",
      "squirrel",
    ]);
    expect(earnedText(gameData, wall)).toBe(`2/${gameData.achievements.length} earned`);
  });

  it("falls back to the full goal where there is no short one", () => {
    const wall = badgeWall(gameData, newPlayerSave);
    const favourite = wall.find(({ id }) => id === "neighbourhoodFavourite");
    expect(favourite?.shortGoal).not.toBe(favourite?.goal);
    expect(wall[0]?.shortGoal).toBe(wall[0]?.goal);
  });
});

describe("wallRects", () => {
  it("fills each column down before the next", () => {
    const spec = { columnGap: 8, columnWidth: 168, rowHeight: 52, rows: 8, x: 8, y: 212 };
    const rects = wallRects(spec, 15);
    expect(rects[0]).toEqual({ height: 52, width: 168, x: 8, y: 212 });
    expect(rects[7]).toEqual({ height: 52, width: 168, x: 8, y: 212 + 7 * 52 });
    expect(rects[8]).toEqual({ height: 52, width: 168, x: 184, y: 212 });
  });
});

describe("badgeStrip", () => {
  it("shares the width, naming the badges only while few share it", () => {
    const layout = { maxNamed: 3, width: 300, x: 30 };
    expect(badgeStrip(layout, 1)).toEqual({ named: true, slots: [{ centerX: 180, width: 300 }] });
    const four = badgeStrip(layout, 4);
    expect(four.named).toBe(false);
    expect(four.slots.map(({ centerX }) => centerX)).toEqual([68, 143, 218, 293]);
  });
});

describe("celebrationTitle", () => {
  it("counts more than one badge", () => {
    expect(celebrationTitle(gameData, 1)).toBe("Badge earned!");
    expect(celebrationTitle(gameData, 3)).toBe("3 badges earned!");
  });
});
