import * as v from "valibot";
import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { DogId } from "../data/types";
import { defined, present } from "../testing/defined";
import { newPlayerSave, testContext, veteranSave } from "./fixtures";
import { loadSave, saveContextFrom } from "./load";
import { SAVE_VERSION, type SaveDocument, saveSchema } from "./schema";

const stored = (document: unknown) => JSON.stringify(document);

// The document as JSON holds it: ids are any string, so a test can store unknown ones.
type StoredInput = v.InferInput<typeof saveSchema>;

// For changes that break the stored shape on purpose.
const untyped = (document: StoredInput) => document as unknown as Record<string, unknown>;

function withChanges(change: (document: StoredInput) => void): string {
  const document: StoredInput = veteranSave();
  change(document);
  return stored(document);
}

const loaded = (change: (document: StoredInput) => void): SaveDocument =>
  loadSave(testContext, withChanges(change)).save;

const STARTER_DOGS = (Object.keys(gameData.dogs) as DogId[]).filter(
  (id) => gameData.dogs[id].unlock === "start",
);

const PRE_FORK_ROUTE = ["street", "park", "shops", "homeStretch"];

describe("loadSave", () => {
  it("gives a new player the free dogs, the default walker and no loadout", () => {
    expect(loadSave(testContext, null)).toEqual({ save: newPlayerSave, status: "new" });
  });

  // A save from when Duchess and Koda were starters: what it owns wins, and loading never
  // takes a dog away.
  it.each<[string, DogId[]]>([
    ["all three old starters", ["biscuit", "duchess", "koda"]],
    ["the old starters in another order", ["koda", "duchess", "biscuit"]],
    ["the old starters and a bought dog", ["biscuit", "duchess", "koda", "penny"]],
    ["two old starters without the new one", ["duchess", "koda"]],
  ])("keeps every dog an old save owns: %s", (_name, dogs) => {
    const save = loaded((document) => {
      document.owned.dogs = dogs;
    });
    expect(new Set(save.owned.dogs)).toEqual(new Set([...STARTER_DOGS, ...dogs]));
  });

  it("loads a valid save unchanged", () => {
    expect(loadSave(testContext, stored(veteranSave()))).toEqual({
      save: veteranSave(),
      status: "loaded",
    });
  });

  // Each row changes the stored veteran save, then reads part of what loads.
  it.each<[string, (document: StoredInput) => void, (save: SaveDocument) => unknown, unknown]>([
    [
      "a save from before achievements, with none earned and every counter at 0",
      (document) => {
        delete untyped(document).achievements;
        const stats = document.stats as unknown as Record<string, unknown>;
        delete stats.dogsFinishedWith;
        delete stats.tallies;
        delete stats.walksWithoutFiring;
      },
      ({ achievements, stats }) => [
        achievements,
        stats.dogsFinishedWith,
        stats.tallies,
        stats.walksWithoutFiring,
      ],
      [{}, [], {}, 0],
    ],
    [
      "a save from before the mute setting, unmuted",
      (document) => {
        delete (document.settings as Partial<typeof document.settings>).muted;
      },
      (save) => save.settings.muted,
      false,
    ],
    [
      "a pending checkpoint from before forks, on the pre-fork route",
      (document) => {
        document.checkpoint = {
          dogs: [{ fired: false, id: "koda", zonesFinished: 2 }],
          earnedCents: 4_250,
          zonesFinished: 2,
        };
      },
      (save) => save.checkpoint,
      {
        counters: null,
        dogs: [{ fired: false, id: "koda", zonesFinished: 2 }],
        earnedCents: 4_250,
        route: PRE_FORK_ROUTE,
        zonesFinished: 2,
      },
    ],
    [
      "a version 1 save's checkpoint on the pre-fork route",
      (document) => {
        untyped(document).version = 1;
        document.checkpoint = {
          dogs: [{ fired: false, id: "koda", zonesFinished: 1 }],
          earnedCents: 500,
          zonesFinished: 1,
        };
      },
      (save) => save.checkpoint?.route,
      PRE_FORK_ROUTE,
    ],
    [
      "a checkpoint's route, dropping zones the game no longer has",
      (document) => {
        document.checkpoint = {
          dogs: [{ fired: false, id: "koda", zonesFinished: 2 }],
          earnedCents: 4_250,
          route: ["street", "oldZone", "pawsPromenade"],
          zonesFinished: 2,
        };
      },
      (save) => save.checkpoint?.route,
      ["street", "pawsPromenade"],
    ],
    [
      "a checkpoint's run counters saved before the first zone, starting money and debuffs got",
      (document) => {
        document.checkpoint = {
          counters: { bumpsByZone: [0, 3] },
          dogs: [{ fired: false, id: "koda", zonesFinished: 2 }],
          earnedCents: 4_250,
          zonesFinished: 2,
        };
      },
      (save) => save.checkpoint?.counters,
      {
        bumpsByZone: [0, 3],
        debuffsGot: {},
        firstZone: 0,
        lastHeartOwners: 0,
        startCents: 0,
        tallies: {},
      },
    ],
    [
      // Saved before the rules rewrite: a checkpoint counting zones ended with a debuff, the
      // Whistle owned and picked, and a carried treat count.
      "a save from before the rules rewrite, keeping its dogs and money",
      (document) => {
        document.owned.gear = ["fannyPack", "whistle"];
        document.lastLoadout.gear = "whistle";
        document.checkpoint = {
          counters: { bumpsByZone: [1], debuffZones: { stinky: 1 } },
          dogs: [{ fired: false, id: "koda", zonesFinished: 1 }],
          earnedCents: 700,
          route: ["street"],
          treats: 2,
          zonesFinished: 1,
        } as unknown as StoredInput["checkpoint"];
      },
      (save) => [
        save.bankCents,
        save.owned.dogs,
        save.owned.gear,
        save.lastLoadout,
        save.checkpoint,
      ],
      [
        veteranSave().bankCents,
        veteranSave().owned.dogs,
        ["fannyPack"],
        { dogs: veteranSave().lastLoadout.dogs, gear: null },
        {
          counters: {
            bumpsByZone: [1],
            debuffsGot: {},
            firstZone: 0,
            lastHeartOwners: 0,
            startCents: 0,
            tallies: {},
          },
          dogs: [{ fired: false, id: "koda", zonesFinished: 1 }],
          earnedCents: 700,
          route: ["street"],
          zonesFinished: 1,
        },
      ],
    ],
    [
      "a last walk from before forks on the pre-fork route",
      (document) => {
        delete present(document.stats.lastWalk).route;
      },
      (save) => save.stats.lastWalk?.route,
      PRE_FORK_ROUTE,
    ],
    [
      "an empty loadout, as a new player has before picking a dog",
      (document) => {
        document.lastLoadout = { dogs: [], gear: null };
      },
      (save) => save.lastLoadout,
      { dogs: [], gear: null },
    ],
    [
      "without fields the schema does not know",
      (document) => {
        untyped(document).extra = true;
        untyped(document).settings = { ...document.settings, language: "fr" };
      },
      (save) => save,
      veteranSave(),
    ],
    [
      "without achievements and finished-with dogs the game no longer has",
      (document) => {
        document.achievements = { firstSteps: 5, retiredBadge: 6 };
        document.stats.dogsFinishedWith = ["koda", "ghost"];
      },
      (save) => [save.achievements, save.stats.dogsFinishedWith],
      [{ firstSteps: 5 }, ["koda"]],
    ],
    [
      "without unknown or duplicate owned ids",
      (document) => {
        document.owned = {
          dogSlots: 2,
          dogs: ["koda", "ghost", "penny", "koda"],
          gear: ["runningShoes", "jetpack", "runningShoes"],
          walkers: ["ben", "ghost", "ben"],
        };
      },
      (save) => save.owned,
      {
        dogSlots: 2,
        dogs: ["biscuit", "koda", "penny"],
        gear: ["runningShoes"],
        walkers: ["casey", "ben"],
      },
    ],
    [
      // archie is a known dog that this player has not bought.
      "without unknown or unowned loadout picks",
      (document) => {
        document.lastLoadout = { dogs: ["ghost", "penny", "archie"], gear: "luckyCollar" };
      },
      (save) => save.lastLoadout,
      { dogs: ["penny"], gear: null },
    ],
    [
      "with the loadout trimmed to the clamped slots",
      (document) => {
        document.owned.dogSlots = 0;
        document.lastLoadout.dogs = ["penny", "koda"];
      },
      (save) => save.lastLoadout.dogs,
      ["penny"],
    ],
    [
      "with an empty loadout keeping owned gear when no loadout dog is left",
      (document) => {
        document.lastLoadout = { dogs: ["ghost"], gear: "runningShoes" };
      },
      (save) => save.lastLoadout,
      { dogs: [], gear: "runningShoes" },
    ],
    [
      "with an unknown walker swapped for the default",
      (document) => {
        document.walker = "retiredWalker";
      },
      (save) => save.walker,
      "casey",
    ],
    [
      "with a walker not unlocked swapped for the default",
      (document) => {
        document.owned.walkers = ["casey", "ben"];
        document.walker = "trista";
      },
      (save) => save.walker,
      "casey",
    ],
    [
      "keeping an unset walker unset",
      (document) => {
        document.walker = null;
      },
      (save) => save.walker,
      null,
    ],
    [
      "without stats for unknown dogs, keeping the total firings",
      (document) => {
        document.stats.dogs.ghost = { timesFired: 2, walks: 3, zonesFinished: 4 };
        document.stats.timesFired = 3;
      },
      (save) => [Object.keys(save.stats.dogs).sort(), save.stats.timesFired],
      [["biscuit", "koda"], 3],
    ],
    [
      "without unknown dogs in the logbook's walks, keeping the walks",
      (document) => {
        present(document.stats.bestWalk).dogs = ["ghost", "koda"];
        present(document.stats.lastWalk).dogs = ["ghost"];
      },
      (save) => [save.stats.bestWalk?.dogs, save.stats.lastWalk],
      [["koda"], { ...veteranSave().stats.lastWalk, dogs: [] }],
    ],
    [
      "without unknown dogs in the last walk's firings",
      (document) => {
        present(document.stats.lastWalk).firings = [
          { dog: "ghost", zone: 1 },
          { dog: "koda", zone: 2 },
        ];
      },
      (save) => save.stats.lastWalk?.firings,
      [{ dog: "koda", zone: 2 }],
    ],
    [
      "without unknown dogs in a checkpoint, keeping its earnings",
      (document) => {
        document.checkpoint = {
          dogs: [
            { fired: true, id: "ghost", zonesFinished: 1 },
            { fired: false, id: "koda", zonesFinished: 2 },
          ],
          earnedCents: 900,
          zonesFinished: 2,
        };
      },
      (save) => save.checkpoint,
      {
        counters: null,
        dogs: [{ fired: false, id: "koda", zonesFinished: 2 }],
        earnedCents: 900,
        route: PRE_FORK_ROUTE,
        zonesFinished: 2,
      },
    ],
    [
      "without unknown, removed (pause) or duplicate hints shown",
      (document) => {
        document.shownHints = ["tip", "retiredHint", "pause", "tip", "puddle"];
      },
      (save) => save.shownHints,
      ["tip", "puddle"],
    ],
  ])("loads %s", (_, change, read, expected) => {
    const { save, status } = loadSave(testContext, withChanges(change));
    expect(status).toBe("loaded");
    expect(read(save)).toEqual(expected);
  });

  describe("a save it cannot use", () => {
    const corruptCases: [string, string][] = [
      ["text that is not JSON", "{not json"],
      [
        "a missing field",
        withChanges((document) => {
          delete untyped(document).owned;
        }),
      ],
      [
        "a field of the wrong type",
        withChanges((document) => {
          untyped(document).bankCents = "12345";
        }),
      ],
      [
        "negative cents in the bank",
        withChanges((document) => {
          document.bankCents = -1;
        }),
      ],
      [
        "fractional cents in the bank",
        withChanges((document) => {
          document.bankCents = 10.5;
        }),
      ],
      [
        "negative lifetime earnings",
        withChanges((document) => {
          document.stats.lifetimeCents = -100;
        }),
      ],
      [
        "fractional checkpoint earnings",
        withChanges((document) => {
          document.checkpoint = { dogs: [], earnedCents: 2.5, zonesFinished: 1 };
        }),
      ],
      [
        "a checkpoint before any zone finished",
        withChanges((document) => {
          document.checkpoint = { dogs: [], earnedCents: 0, zonesFinished: 0 };
        }),
      ],
      [
        "a fractional stat count",
        withChanges((document) => {
          defined(document.stats.dogs.koda).walks = 1.5;
        }),
      ],
      [
        "a last walk with an unknown outcome",
        withChanges((document) => {
          (present(document.stats.lastWalk) as Record<string, unknown>).outcome = "abducted";
        }),
      ],
      [
        "a loadout of four dogs",
        withChanges((document) => {
          document.lastLoadout.dogs = ["koda", "biscuit", "duchess", "penny"];
        }),
      ],
      [
        "fractional dog slots",
        withChanges((document) => {
          document.owned.dogSlots = 1.5;
        }),
      ],
      [
        "a volume that is not a number",
        withChanges((document) => {
          (document.settings as Record<string, unknown>).musicVolume = "loud";
        }),
      ],
      [
        "reduced motion that is not a boolean",
        withChanges((document) => {
          (document.settings as Record<string, unknown>).reducedMotion = "yes";
        }),
      ],
      [
        "a version with no migration",
        withChanges((document) => {
          untyped(document).version = 0;
        }),
      ],
    ];

    it.each(corruptCases)("returns a default save and the raw text for %s", (_, raw) => {
      expect(loadSave(testContext, raw)).toEqual({
        raw,
        reason: expect.any(String),
        save: newPlayerSave,
        status: "corrupt",
      });
    });

    it("says why a later version was rejected", () => {
      const raw = withChanges((document) => {
        untyped(document).version = SAVE_VERSION + 1;
      });
      const result = loadSave(testContext, raw);
      expect(result.status === "corrupt" && result.reason).toMatch(/newer than this game/);
    });
  });

  describe("settings", () => {
    it.each([
      [-0.5, 0],
      [0, 0],
      [0.4, 0.4],
      [1, 1],
      [3, 1],
    ])("clamps a stored volume of %d to %d", (volume, clamped) => {
      const save = loaded((document) => {
        document.settings.musicVolume = volume;
        document.settings.sfxVolume = volume;
      });
      expect([save.settings.musicVolume, save.settings.sfxVolume]).toEqual([clamped, clamped]);
    });
  });

  describe("dog slots", () => {
    it.each([
      [-2, 1],
      [0, 1],
      [4, 3],
      [3, 3],
    ])("clamps %i dog slots to %i", (storedSlots, clamped) => {
      const save = loaded((document) => {
        document.owned.dogSlots = storedSlots;
      });
      expect(save.owned.dogSlots).toBe(clamped);
    });
  });
});

describe("saveContextFrom", () => {
  const context = saveContextFrom(gameData);

  it("knows every achievement, debuff, dog, gear item, hint and walker in the game data", () => {
    expect([...context.known.achievements]).toEqual(gameData.achievements.map(({ id }) => id));
    expect([...context.known.debuffs]).toEqual(Object.keys(gameData.debuffs));
    expect([...context.known.dogs]).toEqual(Object.keys(gameData.dogs));
    expect([...context.known.gear]).toEqual(Object.keys(gameData.shopGear));
    expect([...context.known.hints]).toEqual(Object.keys(gameData.hints));
    expect([...context.known.walkers]).toEqual(Object.keys(gameData.walkers));
    expect([...context.known.zones]).toEqual(gameData.world.zones.map(({ id }) => id));
  });

  it("starts a new player with one dog slot, the starter dogs and walkers, and the default walker", () => {
    expect(context.defaults).toEqual({
      dogSlots: 1,
      freeDogs: STARTER_DOGS,
      freeWalkers: ["casey"],
      walker: gameData.defaultWalker,
    });
  });

  it("refuses game data with no starter dog", () => {
    const dogs = Object.fromEntries(
      Object.entries(gameData.dogs).map(([id, dog]) => [id, { ...dog, unlock: "shop" as const }]),
    ) as typeof gameData.dogs;
    expect(() => saveContextFrom({ ...gameData, dogs })).toThrow("needs a starter dog");
  });

  it("refuses game data whose default walker does not walk from the start", () => {
    const walkers = { ...gameData.walkers, casey: { ...gameData.walkers.ben, name: "Casey" } };
    expect(() => saveContextFrom({ ...gameData, walkers })).toThrow("default walker");
  });
});
