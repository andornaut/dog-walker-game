import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { DogId, EncounterId } from "../data/types";
import type { CardSource } from "../state/runState";
import { heartsFactor } from "../testing/dogs";
import { testState } from "../testing/runState";
import { cardFor } from "./choices";
import { cents, dollarsToCents } from "./units";

// Koda is a chaser, Duchess a fancy dog and Nugget a food-driven one, so trait amounts show;
// their owners' temperaments come from the data, and the pack mixes them, so the dramatic
// doubling shows too.
const PACK: readonly DogId[] = ["koda", "duchess", "nugget"];
const state = testState({ duchess: 5, koda: 5, nugget: 5 }, { money: cents(10_000) });
const { encounterHigh, encounterLow, thiefLetGo } = gameData.tuning.money;

const encounter = (id: EncounterId, affected: readonly DogId[]): CardSource => ({
  affected,
  encounter: id,
  kind: "encounter",
});

// One dog's part of a card's text: a base change in hearts, scaled by their owner's
// temperament, and the dog's name.
function heartsText(dog: DogId, amount: number): string {
  const total = amount * heartsFactor(gameData, dog);
  return `${total < 0 ? "−" : "+"}${Math.abs(total)} ♥ ${gameData.dogs[dog].name}`;
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
      affected: ["koda"],
      id: "puddle",
      label: "Splash through",
      text: heartsText("koda", -1),
      why: "drops a trait amount no dog caught has",
    },
    {
      affected: ["duchess", "koda"],
      id: "puddle",
      label: "Splash through",
      text: `${heartsText("duchess", -2)}, ${heartsText("koda", -1)}`,
      why: "names each dog's total",
    },
    {
      affected: ["nugget"],
      id: "skunk",
      label: "Hold your nose",
      text: heartsText("nugget", -2),
      why: "includes the owner's temperament",
    },
    {
      affected: ["koda", "duchess"],
      id: "skunk",
      label: "Full groom",
      text: `−$${encounterHigh * 2}`,
      why: "totals a per-dog cost for the dogs caught",
    },
    {
      affected: ["koda"],
      id: "thief",
      label: "Let it go",
      text: `−$${thiefLetGo}`,
      why: "keeps a cost charged once for the pack",
    },
  ] as const)("$why", ({ affected, id, label, text }) => {
    expect(option(encounter(id, affected), label).text).toBe(text);
  });

  it.each([
    { affected: ["koda"], dollars: encounterHigh, id: "skunk", label: "Full groom" },
    { affected: PACK, dollars: encounterHigh * 3, id: "skunk", label: "Full groom" },
    { affected: PACK, dollars: encounterLow * 3, id: "puddle", label: "Towel off" },
    { affected: ["koda"], dollars: encounterLow, id: "puddle", label: "Towel off" },
  ] as const)("agrees with the cost plaque: $label for $affected.length", (row) => {
    const view = option(encounter(row.id, row.affected), row.label);
    expect(view.cost).toBe(dollarsToCents(row.dollars));
    expect(view.text).toBe(`−$${row.dollars}`);
  });

  it("matches the snapshot for the whole pack caught", () => {
    const temperaments = new Set(PACK.map((dog) => gameData.dogs[dog].owner.temperament));
    expect(temperaments).toContain("dramatic");
    expect(temperaments.size).toBeGreaterThan(1);
    const encounters = Object.fromEntries(
      Object.entries(gameData.encounters).flatMap(([id, { resolution }]) =>
        resolution.kind === "instant"
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
      forcedStops: cards(
        Object.keys(gameData.forcedStops),
        (stop) => ({ kind: "forcedStop", stop }) as CardSource,
      ),
      needCards: cards(
        Object.keys(gameData.needCards),
        (card) => ({ affected: PACK, card, kind: "need" }) as CardSource,
      ),
      upgrades: cards(["all"], () => ({
        kind: "upgradeOffer",
        offered: ["bellyRubs", "secondWind", "sweetTalker"],
      })),
    }).toMatchSnapshot();
  });
});
