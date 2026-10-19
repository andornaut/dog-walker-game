import { describe, expect, it } from "vitest";

import manifest from "../../public/art/manifest.json";
import { energyIconKey, temperamentIconKey, traitIconKey } from "./iconKeys";

const keys = new Set(manifest.images.map((image) => image.key));

describe("icon keys", () => {
  it("name icons the art manifest has", () => {
    const named = [
      ...(["chaser", "fancy", "foodDriven"] as const).map(traitIconKey),
      ...(["calm", "hyper", "steady"] as const).map(energyIconKey),
      ...(["dramatic", "fussy", "laidBack"] as const).map(temperamentIconKey),
    ];
    expect(named.filter((key) => !keys.has(key))).toEqual([]);
  });
});
