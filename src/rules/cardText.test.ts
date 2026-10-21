import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { DogId, EncounterId } from "../data/types";
import type { CardSource } from "../state/runState";
import { testState } from "../testing/runState";
import { cardFor } from "./choices";
import { cents, dollarsToCents } from "./units";

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
  it.each([
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
  ] as const)("$why", ({ affected, id, label, text }) => {
    expect(option(encounter(id, affected), label).text).toBe(text);
  });

  it.each([
    { affected: ["koda"], dollars: encounterHigh, id: "skunk", label: "Full groom" },
    { affected: PACK, dollars: encounterHigh, id: "skunk", label: "Full groom" },
    { affected: PACK, dollars: thiefLetGo, id: "thief", label: "Let them go" },
    { affected: ["koda"], dollars: thiefLetGo, id: "thief", label: "Let them go" },
  ] as const)("agrees with the cost plaque: $label for $affected.length", (row) => {
    const view = option(encounter(row.id, row.affected), row.label);
    expect(view.cost).toBe(dollarsToCents(row.dollars));
    expect(view.text).toBe(`−$${row.dollars}`);
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
