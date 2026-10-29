import { loadSave } from "@andornaut/game-kit/save/versionedSave";
import * as v from "valibot";
import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { DogId } from "../data/types";
import { defined, present } from "../testing/defined";
import {
  newPlayerSave,
  quietCounters,
  STARTER_DOGS,
  testContext,
  veteranSave,
} from "../testing/saves";
import { saveContextFrom, saveFormat } from "./load";
import { createDefaultSave, SAVE_VERSION, type SaveDocument, saveSchema } from "./schema";

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
  loadSave(saveFormat(testContext), withChanges(change)).save;

// A stored checkpoint two zones in, with each given field in place of its own.
const checkpointWith = (
  fields: Partial<NonNullable<StoredInput["checkpoint"]>>,
): StoredInput["checkpoint"] => ({
  counters: quietCounters(),
  dogs: [{ firedInZone: null, id: "kilo" }],
  earnedCents: 4_250,
  route: ["distilleryDistrict", "highPark"],
  zonesFinished: 2,
  ...fields,
});

describe("loadSave", () => {
  it("gives a new player the free dogs, the default walker and the starter dog picked", () => {
    expect(loadSave(saveFormat(testContext), null)).toEqual({ save: newPlayerSave, status: "new" });
  });

  it("picks a new save's free dogs, as many as its slots walk", () => {
    const picked = (dogSlots: number[]) =>
      createDefaultSave({ ...testContext.defaults, dogSlots, freeDogs: ["lady", "kilo"] })
        .lastLoadout.dogs;
    expect([picked([1]), picked([1, 3])]).toEqual([["lady"], ["lady", "kilo"]]);
  });

  it("keeps every dog a save owns, adding the starters", () => {
    const dogs: DogId[] = ["ginger", "kilo", "penny"];
    const save = loaded((document) => {
      document.owned.dogs = dogs;
    });
    expect(new Set(save.owned.dogs)).toEqual(new Set([...STARTER_DOGS, ...dogs]));
  });

  // Each row stores the veteran save under the current version plus offset.
  const byVersion: [string, number, (raw: string) => unknown][] = [
    [
      "an older save as corrupt, with a default save",
      -1,
      (raw) => ({
        raw,
        reason: expect.stringMatching(/older than this game/),
        save: newPlayerSave,
        status: "corrupt",
      }),
    ],
    ["a current save unchanged", 0, () => ({ save: veteranSave(), status: "loaded" })],
    [
      "a newer save as newer, with a default save and no backup",
      1,
      () => ({
        reason: expect.stringMatching(/newer than this game/),
        save: newPlayerSave,
        status: "newer",
      }),
    ],
  ];

  it.each(byVersion)("loads %s", (_name, offset, expected) => {
    const raw = withChanges((document) => {
      untyped(document).version = SAVE_VERSION + offset;
    });
    expect(loadSave(saveFormat(testContext), raw)).toEqual(expected(raw));
  });

  // Each row changes the stored veteran save, then reads part of what loads.
  const repairs: [
    string,
    (document: StoredInput) => void,
    (save: SaveDocument) => unknown,
    unknown,
  ][] = [
    [
      "a checkpoint in the first zone, before any zone finished",
      (document) => {
        document.checkpoint = checkpointWith({ dogs: [], earnedCents: 0, zonesFinished: 0 });
      },
      (save) => save.checkpoint?.zonesFinished,
      0,
    ],
    [
      "a checkpoint's route, dropping zones the game no longer has",
      (document) => {
        document.checkpoint = checkpointWith({
          route: ["distilleryDistrict", "oldZone", "theBeaches"],
        });
      },
      (save) => save.checkpoint?.route,
      ["distilleryDistrict", "theBeaches"],
    ],
    [
      "an empty loadout, as a stored save keeps it",
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
      "without achievements, finished-with dogs and finished zones the game no longer has",
      (document) => {
        document.achievements = ["retiredBadge", "wholeCity"];
        document.stats.dogsFinishedWith = ["kilo", "ghost"];
        document.stats.zonesEverFinished = ["highPark", "atlantis"];
      },
      (save) => [save.achievements, save.stats.dogsFinishedWith, save.stats.zonesEverFinished],
      [["wholeCity"], ["kilo"], ["highPark"]],
    ],
    [
      "without unknown or duplicate owned ids",
      (document) => {
        document.owned = {
          dogSlots: [3, 9, 3, 0],
          dogs: ["kilo", "ghost", "penny", "kilo"],
          gear: ["runningShoes", "jetpack", "runningShoes"],
          walkers: ["mrB", "ghost", "mrB"],
        };
      },
      (save) => save.owned,
      {
        dogSlots: [1, 3],
        dogs: [...STARTER_DOGS, "kilo", "penny"],
        gear: ["runningShoes"],
        walkers: ["casey", "mrB"],
      },
    ],
    [
      // pepe is a known dog that this player has not bought.
      "without unknown or unowned loadout picks",
      (document) => {
        document.lastLoadout = { dogs: ["ghost", "penny", "pepe"], gear: "luckyCollar" };
      },
      (save) => save.lastLoadout,
      { dogs: ["penny"], gear: null },
    ],
    [
      "with the loadout trimmed to the slots owned, the starting ones always among them",
      (document) => {
        document.owned.dogSlots = [];
        document.lastLoadout.dogs = ["penny", "kilo"];
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
        document.owned.walkers = ["casey", "mrB"];
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
      "without stats for unknown dogs",
      (document) => {
        document.stats.dogs.ghost = { timesFired: 2, walks: 3, zonesFinished: 4 };
      },
      (save) => Object.keys(save.stats.dogs).sort(),
      ["kilo", "lady"],
    ],
    [
      "without bumps by unknown obstacles",
      (document) => {
        document.stats.bumpsByKind = { pigeons: 3, retiredObstacle: 2 };
      },
      (save) => save.stats.bumpsByKind,
      { pigeons: 3 },
    ],
    [
      "without unknown or duplicate walkers who finished a walk",
      (document) => {
        document.stats.walkersFinishedWith = ["casey", "retiredWalker", "casey", "mrB"];
      },
      (save) => save.stats.walkersFinishedWith,
      ["casey", "mrB"],
    ],
    [
      "without unknown dogs in the logbook's walks, keeping the walks",
      (document) => {
        present(document.stats.bestWalk).dogs = ["ghost", "kilo"];
        present(document.stats.lastWalk).dogs = ["ghost"];
      },
      (save) => [save.stats.bestWalk?.dogs, save.stats.lastWalk],
      [["kilo"], { ...veteranSave().stats.lastWalk, dogs: [] }],
    ],
    [
      "without unknown dogs in the last walk's firings",
      (document) => {
        present(document.stats.lastWalk).firings = ["ghost", "kilo"];
      },
      (save) => save.stats.lastWalk?.firings,
      ["kilo"],
    ],
    [
      "without unknown dogs in a checkpoint, keeping its earnings",
      (document) => {
        document.checkpoint = checkpointWith({
          dogs: [
            { firedInZone: 2, id: "ghost" },
            { firedInZone: null, id: "kilo" },
          ],
        });
      },
      (save) => save.checkpoint,
      checkpointWith({}),
    ],
    [
      "a checkpoint's counters, without bump kinds, debuffs, picks and tallies the game no longer has",
      (document) => {
        document.checkpoint = checkpointWith({
          counters: {
            bumpsByKind: { pigeons: 2, retiredObstacle: 1 },
            bumpsByZone: [2, 1],
            debuffsGot: { retiredDebuff: 1, stinky: 2 },
            firstZone: 1,
            optionPicks: {
              escapedCapybara: { help: 1, retiredOption: 2 },
              retiredCard: { help: 3 },
            },
            startCents: 1_500,
            tallies: { retiredTally: 4, squirrelPulls: 3 },
          },
        });
      },
      (save) => save.checkpoint?.counters,
      {
        bumpsByKind: { pigeons: 2 },
        bumpsByZone: [2, 1],
        debuffsGot: { stinky: 2 },
        firstZone: 1,
        optionPicks: { escapedCapybara: { help: 1 } },
        startCents: 1_500,
        tallies: { squirrelPulls: 3 },
      },
    ],
    [
      "without picks of options or cards the game no longer has",
      (document) => {
        document.stats.optionPicks = {
          escapedCapybara: { callZoo: 4, help: 2, retiredOption: 1 },
          retiredCard: { help: 5 },
        };
      },
      (save) => save.stats.optionPicks,
      { escapedCapybara: { callZoo: 4, help: 2 } },
    ],
    [
      "without unknown, removed (pause) or duplicate hints shown",
      (document) => {
        document.shownHints = ["tip", "retiredHint", "pause", "tip", "puddle"];
      },
      (save) => save.shownHints,
      ["tip", "puddle"],
    ],
  ];

  it("loads a save, dropping what the game no longer has and repairing what it can", () => {
    for (const [name, change, read, expected] of repairs) {
      const { save, status } = loadSave(saveFormat(testContext), withChanges(change));
      expect(status, name).toBe("loaded");
      expect(read(save), name).toEqual(expected);
    }
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
        "negative lifetime starting cash",
        withChanges((document) => {
          document.stats.lifetimeStartCents = -100;
        }),
      ],
      [
        "fractional checkpoint earnings",
        withChanges((document) => {
          document.checkpoint = checkpointWith({ earnedCents: 2.5 });
        }),
      ],
      [
        "a fractional stat count",
        withChanges((document) => {
          defined(document.stats.dogs.kilo).walks = 1.5;
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
          document.lastLoadout.dogs = ["kilo", "lady", "ginger", "penny"];
        }),
      ],
      [
        "a fractional dog slot",
        withChanges((document) => {
          document.owned.dogSlots = [1, 1.5];
        }),
      ],
      [
        "dog slots as a count",
        withChanges((document) => {
          (document.owned as Record<string, unknown>).dogSlots = 2;
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
    ];

    it("returns a default save and the raw text for each", () => {
      for (const [name, raw] of corruptCases) {
        expect(loadSave(saveFormat(testContext), raw), name).toEqual({
          raw,
          reason: expect.any(String),
          save: newPlayerSave,
          status: "corrupt",
        });
      }
    });
  });

  it("clamps stored volumes into range, keeps known dog slots in order, and drops bests for no pack size", () => {
    const save = loaded((document) => {
      document.settings.musicVolume = -0.5;
      document.settings.sfxVolume = 3;
      document.owned.dogSlots = [3, 2, 4, 1];
      document.stats.bestCentsByPackSize = { 0: 1, 2: 200, 4: 400, two: 2 };
    });
    expect([save.settings.musicVolume, save.settings.sfxVolume]).toEqual([0, 1]);
    expect(save.owned.dogSlots).toEqual([1, 2, 3]);
    expect(save.stats.bestCentsByPackSize).toEqual({ 2: 200 });
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

  // A retired obstacle's bumps load dropped; a skin is no obstacle id, so none move to the street
  // cart.
  it.each(["hotDogCart", "picnicBlanket"])("loads a save with bumps by %s, dropping them", (id) => {
    const { save, status } = loadSave(
      saveFormat(context),
      withChanges((document) => {
        document.stats.bumpsByKind = { [id]: 2, pigeons: 3 };
      }),
    );
    expect(status).toBe("loaded");
    expect(save.stats.bumpsByKind).toEqual({ pigeons: 3 });
  });

  it("refuses game data with no starter dog, or a default walker locked at the start", () => {
    const dogs = Object.fromEntries(
      Object.entries(gameData.dogs).map(([id, dog]) => [id, { ...dog, unlock: "shop" as const }]),
    ) as typeof gameData.dogs;
    expect(() => saveContextFrom({ ...gameData, dogs })).toThrow("needs a starter dog");
    const walkers = { ...gameData.walkers, casey: { ...gameData.walkers.mrB, name: "Casey" } };
    expect(() => saveContextFrom({ ...gameData, walkers })).toThrow("default walker");
  });
});
