import { describe, expect, it } from "vitest";

import { DEBUFFS } from "../data/debuffs";
import { DOGS } from "../data/dogs";
import { ENCOUNTERS } from "../data/encounters";
import { QUIPS } from "../data/quips";
import { RUN_TEXT } from "../data/runText";
import { SHOP_GEAR } from "../data/shop";
import type { DogId, EncounterId, UpgradeId } from "../data/types";
import { UPGRADES } from "../data/upgrades";
import { type CardSource, newRun, type RunState } from "../state/runState";
import { activeModifier, heartsByDog, testState } from "../testing/runState";
import { TEST_TUNING } from "../testing/tuning";
import { TEST_WALKER_DATA } from "../testing/walkers";
import { TEST_WORLD } from "../testing/world";
import {
  applyInstantEncounter,
  cardFor,
  type Choice,
  chooseOption,
  offerFork,
  offerUpgrades,
  openCard,
  quipLine,
} from "./choices";
import { startHearts } from "./dogs";
import { cents, read } from "./units";

const data = {
  debuffs: DEBUFFS,
  dogs: DOGS,
  encounters: ENCOUNTERS,
  quips: QUIPS,
  runText: RUN_TEXT,
  shopGear: SHOP_GEAR,
  ...TEST_WALKER_DATA,
  tuning: TEST_TUNING,
  upgrades: UPGRADES,
  world: TEST_WORLD,
};

const encounter = (id: EncounterId, affected: DogId[]): CardSource => ({
  affected,
  encounter: id,
  kind: "encounter",
});

// The index of the encounter's first card option with an effect of kind.
function optionWith(id: EncounterId, kind: "debuff" | "hearts" | "money"): number {
  const { resolution } = ENCOUNTERS[id];
  const options = resolution.kind === "card" ? resolution.options : [];
  const index = options.findIndex(({ effects }) =>
    effects.some(
      (effect) =>
        effect.kind === kind &&
        (kind !== "money" || effect.kind !== "money" || effect.change === "lose"),
    ),
  );
  if (index < 0) {
    throw new Error(`${id} has no ${kind} option`);
  }
  return index;
}
// The hearts the encounter's first hearts option changes each owner by.
function heartsOf(id: EncounterId): number {
  const { resolution } = ENCOUNTERS[id];
  const option =
    resolution.kind === "card" ? resolution.options[optionWith(id, "hearts")] : undefined;
  const effect = option?.effects.find((candidate) => candidate.kind === "hearts");
  return effect?.kind === "hearts" ? effect.amount : 0;
}
const low = read(TEST_TUNING, "money", "encounterLow");
const high = read(TEST_TUNING, "money", "encounterHigh");

function choose(state: RunState, source: CardSource, choice: Choice, random = () => 0) {
  const opened = openCard(source, state);
  return chooseOption(data, random, opened, cardFor(data, opened, source), choice);
}

describe("cardFor", () => {
  it("disables an option the player cannot afford, with the reason", () => {
    const state = testState({ duchess: 5, koda: 5 }, { money: cents(low - 100) });
    const card = cardFor(data, state, encounter("puddle", ["duchess", "koda"]));
    const towel = optionWith("puddle", "money");
    expect(card.title).toBe(ENCOUNTERS.puddle.name);
    expect(card.options.map(({ availability }) => availability)).toEqual(
      card.options.map((_, index) =>
        index === towel ? { enabled: false, reason: "not enough money" } : { enabled: true },
      ),
    );
    expect(card.options[towel]?.cost).toBe(low);
  });

  it("keeps every card's free option enabled with no money", () => {
    const state = testState({ duchess: 5, koda: 5, pierre: 5 });
    const cardEncounters = (Object.keys(ENCOUNTERS) as EncounterId[]).filter(
      (id) => ENCOUNTERS[id].resolution.kind === "card",
    );
    const sources = cardEncounters.map((id) => encounter(id, ["duchess", "koda", "pierre"]));
    for (const source of sources) {
      const card = cardFor(data, state, source);
      const free = card.options.filter(({ cost }) => cost === 0);
      expect(free.length, card.title).toBeGreaterThan(0);
      expect(
        free.every(({ availability }) => availability.enabled),
        card.title,
      ).toBe(true);
    }
  });

  it("lists only the caught dogs still walking as affected", () => {
    const state = testState({ duchess: 5, koda: 5, pierre: "fired" });
    expect(cardFor(data, state, encounter("skunk", ["koda", "pierre"])).affected).toEqual(["koda"]);
  });

  it("gives each option its art and a breakdown of every change it would make", () => {
    const state = testState({ koda: 5, nugget: 5 }, { money: cents(5000) });
    const card = cardFor(data, state, encounter("thief", ["koda", "nugget"]));
    const { resolution } = ENCOUNTERS.thief;
    const options = resolution.kind === "card" ? resolution.options : [];
    expect(card.options.map(({ art }) => art)).toEqual(options.map(({ art }) => art));
    const letGo = options[optionWith("thief", "money")];
    const chase = options[optionWith("thief", "hearts")];
    const lost = `−${Math.abs(heartsOf("thief"))} ♥`;
    expect(card.options[optionWith("thief", "hearts")]?.breakdown).toEqual([
      { dog: "koda", name: chase?.name, text: lost },
      { dog: "nugget", name: chase?.name, text: lost },
    ]);
    expect(
      card.options[optionWith("thief", "money")]?.breakdown.filter(({ dog }) => dog === null),
    ).toEqual([{ dog: null, name: letGo?.name, text: `−$${TEST_TUNING.money.thiefLetGo}` }]);
  });

  it("refuses an instant encounter, which opens no card", () => {
    const state = testState({ koda: 5 });
    expect(() => cardFor(data, state, encounter("lostWallet", ["koda"]))).toThrow("opens no card");
  });
});

describe("applyInstantEncounter", () => {
  it("pays a lost wallet at once, with no quip when no owner's hearts changed", () => {
    const state = testState({ koda: 5, snowball: 3 });
    const outcome = applyInstantEncounter(data, () => 0, state, "lostWallet", ["koda", "snowball"]);
    const keep = read(TEST_TUNING, "money", "lostWalletKeep");
    expect(outcome.moneyDelta).toBe(keep);
    expect(heartsByDog(outcome.state)).toEqual(heartsByDog(state));
    expect(outcome.quips).toEqual([]);
    expect(outcome.moneyChanges[0]?.causes).toEqual([
      { amount: keep, kind: "effect", source: { encounter: "lostWallet", kind: "instant" } },
    ]);
    expect(outcome.state.phase).toEqual({ kind: "walking" });
  });

  it("gives the generous neighbour's hearts to every owner, with a happier line", () => {
    const state = testState({ duchess: 3, koda: 3 });
    const outcome = applyInstantEncounter(data, () => 0, state, "biscuitNeighbour", [
      "duchess",
      "koda",
    ]);
    expect(outcome.heartChanges.map(({ dog }) => dog)).toEqual(["duchess", "koda"]);
    expect(outcome.quips).toEqual([
      { dog: "duchess", moment: "happier" },
      { dog: "koda", moment: "happier" },
    ]);
  });

  it("refuses an encounter that opens a card, and an ended run", () => {
    const state = testState({ koda: 5 });
    expect(() => applyInstantEncounter(data, () => 0, state, "puddle", ["koda"])).toThrow(
      "opens a card",
    );
    const ended = { ...state, phase: { kind: "ended", reason: "noDogs" } as const };
    expect(() => applyInstantEncounter(data, () => 0, ended, "lostWallet", ["koda"])).toThrow(
      "ended",
    );
  });
});

describe("openCard", () => {
  it.each<CardSource>([
    { affected: ["koda"], encounter: "skunk", kind: "encounter" },
    { kind: "fork", paths: ["park"], upgrades: ["bellyRubs"] },
  ])("waits in the card phase for a $kind card", (source) => {
    expect(openCard(source, testState({ koda: 5 })).phase).toEqual({ kind: "card", source });
  });
});

describe("quipLine", () => {
  it("draws one of the owner's two lines for the moment", () => {
    const cue = { dog: "koda", moment: "parting" } as const;
    expect(quipLine(data, () => 0, cue)).toBe(QUIPS.koda.parting[0]);
    expect(quipLine(data, () => 0.99, cue)).toBe(QUIPS.koda.parting[1]);
  });
});

describe("chooseOption", () => {
  const nose = optionWith("skunk", "hearts");
  const groom = optionWith("skunk", "money");
  const lost = heartsOf("skunk");

  it("counts a squirrel chase only when the chasers are let chase", () => {
    const state = testState({ koda: 5 }, { money: cents(5_000) });
    const squirrel = encounter("squirrel", ["koda"]);
    const { resolution } = ENCOUNTERS.squirrel;
    const options = resolution.kind === "card" ? resolution.options : [];
    const chase = options.findIndex((option) => "chase" in option && option.chase === true);
    const hold = options.findIndex((option) => !("chase" in option));
    expect(choose(state, squirrel, chase).state.squirrelChases).toBe(1);
    expect(choose(state, squirrel, hold).state.squirrelChases).toBe(0);
  });

  it("applies an option only to the affected dogs, and reports each heart change", () => {
    const outcome = choose(testState({ duchess: 5, koda: 5 }), encounter("skunk", ["koda"]), nose);
    expect(heartsByDog(outcome.state)).toEqual({ duchess: 5, koda: 5 + lost });
    expect(outcome.heartChanges).toEqual([
      {
        after: 5 + lost,
        before: 5,
        causes: [
          {
            amount: lost,
            kind: "effect",
            source: { encounter: "skunk", kind: "encounter", option: nose },
          },
        ],
        dog: "koda",
        kind: "hearts",
      },
    ]);
    expect(outcome.quips).toEqual([{ dog: "koda", moment: "upset" }]);
    expect(outcome.state.phase).toEqual({ kind: "walking" });
  });

  it("charges the option's cost and reports the money change", () => {
    const state = testState({ duchess: 5, koda: 5 }, { money: cents(4000) });
    const outcome = choose(state, encounter("skunk", ["duchess", "koda"]), groom);
    expect(outcome.state.money).toBe(4000 - high);
    expect(outcome.moneyDelta).toBe(-high);
  });

  it("rejects a disabled option", () => {
    const state = testState({ duchess: 5, koda: 5 }, { money: cents(0) });
    expect(() =>
      choose(state, encounter("puddle", ["duchess", "koda"]), optionWith("puddle", "money")),
    ).toThrow("not enough money");
  });

  it("fires an owner at 0 hearts, and the money stays", () => {
    const state = testState({ duchess: 5, pierre: -lost }, { money: cents(5000), zoneIndex: 2 });
    const outcome = choose(state, encounter("skunk", ["pierre"]), nose);
    expect(outcome.fired).toEqual(["pierre"]);
    expect(outcome.state.money).toBe(state.money);
    expect(outcome.moneyDelta).toBe(0);
    expect(outcome.moneyChanges).toEqual([]);
    expect(outcome.state.pack[1]).toEqual({ dog: "pierre", status: "fired", zoneIndex: 2 });
    expect(outcome.quips).toEqual([{ dog: "pierre", moment: "fired" }]);
    expect(outcome.state.phase).toEqual({ kind: "walking" });
  });

  it("ends the run when the last owner fires you", () => {
    const outcome = choose(testState({ koda: -lost }), encounter("skunk", ["koda"]), nose);
    expect(outcome.state.phase).toEqual({ kind: "ended", reason: "noDogs" });
    const source = encounter("skunk", ["koda"]);
    const card = cardFor(data, outcome.state, source);
    expect(() => chooseOption(data, () => 0, outcome.state, card, nose)).toThrow("ended");
  });

  it("makes the zone's first card free with Sweet talker, and the next one not", () => {
    const sweetTalker = activeModifier(
      { kind: "upgrade", upgrade: "sweetTalker" },
      { by: "sweetTalkerFreeCards", operation: "add", stat: "freeCards" },
    );
    const state = testState(
      { duchess: 5, koda: 5 },
      { modifiers: [sweetTalker], money: cents(4000) },
    );
    const skunk = encounter("skunk", ["duchess", "koda"]);
    const first = choose(state, skunk, groom);
    expect(first.state.money).toBe(4000);
    expect(first.state.cardsThisZone).toBe(1);
    expect(choose(first.state, skunk, groom).state.money).toBe(4000 - high);
  });
});

describe("offerUpgrades", () => {
  it("never offers an upgrade already picked", () => {
    const all = Object.keys(UPGRADES) as UpgradeId[];
    const picked = testState({ koda: 5 }, { upgradesPicked: all.slice(0, 2) });
    for (let draw = 0; draw < 1; draw += 0.1) {
      const offer = offerUpgrades(data, () => draw, 3, picked);
      expect(offer).toHaveLength(3);
      expect(offer.filter((id) => all.slice(0, 2).includes(id))).toEqual([]);
    }
  });

  it("offers the only ones left when the rest are picked, and fails with fewer", () => {
    const all = Object.keys(UPGRADES) as UpgradeId[];
    const left = testState({ koda: 5 }, { upgradesPicked: all.slice(0, all.length - 3) });
    expect([...offerUpgrades(data, () => 0.5, 3, left)].sort()).toEqual(all.slice(-3).sort());
    const fewer = testState({ koda: 5 }, { upgradesPicked: all.slice(0, all.length - 2) });
    expect(() => offerUpgrades(data, () => 0, 3, fewer)).toThrow("Fewer than 3");
  });
});

describe("skip option", () => {
  it("is offered on every obstacle card with Hall pass until it is taken, once per zone", () => {
    const state = newRun(data, 1, { dogs: ["koda"], gear: "poopBags", walker: "casey" });
    const source = encounter("skunk", ["koda"]);
    expect(cardFor(data, state, source).skip).toBe(true);
    const skipped = choose(state, source, "skip");
    expect(heartsByDog(skipped.state)).toEqual(heartsByDog(state));
    expect(skipped.state.skipUsed).toBe(true);
    expect(cardFor(data, skipped.state, source).skip).toBe(false);
    expect(() => choose(skipped.state, source, "skip")).toThrow("no Skip option");
  });

  it("takes the costliest option's place on a card that already shows three", () => {
    const withBags = newRun(data, 1, { dogs: ["koda"], gear: "poopBags", walker: "casey" });
    const skunk = encounter("skunk", ["koda"]);
    const indexes = (state: RunState) => cardFor(data, state, skunk).options.map((o) => o.index);
    // Skunk's options in data order, the money one the costliest.
    expect(indexes(newRun(data, 1, { dogs: ["koda"], gear: null, walker: "casey" }))).toEqual([
      0, 1, 2,
    ]);
    const groom = optionWith("skunk", "money");
    expect(indexes(withBags)).toEqual([0, 1, 2].filter((index) => index !== groom));
    expect(() => choose(withBags, skunk, groom)).toThrow("not on the Skunk card");
  });

  it("is added beside the options of a card with fewer than three", () => {
    const withBags = newRun(data, 1, { dogs: ["koda"], gear: "poopBags", walker: "casey" });
    const card = cardFor(data, withBags, encounter("squirrel", ["koda"]));
    expect(card.options).toHaveLength(2);
    expect(card.skip).toBe(true);
  });
});

describe("Lucky collar", () => {
  it("starts every owner full at a max one heart higher", () => {
    const state = newRun(data, 2, {
      dogs: ["duchess", "pierre"],
      gear: "luckyCollar",
      walker: "casey",
    });
    const { luckyCollarMax } = TEST_TUNING.hearts;
    const collared = (dog: DogId) => startHearts(TEST_TUNING, [], DOGS[dog]) + luckyCollarMax;
    expect(heartsByDog(state)).toEqual({
      duchess: collared("duchess"),
      pierre: collared("pierre"),
    });
    const fork: CardSource = {
      kind: "fork",
      paths: ["park", "shops"],
      upgrades: ["bellyRubs", "bigTipper"],
    };
    // Belly rubs, on the first path, leaves full owners at their raised max.
    expect(heartsByDog(choose(state, fork, 0).state)).toEqual(heartsByDog(state));
  });
});

describe("a fork", () => {
  const upgrades: UpgradeId[] = ["bellyRubs", "bigTipper", "raincoats"];
  const source: CardSource = {
    kind: "fork",
    paths: ["snoozeCrescent", "shops", "homeStretch"],
    upgrades,
  };
  const afterZone = testState({ koda: 4 }, { route: ["street"], zoneIndex: 1 });

  it("shows a free path card per path with its zone, difficulty, pay multiplier and upgrade", () => {
    const card = cardFor(data, openCard(source, afterZone), source);
    expect(card.title).toBe(data.runText.card.forkTitle);
    expect(card.affected).toEqual([]);
    expect(card.skip).toBe(false);
    expect(
      card.options.map(({ availability, cost, label, path }) => ({
        availability,
        cost,
        label,
        path,
      })),
    ).toEqual(
      ["snoozeCrescent", "shops", "homeStretch"].map((id, index) => {
        const zone = TEST_WORLD.zones.find((candidate) => candidate.id === id);
        return {
          availability: { enabled: true },
          cost: 0,
          label: zone?.name,
          path: {
            difficulty: zone?.difficulty,
            difficultyName: zone?.difficultyName,
            fees: zone?.fees,
            side: ["left", "straight", "right"][index],
            upgrade: upgrades[index],
            zone: id,
          },
        };
      }),
    );
    expect(card.options[0]?.art).toBe("card-zone-snooze-crescent");
  });

  it("adds the chosen path's zone to the route, takes its upgrade and walks on", () => {
    const opened = openCard(source, afterZone);
    const outcome = chooseOption(data, () => 0, opened, cardFor(data, opened, source), 2);
    expect(outcome.state.route).toEqual(["street", "homeStretch"]);
    expect(outcome.state.upgradesPicked).toEqual([upgrades[2]]);
    expect(outcome.state.phase).toEqual({ kind: "walking" });
    expect(outcome.moneyDelta).toBe(0);
  });

  it("refuses a path the fork does not have", () => {
    const opened = openCard(source, afterZone);
    const card = cardFor(data, opened, source);
    expect(() => chooseOption(data, () => 0, opened, card, 3)).toThrow(RangeError);
    expect(() => chooseOption(data, () => 0, opened, card, "skip")).toThrow(RangeError);
  });

  it("offers only zones the route has not walked, each with an upgrade", () => {
    const walked = testState({ koda: 4 }, { route: ["street", "park"], zoneIndex: 2 });
    const fork = offerFork(data, { forks: () => 0, upgrades: () => 0 }, walked);
    expect(fork.paths).toEqual(["snoozeCrescent", "shops", "pawsPromenade"]);
    expect(fork.upgrades).toHaveLength(fork.paths.length);
  });

  it("leads only to the last zone, with its upgrade, before it", () => {
    const walked = testState({ koda: 4 }, { route: ["street", "park", "shops"], zoneIndex: 3 });
    const fork = offerFork(data, { forks: () => 0, upgrades: () => 0 }, walked);
    expect(fork.paths).toEqual([TEST_WORLD.lastZone]);
    expect(fork.upgrades).toHaveLength(1);
  });
});
