import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { DogId, EncounterId } from "../data/types";
import { largeBodyText } from "../hud/cardText";
import { boxStyles, CARD_LAYOUT } from "../layout/cardLayout";
import { fillNames } from "../lib/lines";
import type { CardSource } from "../state/runState";
import { fitInFont, fontFileMetrics } from "../testing/fontInk";
import { activeModifier, testState } from "../testing/runState";
import { plainMarks } from "../ui/pixelFont";
import { cardFor } from "./choices";
import { cents, dollarsToCents, read } from "./units";

const PACK: readonly DogId[] = ["kilo", "duchess", "reggie"];
const state = testState({ duchess: 5, kilo: 5, reggie: 5 }, { money: cents(10_000) });
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

// A card's hearts text: the change by each owner's dog's name.
function heartsText(dogs: readonly DogId[], amount: number): string {
  const change = `${amount < 0 ? "−" : "+"}${Math.abs(amount)}♥`;
  return dogs.map((dog) => `${change} ${gameData.dogs[dog].name}`).join(", ");
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
        affected: ["duchess", "kilo"],
        id: "thief",
        label: grabBack,
        text: heartsText(["duchess", "kilo"], -1),
        why: "names each dog it reaches, in pack order",
      },
      {
        affected: ["kilo", "duchess"],
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
        ["the first dog's loss forgiven", 0, `${forgiven("duchess")}, ${heartsText(["kilo"], -1)}`],
        [
          "nothing forgiven once Second chance is used",
          allowance,
          heartsText(["duchess", "kilo"], -1),
        ],
      ] as const) {
        const kind = testState(
          { duchess: 5, kilo: 5 },
          { heartsForgiven: used, modifiers: [secondChance] },
        );
        const source = encounter("thief", ["duchess", "kilo"]);
        const view = cardFor(gameData, kind, source).options.find(
          ({ label }) => label === grabBack,
        );
        expect(view?.text).toBe(text);
      }
    });

    // The small card's effect, in the body font at 2x on the lines its height holds, else 1x.
    const { effect } = CARD_LAYOUT;
    const styles = boxStyles(fontFileMetrics("font-body"), effect.height);

    it("fits every forgiven loss in a card's effect", () => {
      for (const dog of Object.keys(gameData.dogs) as DogId[]) {
        const fitted = fitInFont("font-body", styles, effect.width, plainMarks(forgiven(dog)));
        expect(fitted.widest).toBeLessThanOrEqual(effect.width);
        expect(fitted.lines.length).toBeLessThanOrEqual(fitted.style.lines ?? 1);
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
        large: `−$${encounterHigh} ${groom}`,
        modifiers: [sweetTalker],
        text: `−$${encounterHigh}`,
        why: "a cost once the zone's free card is used says its price",
      },
      {
        cardsThisZone: 0,
        large: `−$${encounterHigh} ${groom}`,
        modifiers: [],
        text: `−$${encounterHigh}`,
        why: "a cost without Sweet talker says its price",
      },
    ])("$why, on the small and large card", ({ cardsThisZone, large, modifiers, text }) => {
      const run = testState(
        { duchess: 5, kilo: 5 },
        { cardsThisZone, modifiers, money: cents(10_000) },
      );
      const view = cardFor(gameData, run, encounter("skunk", ["kilo"])).options.find(
        ({ label }) => label === groom,
      );
      expect([view?.text, largeBodyText(gameData, view)]).toEqual([text, large]);
    });
  });
});
