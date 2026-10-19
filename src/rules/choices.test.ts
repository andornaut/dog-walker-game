import { describe, expect, it } from "vitest";

import { DEBUFFS } from "../data/debuffs";
import { DOGS } from "../data/dogs";
import { ENCOUNTERS } from "../data/encounters";
import { FORCED_STOPS } from "../data/forcedStops";
import { NEED_CARDS, NEED_SPOTS, NEEDS } from "../data/needs";
import { QUIPS } from "../data/quips";
import { QUIRKS } from "../data/quirks";
import { RUN_TEXT } from "../data/runText";
import { SHOP_GEAR } from "../data/shop";
import type { DogId, EncounterId, ForcedStopId, UpgradeId } from "../data/types";
import { UPGRADES } from "../data/upgrades";
import { type CardSource, newRun, type RunState, type UpgradeOffer } from "../state/runState";
import { heartsByDog, testState } from "../testing/runState";
import { TEST_TUNING } from "../testing/tuning";
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
import { cents } from "./units";

const data = {
  debuffs: DEBUFFS,
  dogs: DOGS,
  encounters: ENCOUNTERS,
  forcedStops: FORCED_STOPS,
  needCards: NEED_CARDS,
  needSpots: NEED_SPOTS,
  needs: NEEDS,
  quips: QUIPS,
  quirks: QUIRKS,
  runText: RUN_TEXT,
  shopGear: SHOP_GEAR,
  tuning: TEST_TUNING,
  upgrades: UPGRADES,
  world: TEST_WORLD,
};

const encounter = (id: EncounterId, affected: DogId[]): CardSource => ({
  affected,
  encounter: id,
  kind: "encounter",
});

function choose(state: RunState, source: CardSource, choice: Choice, random = () => 0) {
  const opened = openCard(source, state);
  return chooseOption(data, random, opened, cardFor(data, opened, source), choice);
}

describe("cardFor", () => {
  it("disables an option the player cannot afford, with the reason", () => {
    const state = testState({ duchess: 5, koda: 5 }, { money: cents(900) });
    const card = cardFor(data, state, encounter("puddle", ["duchess", "koda"]));
    expect(card.title).toBe("Puddle");
    expect(card.options.map(({ availability }) => availability)).toEqual([
      { enabled: true },
      { enabled: false, reason: "not enough money" },
    ]);
    expect(card.options[1]?.cost).toBe(1000);
  });

  it("keeps every card's free option enabled with no money", () => {
    const state = testState({ duchess: 5, koda: 5, pierre: 5 });
    const cardEncounters = (Object.keys(ENCOUNTERS) as EncounterId[]).filter(
      (id) => ENCOUNTERS[id].resolution.kind === "card",
    );
    const sources: CardSource[] = [
      ...cardEncounters.map((id) => encounter(id, ["duchess", "koda", "pierre"])),
      ...(Object.keys(FORCED_STOPS) as ForcedStopId[]).map((stop): CardSource => ({
        kind: "forcedStop",
        stop,
      })),
    ];
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
    const card = cardFor(data, state, encounter("otherDog", ["koda", "nugget"]));
    expect(card.options.map(({ art }) => art)).toEqual([
      "card-other-dog-sniff",
      "card-other-dog-pull-away",
    ]);
    expect(card.options[1]?.breakdown).toEqual([
      { dog: "koda", name: "Pull away", text: "−1 ♥" },
      { dog: "nugget", name: "Pull away", text: "−1 ♥" },
      { dog: "nugget", name: "dramatic", text: "−1 ♥" },
    ]);
    expect(card.options[0]?.breakdown.filter(({ dog }) => dog === null)).toEqual([
      { dog: null, name: "Let them sniff", text: "−$10" },
    ]);
  });

  it("refuses an instant encounter, which opens no card", () => {
    const state = testState({ koda: 5 });
    expect(() => cardFor(data, state, encounter("photoOp", ["koda"]))).toThrow("opens no card");
  });
});

describe("the zone encounters' options", () => {
  // In dollars, as the card text shows them; the state counts cents.
  const { encounterLow, lemonadeCup, missedTips } = TEST_TUNING.money;
  const start = cents(5000);
  // Every need half way to urgent, so a need met shows as 0.
  const walking = (dogs: DogId[]) =>
    testState(Object.fromEntries(dogs.map((dog) => [dog, 5])), {
      money: start,
      needSeconds: Object.fromEntries(dogs.map((dog) => [dog, 30])),
    });
  const pick = (id: EncounterId, dogs: DogId[], name: string, affected = dogs) => {
    const state = walking(dogs);
    const card = cardFor(data, state, encounter(id, affected));
    const option = card.options.find(({ label }) => label === name);
    if (option === undefined) {
      throw new Error(`${card.title} has no option ${name}`);
    }
    const { state: after } = choose(state, encounter(id, affected), option.index);
    return {
      hearts: heartsByDog(after),
      met: Object.keys(after.needSeconds).filter((dog) => after.needSeconds[dog as DogId] === 0),
      spent: start - after.money,
      text: option.text,
    };
  };

  // Koda is a laid-back chaser, Nugget a dramatic food-driven dog, Pierre a fussy fancy one,
  // Biscuit Regular and Duchess Friendly.
  const kodaTrio: DogId[] = ["koda", "nugget", "pierre"];
  const biscuitTrio: DogId[] = ["biscuit", "koda", "nugget"];
  const duchessTrio: DogId[] = ["duchess", "nugget", "pierre"];
  const tips = 3 * missedTips * 100;
  const low = encounterLow * 100;

  it.each<[EncounterId, string, DogId[], Partial<ReturnType<typeof pick>>, DogId[]?]>([
    [
      "goose",
      "Back off slowly",
      kodaTrio,
      { hearts: { koda: 5, nugget: 5, pierre: 5 }, spent: tips },
    ],
    [
      "goose",
      "Honk back",
      kodaTrio,
      {
        hearts: { koda: 3, nugget: 3, pierre: 4 },
        spent: 0,
        text: "−2 ♥ Koda and Nugget, −1 ♥ Pierre",
      },
    ],
    ["picnic", "Buy a new lunch", kodaTrio, { spent: low }, ["nugget"]],
    [
      "picnic",
      "Drop it!",
      kodaTrio,
      { hearts: { koda: 5, nugget: 3, pierre: 5 }, spent: 0 },
      ["nugget"],
    ],
    ["petunias", "Replant them", biscuitTrio, { spent: 3 * low }],
    [
      "petunias",
      "Nature calls",
      biscuitTrio,
      { hearts: { biscuit: 4, koda: 4, nugget: 3 }, met: ["biscuit"], spent: 0 },
    ],
    [
      "trash",
      "Sniff it all",
      kodaTrio,
      {
        hearts: { koda: 5, nugget: 5, pierre: 3 },
        met: ["koda", "pierre"],
        spent: tips,
        // Pierre is a show dog and the trash is messy: his heart lost there costs one more.
        text: `Nosy needs met, −2 ♥ Pierre, −$${3 * missedTips}`,
      },
    ],
    ["trash", "Tidy up", kodaTrio, { hearts: { koda: 5, nugget: 5, pierre: 6 }, spent: tips }],
    ["trash", "Drag them on", kodaTrio, { hearts: { koda: 4, nugget: 1, pierre: 3 }, spent: 0 }],
    [
      "cafe",
      "Charm the crowd",
      duchessTrio,
      { hearts: { duchess: 5, nugget: 5, pierre: 5 }, met: ["duchess"], spent: tips },
    ],
    [
      "cafe",
      "Buy new lattes",
      duchessTrio,
      { hearts: { duchess: 5, nugget: 5, pierre: 6 }, spent: 3 * low },
    ],
    ["cafe", "Slink away", duchessTrio, { hearts: { duchess: 4, nugget: 3, pierre: 4 }, spent: 0 }],
    [
      "lemonade",
      "Water, please",
      duchessTrio,
      {
        met: ["nugget"],
        spent: 3 * lemonadeCup * 100,
        text: `Thirsty needs met, −$${3 * lemonadeCup}`,
      },
    ],
    ["lemonade", "Say hi", duchessTrio, { met: ["duchess"], spent: tips }],
    [
      "lemonade",
      "Maybe later",
      duchessTrio,
      { hearts: { duchess: 5, nugget: 5, pierre: 5 }, met: [], spent: 0, text: "Nothing" },
    ],
  ])("%s: %s", (id, option, pack, expected, affected) => {
    expect(pick(id, pack, option, affected)).toMatchObject(expected);
  });
});

describe("applyInstantEncounter", () => {
  it("pays a photo op at once, with a quip from the owners who gained hearts", () => {
    const state = testState({ koda: 5, snowball: 3 });
    const outcome = applyInstantEncounter(data, () => 0, state, "photoOp", ["koda", "snowball"]);
    expect(outcome.moneyDelta).toBe(1000);
    expect(heartsByDog(outcome.state)).toEqual({ koda: 5, snowball: 5 });
    expect(outcome.quips).toEqual([{ dog: "snowball", moment: "happier" }]);
    expect(outcome.moneyChanges[0]?.causes).toEqual([
      { amount: 1000, kind: "effect", source: { encounter: "photoOp", kind: "instant" } },
    ]);
    expect(outcome.state.phase).toEqual({ kind: "walking" });
  });

  // The carry limit is 3 treats.
  it.each<[string, number, DogId[], number, DogId[]]>([
    ["one dog", 0, ["koda"], 1, ["koda"]],
    ["two dogs", 0, ["duchess", "koda"], 2, ["duchess", "koda"]],
    ["a full treat bag", 3, ["koda"], 0, []],
  ])(
    "gives the biscuit neighbour's treats per caught dog, a happier line and no hearts: %s",
    (_, treats, affected, treatsDelta, quips) => {
      const state = testState({ duchess: 5, koda: 5 }, { treats });
      const outcome = applyInstantEncounter(data, () => 0, state, "biscuitNeighbour", affected);
      expect(outcome.treatsDelta).toBe(treatsDelta);
      expect(outcome.heartChanges).toEqual([]);
      expect(outcome.quips).toEqual(quips.map((dog) => ({ dog, moment: "happier" })));
    },
  );

  it("refuses an encounter that opens a card, and an ended run", () => {
    const state = testState({ koda: 5 });
    expect(() => applyInstantEncounter(data, () => 0, state, "lostWallet", ["koda"])).toThrow(
      "opens a card",
    );
    const ended = { ...state, phase: { kind: "ended", reason: "noDogs" } as const };
    expect(() => applyInstantEncounter(data, () => 0, ended, "photoOp", ["koda"])).toThrow("ended");
  });
});

describe("openCard", () => {
  it("waits in the upgrade phase for an upgrade offer, and the card phase for anything else", () => {
    const state = testState({ koda: 5 });
    const offered: UpgradeOffer = ["bellyRubs", "bigTipper", "raincoats"];
    expect(openCard({ kind: "upgradeOffer", offered }, state).phase).toEqual({
      kind: "upgrade",
      offered,
    });
    const skunk = encounter("skunk", ["koda"]);
    expect(openCard(skunk, state).phase).toEqual({ kind: "card", source: skunk });
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
  it("counts a squirrel chase only when the chasers are let chase", () => {
    const state = testState({ koda: 5 }, { money: cents(5_000) });
    const squirrel = encounter("squirrel", ["koda"]);
    expect(choose(state, squirrel, 1).state.squirrelChases).toBe(1);
    expect(choose(state, squirrel, 0).state.squirrelChases).toBe(0);
  });

  it("applies an option only to the caught dogs, and reports each heart change", () => {
    const outcome = choose(testState({ duchess: 5, koda: 5 }), encounter("skunk", ["koda"]), 2);
    expect(heartsByDog(outcome.state)).toEqual({ duchess: 5, koda: 3 });
    expect(outcome.heartChanges).toEqual([
      {
        after: 3,
        before: 5,
        causes: [
          {
            amount: -2,
            kind: "effect",
            source: { encounter: "skunk", kind: "encounter", option: 2 },
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
    const outcome = choose(state, encounter("skunk", ["duchess", "koda"]), 0);
    expect(outcome.state.money).toBe(1000);
    expect(outcome.moneyDelta).toBe(-1500 * 2);
  });

  it("rejects a disabled option", () => {
    const state = testState({ duchess: 5, koda: 5 });
    expect(() => choose(state, encounter("puddle", ["duchess", "koda"]), 1)).toThrow(
      "not enough money",
    );
  });

  it("fires an owner at 0 hearts, who takes back their dog's fees", () => {
    const state = testState(
      { duchess: 5, pierre: 2 },
      {
        feesEarned: { duchess: cents(2000), pierre: cents(2600) },
        money: cents(5000),
        zoneIndex: 2,
      },
    );
    const outcome = choose(state, encounter("skunk", ["pierre"]), 2);
    expect(outcome.fired).toEqual(["pierre"]);
    expect(outcome.state.money).toBe(5000 - 2600);
    expect(outcome.moneyDelta).toBe(-2600);
    expect(outcome.moneyChanges.map(({ amount, dog }) => ({ amount, dog }))).toEqual([
      { amount: -2600, dog: "pierre" },
    ]);
    expect(outcome.state.pack[1]).toEqual({ dog: "pierre", status: "fired", zoneIndex: 2 });
    expect(outcome.quips).toEqual([{ dog: "pierre", moment: "fired" }]);
    expect(outcome.state.phase).toEqual({ kind: "walking" });
  });

  it("ends the run when the last owner fires you", () => {
    const outcome = choose(testState({ koda: 2 }), encounter("skunk", ["koda"]), 2);
    expect(outcome.state.phase).toEqual({ kind: "ended", reason: "noDogs" });
    const source = encounter("skunk", ["koda"]);
    const card = cardFor(data, outcome.state, source);
    expect(() => chooseOption(data, () => 0, outcome.state, card, 2)).toThrow("ended");
  });
});

describe("upgrades", () => {
  it("records a picked upgrade, which then leaves the pool", () => {
    const offered = offerUpgrades(data, () => 0, testState({ koda: 5 }));
    const picked = choose(testState({ koda: 5 }), { kind: "upgradeOffer", offered }, 1).state;
    expect(picked.upgradesPicked).toEqual([offered[1]]);
    for (let draw = 0; draw < 1; draw += 0.1) {
      expect(offerUpgrades(data, () => draw, picked)).not.toContain(offered[1]);
    }
  });

  it("never offers both trade-off cards together", () => {
    const tradeOffs = (Object.keys(UPGRADES) as UpgradeId[]).filter(
      (id) => UPGRADES[id].kind === "tradeOff",
    );
    expect(tradeOffs).toHaveLength(2);
    // A seeded linear congruential generator, so every run of the test draws the same offers.
    let seed = 1;
    const seeded = () => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed / 2_147_483_648;
    };
    let offersWithTradeOff = 0;
    for (let draw = 0; draw < 500; draw++) {
      const offer = offerUpgrades(data, seeded, testState({ koda: 5 }));
      const count = offer.filter((id) => tradeOffs.includes(id)).length;
      expect(count, offer.join(", ")).toBeLessThanOrEqual(1);
      offersWithTradeOff += count;
    }
    expect(offersWithTradeOff).toBeGreaterThan(0);
  });

  it("sets a second trade-off aside and draws another card instead", () => {
    // The first draws take rushHour (index 4 of 9), then shortcut (index 5 of the 8 left).
    const draws = [4.5 / 9, 5.5 / 8, 0];
    const offer = offerUpgrades(data, () => draws.shift() ?? 0, testState({ koda: 5 }));
    expect(offer).toEqual(["rushHour", "bellyRubs", "bigTipper"]);
  });

  it("offers the only three left when the rest are picked, and fails with fewer", () => {
    const all = Object.keys(UPGRADES) as UpgradeId[];
    const sixPicked = testState({ koda: 5 }, { upgradesPicked: all.slice(0, 6) });
    expect([...offerUpgrades(data, () => 0.5, sixPicked)].sort()).toEqual(all.slice(6).sort());
    const sevenPicked = testState({ koda: 5 }, { upgradesPicked: all.slice(0, 7) });
    expect(() => offerUpgrades(data, () => 0, sevenPicked)).toThrow("Fewer than 3");
  });
});

describe("skip option", () => {
  it("is offered on an obstacle card with poop bags, and only once per run", () => {
    const state = newRun(data, 1, { dogs: ["koda"], gear: "poopBags" });
    const source = encounter("skunk", ["koda"]);
    expect(cardFor(data, state, source).skip).toBe(true);
    expect(cardFor(data, state, encounter("lostWallet", ["koda"])).skip).toBe(false);
    const skipped = choose(state, source, "skip");
    expect(heartsByDog(skipped.state)).toEqual(heartsByDog(state));
    expect(skipped.state.skipsLeft).toBe(0);
    expect(cardFor(data, skipped.state, source).skip).toBe(false);
    expect(() => choose(skipped.state, source, "skip")).toThrow("no Skip option");
  });

  it("takes the costliest option's place on a card that already shows three", () => {
    const withBags = newRun(data, 1, { dogs: ["koda"], gear: "poopBags" });
    const skunk = encounter("skunk", ["koda"]);
    const indexes = (state: RunState) => cardFor(data, state, skunk).options.map((o) => o.index);
    // Skunk's options in data order: grooming (the costliest), quick rinse, then the free one.
    expect(indexes(newRun(data, 1, { dogs: ["koda"], gear: null }))).toEqual([0, 1, 2]);
    expect(indexes(withBags)).toEqual([1, 2]);
    expect(() => choose(withBags, skunk, 0)).toThrow("not on the Skunk card");
  });

  it("is added beside the options of a card with fewer than three", () => {
    const withBags = newRun(data, 1, { dogs: ["koda"], gear: "poopBags" });
    const card = cardFor(data, withBags, encounter("squirrel", ["koda"]));
    expect(card.options).toHaveLength(2);
    expect(card.skip).toBe(true);
  });
});

describe("Second wind", () => {
  const offer: CardSource = {
    kind: "upgradeOffer",
    offered: ["secondWind", "bigTipper", "raincoats"],
  };

  it.each<[string, Parameters<typeof testState>[0], Parameters<typeof testState>[0]]>([
    [
      "+2 hearts to the unhappiest owner only",
      { duchess: 4, koda: 2, pierre: 3 },
      { duchess: 4, koda: 4, pierre: 3 },
    ],
    ["+4 hearts to a dramatic unhappiest owner", { koda: 5, nugget: 1 }, { koda: 5, nugget: 5 }],
    [
      "the first in pack order on a tie",
      { duchess: 3, koda: 2, pierre: 2 },
      { duchess: 3, koda: 4, pierre: 2 },
    ],
  ])("gives %s", (_, before, after) => {
    expect(heartsByDog(choose(testState(before), offer, 0).state)).toEqual(after);
  });
});

describe("Lucky collar", () => {
  it("starts every owner one heart higher and raises the max by one", () => {
    const state = newRun(data, 2, { dogs: ["duchess", "pierre"], gear: "luckyCollar" });
    expect(heartsByDog(state)).toEqual({ duchess: 7, pierre: 5 });
    const offer: CardSource = {
      kind: "upgradeOffer",
      offered: ["bellyRubs", "bigTipper", "raincoats"],
    };
    expect(heartsByDog(choose(state, offer, 0).state)).toEqual({ duchess: 7, pierre: 6 });
  });
});

describe("need cards", () => {
  const need = (card: "accident" | "strangerLoves", affected: DogId[]): CardSource => ({
    affected,
    card,
    kind: "need",
  });

  it("names the dogs whose need opened the card, and affects only them", () => {
    const state = testState({ duchess: 3, koda: 3, snowball: 3 });
    const card = cardFor(data, state, need("strangerLoves", ["duchess", "snowball"]));
    expect(card.title).toBe("A stranger loves Duchess and Snowball");
    expect(card.affected).toEqual(["duchess", "snowball"]);
    const outcome = choose(state, need("strangerLoves", ["duchess", "snowball"]), 0);
    expect(heartsByDog(outcome.state)).toEqual({ duchess: 4, koda: 3, snowball: 5 });
  });

  it("names the grumpy neighbour as the cause of an accident's Walk on", () => {
    const state = testState({ biscuit: 5, koda: 5 }, { money: cents(10_000) });
    const { amount } = NEED_CARDS.accident.options[1].effects[0];
    const card = cardFor(data, state, need("accident", ["biscuit"]));
    expect(card.options[1]?.breakdown).toEqual([
      { dog: "biscuit", name: "grumpy neighbour", text: `−${-amount} ♥` },
    ]);
    const walkOn = choose(state, need("accident", ["biscuit"]), 1);
    expect(heartsByDog(walkOn.state)).toEqual({ biscuit: 5 + amount, koda: 5 });
    expect(walkOn.quips).toEqual([{ dog: "biscuit", moment: "upset" }]);
  });

  it("meets Playful needs with Let them sniff, and Friendly ones with Of course!", () => {
    const state = testState(
      { duchess: 3, koda: 3, zippy: 3 },
      { money: cents(10_000), needSeconds: { duchess: 30, koda: 30, zippy: 30 } },
    );
    const sniffed = choose(state, encounter("otherDog", ["duchess", "koda", "zippy"]), 0);
    expect(sniffed.state.needSeconds).toEqual({ duchess: 30, koda: 30, zippy: 0 });
    const petted = choose(state, { kind: "forcedStop", stop: "kidWantsToPet" }, 0);
    expect(petted.state.needSeconds).toEqual({ duchess: 0, koda: 30, zippy: 30 });
  });
});

describe("a fork", () => {
  const source: CardSource = { kind: "fork", paths: ["snoozeCrescent", "shops", "homeStretch"] };
  const afterZone = testState({ koda: 4 }, { route: ["street"], zoneIndex: 1 });

  it("shows a free path card per path with its zone, difficulty and fee multiplier", () => {
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
            zone: id,
          },
        };
      }),
    );
    expect(card.options[0]?.art).toBe("card-zone-snooze-crescent");
  });

  it("adds the chosen path's zone to the route and walks on", () => {
    const opened = openCard(source, afterZone);
    const outcome = chooseOption(data, () => 0, opened, cardFor(data, opened, source), 2);
    expect(outcome.state.route).toEqual(["street", "homeStretch"]);
    expect(outcome.state.phase).toEqual({ kind: "walking" });
    expect(outcome.moneyDelta).toBe(0);
  });

  it("refuses a path the fork does not have", () => {
    const opened = openCard(source, afterZone);
    const card = cardFor(data, opened, source);
    expect(() => chooseOption(data, () => 0, opened, card, 3)).toThrow(RangeError);
    expect(() => chooseOption(data, () => 0, opened, card, "skip")).toThrow(RangeError);
  });

  it("offers only zones the route has not walked", () => {
    const walked = testState({ koda: 4 }, { route: ["street", "park", "shops"], zoneIndex: 3 });
    expect(offerFork(data, () => 0, walked)).toEqual({
      kind: "fork",
      paths: ["snoozeCrescent", "pawsPromenade", "homeStretch"],
    });
  });
});
