import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { DEBUFFS } from "../data/debuffs";
import { ENCOUNTERS } from "../data/encounters";
import { HOME_TEXT } from "../data/homeText";
import { TUNING } from "../data/tuning";
import type {
  Effect,
  GearId,
  MoneyKey,
  MultiplierKey,
  WalkerPerk,
  WalkerPerkId,
} from "../data/types";
import { UPGRADES } from "../data/upgrades";
import { fillNames, placeholders } from "../lib/lines";
import { TEST_TUNING } from "../testing/tuning";
import {
  agilityPercent,
  capitalize,
  effectText,
  formatDollars,
  gearShort,
  largeSpeedText,
  perkEffect,
  sentenceList,
  SIZE_NAMES,
} from "./effectText";
import { modifiersOf, modifierValue } from "./modifiers";
import { cents, read } from "./units";

// The game's chances, which the test tuning pins to 0, so a dodge reads as one in so many.
const data = {
  debuffs: DEBUFFS,
  encounters: ENCOUNTERS,
  homeText: HOME_TEXT,
  tuning: { ...TEST_TUNING, probability: TUNING.probability },
};

const words = HOME_TEXT.effect;
const dollars = (key: MoneyKey) => formatDollars(read(TEST_TUNING, "money", key));
const percent = (key: MultiplierKey) =>
  Math.round((read(TEST_TUNING, "multipliers", key) - 1) * 100);
// An added agility as a signed percent of the base lane-change speed.
const addedAgility = (key: MultiplierKey) => {
  const added = Math.round(read(TEST_TUNING, "multipliers", key) * 100);
  return `${added < 0 ? "−" : "+"}${Math.abs(added)}%`;
};

describe("effectText", () => {
  it("writes each effect's text", () => {
    for (const [, effects, text] of [
      [
        "money once",
        [{ amount: "thiefLetGo", change: "lose", kind: "money" }],
        `−${dollars("thiefLetGo")}`,
      ],
      [
        "a gain once",
        [{ amount: "lostWalletKeep", change: "gain", kind: "money" }],
        `+${dollars("lostWalletKeep")}`,
      ],
      [
        "hearts each",
        [{ amount: -2, kind: "hearts", target: { kind: "affected" } }],
        fillNames(words.heartsEach, { hearts: "−2♥" }),
      ],
      [
        "a dodge for the sizes it names, as one in so many",
        [{ chance: "whistleDodgeChance", kind: "dodge", sizes: ["medium", "large"] }],
        capitalize(
          fillNames(HOME_TEXT.dodgeEffect, {
            dodgeIn: String(Math.round(1 / TUNING.probability.whistleDodgeChance)),
            sizes: sentenceList(HOME_TEXT.sentenceList, [SIZE_NAMES.medium, SIZE_NAMES.large]),
          }),
        ),
      ],
      [
        "several effects, naming a debuff",
        [
          { amount: "encounterLow", change: "lose", kind: "money" },
          { debuff: "stinky", kind: "debuff" },
        ],
        `−${dollars("encounterLow")}, ${DEBUFFS.stinky.name}: ${DEBUFFS.stinky.stake.replace(
          "{seconds}",
          String(read(TEST_TUNING, "seconds", DEBUFFS.stinky.seconds)),
        )}`,
      ],
      [
        "a multiplier as a percentage with its duration",
        [
          {
            by: "rushHourTips",
            duration: "nextZone",
            kind: "modifier",
            operation: "multiply",
            stat: "tipSpawns",
          },
        ],
        capitalize(
          `${words.stats.tipSpawns} +${percent("rushHourTips")}% ${words.durations.nextZone}`,
        ),
      ],
      [
        "an immunity as the cards it stops",
        [{ duration: "run", encounter: "thief", kind: "immune" }],
        `No ${ENCOUNTERS.thief.name} cards ${words.durations.run}`,
      ],
      [
        "a contact obstacle's immunity as its own line",
        [{ duration: "run", encounter: "puddle", kind: "immune" }],
        `${capitalize(ENCOUNTERS.puddle.resolution.immuneText)} all walk`,
      ],
      [
        "a duration every phrase shares once, at the end",
        UPGRADES.rushHour.effects,
        capitalize(
          `${words.stats.tipSpawns} +${percent("rushHourTips")}%, ` +
            `${words.stats.obstacleSpawns} +${percent("rushHourObstacles")}%, ` +
            `${words.stats.treatSpawns} +${percent("rushHourTreats")}% ${words.durations.nextZone}`,
        ),
      ],
      [
        "a cut card cost as a signed percent",
        [
          {
            by: "fannyPackCardCostFactor",
            kind: "modifier",
            operation: "multiply",
            stat: "cardCost",
          },
        ],
        capitalize(`${words.stats.cardCost} −${-percent("fannyPackCardCostFactor")}%`),
      ],
      [
        "a raised agility as a percent of the base lane-change speed",
        [{ by: "runningShoesAgility", kind: "modifier", operation: "add", stat: "agility" }],
        capitalize(`${words.stats.agility} ${addedAgility("runningShoesAgility")}`),
      ],
      [
        "a lowered agility as a percent of the base lane-change speed",
        [{ by: "largeDogAgility", kind: "modifier", operation: "add", stat: "agility" }],
        capitalize(`${words.stats.agility} ${addedAgility("largeDogAgility")}`),
      ],
      ["a free Walk on by", [{ kind: "skipOption" }], capitalize(words.skipOption)],
      [
        "free cards as cash options free",
        [{ by: "sweetTalkerFreeCards", kind: "modifier", operation: "add", stat: "freeCards" }],
        capitalize(
          read(TEST_TUNING, "counts", "sweetTalkerFreeCards") === 1
            ? words.freeCard
            : fillNames(words.freeCards, {
                count: String(read(TEST_TUNING, "counts", "sweetTalkerFreeCards")),
              }),
        ),
      ],
      ["no effects as nothing", [], words.nothing],
    ] satisfies readonly [string, readonly Effect[], string][]) {
      expect(effectText(data, effects)).toBe(text);
    }
  });

  const muddyBumpHearts = read(TEST_TUNING, "multipliers", "muddyBumpHearts");
  it.each([muddyBumpHearts, muddyBumpHearts + 1])(
    "fills Muddy's stake with muddyBumpHearts at %i",
    (hearts) => {
      const tuning = {
        ...data.tuning,
        multipliers: { ...data.tuning.multipliers, muddyBumpHearts: hearts },
      };
      const seconds = String(read(TEST_TUNING, "seconds", DEBUFFS.muddy.seconds));
      expect(effectText({ ...data, tuning }, [{ debuff: "muddy", kind: "debuff" }])).toBe(
        `${DEBUFFS.muddy.name}: ${fillNames(DEBUFFS.muddy.stake, { hearts: String(hearts), seconds })}`,
      );
    },
  );
});

// A share of the base lane-change speed as an unsigned whole percent.
const unsignedPercent = (fraction: number) => `${Math.abs(Math.round(fraction * 100))}%`;

describe("agilityPercent", () => {
  const shoes = read(gameData.tuning, "multipliers", "runningShoesAgility");
  const large = read(gameData.tuning, "multipliers", "largeDogAgility");
  const floor = read(gameData.tuning, "multipliers", "minPackAgility");
  // Each walker's own agility, with Running shoes, and with one large dog down to the floor.
  const cases = Object.values(gameData.walkers).flatMap(({ agility, name }) => [
    [`${name}'s own`, agility],
    [`${name} with Running shoes`, agility + shoes],
    [`${name} with a large dog`, Math.max(Math.min(agility, floor), agility + large)],
  ]) as [string, number][];

  it.each(cases)(
    "gives %s agility as a signed percent against the base, or none at the base",
    (_, agility) => {
      const whole = Math.round((agility - 1) * 100);
      expect(agilityPercent(agility)).toBe(
        whole === 0 ? null : `${whole < 0 ? "−" : "+"}${Math.abs(whole)}%`,
      );
    },
  );
});

describe("largeSpeedText", () => {
  it("gives largeDogAgility as an unsigned percent of the base lane-change speed", () => {
    expect(largeSpeedText(TEST_TUNING)).toBe(
      unsignedPercent(read(TEST_TUNING, "multipliers", "largeDogAgility")),
    );
  });
});

describe("gearShort", () => {
  const gearData = { shopGear: gameData.shopGear, tuning: TEST_TUNING };
  const agilityAdded = (gear: GearId) =>
    modifiersOf(gameData.shopGear[gear].effects)
      .filter((modifier) => modifier.operation === "add" && modifier.stat === "agility")
      .reduce((sum, modifier) => sum + modifierValue(TEST_TUNING, modifier), 0);

  it.each(Object.keys(gameData.shopGear) as GearId[])(
    "fills %s's shop line's {percent} with the agility it adds, leaving no names",
    (gear) => {
      const { short } = gameData.shopGear[gear];
      expect(placeholders(short).every((name) => name === "percent")).toBe(true);
      expect(placeholders(short).length === 0 || agilityAdded(gear) !== 0).toBe(true);
      expect(gearShort(gearData, gear)).toBe(
        fillNames(short, { percent: unsignedPercent(agilityAdded(gear)) }),
      );
      expect(placeholders(gearShort(gearData, gear))).toEqual([]);
    },
  );
});

describe("perkEffect", () => {
  const perks = Object.keys(gameData.walkerPerks) as WalkerPerkId[];

  it.each(perks)(
    "fills %s's effect line's {percent} from the multiplier it names, one of its own",
    (id) => {
      const perk: WalkerPerk = gameData.walkerPerks[id];
      const factors = modifiersOf(perk.effects)
        .filter(({ operation }) => operation === "multiply")
        .map(({ by }) => by);
      expect(placeholders(perk.effect)).toEqual(perk.percent === undefined ? [] : ["percent"]);
      if (perk.percent !== undefined) {
        expect(factors).toContain(perk.percent);
      }
      const percent =
        perk.percent === undefined
          ? {}
          : { percent: unsignedPercent(read(gameData.tuning, "multipliers", perk.percent) - 1) };
      expect(perkEffect(gameData.tuning, perk)).toBe(fillNames(perk.effect, percent));
    },
  );
});

describe("formatDollars", () => {
  it("shows cents as dollars", () => {
    for (const [amount, text] of [
      [500, "$5"],
      [150, "$1.50"],
    ] as const) {
      expect(formatDollars(cents(amount))).toBe(text);
    }
  });
});
