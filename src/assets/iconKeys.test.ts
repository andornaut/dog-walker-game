import { describe, expect, it } from "vitest";

import manifest from "../../public/art/manifest.json";
import { SCALE_STEPS } from "../layout/projection";
import { type DogStatusId, statusOverlayKey } from "../runner/statuses";
import { energyIconKey, statusIconKey, temperamentIconKey, traitIconKey } from "./iconKeys";
import { depthVariantKey } from "./spriteKeys";

const keys = new Set(manifest.images.map((image) => image.key));
const STATUSES: readonly DogStatusId[] = ["soaked", "spooked", "stinky"];

describe("icon keys", () => {
  it("name icons the art manifest has", () => {
    const named = [
      ...(["chaser", "fancy", "foodDriven"] as const).map(traitIconKey),
      ...(["calm", "hyper", "steady"] as const).map(energyIconKey),
      ...(["dramatic", "fussy", "laidBack"] as const).map(temperamentIconKey),
      ...STATUSES.map(statusIconKey),
    ];
    expect(named.filter((key) => !keys.has(key))).toEqual([]);
  });

  it("name a status loop the art manifest has at every depth variant", () => {
    const sprites = new Set(manifest.sprites.map((sprite) => sprite.key));
    const named = STATUSES.flatMap((status) =>
      SCALE_STEPS.map((step) => {
        const key = statusOverlayKey(status);
        return depthVariantKey(key, step) ?? key;
      }),
    );
    expect(named.filter((key) => !sprites.has(key))).toEqual([]);
  });
});
