import { describe, expect, it } from "vitest";

import { SCREEN_CONFIG } from "../data/screen";
import type { Rect } from "../layout/rect";
import { screenLayout } from "../layout/screenLayout";
import { DOGHOUSE, doghouseHearts, fittingScale, heartCount } from "./doghouse";

const HEART = { height: 7, width: 8 };
const FACE = 32;
const STATUS = 16;
const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe("DOGHOUSE", () => {
  it("is the size of a doghouse slot", () => {
    const slot = screenLayout(SCREEN_CONFIG).dogSlots[0];
    expect({ height: slot?.height, width: slot?.width }).toEqual(DOGHOUSE.size);
  });

  it("puts the faces side by side under the roof, clear of each other and the hearts", () => {
    const dog = { ...DOGHOUSE.dogFace, height: FACE, width: FACE };
    const owner = { ...DOGHOUSE.ownerFace, height: FACE, width: FACE };
    expect(dog.y).toBeGreaterThanOrEqual(DOGHOUSE.roof.height);
    expect(overlaps(dog, owner)).toBe(false);
    for (const cell of doghouseHearts(0, 11)) {
      expect(overlaps(owner, { ...cell, ...HEART })).toBe(false);
    }
  });
});

describe("doghouseHearts", () => {
  it("lays hearts from (76, 26) in rows of five, 9px across and 8px down", () => {
    const cells = doghouseHearts(7, 10);
    expect(cells).toHaveLength(10);
    expect(cells[0]).toEqual({ full: true, x: 76, y: 26 });
    expect(cells[4]).toEqual({ full: true, x: 112, y: 26 });
    expect(cells[5]).toEqual({ full: true, x: 76, y: 34 });
    expect(cells[7]).toEqual({ full: false, x: 94, y: 34 });
  });

  it("keeps eleven hearts, a big dog with the Lucky collar, on the house above the statuses", () => {
    for (const cell of doghouseHearts(0, 11)) {
      expect(cell.x + HEART.width).toBeLessThanOrEqual(DOGHOUSE.size.width);
      for (const status of DOGHOUSE.statuses) {
        expect(cell.y + HEART.height).toBeLessThanOrEqual(status.y);
      }
    }
  });
});

describe("heartCount", () => {
  it("writes hearts over the max", () => {
    expect(heartCount(4, 8)).toBe("4/8");
  });
});

describe("fittingScale", () => {
  it("takes the largest scale that fits, and 1 when none does", () => {
    expect(fittingScale(DOGHOUSE.name.width, [2, 1], 54)).toBe(2);
    expect(fittingScale(DOGHOUSE.name.width, [2, 1], 55)).toBe(1);
    expect(fittingScale(10, [2, 1], 41)).toBe(1);
  });
});

describe("DOGHOUSE.statuses", () => {
  it("puts the 16x16 status icons side by side on the house, apart", () => {
    for (const cell of DOGHOUSE.statuses) {
      expect(cell.x + STATUS).toBeLessThanOrEqual(DOGHOUSE.size.width);
      expect(cell.y + STATUS).toBeLessThanOrEqual(DOGHOUSE.size.height);
    }
    const [left, right] = DOGHOUSE.statuses;
    expect(left.x + STATUS).toBeLessThanOrEqual(right.x);
  });
});
