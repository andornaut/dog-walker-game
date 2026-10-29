// Keyboard focus on the home screen: rows of items (the dog rows, gear, Start walk, walkers),
// moved through with the arrow keys.

import { clampIndex } from "@andornaut/game-kit/arrays";

export interface Focus {
  readonly column: number;
  readonly row: number;
}

type FocusDirection = "down" | "left" | "right" | "up";

const KEY_DIRECTIONS: Readonly<Record<string, FocusDirection>> = {
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
};

export function focusDirectionForKey(key: string): FocusDirection | undefined {
  return KEY_DIRECTIONS[key];
}

// The same share of the way along a row of another length.
function matchingColumn(column: number, fromLength: number, toLength: number): number {
  if (fromLength <= 1 || toLength <= 1) {
    return 0;
  }
  return Math.round((column / (fromLength - 1)) * (toLength - 1));
}

// rowLengths holds how many items each row has, each at least 1. The first arrow press, with
// nothing focused, focuses the first item. Moves stop at the edges.
export function moveFocus(
  rowLengths: readonly number[],
  direction: FocusDirection,
  focus: Focus | null,
): Focus {
  if (focus === null) {
    return { column: 0, row: 0 };
  }
  const length = (row: number) => rowLengths[row] ?? 1;
  switch (direction) {
    case "left":
    case "right": {
      const column = focus.column + (direction === "left" ? -1 : 1);
      return { ...focus, column: clampIndex(length(focus.row), column) };
    }
    case "down":
    case "up": {
      const row = clampIndex(rowLengths.length, focus.row + (direction === "up" ? -1 : 1));
      if (row === focus.row) {
        return focus;
      }
      return { column: matchingColumn(focus.column, length(focus.row), length(row)), row };
    }
    default:
      return direction satisfies never;
  }
}
