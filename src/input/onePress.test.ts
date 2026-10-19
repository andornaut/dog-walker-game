import { describe, expect, it } from "vitest";

import { chance, randomInt, seededRandom } from "../runner/random";
import { followOnePress } from "./onePress";
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

  it("hands a cancel to the followed press and lets the next press in", () => {
    const step = followOnePress(true, "cancel", 1, 1);
    expect(step).toEqual({ handle: true, owner: undefined });
  });

  it("frees the scene from a press whose release it never saw once that pointer is up", () => {
    expect(followOnePress(false, "down", 2, 1)).toEqual({ handle: true, owner: 2 });
    expect(followOnePress(true, "down", 2, 1)).toEqual({ handle: false, owner: 1 });
  });

  it("takes a new press of the followed pointer as a fresh one", () => {
    expect(followOnePress(true, "down", 1, 1)).toEqual({ handle: true, owner: 1 });
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
