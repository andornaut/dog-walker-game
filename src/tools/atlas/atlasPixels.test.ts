import type { Rect } from "@andornaut/game-kit/rect";
import { describe, expect, it } from "vitest";

import { sheetFromRows } from "../../testing/sheetImage";
import { opaqueRect } from "./atlasPixels";

describe("opaqueRect", () => {
  it("bounds the opaque pixels within a rect, or none for a clear one", () => {
    const cases: { expected: Rect | undefined; name: string; rows: string[]; within: Rect }[] = [
      {
        expected: { height: 2, width: 3, x: 1, y: 1 },
        name: "bounds the opaque pixels",
        rows: ["....", ".a..", "..bc", "...."],
        within: { height: 4, width: 4, x: 0, y: 0 },
      },
      {
        expected: { height: 1, width: 1, x: 1, y: 1 },
        name: "ignores opaque pixels outside within",
        rows: ["....", ".a..", "..bc", "...."],
        within: { height: 2, width: 2, x: 0, y: 0 },
      },
      {
        expected: undefined,
        name: "is undefined for a clear rect",
        rows: ["....", "....", "....", "...."],
        within: { height: 4, width: 4, x: 0, y: 0 },
      },
    ];
    for (const { expected, rows, within } of cases) {
      expect(opaqueRect(sheetFromRows("dog-kilo", [rows]).image, within)).toEqual(expected);
    }
  });
});
