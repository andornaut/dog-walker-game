import { describe, expect, it } from "vitest";

import type { GearId } from "../data/types";
import { spareTreatRoom } from "../rules/spareTreats";
import { read } from "../rules/units";
import { newRun, type PackDogs } from "../state/runState";
import { heartsByDog } from "../testing/runState";
import { atPack, data, step, tuning, walkWith, withHearts } from "../testing/walk";
import type { Walk } from "./walk";
import type { WalkItem } from "./walkItems";

// A walk of dogs with gear in the Pocket, holding held spare treats.
function walkGeared(gear: GearId | null, held: number, dogs: PackDogs, items: WalkItem[]): Walk {
  const walk = walkWith(dogs, items);
  const run = newRun(data, 3, { dogs, gear, walker: walk.run.walker });
  return { ...walk, run: { ...run, spareTreats: { held, spent: 0, stored: 0 } } };
}

const room = spareTreatRoom(
  data,
  newRun(data, 3, { dogs: ["kilo"], gear: "fannyPack", walker: "casey" }),
);
const bump = read(tuning, "hearts", "bump");
const treat = read(tuning, "hearts", "treat");

describe("a treat grabbed at every owner's max", () => {
  it.each([
    { gear: "fannyPack", held: 0, name: "goes into the Fanny pack", stored: true },
    { gear: "fannyPack", held: room, name: "is wasted with the Fanny pack full", stored: false },
    { gear: null, held: 0, name: "is wasted with no Fanny pack", stored: false },
  ] as const)("$name", ({ gear, held, stored }) => {
    const walk = walkGeared(gear, held, ["kilo", "biscuit"], [atPack("treat")]);
    const { treats, walk: after } = step(walk);
    expect(treats.map((grab) => [grab.change, grab.stored])).toEqual([[null, stored]]);
    expect(heartsByDog(after.run)).toEqual(heartsByDog(walk.run));
    expect(after.run.spareTreats).toEqual({
      held: held + (stored ? 1 : 0),
      spent: 0,
      stored: stored ? 1 : 0,
    });
  });

  it("goes to an owner below their max as ever, with room in the Fanny pack", () => {
    const walk = withHearts(1, walkGeared("fannyPack", 0, ["kilo"], [atPack("treat")]));
    const { treats, walk: after } = step(walk);
    expect(treats.map((grab) => grab.stored)).toEqual([false]);
    expect(heartsByDog(after.run).kilo).toBe(1 + treat);
    expect(after.run.spareTreats.held).toBe(0);
  });
});

describe("a bump with a spare treat held", () => {
  it.each([
    {
      fired: [],
      hearts: treat,
      held: 1,
      name: "gives the heart back, so the owner keeps walking",
      spent: "kilo",
    },
    {
      fired: ["kilo"],
      hearts: undefined,
      held: 0,
      name: "fires the owner with none held",
      spent: null,
    },
  ])("on the owner's last heart $name", ({ fired, hearts, held, spent }) => {
    const walk = withHearts(bump, walkGeared("fannyPack", held, ["kilo"], [atPack("cone")]));
    const stepped = step(walk);
    expect(stepped.fired).toEqual(fired);
    expect(stepped.spareTreat?.dog ?? null).toBe(spent);
    expect(heartsByDog(stepped.walk.run).kilo).toBe(hearts);
    expect(stepped.walk.run.spareTreats).toEqual({ held: 0, spent: held, stored: 0 });
  });
});
