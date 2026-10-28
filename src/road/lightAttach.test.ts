import { describe, expect, it, vi } from "vitest";

import type { ZoneId } from "../data/types";
import { type LightAnchor, newAttachedLightPlaces, placeAttachedLights } from "./lightPlaces";

// Art's lights, with a test sprite carrying a pulsing glow in Yonge Street alone and a cone set
// to point left, across the road from a prop on its right.
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
const glow = { groundY: 200, key: "test-glow", rotation: 0, scale: 0.5 };
const beam = { groundY: 200, key: "test-beam", scale: 0.5, strength: 1, y: 200 };

describe("placeAttachedLights", () => {
  // The glow 10 px right and 20 up at full size, the beam 4 right; at scale 0.5 half that. A
  // cone baked pointing down turns a quarter clockwise to point left, or back to point right.
  it.each([
    {
      anchor: anchorOf({ frame: 1 }),
      name: "a prop on the right, pointing its cone left",
      want: [
        { ...glow, strength: 0.6, x: 305, y: 190 },
        { ...beam, rotation: QUARTER, x: 302 },
      ],
    },
    {
      anchor: anchorOf({ flipX: true, frame: 1 }),
      name: "a mirrored prop, pointing its cone right",
      want: [
        { ...glow, strength: 0.6, x: 295, y: 190 },
        { ...beam, rotation: -QUARTER, x: 298 },
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

  it("leaves out a light in a zone it does not show in", () => {
    expect(placed("shops", [anchorOf({})]).map(({ key }) => key)).toEqual(["test-beam"]);
  });

  it("follows each sprite, at its own place and scale", () => {
    const near = anchorOf({ scale: 1, x: 100, y: 400 });
    const far = anchorOf({ scale: 0.25, x: 200, y: 150 });
    expect(placed("shops", [near, far])).toEqual([
      { ...beam, groundY: 400, rotation: QUARTER, scale: 1, x: 104, y: 400 },
      { ...beam, groundY: 150, rotation: QUARTER, scale: 0.25, x: 201, y: 150 },
    ]);
  });

  it("places nothing for a sprite that carries no light", () => {
    expect(placed("homeStretch", [anchorOf({ key: "no-such-sprite" })])).toEqual([]);
  });
});
