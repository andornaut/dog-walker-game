import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { DogId, EncounterId } from "../data/types";
import { boxStyles, CARD_LAYOUT } from "../layout/cardLayout";
import type { CardSource } from "../state/runState";
import { fitInFont, fontFileMetrics } from "../testing/fontInk";
import { activeModifier, testState } from "../testing/runState";
import { fillNames } from "../text/lines";
import { plainMarks } from "../ui/pixelFont";
import { cardFor } from "./choices";
import { cents, dollarsToCents, read } from "./units";

const PACK: readonly DogId[] = ["koda", "duchess", "nugget"];
const state = testState({ duchess: 5, koda: 5, nugget: 5 }, { money: cents(10_000) });
const { encounterHigh, thiefLetGo } = gameData.tuning.money;

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
        affected: ["duchess", "koda"],
        id: "thief",
        label: "Chase them off",
        text: heartsText(["duchess", "koda"], -1),
        why: "names each dog it reaches, in pack order",
      },
      {
        affected: ["koda", "duchess"],
        id: "skunk",
        label: "Full groom",
        text: `−$${encounterHigh}`,
        why: "charges a cost once, whatever the pack",
      },
      {
        affected: ["koda"],
        id: "thief",
        label: "Let them go",
        text: `−$${thiefLetGo}`,
        why: "keeps a cost charged once for the pack",
      },
    ] as const) {
      expect(option(encounter(id, affected), label).text).toBe(text);
    }
  });

  it("agrees with the cost plaque for every pack size", () => {
    for (const row of [
      { affected: ["koda"], dollars: encounterHigh, id: "skunk", label: "Full groom" },
      { affected: PACK, dollars: encounterHigh, id: "skunk", label: "Full groom" },
      { affected: PACK, dollars: thiefLetGo, id: "thief", label: "Let them go" },
      { affected: ["koda"], dollars: thiefLetGo, id: "thief", label: "Let them go" },
    ] as const) {
      const view = option(encounter(row.id, row.affected), row.label);
      expect(view.cost).toBe(dollarsToCents(row.dollars));
      expect(view.text).toBe(`−$${row.dollars}`);
    }
  });

  describe("with Second chance", () => {
    const kindWords = activeModifier(
      { kind: "walker", walker: "casey" },
      { by: "kindWordsForgiven", operation: "add", stat: "forgivenHearts" },
    );
    const allowance = read(gameData.tuning, "hearts", "kindWordsForgiven");
    const forgiven = (dog: DogId) =>
      fillNames(gameData.runText.card.heartForgiven, { dog: gameData.dogs[dog].name, hearts: "1" });

    it("says each effect's line", () => {
      for (const [, used, text] of [
        ["the first dog's loss forgiven", 0, `${forgiven("duchess")}, ${heartsText(["koda"], -1)}`],
        [
          "nothing forgiven once Second chance is used",
          allowance,
          heartsText(["duchess", "koda"], -1),
        ],
      ] as const) {
        const kind = testState(
          { duchess: 5, koda: 5 },
          { heartsForgiven: used, modifiers: [kindWords] },
        );
        const source = encounter("thief", ["duchess", "koda"]);
        const view = cardFor(gameData, kind, source).options.find(
          ({ label }) => label === "Chase them off",
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

  it("matches the snapshot for the whole pack caught", () => {
    const encounters = Object.fromEntries(
      Object.entries(gameData.encounters).flatMap(([id, { resolution }]) =>
        resolution.kind !== "card"
          ? []
          : cardFor(gameData, state, encounter(id as EncounterId, PACK)).options.map((view) => [
              `${id}: ${view.label}`,
              view.text,
            ]),
      ),
    );
    const cards = (ids: readonly string[], source: (id: string) => CardSource) =>
      Object.fromEntries(
        ids.flatMap((id) =>
          cardFor(gameData, state, source(id)).options.map((view) => [
            `${id}: ${view.label}`,
            view.text,
          ]),
        ),
      );
    expect({
      encounters,
      forks: cards(["fork"], () => ({
        kind: "fork",
        paths: ["park", "snoozeCrescent"],
        upgrades: ["bellyRubs", "sweetTalker"],
      })),
    }).toMatchSnapshot();
  });
});
