import { describe, expect, it } from "vitest";

import { DOGHOUSE, doghouseHearts, fittingScale, heartCount } from "./doghouse";

describe("doghouseHearts", () => {
  it("lays hearts from (9, 127) in rows of six, 9px across and 8px down", () => {
    const cells = doghouseHearts(7, 10);
    expect(cells).toHaveLength(10);
    expect(cells[0]).toEqual({ full: true, x: 9, y: 127 });
    expect(cells[5]).toEqual({ full: true, x: 54, y: 127 });
    expect(cells[6]).toEqual({ full: true, x: 9, y: 135 });
    expect(cells[7]).toEqual({ full: false, x: 18, y: 135 });
  });

  it("keeps eleven hearts, a big dog with the Lucky collar, on the 72px house", () => {
    for (const cell of doghouseHearts(0, 11)) {
      expect(cell.x + 8).toBeLessThanOrEqual(66);
      expect(cell.y + 7).toBeLessThanOrEqual(146);
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
    expect(fittingScale(DOGHOUSE.name.width, [2, 1], 24)).toBe(2);
    expect(fittingScale(DOGHOUSE.name.width, [2, 1], 41)).toBe(1);
    expect(fittingScale(10, [2, 1], 41)).toBe(1);
  });
});

describe("DOGHOUSE.statuses", () => {
  it("puts the 16x16 status icons right of the owner's window, clear of the count and board", () => {
    // The window's cream frame ends at x=42, the board starts at y=116, and the 1x count's
    // capitals take the 6 rows from its y.
    for (const cell of DOGHOUSE.statuses) {
      expect(cell.x).toBeGreaterThanOrEqual(42);
      expect(cell.x + 16).toBeLessThanOrEqual(66);
      const count = DOGHOUSE.heartCount.y;
      expect(cell.y + 16 <= count || cell.y >= count + 6).toBe(true);
      expect(cell.y + 16).toBeLessThanOrEqual(116);
    }
  });
});
