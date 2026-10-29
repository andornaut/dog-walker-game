import { describe, expect, it } from "vitest";

import type { DogId } from "../data/types";
import type { LastWalk } from "../save/schema";
import { homecomers, RETURN_HOME, returnPhase, walkUpOffset, waveOffset } from "./returnHome";

const WAVING_MS = RETURN_HOME.waveMs * RETURN_HOME.waves;

describe("homecomers", () => {
  it("brings home the dogs still walking, in pack order, without the fired ones", () => {
    const cases: readonly {
      expected: DogId[];
      name: string;
      walk: Pick<LastWalk, "dogs" | "firings">;
    }[] = [
      {
        expected: ["kilo", "biscuit"],
        name: "brings home the dogs still walking, in pack order, without the fired ones",
        walk: {
          dogs: ["kilo", "reggie", "biscuit"],
          firings: ["reggie"],
        },
      },
      {
        expected: [],
        name: "brings nobody home when every owner fired you",
        walk: { dogs: ["kilo"], firings: ["kilo"] },
      },
    ];
    for (const { expected, walk } of cases) {
      expect(homecomers(walk)).toEqual(expected);
    }
  });
});

describe("walkUpOffset", () => {
  it("starts the pack below its places and eases it up to them", () => {
    expect(walkUpOffset(false, 0)).toBe(RETURN_HOME.risePx);
    const halfway = walkUpOffset(false, RETURN_HOME.walkMs / 2);
    expect(halfway).toBeGreaterThan(0);
    expect(halfway).toBeLessThan(RETURN_HOME.risePx / 2);
    expect(walkUpOffset(false, RETURN_HOME.walkMs)).toBe(0);
    expect(walkUpOffset(true, 0)).toBe(0);
  });
});

describe("returnPhase and waveOffset", () => {
  const start = RETURN_HOME.walkMs;
  const quarter = RETURN_HOME.waveMs / 4;
  const { wavePx } = RETURN_HOME;

  it("walks the pack up, has the owners wave, sway and stand, and holds the wave with reduced motion", () => {
    const cases: readonly [string, boolean, number, ReturnType<typeof returnPhase>, number][] = [
      ["walks the pack up, the owners still", false, start - quarter, "walking", 0],
      ["walks the pack up to the last moment", false, start - 1, "walking", 0],
      ["has the owners wave once the pack arrives", false, start, "waving", 0],
      ["sways the owners one way", false, start + quarter, "waving", wavePx],
      ["sways the owners the other way", false, start + 3 * quarter, "waving", -wavePx],
      ["waves to the last moment", false, start + WAVING_MS - 1, "waving", 0],
      ["has everyone stand after the waves", false, start + WAVING_MS, "home", 0],
      ["stops swaying after the waves", false, start + WAVING_MS + quarter, "home", 0],
      ["holds the wave pose from the start with reduced motion", true, 0, "waving", 0],
      ["never sways with reduced motion", true, start + quarter, "waving", 0],
      ["holds the wave pose to the end with reduced motion", true, start + WAVING_MS, "waving", 0],
    ];
    for (const [, reducedMotion, ms, phase, offset] of cases) {
      expect({
        offset: waveOffset(reducedMotion, ms),
        phase: returnPhase(reducedMotion, ms),
      }).toEqual({ offset, phase });
    }
  });
});
