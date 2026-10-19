import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { BADGE_OFFSET } from "../layout/badge";
import { gridRects } from "../layout/grid";
import { insetRect } from "../layout/rect";
import { FEEDBACK } from "./feedback";
import { HOME_LAYOUT, pocketLining } from "./homeLayout";

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

describe("pocket lining", () => {
  const { pocketLining: lining, sections: all } = HOME_LAYOUT;
  const frame = all.pocket;
  const { band, edge } = sectionFrame;
  const inner = {
    bottom: frame.y + frame.height - edge,
    left: frame.x + edge,
    right: frame.x + frame.width - edge,
    top: frame.y + edge + band + 1,
  };

  it("is derived from the Pocket's section", () => {
    expect(lining).toEqual(pocketLining(frame));
  });

  it.each(Object.entries(lining))("%s lies inside the frame, under the band", (_, rect) => {
    expect(rect.x).toBeGreaterThanOrEqual(inner.left);
    expect(rect.x + rect.width).toBeLessThanOrEqual(inner.right);
    expect(rect.y).toBeGreaterThanOrEqual(inner.top);
    expect(rect.y + rect.height).toBeLessThanOrEqual(inner.bottom);
  });

  it.each(Object.entries(lining).filter(([name]) => name !== "denim"))(
    "%s lies within the denim",
    (_, rect) => {
      const { denim } = lining;
      expect(rect.x).toBeGreaterThanOrEqual(denim.x);
      expect(rect.x + rect.width).toBeLessThanOrEqual(denim.x + denim.width);
      expect(rect.y).toBeGreaterThanOrEqual(denim.y);
      expect(rect.y + rect.height).toBeLessThanOrEqual(denim.y + denim.height);
    },
  );

  it("keeps the tiles clear of the stitch", () => {
    const { cells, origin, tileInset } = pocket;
    const tiles = gridRects(cells, cells.columns, origin).map((cell) => insetRect(tileInset, cell));
    const { stitchLeft, stitchRight } = lining;
    for (const tile of tiles) {
      expect(tile.x).toBeGreaterThanOrEqual(stitchLeft.x + stitchLeft.width);
      expect(tile.x + tile.width).toBeLessThanOrEqual(stitchRight.x);
    }
  });
});

describe("Pet shop", () => {
  const { board, ...shop } = HOME_LAYOUT.petShop;

  it("holds its board inside its frame, at the top", () => {
    expect(board.y).toBe(shop.y);
    expect(board.x).toBeGreaterThanOrEqual(shop.x);
    expect(board.x + board.width).toBeLessThanOrEqual(shop.x + shop.width);
  });

  it("leaves room under the street sign for the bob", () => {
    const { streetSign } = HOME_LAYOUT;
    expect(shop.y - FEEDBACK.shopBobSteps.length).toBeGreaterThan(0);
    expect(Math.min(...FEEDBACK.shopBobSteps)).toBeGreaterThanOrEqual(-2);
    expect(streetSign.y).toBeLessThan(shop.y);
  });
});
