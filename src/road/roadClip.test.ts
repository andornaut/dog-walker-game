import { describe, expect, it } from "vitest";

import { SCREEN_CONFIG } from "../data/screen";
import { screenLayout } from "../layout/screenLayout";
import { rowsAboveJuncture, rowsHidden } from "./roadClip";

const { approach, junction, road } = screenLayout(SCREEN_CONFIG);
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
    { ground: road.y, height: 40, name: "on the road's far edge" },
    { ground: road.y + 60, height: 8, name: "nearer" },
  ])("draws a sprite standing $name whole", ({ ground, height }) => {
    expect(rowsHidden(JUNCTURE, ground, { height, scale: 0.5, top: ground - height / 2 })).toBe(0);
  });

  // Its frame may run a few rows below its ground, which still show.
  it.each([
    { below: 0, ground: JUNCTURE - 1, height: 64, hidden: 64 },
    { below: 0, ground: JUNCTURE - 4, height: 30, hidden: 30 },
    { below: 3, ground: JUNCTURE - 1, height: 30, hidden: 28 },
  ])(
    "hides a sprite standing on row $ground, past the juncture, above the juncture",
    ({ below, ground, height, hidden }) => {
      const drawn = { height, scale: 1, top: ground + below - height };
      expect(rowsHidden(JUNCTURE, ground, drawn)).toBe(hidden);
    },
  );
});
