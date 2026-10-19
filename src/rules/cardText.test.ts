import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { DogId, EncounterId } from "../data/types";
import type { CardSource } from "../state/runState";
import { testState } from "../testing/runState";
import { cardFor } from "./choices";
import { cents } from "./units";

// Koda is a laid-back chaser, Duchess a laid-back fancy dog, Nugget a dramatic food-driven
// one, so trait amounts and the dramatic doubling both show.
const PACK: readonly DogId[] = ["koda", "duchess", "nugget"];
const state = testState({ duchess: 5, koda: 5, nugget: 5 }, { money: cents(10_000) });

const encounter = (id: EncounterId, affected: readonly DogId[]): CardSource => ({
  affected,
  encounter: id,
  kind: "encounter",
});

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
      text: "−1 ♥ Koda",
      why: "drops a trait amount no dog caught has",
    },
    {
      affected: ["duchess", "koda"],
      id: "puddle",
      label: "Splash through",
      text: "−2 ♥ Duchess, −1 ♥ Koda",
      why: "names each dog's total",
    },
    {
      affected: ["nugget"],
      id: "skunk",
      label: "Hold your nose",
      text: "−4 ♥ Nugget",
      why: "includes a dramatic owner's doubling",
    },
    {
      affected: ["koda", "duchess"],
      id: "skunk",
      label: "Full groom",
      text: "−$40",
      why: "totals a per-dog cost for the dogs caught",
    },
    {
      affected: ["koda"],
      id: "thief",
      label: "Let it go",
      text: "−$20",
      why: "keeps a cost charged once for the pack",
    },
  ] as const)("$why", ({ affected, id, label, text }) => {
    expect(option(encounter(id, affected), label).text).toBe(text);
  });

  it.each([
    { affected: ["koda"], cost: 2000, id: "skunk", label: "Full groom" },
    { affected: PACK, cost: 6000, id: "skunk", label: "Full groom" },
    { affected: PACK, cost: 3000, id: "puddle", label: "Towel off" },
  ] as const)("agrees with the cost plaque: $label for $affected.length", (row) => {
    const view = option(encounter(row.id, row.affected), row.label);
    expect(view.cost).toBe(row.cost);
    expect(view.text).toBe(`−$${row.cost / 100}`);
  });

  it("matches the snapshot for the whole pack caught", () => {
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
