import { describe, expect, it } from "vitest";

import { signaturePlace } from "../../runner/signaturePaths";
import { signatureTrail } from "../../testing/signature";
import { geometry, walkWith } from "../../testing/walk";
import { blendWalk } from "./interpolate";

describe("component interpolation", () => {
  it("shares one immutable route and interpolates progress before evaluating each curved phase", () => {
    const { item, path } = signatureTrail([0.01, 0.02]);
    if (path.motion !== "signature") {
      throw new Error("Expected a signature path");
    }
    const previous = walkWith(["kilo"], [item(geometry.roadTop)]);
    const current = walkWith(["kilo"], [item(geometry.roadTop + 4)]);
    const blended = blendWalk(0.25, previous, current).road.items[0];
    expect(blended?.mover?.path).toBe(path);
    expect(blended?.mover?.since).toBe(1);
    const route = path.route;
    for (const component of [0, 1, 2]) {
      expect(signaturePlace(route, blended?.mover?.since ?? -1, component)).toEqual(
        signaturePlace(route, 1, component),
      );
    }
    const curved = signaturePlace(route, 1).x;
    const interpolatedEndpoints =
      signaturePlace(route, 0).x + (signaturePlace(route, 4).x - signaturePlace(route, 0).x) * 0.25;
    expect(curved).not.toBeCloseTo(interpolatedEndpoints, 4);
  });
});
