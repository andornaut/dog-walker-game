import { describe, expect, it } from "vitest";

import { DEBUFFS } from "../data/debuffs";
import { DOGS } from "../data/dogs";
import { ENCOUNTERS } from "../data/encounters";
import { HOME_TEXT } from "../data/homeText";
import { QUIPS } from "../data/quips";
import { RUN_TEXT } from "../data/runText";
import { SHOP_GEAR } from "../data/shop";
import type { CardOption, DogId, Effect, EncounterId, UpgradeId } from "../data/types";
import { UPGRADES } from "../data/upgrades";
import { keysOf } from "../lib/records";
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
  hasPlaque,
  offerFork,
  offerUpgrades,
  openCard,
} from "./choices";
import { placeInPack, startHearts } from "./dogs";
import { cents, read } from "./units";

const data = {
  debuffs: DEBUFFS,
  dogs: DOGS,
  encounters: ENCOUNTERS,
  homeText: HOME_TEXT,
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
const letGo = read(TEST_TUNING, "money", "thiefLetGo");
const high = read(TEST_TUNING, "money", "encounterHigh");

function choose(state: RunState, source: CardSource, choice: Choice) {
  const opened = openCard(source, state);
  return chooseOption(data, opened, cardFor(data, opened, source), choice);
}

describe("cardFor", () => {
  it("disables an option the player cannot afford, with the reason", () => {
    const state = testState({ duchess: 5, kilo: 5 }, { money: cents(letGo - 100) });
    const card = cardFor(data, state, encounter("thief", ["duchess", "kilo"]));
    const letGoOption = optionWith("thief", "money");
    expect(card.title).toBe(ENCOUNTERS.thief.name);
    expect(card.options.map(({ availability }) => availability)).toEqual(
      card.options.map((_, index) =>
        index === letGoOption ? { enabled: false, reason: "not enough money" } : { enabled: true },
      ),
    );
    expect(card.options[letGoOption]?.cost).toBe(letGo);
  });

  it("keeps every card's free option enabled with no money", () => {
    const state = testState({ duchess: 5, kilo: 5, pierre: 5 });
    const cardEncounters = keysOf(ENCOUNTERS).filter(
      (id) => ENCOUNTERS[id].resolution.kind === "card",
    );
    const sources = cardEncounters.map((id) => encounter(id, ["duchess", "kilo", "pierre"]));
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

  it("gives each option its art and a breakdown of every change it would make", () => {
    const state = testState({ kilo: 5, reggie: 5 }, { money: cents(5000) });
    const card = cardFor(data, state, encounter("thief", ["kilo", "reggie"]));
    const { resolution } = ENCOUNTERS.thief;
    const options = resolution.kind === "card" ? resolution.options : [];
    expect(card.options.map(({ art }) => art)).toEqual(options.map(({ art }) => art));
    const letGo = options[optionWith("thief", "money")];
    const grabBack = options[optionWith("thief", "hearts")];
    const lost = `−${Math.abs(heartsOf("thief"))}♥`;
    expect(card.options[optionWith("thief", "hearts")]?.breakdown).toEqual([
      { dog: "kilo", name: grabBack?.name, text: lost },
      { dog: "reggie", name: grabBack?.name, text: lost },
    ]);
    expect(
      card.options[optionWith("thief", "money")]?.breakdown.filter(({ dog }) => dog === null),
    ).toEqual([{ dog: null, name: letGo?.name, text: `−$${TEST_TUNING.money.thiefLetGo}` }]);
  });

  it("refuses an instant encounter, which opens no card", () => {
    const state = testState({ kilo: 5 });
    expect(() => cardFor(data, state, encounter("lostWallet", ["kilo"]))).toThrow("opens no card");
  });
});

describe("hasPlaque", () => {
  const pack: DogId[] = ["duchess", "kilo", "pierre"];
  const state = testState({ duchess: 5, kilo: 5, pierre: 5 }, { money: cents(1_000_000) });
  const rows = keysOf(ENCOUNTERS).flatMap((id) => {
    const { resolution } = ENCOUNTERS[id];
    return resolution.kind === "card"
      ? resolution.options.map(({ effects, name }, index) => ({
          id,
          index,
          name,
          pays: effects.some((effect) => effect.kind === "money" && effect.change === "lose"),
        }))
      : [];
  });

  it("gives every encounter option a plaque exactly when it costs cash", () => {
    const wrong = rows.filter(
      (row) =>
        hasPlaque(cardFor(data, state, encounter(row.id, pack)).options[row.index]) !== row.pays,
    );
    expect(wrong.map(({ id, name }) => `${id}: ${name}`)).toEqual([]);
  });

  it("gives the Skip card no plaque and a fork's path card one, for its zone's pay", () => {
    const fork: CardSource = { kind: "fork", paths: ["shops"], upgrades: ["bigTipper"] };
    const afterZone = testState({ kilo: 4 }, { route: ["street"], zoneIndex: 1 });
    expect(hasPlaque(undefined)).toBe(false);
    expect(hasPlaque(cardFor(data, openCard(fork, afterZone), fork).options[0])).toBe(true);
  });
});

describe("applyInstantEncounter", () => {
  it("pays a lost wallet at once", () => {
    const state = testState({ kilo: 5, snowball: 3 });
    const outcome = applyInstantEncounter(data, state, "lostWallet", ["kilo", "snowball"]);
    const keep = read(TEST_TUNING, "money", "lostWalletKeep");
    expect(outcome.moneyDelta).toBe(keep);
    expect(heartsByDog(outcome.state)).toEqual(heartsByDog(state));
    expect(outcome.moneyChanges[0]?.causes).toEqual([
      { amount: keep, kind: "effect", source: { encounter: "lostWallet", kind: "instant" } },
    ]);
    expect(outcome.state.phase).toEqual({ kind: "walking" });
  });

  // The pinned tuning shares 3 hearts.
  it("shares the friendly neighbour's hearts by the whole pack, whichever dog it caught", () => {
    const state = testState({ duchess: 3, kilo: 3 });
    const outcome = applyInstantEncounter(data, state, "pettingNeighbour", ["duchess"]);
    expect(outcome.heartChanges.map(({ after, before, dog }) => [dog, after - before])).toEqual([
      ["kilo", 2],
      ["duchess", 1],
    ]);
  });

  // Each lucky find, caught by the whole pack, below max, with an owner at max and with an owner
  // fired: each owner it raised a heart for says one happier line, and no other owner says one.
  // Found money is the walker's, so no owner gains it.
  const luckyFinds = keysOf(ENCOUNTERS).filter((id) => ENCOUNTERS[id].kind === "lucky");
  const low = testState({ duchess: 1, kilo: 1, snowball: 1 });
  const kiloFull = startHearts(TEST_TUNING, [], placeInPack(low, "kilo"), DOGS.kilo);
  const packs: [string, RunState][] = [
    ["below max", low],
    ["Kilo's owner at max", testState({ duchess: 1, kilo: kiloFull, snowball: 1 })],
    ["Sequoia's owner fired", testState({ duchess: 1, kilo: 1, snowball: "fired" })],
  ];
  it.each(luckyFinds.flatMap((id) => packs.map(([pack, state]) => [id, pack, state] as const)))(
    "has %s quip from exactly the owners it raised, %s",
    (id, _pack, state) => {
      const { resolution } = ENCOUNTERS[id];
      const effects: readonly Effect[] = resolution.kind === "instant" ? resolution.effects : [];
      const hearts = effects.some(
        (effect) => effect.kind === "hearts" || effect.kind === "sharedHearts",
      );
      const walking = Object.entries(heartsByDog(state)) as [DogId, number][];
      const raised = walking.filter(
        ([dog, now]) =>
          hearts && now < startHearts(TEST_TUNING, [], placeInPack(state, dog), DOGS[dog]),
      );
      const caught = walking.map(([dog]) => dog);
      const outcome = applyInstantEncounter(data, state, id, caught);
      expect(outcome.quips).toEqual(raised.map(([dog]) => ({ dog, moment: "happier" })));
    },
  );

  it("refuses an encounter with no effects on contact", () => {
    expect(() => applyInstantEncounter(data, testState({ kilo: 5 }), "thief", ["kilo"])).toThrow(
      "no effects on contact",
    );
  });

  it("applies a contact obstacle's effects to the pack", () => {
    const outcome = applyInstantEncounter(data, testState({ kilo: 5 }), "puddle", ["kilo"]);
    const { resolution } = ENCOUNTERS.puddle;
    const debuffs = resolution.effects.flatMap((effect) =>
      effect.kind === "debuff" ? [effect.debuff] : [],
    );
    expect(outcome.state.debuffs.map(({ debuff }) => debuff)).toEqual(debuffs);
    expect(outcome.heartChanges).toEqual([]);
  });
});

describe("chooseOption", () => {
  // Raincoats keep only a puddle's Muddy off: the capybara's Help the keeper muddies the pack
  // with them or without.
  it.each([{ raincoats: false }, { raincoats: true }])(
    "muddies the pack helping the capybara's keeper, with Raincoats: $raincoats",
    ({ raincoats }) => {
      const coats = {
        encounter: "puddle",
        source: { kind: "upgrade", upgrade: "raincoats" },
      } as const;
      const state = testState({ kilo: 5 }, raincoats ? { immunities: [coats] } : {});
      const help = optionWith("capybara", "debuff");
      const { state: after } = choose(state, encounter("capybara", ["kilo"]), help);
      expect(after.debuffs.map(({ debuff }) => debuff)).toEqual(["muddy"]);
    },
  );

  const nose = optionWith("skunk", "hearts");
  const groom = optionWith("skunk", "money");
  const lost = heartsOf("skunk");

  // An option of every card in the data, by its encounter, index and id: a pick counts the same
  // way whichever option it is, so the cards take their options' places in turn.
  const picked = keysOf(ENCOUNTERS).flatMap((id, card) => {
    const { resolution } = ENCOUNTERS[id];
    const options: readonly CardOption[] = resolution.kind === "card" ? resolution.options : [];
    const index = card % Math.max(1, options.length);
    const option = options[index];
    return option === undefined ? [] : [{ id, index, option: option.id }];
  });

  it.each(picked)(
    "counts a pick of $id's $option by encounter and option id, as no tally",
    (row) => {
      const state = testState({ kilo: 5 }, { money: cents(5_000) });
      const card = encounter(row.id, ["kilo"]);
      const once = choose(state, card, row.index).state;
      expect(once.optionPicks).toEqual({ [row.id]: { [row.option]: 1 } });
      expect(once.tallies).toEqual({});
      const twice = choose({ ...once, phase: { kind: "walking" } }, card, row.index).state;
      expect(twice.optionPicks).toEqual({ [row.id]: { [row.option]: 2 } });
    },
  );

  // Every card option in the data that applies a debuff, whichever debuff and card it is.
  const debuffOptions = keysOf(ENCOUNTERS).flatMap((id) => {
    const { resolution } = ENCOUNTERS[id];
    const options: readonly CardOption[] = resolution.kind === "card" ? resolution.options : [];
    return options.flatMap((option, index) => {
      const debuffs = option.effects.flatMap((effect) =>
        effect.kind === "debuff" ? [effect.debuff] : [],
      );
      return debuffs.length === 0 ? [] : [{ debuffs, id, index, name: option.name }];
    });
  });

  it("gives some card option every debuff", () => {
    expect(new Set(debuffOptions.flatMap(({ debuffs }) => debuffs))).toEqual(
      new Set(Object.keys(DEBUFFS)),
    );
  });

  // The first option that applies each debuff.
  const debuffSample = debuffOptions.filter((row, i) =>
    row.debuffs.some(
      (debuff) => debuffOptions.findIndex((other) => other.debuffs.includes(debuff)) === i,
    ),
  );

  it.each(debuffSample)(
    "$id's $name leaves the pack with its debuffs",
    ({ debuffs, id, index }) => {
      const outcome = choose(testState({ kilo: 5 }), encounter(id, ["kilo"]), index);
      expect(outcome.state.debuffs.map(({ debuff }) => debuff)).toEqual(debuffs);
    },
  );

  // Every card option in the data that costs the lead dog's owner hearts.
  const leadOptions = keysOf(ENCOUNTERS).flatMap((id) => {
    const { resolution } = ENCOUNTERS[id];
    const options: readonly CardOption[] = resolution.kind === "card" ? resolution.options : [];
    return options.flatMap((option, index) =>
      option.effects.flatMap((effect) =>
        effect.kind === "hearts" && effect.target.kind === "lead"
          ? [{ amount: effect.amount, id, index, name: option.name }]
          : [],
      ),
    );
  });

  it("has a card option that costs only the lead dog's owner", () => {
    expect(leadOptions).not.toEqual([]);
  });

  it.each(leadOptions)("$id's $name reaches only the lead dog", ({ amount, id, index }) => {
    // Formation leads with the largest dog: Pierre is the medium dog beside small Duchess.
    const state = testState({ duchess: 5, pierre: 5 });
    const outcome = choose(state, encounter(id, ["duchess", "pierre"]), index);
    expect(heartsByDog(outcome.state)).toEqual({ duchess: 5, pierre: 5 + amount });
  });

  it("applies an option only to the affected dogs, and reports each heart change", () => {
    const outcome = choose(testState({ duchess: 5, kilo: 5 }), encounter("skunk", ["kilo"]), nose);
    expect(heartsByDog(outcome.state)).toEqual({ duchess: 5, kilo: 5 + lost });
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
        dog: "kilo",
        kind: "hearts",
      },
    ]);
    expect(outcome.quips).toEqual([{ dog: "kilo", moment: "upset" }]);
    expect(outcome.state.phase).toEqual({ kind: "walking" });
  });

  it("charges the option's cost and reports the money change", () => {
    const state = testState({ duchess: 5, kilo: 5 }, { money: cents(4000) });
    const outcome = choose(state, encounter("skunk", ["duchess", "kilo"]), groom);
    expect(outcome.state.money).toBe(4000 - high);
    expect(outcome.moneyDelta).toBe(-high);
  });

  it("rejects a disabled option", () => {
    const state = testState({ duchess: 5, kilo: 5 }, { money: cents(0) });
    expect(() =>
      choose(state, encounter("thief", ["duchess", "kilo"]), optionWith("thief", "money")),
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
    const outcome = choose(testState({ kilo: -lost }), encounter("skunk", ["kilo"]), nose);
    expect(outcome.state.phase).toEqual({ kind: "ended", reason: "noDogs" });
    const source = encounter("skunk", ["kilo"]);
    const card = cardFor(data, outcome.state, source);
    expect(() => chooseOption(data, outcome.state, card, nose)).toThrow("ended");
  });

  it("makes the zone's first card free with Sweet talker, and the next one not", () => {
    const sweetTalker = activeModifier(
      { kind: "upgrade", upgrade: "sweetTalker" },
      { by: "sweetTalkerFreeCards", operation: "add", stat: "freeCards" },
    );
    const state = testState(
      { duchess: 5, kilo: 5 },
      { modifiers: [sweetTalker], money: cents(4000) },
    );
    const skunk = encounter("skunk", ["duchess", "kilo"]);
    const first = choose(state, skunk, groom);
    expect(first.state.money).toBe(4000);
    expect(first.state.cardsThisZone).toBe(1);
    expect(choose(first.state, skunk, groom).state.money).toBe(4000 - high);
  });
});

describe("offerUpgrades", () => {
  it("never offers an upgrade already picked", () => {
    const all = keysOf(UPGRADES);
    const picked = testState({ kilo: 5 }, { upgradesPicked: all.slice(0, 2) });
    for (let draw = 0; draw < 1; draw += 0.1) {
      const offer = offerUpgrades(data, () => draw, 3, picked);
      expect(offer).toHaveLength(3);
      expect(offer.filter((id) => all.slice(0, 2).includes(id))).toEqual([]);
    }
  });

  it("offers the only ones left when the rest are picked, and fails with fewer", () => {
    const all = keysOf(UPGRADES);
    const left = testState({ kilo: 5 }, { upgradesPicked: all.slice(0, all.length - 3) });
    expect([...offerUpgrades(data, () => 0.5, 3, left)].sort()).toEqual(all.slice(-3).sort());
    const fewer = testState({ kilo: 5 }, { upgradesPicked: all.slice(0, all.length - 2) });
    expect(() => offerUpgrades(data, () => 0, 3, fewer)).toThrow("Fewer than 3");
  });
});

describe("skip option", () => {
  it("is offered on every obstacle card with Hall pass until it is taken, once per zone", () => {
    const state = newRun(data, 1, { dogs: ["kilo"], gear: "hallPass", walker: "casey" });
    const source = encounter("skunk", ["kilo"]);
    expect(cardFor(data, state, source).skip).toBe(true);
    const skipped = choose(state, source, "skip");
    expect(heartsByDog(skipped.state)).toEqual(heartsByDog(state));
    // The card counts toward the zone's, so a Sweet talker free card is used up by it.
    expect(skipped.state).toMatchObject({
      cardsThisZone: state.cardsThisZone + 1,
      money: state.money,
      phase: { kind: "walking" },
      skipUsed: true,
    });
    // A Skip picks no option.
    expect(skipped.state.optionPicks).toEqual({});
    expect(cardFor(data, skipped.state, source).skip).toBe(false);
    expect(() => choose(skipped.state, source, "skip")).toThrow("no Skip option");
  });

  // Cards built from the data's options. replaced is the index Walk on by takes the place of,
  // or null when the card keeps every option.
  const optionOf = (id: EncounterId, kind: "debuff" | "hearts" | "money"): CardOption => {
    const { resolution } = ENCOUNTERS[id];
    const option = resolution.kind === "card" ? resolution.options[optionWith(id, kind)] : null;
    if (!option) {
      throw new Error(`${id} has no ${kind} option`);
    }
    return option;
  };
  const cardOptions = (id: EncounterId): readonly CardOption[] => {
    const { resolution } = ENCOUNTERS[id];
    return resolution.kind === "card" ? resolution.options : [];
  };
  const holdYourNose = optionOf("skunk", "hearts");
  const fullGroom = optionOf("skunk", "money");
  const pricedHearts: CardOption = {
    ...holdYourNose,
    effects: [...holdYourNose.effects, ...fullGroom.effects],
  };
  it.each<{
    encounter: EncounterId;
    name: string;
    options?: readonly CardOption[];
    replaced: number | null;
  }>([
    {
      encounter: "skunk",
      name: "the one option that costs hearts, over a pricier one",
      replaced: optionWith("skunk", "hearts"),
    },
    {
      encounter: "skunk",
      name: "the pricier of two options tied on hearts",
      options: [optionOf("thief", "hearts"), optionOf("skunk", "debuff"), pricedHearts],
      replaced: 2,
    },
    {
      encounter: "skunk",
      name: "the most expensive option when none costs hearts",
      options: [optionOf("otherDog", "debuff"), fullGroom, optionOf("skunk", "debuff")],
      replaced: 1,
    },
    { encounter: "otherDog", name: "no option of a card with two", replaced: null },
  ])("takes the place of $name ($encounter)", ({ encounter: id, options, replaced }) => {
    const shown = options ?? cardOptions(id);
    const withOptions = {
      ...data,
      encounters: {
        ...ENCOUNTERS,
        [id]: { ...ENCOUNTERS[id], resolution: { kind: "card" as const, options: shown } },
      },
    };
    const source = encounter(id, ["kilo"]);
    const indexes = (gear: "hallPass" | null) =>
      cardFor(
        withOptions,
        newRun(withOptions, 1, { dogs: ["kilo"], gear, walker: "casey" }),
        source,
      ).options.map((option) => option.index);
    const all = shown.map((_, index) => index);
    expect(indexes(null)).toEqual(all);
    expect(indexes("hallPass")).toEqual(all.filter((index) => index !== replaced));
  });

  it("refuses the option Walk on by took the place of", () => {
    const withPass = newRun(data, 1, { dogs: ["kilo"], gear: "hallPass", walker: "casey" });
    const skunk = encounter("skunk", ["kilo"]);
    expect(() => choose(withPass, skunk, optionWith("skunk", "hearts"))).toThrow(
      "not on the Skunk card",
    );
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
    const collared = (dog: DogId) =>
      startHearts(TEST_TUNING, [], placeInPack(state, dog), DOGS[dog]) + luckyCollarMax;
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
  const afterZone = testState({ kilo: 4 }, { route: ["street"], zoneIndex: 1 });

  it("shows a free path card per path with its zone, difficulty and upgrade", () => {
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
            side: ["left", "straight", "right"][index],
            upgrade: upgrades[index],
            zone: id,
          },
        };
      }),
    );
    const first = TEST_WORLD.zones.find((zone) => zone.id === "snoozeCrescent");
    expect(card.options[0]?.art).toBe(`card-zone-${first?.art}`);
  });

  it("adds the chosen path's zone to the route, takes its upgrade and walks on, and refuses one it lacks", () => {
    const opened = openCard(source, afterZone);
    const outcome = chooseOption(data, opened, cardFor(data, opened, source), 2);
    expect(outcome.state.route).toEqual(["street", "homeStretch"]);
    expect(outcome.state.upgradesPicked).toEqual([upgrades[2]]);
    expect(outcome.state.phase).toEqual({ kind: "walking" });
    expect(outcome.moneyDelta).toBe(0);
    const card = cardFor(data, opened, source);
    expect(() => chooseOption(data, opened, card, 3)).toThrow(RangeError);
    expect(() => chooseOption(data, opened, card, "skip")).toThrow(RangeError);
  });

  it("offers only zones the route has not walked, each with an upgrade, and only the last before it", () => {
    const walked = testState({ kilo: 4 }, { route: ["street", "park"], zoneIndex: 2 });
    const fork = offerFork(data, { forks: () => 0, upgrades: () => 0 }, walked);
    expect(fork.paths).toEqual(["snoozeCrescent", "shops", "pawsPromenade"]);
    expect(fork.upgrades).toHaveLength(fork.paths.length);
    // Before the last zone, it leads only there.
    const before = testState({ kilo: 4 }, { route: ["street", "park", "shops"], zoneIndex: 3 });
    const last = offerFork(data, { forks: () => 0, upgrades: () => 0 }, before);
    expect(last.paths).toEqual([TEST_WORLD.lastZone]);
    expect(last.upgrades).toHaveLength(1);
  });
});
