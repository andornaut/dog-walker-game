import { describe, expect, it, vi } from "vitest";

import type { ZoneId } from "../data/types";
import {
  anchorSprite,
  type LightAnchor,
  newAttachedLightPlaces,
  placeAttachedLights,
} from "./lightPlaces";

// Art's lights, with test sprites: one carrying a pulsing glow in Yonge Street alone and a cone
// set to point left, one whose cone faces the road, and one drawn facing the pack with a
// headlamp shining down.
vi.mock("../../shared/lights.json", async (importOriginal) => {
  const { default: table } = await importOriginal<{
    default: { attach?: Record<string, unknown>; defs: Record<string, unknown> };
  }>();
  const rings = [
    { scale: 1, strength: 0.1 },
    { scale: 0.5, strength: 0.2 },
  ];
  return {
    default: {
      attach: {
        ...table.attach,
        "test-lamp": [{ angle: 180, dx: 4, dy: -6, facesRoad: true, light: "test-beam" }],
        "test-rider": [{ dx: 0, dy: -10, light: "test-beam" }],
        "test-sprite": [
          { dx: 10, dy: -20, light: "test-glow", pulse: [1, 0.6, 0.2], zones: ["homeStretch"] },
          { angle: 180, dx: 4, dy: 0, light: "test-beam" },
        ],
      },
      defs: {
        ...table.defs,
        "test-beam": { colour: "cream", height: 12, rings, shape: "cone", width: 8 },
        "test-glow": { colour: "cream", height: 8, rings, shape: "ellipse", width: 16 },
      },
    },
  };
});

const anchorOf = (overrides: Partial<LightAnchor>): LightAnchor => ({
  flipX: false,
  frame: 0,
  key: "test-sprite",
  leftOfRoad: false,
  scale: 0.5,
  x: 300,
  y: 200,
  ...overrides,
});
const placed = (zone: ZoneId, anchors: readonly LightAnchor[]) => {
  const out = newAttachedLightPlaces();
  return out.slice(0, placeAttachedLights(zone, anchors, out)).map((place) => ({ ...place }));
};
const QUARTER = Math.PI / 2;
const glow = { anchor: 0, groundY: 200, key: "test-glow", rotation: 0, scale: 0.5 };
const beam = { anchor: 0, groundY: 200, key: "test-beam", scale: 0.5, strength: 1, y: 200 };

describe("placeAttachedLights", () => {
  // The glow 10 px right and 20 up at full size, the beam 4 right; at scale 0.5 half that. A
  // cone baked pointing down turns a quarter clockwise to point left, or back to point right.
  it.each([
    {
      anchor: anchorOf({ frame: 1 }),
      name: "a sprite as drawn, pointing its cone left",
      want: [
        { ...glow, strength: 0.6, x: 305, y: 190 },
        { ...beam, rotation: QUARTER, x: 302 },
      ],
    },
    {
      anchor: anchorOf({ flipX: true, frame: 1 }),
      name: "a flipped sprite, pointing its cone right",
      want: [
        { ...glow, strength: 0.6, x: 295, y: 190 },
        { ...beam, rotation: -QUARTER, x: 298 },
      ],
    },
    {
      anchor: anchorOf({ frame: 1, leftOfRoad: true }),
      name: "a sprite left of the road, as drawn, its lights not facing the road",
      want: [
        { ...glow, strength: 0.6, x: 305, y: 190 },
        { ...beam, rotation: QUARTER, x: 302 },
      ],
    },
    {
      anchor: anchorOf({ frame: 5 }),
      name: "a sprite past its pulse's end, wrapping round it",
      want: [
        { ...glow, strength: 0.2, x: 305, y: 190 },
        { ...beam, rotation: QUARTER, x: 302 },
      ],
    },
  ])("follows $name", ({ anchor, want }) => {
    expect(placed("homeStretch", [anchor])).toEqual(want);
  });

  // A lamp's beam, set out for the road's right, points left toward the road there and right
  // toward it on the left, from its mirrored head.
  it.each([
    { leftOfRoad: false, rotation: QUARTER, x: 302 },
    { leftOfRoad: true, rotation: -QUARTER, x: 298 },
  ])("turns a lamp left of the road $leftOfRoad toward the road", ({ leftOfRoad, ...want }) => {
    expect(placed("shops", [anchorOf({ key: "test-lamp", leftOfRoad })])).toEqual([
      { ...beam, ...want, y: 197 },
    ]);
  });

  // A sprite drawn facing the pack shines its headlamp down the screen, flipped or not.
  it.each([false, true])("shines a rider's headlamp down, flipped %s", (flipX) => {
    expect(placed("shops", [anchorOf({ flipX, key: "test-rider" })])).toEqual([
      { ...beam, rotation: 0, x: 300, y: 195 },
    ]);
  });

  it("leaves out a light in a zone it does not show in", () => {
    expect(placed("shops", [anchorOf({})]).map(({ key }) => key)).toEqual(["test-beam"]);
  });

  it("follows each sprite, at its own place and scale", () => {
    const near = anchorOf({ scale: 1, x: 100, y: 400 });
    const far = anchorOf({ scale: 0.25, x: 200, y: 150 });
    expect(placed("shops", [near, far])).toEqual([
      { ...beam, groundY: 400, rotation: QUARTER, scale: 1, x: 104, y: 400 },
      { ...beam, anchor: 1, groundY: 150, rotation: QUARTER, scale: 0.25, x: 201, y: 150 },
    ]);
  });

  it("places nothing for a sprite that carries no light", () => {
    expect(placed("homeStretch", [anchorOf({ key: "no-such-sprite" })])).toEqual([]);
  });
});

describe("anchorSprite", () => {
  // A 40 x 60 frame with its feet on row 54, drawn from its full-size art or a 75% depth step
  // (30 x 45, feet on row 40), with its origin on its feet or its bottom, at 1 or 2 times.
  const FULL = { feetY: 54, fullHeight: 60, height: 60, width: 40 };
  const STEP = { feetY: 40, fullHeight: 60, height: 45, width: 30 };
  const drawn = { flipX: false, originX: 0.5, originY: 0.9, scaleX: 1, scaleY: 1, x: 100, y: 200 };
  it.each([
    { frame: FULL, name: "its full art on its feet", sprite: drawn, want: { scale: 1, y: 200 } },
    {
      frame: FULL,
      name: "its full art on its bottom",
      sprite: { ...drawn, originY: 1 },
      want: { scale: 1, y: 194 },
    },
    {
      frame: STEP,
      name: "a depth step on its bottom, doubled",
      sprite: { ...drawn, originY: 1, scaleX: 2, scaleY: 2 },
      want: { scale: 1.5, y: 190 },
    },
    {
      frame: FULL,
      name: "its full art flipped",
      sprite: { ...drawn, flipX: true, scaleX: -1 },
      want: { flipX: true, scale: 1, y: 200 },
    },
  ])("anchors a sprite drawn from $name at its feet", ({ frame, sprite, want }) => {
    const anchor = anchorOf({});
    anchorSprite(180, "test-sprite", sprite, frame, 2, anchor);
    expect(anchor).toEqual({
      flipX: false,
      frame: 2,
      key: "test-sprite",
      leftOfRoad: true,
      x: 100,
      ...want,
    });
  });

  it.each([
    [179, false],
    [180, false],
    [181, true],
  ])("stands a sprite at 180 left of a road centred at %d: %s", (centreX, left) => {
    const anchor = anchorOf({});
    anchorSprite(centreX, "test-sprite", { ...drawn, x: 180, y: 200 }, FULL, 0, anchor);
    expect(anchor.leftOfRoad).toBe(left);
  });
});
