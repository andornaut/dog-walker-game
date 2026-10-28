import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { WalkerId, ZoneId } from "../data/types";
import { fillNames } from "../lib/lines";
import { keysOf } from "../lib/records";
import { cents, type Hearts } from "../lib/units";
import type { Change, MoneyChange } from "../rules/causes";
import { agilityPercent } from "../rules/effectText";
import { perkIconKey } from "./effectIcons";
import { celebrationText, zoneBannerHeading, zoneCelebration } from "./zoneCelebration";

const STREET = gameData.world.zones.find(({ id }) => id === "street")?.name ?? "";

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

describe("zoneCelebration", () => {
  // Each zone's walker joins only while not owned; a walker who joined earlier in the walk is
  // not owned yet, and still does not join again.
  // Each walker joins on finishing the zone their data names, while not owned.
  const goal = (walker: WalkerId): ZoneId => {
    const data = gameData.walkers[walker];
    return data.unlock === "start" ? "street" : data.zone;
  };
  it("lets a walker join on finishing their zone only while not owned", () => {
    for (const { expected, finished, owned } of [
      { expected: "mrB", finished: ["street", goal("mrB")], owned: ["casey"] },
      { expected: "ada", finished: ["street", goal("ada")], owned: ["casey"] },
      { expected: "trista", finished: ["street", goal("trista")], owned: ["casey"] },
      { expected: null, finished: ["street", goal("mrB")], owned: ["casey", "mrB"] },
      { expected: null, finished: ["street"], owned: ["casey"] },
      { expected: null, finished: [goal("mrB")], owned: ["ada", "mrB", "casey", "trista"] },
    ] satisfies readonly { expected: WalkerId | null; finished: ZoneId[]; owned: WalkerId[] }[]) {
      const finish = { changes: [], finished, walker: "casey", zone: STREET } as const;
      const joined = zoneCelebration(gameData, owned, finish);
      expect(joined.kind === "newWalker" ? joined.walker : null).toBe(expected);
    }
  });

  it("counts the zone's fees and tips, and leaves out bumps and hearts", () => {
    const finish = {
      changes: ZONE_CHANGES,
      finished: ["street"],
      walker: "mrB",
      zone: STREET,
    } as const;
    expect(zoneCelebration(gameData, ["mrB", "casey"], finish)).toEqual({
      fees: 18000,
      kind: "zoneDone",
      tips: 800,
      walker: "mrB",
      zone: STREET,
    });
  });
});

describe("celebrationText", () => {
  const text = gameData.runText;

  it("heads Zone done with the zone and writes its fees and tips as gains in dollars", () => {
    const celebration = {
      fees: cents(24000),
      kind: "zoneDone",
      tips: cents(3800),
      walker: "casey",
      zone: "Willow Crescent",
    } as const;
    const shown = celebrationText(gameData, celebration);
    expect(shown).toMatchObject({
      button: text.zoneDone.button,
      kind: "zoneDone",
      subtitle: text.zoneDone.subtitle.replace("{zone}", "Willow Crescent"),
      title: text.zoneDone.title,
    });
    if (shown.kind !== "zoneDone") {
      throw new Error("a zone's text");
    }
    const filled = text.zoneDone.earnings.replace("{fees}", "+$240").replace("{tips}", "+$38");
    expect(shown.earnings.map((part) => part.text).join("")).toBe(filled);
    expect(shown.earnings.filter((part) => part.kind === "money")).toEqual([
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
      const filled =
        percent === null
          ? fillNames(text.newWalker.infoBase, { perk: perkName })
          : fillNames(text.newWalker.info, { agility: percent, perk: perkName });
      expect(shown.info.map((part) => part.text).join("")).toBe(filled);
      expect(shown.info.filter((part) => part.kind === "icon")).toEqual([
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
