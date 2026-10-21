import { describe, expect, it } from "vitest";

import { focusDirectionForKey, moveFocus } from "./focus";

// Three rows of 3 dogs, 5 gear items, Start walk, 4 walkers.
const rows = [3, 3, 3, 5, 1, 4];

describe("moveFocus", () => {
  type Move = Parameters<typeof moveFocus>;

  it("moves along and between rows, keeping its place, and stops at the edges", () => {
    const cases: readonly [string, Move[1], Move[2], ReturnType<typeof moveFocus>][] = [
      ["focuses the first item on the first press", "right", null, { column: 0, row: 0 }],
      ["moves along a row", "right", { column: 1, row: 0 }, { column: 2, row: 0 }],
      ["stops at a row's right end", "right", { column: 2, row: 0 }, { column: 2, row: 0 }],
      ["stops at a row's left end", "left", { column: 0, row: 3 }, { column: 0, row: 3 }],
      [
        "keeps its place down into a longer row",
        "down",
        { column: 2, row: 2 },
        { column: 4, row: 3 },
      ],
      [
        "keeps its place down into a shorter row",
        "down",
        { column: 2, row: 3 },
        { column: 0, row: 4 },
      ],
      ["keeps its place up into a shorter row", "up", { column: 4, row: 3 }, { column: 2, row: 2 }],
      ["stops at the first row", "up", { column: 1, row: 0 }, { column: 1, row: 0 }],
      ["stops at the last row", "down", { column: 3, row: 5 }, { column: 3, row: 5 }],
    ];
    for (const [, direction, from, expected] of cases) {
      expect(moveFocus(rows, direction, from)).toEqual(expected);
    }
  });
});

describe("focusDirectionForKey", () => {
  it("reads the arrow keys only", () => {
    expect(focusDirectionForKey("ArrowUp")).toBe("up");
    expect(focusDirectionForKey("ArrowLeft")).toBe("left");
    expect(focusDirectionForKey("a")).toBeUndefined();
  });
});
