import { describe, expect, it } from "vitest";

import { DEBUFFS } from "../data/debuffs";
import { DOGS } from "../data/dogs";
import { ENCOUNTERS } from "../data/encounters";
import { HOME_TEXT } from "../data/homeText";
import { QUIPS } from "../data/quips";
import { RUN_TEXT } from "../data/runText";
import { SHOP_GEAR } from "../data/shop";
import { TUNING } from "../data/tuning";
import type {
  CardOption,
  EncounterId,
  GearId,
  UpgradeId,
  WalkerId,
  WalkerPerkId,
} from "../data/types";
import { UPGRADES } from "../data/upgrades";
import { placeInPack } from "../state/pack";
import {
  type CardSource,
  type EffectSource,
  type ModifierSource,
  newRun,
  type RunState,
} from "../state/runState";
import { TEST_TUNING } from "../testing/tuning";
import { TEST_WALKER_DATA } from "../testing/walkers";
import { TEST_WORLD } from "../testing/world";
import { cardFor, chooseOption, openCard } from "./choices";
import { maxHearts } from "./dogs";
import { applyEffects } from "./effects";
import type { ModifiedValue } from "./modified";
import { currentZone } from "./route";
import { standingModified } from "./standing";
import { read, roundDollars } from "./units";
import { zoneStats } from "./zones";

// The test tuning with every walker's perk in force.
const tuning = {
  ...TEST_TUNING,
  counts: { ...TEST_TUNING.counts, longReachLanes: TUNING.counts.longReachLanes },
  hearts: { ...TEST_TUNING.hearts, secondChanceForgiven: TUNING.hearts.secondChanceForgiven },
  multipliers: {
    ...TEST_TUNING.multipliers,
    keenEyeTipSpawns: TUNING.multipliers.keenEyeTipSpawns,
    keenEyeTreatSpawns: TUNING.multipliers.keenEyeTreatSpawns,
    quickRecoveryDebuffFactor: TUNING.multipliers.quickRecoveryDebuffFactor,
  },
};
const data = {
  debuffs: DEBUFFS,
  dogs: DOGS,
  encounters: ENCOUNTERS,
  homeText: HOME_TEXT,
  quips: QUIPS,
  runText: RUN_TEXT,
  shopGear: SHOP_GEAR,
  ...TEST_WALKER_DATA,
  tuning,
  upgrades: UPGRADES,
  world: TEST_WORLD,
};

function walkerWith(perk: WalkerPerkId): WalkerId {
  const walker = (Object.keys(data.walkers) as WalkerId[]).find(
    (id) => data.walkers[id].perk === perk,
  );
  if (walker === undefined) {
    throw new Error(`No walker has ${perk}`);
  }
  return walker;
}

// Walkers whose perks change none of the values a case checks.
const PLAIN = walkerWith("keenEye");
const PLAIN_FOR_SPAWNS = walkerWith("quickRecovery");

// A lone small dog's run, with the walker and gear given and the upgrades picked. A small
// dog's max stays below hearts.maxOwnerHearts with every bonus.
function runWith(
  walker: WalkerId,
  gear: GearId | null = null,
  upgrades: readonly UpgradeId[] = [],
): RunState {
  return upgrades.reduce(
    (state, upgrade) =>
      applyEffects(
        data,
        { affected: [], source: { kind: "upgrade", upgrade } },
        data.upgrades[upgrade].effects,
        state,
      ),
    newRun(data, 3, { dogs: ["duchess"], gear, walker }),
  );
}

// The index of the encounter's first option with an effect of kind, and that effect.
function optionWith<Kind extends CardOption["effects"][number]["kind"]>(
  encounter: EncounterId,
  kind: Kind,
): {
  readonly effect: Extract<CardOption["effects"][number], { kind: Kind }>;
  readonly index: number;
} {
  const { resolution } = ENCOUNTERS[encounter];
  const options: readonly CardOption[] = resolution.kind === "card" ? resolution.options : [];
  for (const [index, option] of options.entries()) {
    const effect = option.effects.find(
      (candidate): candidate is Extract<CardOption["effects"][number], { kind: Kind }> =>
        candidate.kind === kind,
    );
    if (effect !== undefined) {
      return { effect, index };
    }
  }
  throw new Error(`${encounter} has no ${kind} option`);
}

const cardSource = (encounter: EncounterId): CardSource => ({
  affected: ["duchess"],
  encounter,
  kind: "encounter",
});

// The option's modified values on the card, checked against those its choice reports.
function optionModified(encounter: EncounterId, index: number, state: RunState): ModifiedValue[] {
  const source = cardSource(encounter);
  const opened = openCard(source, state);
  const card = cardFor(data, opened, source);
  const shown = card.options.find((option) => option.index === index)?.modified ?? [];
  expect(chooseOption(data, opened, card, index).modified).toEqual(shown);
  return [...shown];
}

const sources = {
  bigTipper: { kind: "upgrade", upgrade: "bigTipper" },
  fannyPack: { gear: "fannyPack", kind: "gear" },
  goodLeash: { kind: "upgrade", upgrade: "goodLeash" },
  hallPass: { gear: "hallPass", kind: "gear" },
  keenEye: { kind: "walker", walker: walkerWith("keenEye") },
  longReach: { kind: "walker", walker: walkerWith("longReach") },
  luckyCollar: { gear: "luckyCollar", kind: "gear" },
  quickRecovery: { kind: "walker", walker: walkerWith("quickRecovery") },
  runningShoes: { gear: "runningShoes", kind: "gear" },
  rushHour: { kind: "upgrade", upgrade: "rushHour" },
  secondChance: { kind: "walker", walker: walkerWith("secondChance") },
  sweetTalker: { kind: "upgrade", upgrade: "sweetTalker" },
} as const satisfies Record<string, EffectSource>;

const by = (amount: number, source: ModifierSource) => [{ amount, kind: "modifier", source }];

// The spawn counts the run's zone has before modifiers.
const spawnStats = (state: RunState) =>
  zoneStats(tuning, currentZone(data, state), state.zoneIndex);

describe("a card option's modified values", () => {
  const thiefPays = optionWith("thief", "money");
  const thiefHearts = optionWith("thief", "hearts");
  const skunkDebuff = optionWith("skunk", "debuff");
  const letGo = read(tuning, "money", thiefPays.effect.amount);
  const seconds = read(tuning, "seconds", DEBUFFS[skunkDebuff.effect.debuff].seconds);
  const calmed = seconds * read(tuning, "multipliers", "quickRecoveryDebuffFactor");
  const cut = roundDollars(letGo * read(tuning, "multipliers", "fannyPackCardCostFactor"));

  it.each([
    [
      "Fanny pack cuts the cost",
      () =>
        optionModified("thief", thiefPays.index, { ...runWith(PLAIN, "fannyPack"), money: letGo }),
      [
        {
          after: -cut,
          before: -letGo,
          by: by(letGo - cut, sources.fannyPack),
          subject: { kind: "money" },
        },
      ],
    ],
    [
      "Sweet talker waives a cost Fanny pack would cut",
      () => optionModified("thief", thiefPays.index, runWith(PLAIN, "fannyPack", ["sweetTalker"])),
      [
        {
          after: 0,
          before: -letGo,
          by: by(letGo, sources.sweetTalker),
          subject: { kind: "money" },
        },
      ],
    ],
    [
      "Sweet talker waives the cost",
      () => optionModified("thief", thiefPays.index, runWith(PLAIN, null, ["sweetTalker"])),
      [
        {
          after: 0,
          before: -letGo,
          by: by(letGo, sources.sweetTalker),
          subject: { kind: "money" },
        },
      ],
    ],
    [
      "Second chance forgives the loss",
      () => optionModified("thief", thiefHearts.index, runWith(walkerWith("secondChance"))),
      [
        {
          after: 0,
          before: thiefHearts.effect.amount,
          by: [
            {
              amount: -thiefHearts.effect.amount,
              forgives: true,
              kind: "modifier",
              source: sources.secondChance,
            },
          ],
          subject: { dog: "duchess", kind: "hearts" },
        },
      ],
    ],
    [
      "Quick recovery shortens the debuff",
      () => optionModified("skunk", skunkDebuff.index, runWith(walkerWith("quickRecovery"))),
      [
        {
          after: calmed,
          before: seconds,
          by: by(calmed - seconds, sources.quickRecovery),
          subject: { debuff: skunkDebuff.effect.debuff, kind: "debuffSeconds" },
        },
      ],
    ],
    [
      "nothing changes an option with no modifier",
      () => optionModified("thief", thiefHearts.index, runWith(PLAIN)),
      [],
    ],
  ] as const)("%s", (_, modified, expected) => {
    expect(modified()).toEqual(expected);
  });

  it.each([
    ["hallPass", [{ after: 1, before: 0, by: by(1, sources.hallPass), subject: { kind: "skip" } }]],
    [null, []],
  ] as const)("with gear %s, the card's Skip names it", (gear, expected) => {
    const source = cardSource("thief");
    const opened = openCard(source, runWith(PLAIN, gear));
    expect(cardFor(data, opened, source).modified).toEqual(expected);
  });
});

describe("standingModified", () => {
  const agility = (walker: WalkerId) => data.walkers[walker].agility;
  const reach = read(tuning, "counts", "longReachLanes");
  const duchess = (state: RunState, modifiers: RunState["modifiers"]) =>
    maxHearts(tuning, modifiers, placeInPack(state, "duchess"), DOGS.duchess);
  const rushed = (base: number, factor: "rushHourObstacles" | "rushHourTips" | "rushHourTreats") =>
    Math.round(base * read(tuning, "multipliers", factor));

  it.each([
    [
      "Lucky collar",
      runWith(PLAIN, "luckyCollar"),
      sources.luckyCollar,
      (state: RunState) => [
        {
          after: duchess(state, state.modifiers),
          before: duchess(state, []),
          by: by(duchess(state, state.modifiers) - duchess(state, []), sources.luckyCollar),
          subject: { dog: "duchess", kind: "maxHearts" },
        },
      ],
    ],
    [
      "Running shoes",
      runWith(PLAIN, "runningShoes"),
      sources.runningShoes,
      () => {
        const after = agility(PLAIN) + read(tuning, "multipliers", "runningShoesAgility");
        return [
          {
            after,
            before: agility(PLAIN),
            by: by(after - agility(PLAIN), sources.runningShoes),
            subject: { kind: "agility" },
          },
        ];
      },
    ],
    [
      "Long reach",
      runWith(walkerWith("longReach")),
      sources.longReach,
      () =>
        (["tip", "treat"] as const).map((pickup) => ({
          after: reach,
          before: 0,
          by: by(reach, sources.longReach),
          subject: { kind: "reach", pickup },
        })),
    ],
    [
      "Good leash",
      runWith(PLAIN, null, ["goodLeash"]),
      sources.goodLeash,
      () => [
        { after: 0, before: 1, by: by(-1, sources.goodLeash), subject: { kind: "squirrelPulls" } },
      ],
    ],
    [
      "Keen eye",
      runWith(walkerWith("keenEye")),
      sources.keenEye,
      (state: RunState) => {
        const stats = spawnStats(state);
        return (
          [
            ["tips", stats.tips, "keenEyeTipSpawns"],
            ["treats", stats.treats, "keenEyeTreatSpawns"],
          ] as const
        ).flatMap(([spawn, base, factor]) => {
          // A count the factor's rounding leaves alone is left out.
          const after = Math.round(base * read(tuning, "multipliers", factor));
          return after === base
            ? []
            : [
                {
                  after,
                  before: base,
                  by: by(after - base, sources.keenEye),
                  subject: { kind: "spawns", spawn },
                },
              ];
        });
      },
    ],
    [
      "Rush hour",
      runWith(PLAIN_FOR_SPAWNS, null, ["rushHour"]),
      sources.rushHour,
      (state: RunState) => {
        const stats = spawnStats(state);
        return (
          [
            ["minorObstacles", stats.minorObstacles, "rushHourObstacles"],
            ["obstacles", stats.obstacles, "rushHourObstacles"],
            ["tips", stats.tips, "rushHourTips"],
            ["treats", stats.treats, "rushHourTreats"],
          ] as const
        ).map(([spawn, base, factor]) => ({
          after: rushed(base, factor),
          before: base,
          by: by(rushed(base, factor) - base, sources.rushHour),
          subject: { kind: "spawns", spawn },
        }));
      },
    ],
  ] as const)("names %s with its value before and after", (_, state, source, expected) => {
    const named = standingModified(data, state).filter((value) =>
      value.by.some((cause) => JSON.stringify(cause.source) === JSON.stringify(source)),
    );
    expect(named).toEqual(expected(state));
  });

  it("names nothing between a zone's end and its fork", () => {
    const state = runWith(walkerWith("keenEye"));
    expect(standingModified(data, { ...state, zoneIndex: 1 })).toEqual([]);
  });
});
