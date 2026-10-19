import { describe, expect, it } from "vitest";

import { focusDirectionForKey, moveFocus } from "./focus";

// Three rows of 3 dogs, 5 gear items, Start walk, 4 walkers.
const rows = [3, 3, 3, 5, 1, 4];

describe("moveFocus", () => {
  it("focuses the first item on the first press", () => {
    expect(moveFocus(rows, "right", null)).toEqual({ column: 0, row: 0 });
  });

  it("moves along a row and stops at its ends", () => {
    expect(moveFocus(rows, "right", { column: 1, row: 0 })).toEqual({ column: 2, row: 0 });
    expect(moveFocus(rows, "right", { column: 2, row: 0 })).toEqual({ column: 2, row: 0 });
    expect(moveFocus(rows, "left", { column: 0, row: 3 })).toEqual({ column: 0, row: 3 });
  });

  it("keeps its place across rows of different lengths", () => {
    expect(moveFocus(rows, "down", { column: 2, row: 2 })).toEqual({ column: 4, row: 3 });
    expect(moveFocus(rows, "down", { column: 2, row: 3 })).toEqual({ column: 0, row: 4 });
    expect(moveFocus(rows, "up", { column: 4, row: 3 })).toEqual({ column: 2, row: 2 });
  });

  it("stops at the first and last rows", () => {
    expect(moveFocus(rows, "up", { column: 1, row: 0 })).toEqual({ column: 1, row: 0 });
    expect(moveFocus(rows, "down", { column: 3, row: 5 })).toEqual({ column: 3, row: 5 });
  });
});

describe("focusDirectionForKey", () => {
  it("reads the arrow keys only", () => {
    expect(focusDirectionForKey("ArrowUp")).toBe("up");
    expect(focusDirectionForKey("ArrowLeft")).toBe("left");
    expect(focusDirectionForKey("a")).toBeUndefined();
  });
});
