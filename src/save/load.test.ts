import * as v from "valibot";
import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { defined, present } from "../testing/defined";
import { newPlayerSave, testContext, veteranSave } from "./fixtures";
import { loadSave, saveContextFrom } from "./load";
import { type SaveDocument, saveSchema } from "./schema";

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

describe("loadSave", () => {
  it("gives a new player the free dogs, the default walker and no loadout", () => {
    expect(loadSave(testContext, null)).toEqual({ save: newPlayerSave, status: "new" });
  });

  it("loads a valid save unchanged", () => {
    expect(loadSave(testContext, stored(veteranSave()))).toEqual({
      save: veteranSave(),
      status: "loaded",
    });
  });

  it("loads a pending checkpoint", () => {
    const checkpoint = {
      dogs: [{ fired: false, id: "koda", zonesFinished: 2 }],
      earnedCents: 4_250,
      zonesFinished: 2,
    };
    const save = loaded((document) => {
      document.checkpoint = checkpoint;
    });
    expect(save.checkpoint).toEqual(checkpoint);
  });

  it("strips fields the schema does not know", () => {
    const save = loaded((document) => {
      untyped(document).extra = true;
      untyped(document).settings = { ...document.settings, language: "fr" };
    });
    expect(save).toEqual(veteranSave());
  });

  it("loads an empty loadout, as a new player has before picking a dog", () => {
    const save = loaded((document) => {
      document.lastLoadout = { dogs: [], gear: null };
    });
    expect(save.lastLoadout).toEqual({ dogs: [], gear: null });
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
          document.lastLoadout.dogs = ["koda", "biscuit", "duchess", "waffles"];
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
        untyped(document).version = 2;
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

    it("keeps reduced motion as stored", () => {
      expect(loaded(() => {}).settings.reducedMotion).toBe(true);
    });
  });

  describe("unknown ids", () => {
    it("drops them from everything owned, and removes duplicates", () => {
      const save = loaded((document) => {
        document.owned = {
          dogSlots: 2,
          dogs: ["koda", "ghost", "waffles", "koda"],
          gear: ["whistle", "jetpack", "whistle"],
        };
      });
      expect(save.owned).toEqual({
        dogSlots: 2,
        dogs: ["biscuit", "duchess", "koda", "waffles"],
        gear: ["whistle"],
      });
    });

    it("drops them from the loadout, along with picks the player does not own", () => {
      const save = loaded((document) => {
        // dash is a known dog that this player has not bought.
        document.lastLoadout = { dogs: ["ghost", "waffles", "dash"], gear: "luckyCollar" };
      });
      expect(save.lastLoadout).toEqual({ dogs: ["waffles"], gear: null });
    });

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

    it("trims the loadout to the clamped slots", () => {
      const save = loaded((document) => {
        document.owned.dogSlots = 0;
        document.lastLoadout.dogs = ["waffles", "koda"];
      });
      expect(save.lastLoadout.dogs).toEqual(["waffles"]);
    });

    it("leaves the loadout empty, keeping owned gear, when no loadout dog is left", () => {
      const save = loaded((document) => {
        document.lastLoadout = { dogs: ["ghost"], gear: "whistle" };
      });
      expect(save.lastLoadout).toEqual({ dogs: [], gear: "whistle" });
    });

    it("keeps a known walker and swaps an unknown one for the default", () => {
      expect(loaded(() => {}).walker).toBe("ada");
      const save = loaded((document) => {
        document.walker = "retiredWalker";
      });
      expect(save.walker).toBe("casey");
    });

    it("drops stats for unknown dogs and keeps the total firings", () => {
      const save = loaded((document) => {
        document.stats.dogs.ghost = { timesFired: 2, walks: 3, zonesFinished: 4 };
        document.stats.timesFired = 3;
      });
      expect(Object.keys(save.stats.dogs).sort()).toEqual(["biscuit", "koda"]);
      expect(save.stats.timesFired).toBe(3);
    });

    it("drops unknown dogs from the logbook's walks and keeps the walks", () => {
      const save = loaded((document) => {
        present(document.stats.bestWalk).dogs = ["ghost", "koda"];
        present(document.stats.lastWalk).dogs = ["ghost"];
      });
      expect(save.stats.bestWalk?.dogs).toEqual(["koda"]);
      expect(save.stats.lastWalk).toEqual({ ...veteranSave().stats.lastWalk, dogs: [] });
    });

    it("loads a save from before the mute setting as unmuted", () => {
      const save = loaded((document) => {
        delete (document.settings as Partial<typeof document.settings>).muted;
      });
      expect(save.settings.muted).toBe(false);
    });

    it("drops unknown dogs from the last walk's firings", () => {
      const save = loaded((document) => {
        present(document.stats.lastWalk).firings = [
          { dog: "ghost", zone: 1 },
          { dog: "koda", zone: 2 },
        ];
      });
      expect(save.stats.lastWalk?.firings).toEqual([{ dog: "koda", zone: 2 }]);
    });

    it("drops them from a checkpoint and keeps its earnings", () => {
      const save = loaded((document) => {
        document.checkpoint = {
          dogs: [
            { fired: true, id: "ghost", zonesFinished: 1 },
            { fired: false, id: "koda", zonesFinished: 2 },
          ],
          earnedCents: 900,
          zonesFinished: 2,
        };
      });
      expect(save.checkpoint).toEqual({
        dogs: [{ fired: false, id: "koda", zonesFinished: 2 }],
        earnedCents: 900,
        zonesFinished: 2,
      });
    });

    it("drops unknown hints from those shown, and duplicates", () => {
      const save = loaded((document) => {
        document.shownHints = ["tip", "retiredHint", "tip", "puddle"];
      });
      expect(save.shownHints).toEqual(["tip", "puddle"]);
    });
  });
});

describe("saveContextFrom", () => {
  const context = saveContextFrom(gameData);

  it("knows every dog, gear item, hint and walker in the game data", () => {
    expect([...context.known.dogs]).toEqual(Object.keys(gameData.dogs));
    expect([...context.known.gear]).toEqual(Object.keys(gameData.shopGear));
    expect([...context.known.hints]).toEqual(Object.keys(gameData.hints));
    expect([...context.known.walkers]).toEqual(Object.keys(gameData.walkers));
  });

  it("starts a new player with one dog slot, the starter dogs and the default walker", () => {
    expect(context.defaults).toEqual({
      dogSlots: 1,
      freeDogs: ["biscuit", "duchess", "koda"],
      walker: gameData.defaultWalker,
    });
  });

  it("refuses game data with no starter dog", () => {
    const dogs = Object.fromEntries(
      Object.entries(gameData.dogs).map(([id, dog]) => [
        id,
        { ...dog, price: "lockedDog" as const, unlock: "shop" as const },
      ]),
    ) as typeof gameData.dogs;
    expect(() => saveContextFrom({ ...gameData, dogs })).toThrow("needs a starter dog");
  });
});
