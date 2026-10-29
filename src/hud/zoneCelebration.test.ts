import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { WalkerId } from "../data/types";
import { fillNames } from "../lib/lines";
import { keysOf } from "../lib/records";
import { cents, type Hearts } from "../lib/units";
import type { Change, MoneyChange } from "../rules/causes";
import { agilityPercent } from "../rules/effectText";
import { walkerGoal, walkerOrder } from "../rules/walkers";
import { perkIconKey } from "./effectIcons";
import {
  celebrationText,
  newWalkerCelebrations,
  zoneBannerHeading,
  zoneCelebration,
} from "./zoneCelebration";

const DISTILLERY_DISTRICT =
  gameData.world.zones.find(({ id }) => id === "distilleryDistrict")?.name ?? "";

function money(kind: "bump" | "pay" | "tip", amount: number): MoneyChange {
  return {
    amount: cents(amount),
    causes: [{ amount, kind }],
    dog: kind === "pay" ? "kilo" : null,
    kind: "money",
  };
}

const hearts: Change = {
  after: 3 as Hearts,
  before: 4 as Hearts,
  causes: [{ amount: -1, kind: "bump" }],
  dog: "kilo",
  kind: "hearts",
};

const ZONE_CHANGES: readonly Change[] = [
  money("tip", 300),
  hearts,
  money("bump", -200),
  money("tip", 500),
  money("pay", 12000),
  money("pay", 6000),
];

describe("newWalkerCelebrations", () => {
  const goal = (walker: WalkerId) => walkerGoal(gameData.walkers[walker]) ?? 0;
  const starting = keysOf(gameData.walkers).filter(
    (id) => walkerGoal(gameData.walkers[id]) === null,
  );
  const joins = (walkers: readonly WalkerId[]) =>
    walkers.map((walker) => ({ kind: "newWalker", walker }));
  // The walkers a walk finished with this many dogs still walking reaches, in unlock order.
  const reached = (dogs: number) =>
    walkerOrder(gameData).filter((id) => !starting.includes(id) && goal(id) <= dogs);

  it.each([1, 2, 3])(
    "plays one New walker per walker a walk finished with %i dogs unlocks, fewest dogs first",
    (dogs) => {
      const played = newWalkerCelebrations(gameData, starting, dogs);
      expect(played).toEqual(joins(reached(dogs)));
      expect(played.map(({ walker }) => goal(walker))).toEqual(
        reached(dogs)
          .map(goal)
          .sort((a, b) => a - b),
      );
    },
  );

  it.each([1, 2, 3])("plays none for a walker already unlocked, of those %i dogs reach", (dogs) => {
    const owned = [...starting, ...reached(dogs)];
    expect(newWalkerCelebrations(gameData, owned, dogs)).toEqual([]);
    const first = reached(dogs)[0];
    const rest = reached(dogs).slice(1);
    if (first !== undefined) {
      expect(newWalkerCelebrations(gameData, [...starting, first], dogs)).toEqual(joins(rest));
    }
  });

  it("plays none for a walk not finished", () => {
    expect(newWalkerCelebrations(gameData, starting, null)).toEqual([]);
  });
});

describe("zoneCelebration", () => {
  it("counts the zone's fees and tips, and leaves out bumps and hearts", () => {
    const finish = {
      changes: ZONE_CHANGES,
      walker: "mrB",
      zone: DISTILLERY_DISTRICT,
    } as const;
    expect(zoneCelebration(finish)).toEqual({
      fees: 18000,
      kind: "zoneDone",
      tips: 800,
      walker: "mrB",
      zone: DISTILLERY_DISTRICT,
    });
  });
});

describe("celebrationText", () => {
  const text = gameData.runText;

  const zoneDone = (fees: number, tips: number) =>
    ({
      fees: cents(fees),
      kind: "zoneDone",
      tips: cents(tips),
      walker: "casey",
      zone: "Willow Crescent",
    }) as const;
  const { earnings } = text.zoneDone;
  const part = (key: "fees" | "tips", amount: string) => earnings[key].replace("{amount}", amount);

  it.each([
    ["every earning", zoneDone(24000, 3800), [part("fees", "+$240"), part("tips", "+$38")]],
    ["no $0 tips", zoneDone(24000, 0), [part("fees", "+$240")]],
    ["the fees alone when nothing paid", zoneDone(0, 0), [part("fees", "+$0")]],
  ] as const)("writes %s as gains in dollars", (_name, celebration, parts) => {
    const shown = celebrationText(gameData, celebration);
    if (shown.kind !== "zoneDone") {
      throw new Error("a zone's text");
    }
    expect(shown.earnings.map(({ text: said }) => said).join("")).toBe(
      parts.join(earnings.separator),
    );
  });

  it("heads Zone done with the zone and its amounts as money", () => {
    const shown = celebrationText(gameData, zoneDone(24000, 3800));
    expect(shown).toMatchObject({
      button: text.zoneDone.button,
      kind: "zoneDone",
      subtitle: text.zoneDone.subtitle.replace("{zone}", "Willow Crescent"),
      title: text.zoneDone.title,
    });
    if (shown.kind !== "zoneDone") {
      throw new Error("a zone's text");
    }
    expect(shown.earnings.filter(({ kind }) => kind === "money")).toEqual([
      { kind: "money", text: "+$240" },
      { kind: "money", text: "+$38" },
    ]);
  });

  // A walker at the base lane-change speed and one off it: the info reads only which it is.
  const atBase = (walker: WalkerId) => agilityPercent(gameData.walkers[walker].agility) === null;
  const walkers = keysOf(gameData.walkers);
  const sampled = [walkers.find(atBase), walkers.find((walker) => !atBase(walker))].filter(
    (walker): walker is WalkerId => walker !== undefined,
  );
  it.each(sampled)(
    "names new walker %s, with its own agility against the base, if not at it, and perk icon",
    (walker) => {
      const shown = celebrationText(gameData, { kind: "newWalker", walker });
      const { agility, name, perk } = gameData.walkers[walker];
      expect(shown).toMatchObject({
        button: text.newWalker.button,
        greeting: gameData.walkers[walker].greeting,
        subtitle: text.newWalker.subtitle.replace("{walker}", name),
        title: text.newWalker.title,
      });
      if (shown.kind !== "newWalker") {
        throw new Error("a new walker's text");
      }
      const percent = agilityPercent(agility);
      const perkName = gameData.walkerPerks[perk].name;
      const perkLine = fillNames(text.newWalker.perk, { perk: perkName });
      const filled =
        percent === null
          ? [perkLine]
          : [fillNames(text.newWalker.agility, { agility: percent }), perkLine];
      expect(shown.info.map((line) => line.map((part) => part.text).join(""))).toEqual(filled);
      expect(shown.info.flat().filter((part) => part.kind === "icon")).toEqual([
        { icon: perkIconKey(perk), kind: "icon", text: perkName },
      ]);
    },
  );
});

describe("zoneBannerHeading", () => {
  const places = Array.from({ length: gameData.world.walkLength }, (_, zoneIndex) => zoneIndex);

  it("names the world and each zone's place in the walk, from 1, never the word zone", () => {
    for (const zoneIndex of places) {
      const heading = zoneBannerHeading(gameData, { zoneIndex });
      expect(heading).toBe(
        fillNames(gameData.runText.zoneBanner, {
          n: String(zoneIndex + 1),
          world: gameData.world.name,
        }),
      );
      expect(heading).not.toMatch(/\bzone\b/i);
    }
  });
});
