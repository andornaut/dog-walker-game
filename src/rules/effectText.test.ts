import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { DEBUFFS } from "../data/debuffs";
import { ENCOUNTERS } from "../data/encounters";
import { HOME_TEXT } from "../data/homeText";
import { TUNING } from "../data/tuning";
import type { Effect, MoneyKey, MultiplierKey } from "../data/types";
import { UPGRADES } from "../data/upgrades";
import { fillNames } from "../lib/lines";
import { TEST_TUNING } from "../testing/tuning";
import { capitalize, effectText, formatDollars, sentenceList, SIZE_NAMES } from "./effectText";
import { cents, read } from "./units";

// The game's chances, which the test tuning pins to 0, so a dodge reads as one in so many.
const data = {
  debuffs: DEBUFFS,
  encounters: ENCOUNTERS,
  homeText: HOME_TEXT,
  tuning: { ...TEST_TUNING, probability: TUNING.probability },
};

const dollars = (key: MoneyKey) => formatDollars(read(TEST_TUNING, "money", key));
const percent = (key: MultiplierKey) =>
  Math.round((read(TEST_TUNING, "multipliers", key) - 1) * 100);

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
      ["hearts each", [{ amount: -2, kind: "hearts", target: { kind: "affected" } }], "−2♥ each"],
      [
        "a dodge for the sizes it names, as one in so many",
        [{ chance: "dogWhistleDodgeChance", kind: "dodge", sizes: ["medium", "big"] }],
        capitalize(
          fillNames(HOME_TEXT.dodgeEffect, {
            dodgeIn: String(Math.round(1 / TUNING.probability.dogWhistleDodgeChance)),
            sizes: sentenceList(HOME_TEXT.sentenceList, [SIZE_NAMES.medium, SIZE_NAMES.big]),
          }),
        ),
      ],
      [
        "one random owner",
        [{ amount: -1, kind: "hearts", target: { kind: "randomOne" } }],
        "−1♥ to one random owner",
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
        `Tips +${percent("rushHourTips")}% next neighborhood`,
      ],
      [
        "an immunity as the cards it stops",
        [{ duration: "run", encounter: "thief", kind: "immune" }],
        `No ${ENCOUNTERS.thief.name} cards all walk`,
      ],
      [
        "a contact obstacle's immunity as its own line",
        [{ duration: "run", encounter: "puddle", kind: "immune" }],
        `${capitalize(ENCOUNTERS.puddle.resolution.immuneText)} all walk`,
      ],
      [
        "a duration every phrase shares once, at the end",
        UPGRADES.rushHour.effects,
        `Tips +${percent("rushHourTips")}%, obstacles +${percent("rushHourObstacles")}%, ` +
          `treats +${percent("rushHourTreats")}% next neighborhood`,
      ],
      [
        "starting cash",
        [{ by: "fannyPackStart", kind: "modifier", operation: "add", stat: "startMoney" }],
        `Starting cash +${dollars("fannyPackStart")}`,
      ],
      ["a free Walk on by", [{ kind: "skipOption" }], "A free Walk on by each neighborhood"],
      [
        "free cards as cash options free",
        [{ by: "sweetTalkerFreeCards", kind: "modifier", operation: "add", stat: "freeCards" }],
        read(TEST_TUNING, "counts", "sweetTalkerFreeCards") === 1
          ? "First card's cash options free each neighborhood"
          : `First ${read(TEST_TUNING, "counts", "sweetTalkerFreeCards")} cards' cash options free each neighborhood`,
      ],
      ["no effects as nothing", [], "Nothing"],
    ] satisfies readonly [string, readonly Effect[], string][]) {
      expect(effectText(data, effects)).toBe(text);
    }
  });
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

// Every card's text from the real data, so a content or tuning edit shows up as a
// snapshot diff to review. Update with: npx vitest run -u
describe("every card's text", () => {
  it("matches the snapshot", () => {
    const effects = (items: Readonly<Record<string, { readonly effects: readonly Effect[] }>>) =>
      Object.fromEntries(
        Object.entries(items).map(([id, item]) => [id, effectText(gameData, item.effects)]),
      );
    const encounters = Object.fromEntries(
      Object.entries(gameData.encounters).flatMap(([id, { resolution }]) =>
        resolution.kind === "instant" || resolution.kind === "contact"
          ? [[`${id}: ${resolution.kind}`, effectText(gameData, resolution.effects)]]
          : resolution.kind === "pull"
            ? []
            : resolution.options.map((option) => [
                `${id}: ${option.name}`,
                effectText(gameData, option.effects),
              ]),
      ),
    );
    expect({
      encounters,
      gear: effects(gameData.shopGear),
      upgrades: effects(gameData.upgrades),
    }).toMatchSnapshot();
  });
});
