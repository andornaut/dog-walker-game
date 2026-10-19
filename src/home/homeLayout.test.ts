import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { BADGE_OFFSET } from "../layout/badge";
import { gridRects } from "../layout/grid";
import { insetRect } from "../layout/rect";
import { HOME_LAYOUT } from "./homeLayout";

const { dogOrigin, dogTiles, sectionFrame, sections, startButton, walkerOrigin, walkerTiles } =
  HOME_LAYOUT;
const { pocket } = HOME_LAYOUT;

const rows = [
  ["walker", sections.walker, gridRects(walkerTiles, walkerTiles.columns, walkerOrigin)],
  [
    "pocket",
    sections.pocket,
    gridRects(pocket.cells, pocket.cells.columns, pocket.origin).map((cell) =>
      insetRect(pocket.tileInset, cell),
    ),
  ],
  ["dogs", sections.dogs, gridRects(dogTiles, Object.keys(gameData.dogs).length, dogOrigin)],
] as const;

describe("home layout", () => {
  it.each(Object.entries(sections))(
    "section %s shares the Start walk button's edges",
    (_, rect) => {
      expect({ width: rect.width, x: rect.x }).toEqual({
        width: startButton.width,
        x: startButton.x,
      });
    },
  );

  describe.each(rows)("%s tiles", (_, section, tiles) => {
    const inner = {
      left: section.x + sectionFrame.edge,
      right: section.x + section.width - sectionFrame.edge,
    };
    it("keep the selected badge inside the section's frame", () => {
      expect(Math.min(...tiles.map((tile) => tile.x)) + BADGE_OFFSET.x).toBeGreaterThanOrEqual(
        inner.left,
      );
    });
    it("end inside the frame", () => {
      expect(Math.max(...tiles.map((tile) => tile.x + tile.width))).toBeLessThanOrEqual(
        inner.right,
      );
    });
    it("are spaced evenly along a row", () => {
      const row = tiles.filter((tile) => tile.y === tiles[0]?.y);
      const gaps = row
        .slice(1)
        .map((tile, i) => tile.x - ((row[i]?.x ?? 0) + (row[i]?.width ?? 0)));
      expect(new Set(gaps).size).toBe(1);
    });
  });
});
