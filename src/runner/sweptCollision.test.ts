import { describe, expect, it } from "vitest";

import { type Box, type LanedBox, type PackBoxes, sweptHitDog } from "./collision";

const box = (left: number, top: number): LanedBox => ({
  bottom: top + 4,
  lanes: { left: -100, right: 100 },
  left,
  right: left + 4,
  scale: 1,
  top,
});
const pack = (left = 8): PackBoxes<"dog"> => {
  const body: Box = { bottom: 12, left, right: left + 4, top: 8 };
  return {
    centreX: 0,
    dogs: [{ ...body, dog: "dog", scale: 1 }],
    outline: body,
    walker: { bottom: 24, left, right: left + 4, scale: 1, top: 20 },
  };
};

describe("swept component contact", () => {
  it("catches a component that crosses the pack entirely between steps", () => {
    expect(sweptHitDog(pack(), pack(), box(0, 8), box(20, 8))).toBe("dog");
  });

  it("checks simultaneous overlap rather than the bounding rectangle of a diagonal", () => {
    expect(sweptHitDog(pack(), pack(), box(0, -12), box(20, 8))).toBeNull();
  });

  it("keeps the gaps between distinct components non-colliding", () => {
    expect(sweptHitDog(pack(), pack(), box(0, 8), box(0, 8))).toBeNull();
    expect(sweptHitDog(pack(), pack(), box(20, 8), box(20, 8))).toBeNull();
  });

  it("uses relative movement when the pack and component move together", () => {
    expect(sweptHitDog(pack(), pack(28), box(0, 8), box(20, 8))).toBeNull();
  });

  it("retains the current lane clipping and rejects edge-only contact", () => {
    expect(sweptHitDog(pack(), pack(), box(4, 8), box(4, 8))).toBeNull();
    const clipped = { ...box(8, 8), lanes: { left: 20, right: 24 } };
    expect(sweptHitDog(pack(), pack(), clipped, clipped)).toBeNull();
  });
});
