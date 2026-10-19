import { describe, expect, it } from "vitest";

import { homecomers, RETURN_HOME, returnPhase, walkUpOffset, waveOffset } from "./returnHome";

const WAVING_MS = RETURN_HOME.waveMs * RETURN_HOME.waves;

describe("homecomers", () => {
  it("brings home the dogs still walking, in pack order, without the fired ones", () => {
    const walk = {
      dogs: ["koda" as const, "nugget" as const, "biscuit" as const],
      firings: [{ dog: "nugget" as const, zone: 2 }],
    };
    expect(homecomers(walk)).toEqual(["koda", "biscuit"]);
  });

  it("brings nobody home when every owner fired you", () => {
    expect(homecomers({ dogs: ["koda"], firings: [{ dog: "koda", zone: 1 }] })).toEqual([]);
  });
});

describe("walkUpOffset", () => {
  it("starts the pack below its places and eases it up to them", () => {
    expect(walkUpOffset(false, 0)).toBe(RETURN_HOME.risePx);
    const halfway = walkUpOffset(false, RETURN_HOME.walkMs / 2);
    expect(halfway).toBeGreaterThan(0);
    expect(halfway).toBeLessThan(RETURN_HOME.risePx / 2);
    expect(walkUpOffset(false, RETURN_HOME.walkMs)).toBe(0);
  });

  it("puts everyone in place at once with reduced motion", () => {
    expect(walkUpOffset(true, 0)).toBe(0);
  });
});

describe("returnPhase", () => {
  it("walks the pack up, then has the owners wave, then everyone stands", () => {
    expect(returnPhase(false, RETURN_HOME.walkMs - 1)).toBe("walking");
    expect(returnPhase(false, RETURN_HOME.walkMs)).toBe("waving");
    expect(returnPhase(false, RETURN_HOME.walkMs + WAVING_MS - 1)).toBe("waving");
    expect(returnPhase(false, RETURN_HOME.walkMs + WAVING_MS)).toBe("home");
  });

  it("holds the owners' wave pose from the start with reduced motion", () => {
    expect(returnPhase(true, 0)).toBe("waving");
    expect(returnPhase(true, RETURN_HOME.walkMs + WAVING_MS)).toBe("waving");
  });
});

describe("waveOffset", () => {
  const start = RETURN_HOME.walkMs;
  const quarter = RETURN_HOME.waveMs / 4;

  it("holds the owners still until the pack arrives", () => {
    expect(waveOffset(false, start - quarter)).toBe(0);
  });

  it("sways the owners to each side while they wave, then stops", () => {
    expect(waveOffset(false, start + quarter)).toBe(RETURN_HOME.wavePx);
    expect(waveOffset(false, start + 3 * quarter)).toBe(-RETURN_HOME.wavePx);
    expect(waveOffset(false, start + WAVING_MS + quarter)).toBe(0);
  });

  it("never sways with reduced motion", () => {
    expect(waveOffset(true, start + quarter)).toBe(0);
  });
});
