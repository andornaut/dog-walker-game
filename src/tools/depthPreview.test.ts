import { describe, expect, it } from "vitest";

import { blankImage } from "../assets/atlas/atlasPixels";
import { ROAD_CAMERA, SCREEN_LAYOUT } from "../data/screen";
import { depthDraw } from "../layout/depthScale";
import { project } from "../layout/projection";
import { walkProjection } from "../runner/walkGeometry";
import { type PreviewArt, sweepDistances, sweepRow } from "./depthPreview";

const { road } = SCREEN_LAYOUT;
const lens = walkProjection(ROAD_CAMERA, road);

function art(key: string, size: number): PreviewArt {
  return { feetY: size, height: size, image: blankImage(size, size), key, width: size };
}

const ARTS = [art("cone", 32), art("cone@75", 24), art("cone@50", 16)];

describe("sweepDistances", () => {
  it("runs from the feet to the far edge and stops where the art step changes", () => {
    const distances = sweepDistances(ARTS, lens, 5);
    expect(distances[0]).toBe(0);
    expect(distances.at(-1)).toBe(Math.floor(lens.visibleDistance));
    const keyAt = (distance: number) =>
      depthDraw(ARTS, project(lens, { distance, x: lens.centreX }).scale).key;
    const changes = distances.filter((d) => d > 0 && keyAt(d) !== keyAt(d - 1));
    expect(changes.map(keyAt)).toEqual(["cone@75", "cone@50"]);
  });
});

describe("sweepRow", () => {
  it("draws the art depthDraw picks, standing on the projected feet", () => {
    const row = sweepRow(ARTS, lens, lens.centreX, 0);
    expect(row.drawn.key).toBe("cone");
    expect(row.rect).toEqual({ height: 32, width: 32, x: lens.centreX - 16, y: lens.footY - 32 });
  });
});
