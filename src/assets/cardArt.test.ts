import { describe, expect, it } from "vitest";

import manifest from "../../public/art/manifest.json";
import { gameData } from "../data";
import { SKIP_CARD_ART } from "./cardArt";

const images = new Set(manifest.images.map(({ key }) => key));

describe("card art", () => {
  it("finds every card option's, upgrade's, instant popup's and the Skip card's art", () => {
    const { encounters, upgrades } = gameData;
    const keys = [
      SKIP_CARD_ART,
      ...Object.values(encounters).flatMap(({ resolution }) =>
        resolution.kind === "instant"
          ? [resolution.art]
          : resolution.options.map((option) => option.art),
      ),
      ...Object.values(upgrades).map((upgrade) => upgrade.art),
    ];
    expect(keys.filter((key) => !images.has(key))).toEqual([]);
  });
});
