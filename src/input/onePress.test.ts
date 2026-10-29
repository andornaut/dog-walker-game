import { chance, randomInt, seededRandom } from "@andornaut/game-kit/random";
import { describe, expect, it } from "vitest";

import { followOnePress, type OnePressStep } from "./onePress";
import type { PointerPhase } from "./pointerTracking";

describe("followOnePress", () => {
  it("follows the first pointer down until it lifts, ignoring a second finger", () => {
    let owner: number | undefined;
    const handled: string[] = [];
    const steps: [PointerPhase, number][] = [
      ["down", 1],
      ["down", 2],
      ["move", 2],
      ["move", 1],
      ["up", 2],
      ["up", 1],
      ["down", 2],
    ];
    for (const [phase, id] of steps) {
      const step = followOnePress(owner !== undefined, phase, id, owner);
      owner = step.owner;
      if (step.handle) {
        handled.push(`${phase} ${id}`);
      }
    }
    expect(handled).toEqual(["down 1", "move 1", "up 1", "down 2"]);
  });

  // Pointer 1 is followed; ownerDown says whether it is still on the screen.
  const step = (handle: boolean, owner: number | undefined): OnePressStep => ({ handle, owner });

  it("acts once per press", () => {
    for (const [, ownerDown, phase, id, expected] of [
      [
        "hands a cancel to the followed press, then frees it",
        true,
        "cancel",
        1,
        step(true, undefined),
      ],
      ["frees the scene from a press whose release it never saw", false, "down", 2, step(true, 2)],
      ["keeps another press out while the followed one is down", true, "down", 2, step(false, 1)],
      ["takes a new press of the followed pointer as a fresh one", true, "down", 1, step(true, 1)],
    ] satisfies readonly [string, boolean, PointerPhase, number, OnePressStep][]) {
      expect(followOnePress(ownerDown, phase, id, 1)).toEqual(expected);
    }
  });
});

// Random presses by three pointers, some releases unseen. Down is the set of pointers held
// physically, and the scene must only ever handle the earliest of them still held, if any.
describe("followOnePress fuzz", () => {
  it("hands the scene one finger's press at a time, and the next press once it has lifted", () => {
    for (let seed = 1; seed <= 300; seed += 1) {
      const random = seededRandom(seed);
      let owner: number | undefined;
      // The pointer whose down the scene handled, until it handles that press's end.
      let open: number | undefined;
      const down: number[] = [];
      const send = (phase: PointerPhase, id: number) => {
        const step = followOnePress(owner !== undefined && down.includes(owner), phase, id, owner);
        owner = step.owner;
        if (step.handle && phase !== "down") {
          expect(id).toBe(open);
        }
        if (step.handle) {
          open = phase === "down" || phase === "move" ? id : undefined;
        }
        return step.handle;
      };
      for (let i = 0; i < 100; i += 1) {
        const id = randomInt(random, 0, 3);
        const held = down.includes(id);
        if (!held) {
          const ownerHeld = owner !== undefined && down.includes(owner);
          down.push(id);
          expect(send("down", id)).toBe(!ownerHeld);
        } else if (chance(random, 0.5)) {
          expect(send("move", id)).toBe(id === owner);
        } else {
          down.splice(down.indexOf(id), 1);
          // Some releases go to another scene.
          if (chance(random, 0.7)) {
            const owned = id === owner;
            expect(send(chance(random, 0.2) ? "cancel" : "up", id)).toBe(owned);
          }
        }
      }
      for (const id of [...down]) {
        down.splice(down.indexOf(id), 1);
      }
      expect(send("down", randomInt(random, 0, 3))).toBe(true);
    }
  });
});
