import { describe, expect, it } from "vitest";

import { SCREEN_LAYOUT } from "../data/screen";
import { fadeIn, rowsAboveJuncture, rowsHidden } from "./roadClip";

const { approach, junction, road } = SCREEN_LAYOUT;
const JUNCTURE = junction.y;

describe("rowsAboveJuncture", () => {
  it.each([
    { hidden: 0, name: "wholly below", scale: 1, top: JUNCTURE + 5 },
    { hidden: 10, name: "partly above", scale: 1, top: JUNCTURE - 10 },
    { hidden: 20, name: "partly above, at half scale", scale: 0.5, top: JUNCTURE - 10 },
    { hidden: 1, name: "straddling by a part of a row", scale: 1, top: JUNCTURE - 0.5 },
    { hidden: 30, name: "wholly above", scale: 1, top: JUNCTURE - 40 },
  ])("hides the rows of a sprite $name the juncture, at its scale", ({ hidden, scale, top }) => {
    expect(rowsAboveJuncture(JUNCTURE, { height: 30, scale, top })).toBe(hidden);
  });
});

describe("rowsHidden", () => {
  // A tall prop or item standing on the road near the cross street, its top over the band.
  it.each([
    { ground: JUNCTURE, height: 64, name: "on the juncture's row" },
    { ground: approach.y + 3, height: 120, name: "on the approach" },
  ])("draws a sprite standing $name whole", ({ ground, height }) => {
    expect(rowsHidden(JUNCTURE, ground, { height, scale: 0.5, top: ground - height / 2 })).toBe(0);
  });

  // Its frame may run a few rows below its ground, which still show.
  it.each([
    { below: 0, ground: JUNCTURE - 1, height: 64, hidden: 64 },
    { below: 3, ground: JUNCTURE - 1, height: 30, hidden: 28 },
  ])(
    "hides a sprite standing on row $ground, past the juncture, above the juncture",
    ({ below, ground, height, hidden }) => {
      const drawn = { height, scale: 1, top: ground + below - height };
      expect(rowsHidden(JUNCTURE, ground, drawn)).toBe(hidden);
    },
  );
});

describe("fadeIn", () => {
  const span = road.y - JUNCTURE;
  it.each([
    { alpha: 0, ground: JUNCTURE - 4, name: "past the juncture" },
    { alpha: 0, ground: JUNCTURE, name: "on the juncture's row" },
    { alpha: 0.5, ground: JUNCTURE + span / 2, name: "halfway to the far edge" },
    { alpha: 1, ground: road.y, name: "on the road's far edge" },
    { alpha: 1, ground: road.y + 100, name: "nearer" },
  ])("shows a sprite standing $name at $alpha", ({ alpha, ground }) => {
    expect(fadeIn(JUNCTURE, road.y, ground)).toBeCloseTo(alpha);
  });

  it("rises row by row from the juncture to the far edge", () => {
    const alphas = Array.from({ length: span + 1 }, (_, k) =>
      fadeIn(JUNCTURE, road.y, JUNCTURE + k),
    );
    expect(alphas.every((alpha, k) => k === 0 || alpha > (alphas[k - 1] ?? 1))).toBe(true);
  });
});
