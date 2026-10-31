import { describe, expect, it } from "vitest";

import { signatureTrail } from "../testing/signature";
import { data, geometry } from "../testing/walk";
import { moverHazards } from "./bot";

describe("component hazards", () => {
  it("reads separated follower contact windows after the leader has left", () => {
    const { item, path } = signatureTrail([2, 4]);
    const shown = item(geometry.roadBottom + 50);
    const hazards = moverHazards({ data, geometry, speed: 80 }, Infinity, [path], shown);
    expect(hazards.length).toBeGreaterThan(0);
    expect(hazards.some(({ from }) => from > 0)).toBe(true);
    expect(hazards.every(({ lanes }) => lanes === 1 << shown.lane)).toBe(true);
    const ordered = [...hazards].sort((a, b) => a.from - b.from);
    expect(
      ordered.some(
        (entry, index) => index > 0 && entry.from > (ordered[index - 1]?.to ?? Infinity),
      ),
    ).toBe(true);
  });
});
