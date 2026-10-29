import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { CardSource, DogId, EncounterId } from "../data/types";
import { largeBodyText } from "../hud/cardText";
import { fillNames } from "../lib/lines";
import { cents, dollarsToCents } from "../lib/units";
import { activeModifier, testState } from "../testing/runState";
import { cardFor } from "./choices";
import { read } from "./units";

const PACK: readonly DogId[] = ["kilo", "ginger", "reggie"];
const state = testState({ ginger: 5, kilo: 5, reggie: 5 }, { money: cents(10_000) });
const { encounterHigh, thiefLetGo } = gameData.tuning.money;

// The name the data gives a card option, by its id.
function optionName(id: EncounterId, optionId: string): string {
  const { resolution } = gameData.encounters[id];
  const found =
    resolution.kind === "card"
      ? resolution.options.find((option) => option.id === optionId)
      : undefined;
  if (found === undefined) {
    throw new Error(`No option ${id}.${optionId}`);
  }
  return found.name;
}
const letGo = optionName("thief", "letGo");
const grabBack = optionName("thief", "grabBack");

const encounter = (id: EncounterId, affected: readonly DogId[]): CardSource => ({
  affected,
  encounter: id,
  kind: "encounter",
});

// A card's hearts text: the change said once for several dogs, or by the one dog's name.
function heartsText(dogs: readonly DogId[], amount: number): string {
  const hearts = `${amount < 0 ? "−" : "+"}${Math.abs(amount)}`;
  return dogs.length > 1
    ? fillNames(gameData.runText.card.heartsEach, { hearts })
    : dogs.map((dog) => `${hearts}♥ ${gameData.dogs[dog].name}`).join(", ");
}

function option(source: CardSource, label: string) {
  const found = cardFor(gameData, state, source).options.find((view) => view.label === label);
  if (found === undefined) {
    throw new Error(`No option ${label}`);
  }
  return found;
}

describe("a card's text for the dogs it catches", () => {
  it("words each option's effects as its card shows them", () => {
    for (const { affected, id, label, text } of [
      {
        affected: ["ginger", "kilo"],
        id: "thief",
        label: grabBack,
        text: heartsText(["ginger", "kilo"], -1),
        why: "says a change the dogs it reaches share once",
      },
      {
        affected: ["kilo", "ginger"],
        id: "skunk",
        label: "Full groom",
        text: `−$${encounterHigh}`,
        why: "charges a cost once, whatever the pack",
      },
      {
        affected: ["kilo"],
        id: "thief",
        label: letGo,
        text: `−$${thiefLetGo}`,
        why: "keeps a cost charged once for the pack",
      },
    ] as const) {
      expect(option(encounter(id, affected), label).text).toBe(text);
    }
  });

  it("agrees with the cost plaque for every pack size", () => {
    for (const row of [
      { affected: ["kilo"], dollars: encounterHigh, id: "skunk", label: "Full groom" },
      { affected: PACK, dollars: encounterHigh, id: "skunk", label: "Full groom" },
      { affected: PACK, dollars: thiefLetGo, id: "thief", label: letGo },
      { affected: ["kilo"], dollars: thiefLetGo, id: "thief", label: letGo },
    ] as const) {
      const view = option(encounter(row.id, row.affected), row.label);
      expect(view.cost).toBe(dollarsToCents(row.dollars));
      expect(view.text).toBe(`−$${row.dollars}`);
    }
  });

  describe("with Second chance", () => {
    const secondChance = activeModifier(
      { kind: "walker", walker: "casey" },
      { by: "secondChanceForgiven", operation: "add", stat: "forgivenHearts" },
    );
    const allowance = read(gameData.tuning, "hearts", "secondChanceForgiven");
    const forgiven = (dog: DogId) =>
      fillNames(gameData.runText.card.heartForgiven, { dog: gameData.dogs[dog].name, hearts: "1" });

    it("says each effect's line", () => {
      for (const [, used, text] of [
        ["the first dog's loss forgiven", 0, `${forgiven("ginger")}, ${heartsText(["kilo"], -1)}`],
        [
          "nothing forgiven once Second chance is used",
          allowance,
          heartsText(["ginger", "kilo"], -1),
        ],
      ] as const) {
        const kind = testState(
          { ginger: 5, kilo: 5 },
          { heartsForgiven: used, modifiers: [secondChance] },
        );
        const source = encounter("thief", ["ginger", "kilo"]);
        const view = cardFor(gameData, kind, source).options.find(
          ({ label }) => label === grabBack,
        );
        expect(view?.text).toBe(text);
      }
    });
  });

  describe("with Sweet talker", () => {
    const sweetTalker = activeModifier(
      { kind: "upgrade", upgrade: "sweetTalker" },
      { by: "sweetTalkerFreeCards", operation: "add", stat: "freeCards" },
    );
    const groom = "Full groom";

    it.each([
      {
        cardsThisZone: 0,
        large: gameData.runText.card.free,
        modifiers: [sweetTalker],
        text: gameData.runText.card.free,
        why: "a waived cost says FREE",
      },
      {
        cardsThisZone: 1,
        large: `−$${encounterHigh}`,
        modifiers: [sweetTalker],
        text: `−$${encounterHigh}`,
        why: "a cost once the zone's free card is used says its price",
      },
      {
        cardsThisZone: 0,
        large: `−$${encounterHigh}`,
        modifiers: [],
        text: `−$${encounterHigh}`,
        why: "a cost without Sweet talker says its price",
      },
    ])("$why, on the small and large card", ({ cardsThisZone, large, modifiers, text }) => {
      const run = testState(
        { ginger: 5, kilo: 5 },
        { cardsThisZone, modifiers, money: cents(10_000) },
      );
      const view = cardFor(gameData, run, encounter("skunk", ["kilo"])).options.find(
        ({ label }) => label === groom,
      );
      expect([view?.text, largeBodyText(gameData, view)]).toEqual([text, large]);
    });
  });
});
