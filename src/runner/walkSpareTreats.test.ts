import { describe, expect, it } from "vitest";

import type { GearId } from "../data/types";
import { treatGrabLine, treatLine } from "../hud/stripLines";
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
const treatCash = read(tuning, "money", "treatCash");

// A treat grabbed with every owner at their max or not, and the Fanny pack with room, full or not
// owned: the front owner's hearts it gave, the spare treat it stored, the cash it paid and the
// strip line it said (treatGrabLine): the treat's own line, the spare treat's or the cash's.
describe("a treat grabbed", () => {
  const ROOM = { gear: "fannyPack", held: 0, pack: "with room in the Fanny pack" } as const;
  const FULL = { gear: "fannyPack", held: room, pack: "with the Fanny pack full" } as const;
  const NONE = { gear: null, held: 0, pack: "with no Fanny pack" } as const;
  const fed = { atMax: false, cash: 0, hearts: treat, line: "treat", stored: 0 } as const;
  const paid = { atMax: true, cash: treatCash, hearts: 0, line: "treatCash", stored: 0 } as const;
  it.each([
    { ...ROOM, ...fed },
    { ...FULL, ...fed },
    { ...NONE, ...fed },
    { ...ROOM, atMax: true, cash: 0, hearts: 0, line: "spareTreatSaved", stored: 1 },
    { ...FULL, ...paid },
    { ...NONE, ...paid },
  ] as const)(
    "at max $atMax $pack gives $hearts hearts, stores $stored and pays $cash",
    ({ atMax, cash, gear, hearts, held, line, stored }) => {
      const geared = walkGeared(gear, held, ["kilo", "lady"], [atPack("treat")]);
      const walk = atMax ? geared : withHearts(1, geared);
      const { tips, treats, walk: after } = step(walk);
      const [grab] = treats;
      expect(treats).toHaveLength(1);
      expect((heartsByDog(after.run).kilo ?? 0) - (heartsByDog(walk.run).kilo ?? 0)).toBe(hearts);
      expect(after.run.spareTreats).toEqual({ held: held + stored, spent: 0, stored });
      expect(after.run.money - walk.run.money).toBe(cash);
      expect(grab?.cash?.amount ?? 0).toBe(cash);
      const said = grab === undefined ? null : treatGrabLine(data, grab, after.run);
      expect(said?.text).toBe(
        line === "treat" ? treatLine(data, grab?.change ?? null)?.text : data.runText.strip[line],
      );
      // The cash is never a tip: no tip grabbed, and the tips tally unchanged.
      expect(tips).toEqual([]);
      expect(after.run.tallies.tips).toBe(walk.run.tallies.tips);
    },
  );
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
