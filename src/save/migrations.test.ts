import * as v from "valibot";
import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { veteranSave } from "./fixtures";
import { loadSave, saveContextFrom } from "./load";
import { migrateSave, type Migration, saveMigrations } from "./migrations";
import { SAVE_VERSION, saveSchema } from "./schema";

// A made-up version 0 that kept the bank in dollars and listed the help topics seen.
function versionZeroSave(): Record<string, unknown> {
  const { bankCents, helpSeen, ...rest } = veteranSave();
  return {
    ...rest,
    bank: bankCents / 100,
    helpTopicsSeen: helpSeen ? ["lanes"] : [],
    version: 0,
  };
}

const versionZeroToOne: Migration = {
  from: 0,
  migrate: ({ bank, helpTopicsSeen, ...rest }) => ({
    ...rest,
    bankCents: Math.round(Number(bank) * 100),
    helpSeen: (helpTopicsSeen as unknown[]).length > 0,
  }),
};

// Each step records that it ran, so the order shows in the result.
const recordingStep = (from: number): Migration => ({
  from,
  migrate: (document) => ({ ...document, steps: [...(document.steps as number[]), from] }),
});

describe("migrateSave", () => {
  it("upgrades a version 0 fixture to a document the current schema accepts", () => {
    const result = migrateSave(
      [versionZeroToOne, ...saveMigrations],
      SAVE_VERSION,
      versionZeroSave(),
    );
    const parsed = v.safeParse(saveSchema, result.ok ? result.document : null);
    expect(parsed.success).toBe(true);
    expect(parsed.output).toEqual(veteranSave());
  });

  it.each<[string, Migration[], number, Record<string, unknown>, ReturnType<typeof migrateSave>]>([
    [
      "runs every step in version order, whatever order the registry lists them in",
      [recordingStep(2), recordingStep(0), recordingStep(1)],
      3,
      { steps: [], version: 0 },
      { document: { steps: [0, 1, 2], version: 3 }, ok: true },
    ],
    [
      "starts from the document's own version",
      [recordingStep(0), recordingStep(1), recordingStep(2)],
      3,
      { steps: [], version: 2 },
      { document: { steps: [2], version: 3 }, ok: true },
    ],
    [
      "leaves a document at the target version as it is",
      [recordingStep(0)],
      1,
      { steps: [], version: 1 },
      { document: { steps: [], version: 1 }, ok: true },
    ],
    [
      "rejects a document when a step is missing",
      [recordingStep(0), recordingStep(2)],
      3,
      { steps: [], version: 0 },
      { ok: false, reason: "no migration from version 1" },
    ],
  ])("%s", (_, registry, target, document, expected) => {
    expect(migrateSave(registry, target, document)).toEqual(expected);
  });

  it("rejects a document from a later version without running any step", () => {
    const ran: number[] = [];
    const spy: Migration = {
      from: 1,
      migrate: (document) => {
        ran.push(1);
        return document;
      },
    };
    const result = migrateSave([spy], 1, { version: 2 });
    expect(result).toEqual({ ok: false, reason: expect.stringMatching(/version 2, newer/) });
    expect(ran).toEqual([]);
  });

  it.each([
    ["null", null, "the save is not an object"],
    ["an array", [1], "the save is not an object"],
    ["a string", "save", "the save is not an object"],
    ["no version", { bankCents: 0 }, "the save has no integer version"],
    ["a string version", { version: "1" }, "the save has no integer version"],
    ["a fractional version", { version: 0.5 }, "the save has no integer version"],
  ])("rejects %s", (_, document, reason) => {
    expect(migrateSave([recordingStep(0)], 1, document)).toEqual({ ok: false, reason });
  });
});

describe("saveMigrations", () => {
  const fromVersion3 = (document: Record<string, unknown>) =>
    migrateSave(saveMigrations, 4, { ...document, version: 3 });

  it.each<[string, Record<string, unknown>, Record<string, unknown>]>([
    [
      "moves the lifetime squirrel chases into the tallies",
      { stats: { squirrelsChased: 4, timesFired: 1 } },
      { stats: { tallies: { squirrelPulls: 4 }, timesFired: 1 } },
    ],
    [
      "moves a checkpoint's run squirrel chases into its tallies",
      { checkpoint: { counters: { bumpsByZone: [1], squirrelChases: 2 } } },
      { checkpoint: { counters: { bumpsByZone: [1], tallies: { squirrelPulls: 2 } } } },
    ],
    [
      "keeps a checkpoint with no counters",
      { checkpoint: { counters: null } },
      { checkpoint: { counters: null } },
    ],
    ["keeps a save with no checkpoint", { checkpoint: null }, { checkpoint: null }],
  ])("from version 3 %s", (_, document, expected) => {
    expect(fromVersion3(document)).toEqual({ document: { ...expected, version: 4 }, ok: true });
  });

  it("loads a version 3 veteran with its squirrel chases as squirrel pulls", () => {
    const { stats, ...rest } = veteranSave();
    const { tallies, ...older } = stats;
    const stored = {
      ...rest,
      stats: { ...older, squirrelsChased: tallies.squirrelPulls },
      version: 3,
    };
    const result = migrateSave(saveMigrations, SAVE_VERSION, stored);
    const parsed = v.safeParse(saveSchema, result.ok ? result.document : null);
    expect(parsed.output).toEqual(veteranSave());
  });

  it("has one step per version, ending at the current version", () => {
    const froms = saveMigrations.map((migration) => migration.from);
    const expected = froms.map((_, index) => SAVE_VERSION - froms.length + index);
    expect(froms).toEqual(expected);
  });
});

// A save holding first and second in every field that holds a dog id.
function saveWithDogs(first: string, second: string, version: number): Record<string, unknown> {
  const save = veteranSave();
  return {
    ...save,
    checkpoint: {
      counters: null,
      dogs: [
        { fired: false, id: first, zonesFinished: 2 },
        { fired: true, id: second, zonesFinished: 1 },
      ],
      earnedCents: 4_000,
      zonesFinished: 2,
    },
    lastLoadout: { dogs: [first, second], gear: "whistle" },
    owned: { ...save.owned, dogs: ["biscuit", first, "duchess", "koda", second] },
    stats: {
      ...save.stats,
      bestWalk: { dogs: [first, second], earnedCents: 9_000, zonesFinished: 4 },
      dogs: {
        ...save.stats.dogs,
        [first]: { timesFired: 1, walks: 3, zonesFinished: 7 },
        [second]: { timesFired: 0, walks: 2, zonesFinished: 8 },
      },
      dogsFinishedWith: ["biscuit", first, second],
      lastWalk: {
        dogs: [first, "koda", second],
        earnedCents: 2_500,
        firings: [
          { dog: first, zone: 2 },
          { dog: "koda", zone: 2 },
        ],
        outcome: "wentHome",
        zonesFinished: 2,
      },
    },
    version,
  };
}

describe("the version 1 to 2 migration", () => {
  it("renames dash to archie and waffles to penny in every field that holds a dog id", () => {
    expect(migrateSave(saveMigrations, 2, saveWithDogs("dash", "waffles", 1))).toEqual({
      document: saveWithDogs("archie", "penny", 2),
      ok: true,
    });
  });

  it("loads an old save with both dogs owned and their stats kept", () => {
    const result = loadSave(
      saveContextFrom(gameData),
      JSON.stringify(saveWithDogs("dash", "waffles", 1)),
    );
    expect(result.status).toBe("loaded");
    const { checkpoint, lastLoadout, owned, stats } = result.save;
    expect(owned.dogs).toEqual(expect.arrayContaining(["archie", "penny"]));
    expect(lastLoadout.dogs).toEqual(["archie", "penny"]);
    expect(checkpoint?.dogs.map(({ id }) => id)).toEqual(["archie", "penny"]);
    expect(stats.dogs.archie).toEqual({ timesFired: 1, walks: 3, zonesFinished: 7 });
    expect(stats.dogs.penny).toEqual({ timesFired: 0, walks: 2, zonesFinished: 8 });
    expect(stats.dogsFinishedWith).toEqual(["biscuit", "archie", "penny"]);
    expect(stats.bestWalk?.dogs).toEqual(["archie", "penny"]);
    expect(stats.lastWalk?.dogs).toEqual(["archie", "koda", "penny"]);
    expect(stats.lastWalk?.firings).toEqual([
      { dog: "archie", zone: 2 },
      { dog: "koda", zone: 2 },
    ]);
  });

  it("leaves a field of the wrong shape for the schema to reject", () => {
    const document = { owned: "dash", stats: { dogs: ["dash"], lastWalk: null }, version: 1 };
    expect(migrateSave(saveMigrations, 2, document)).toEqual({
      document: { ...document, version: 2 },
      ok: true,
    });
  });
});

// A version 2 save walking with walker, its best walk bestZoneFinished zones long.
function versionTwoSave(walker: string, bestZoneFinished: number): Record<string, unknown> {
  const { owned, stats, ...save } = veteranSave();
  const { dogSlots, dogs, gear } = owned;
  return {
    ...save,
    owned: { dogSlots, dogs, gear },
    stats: { ...stats, bestZoneFinished },
    version: 2,
    walker,
  };
}

describe("the version 2 to 3 migration", () => {
  it.each<[string, string, number, string[]]>([
    ["keeps the walker in use unlocked", "trista", 0, ["casey", "trista"]],
    ["unlocks the walkers the best walk already earned", "casey", 2, ["casey", "ada", "ben"]],
    ["lists each walker once", "ben", 1, ["casey", "ben"]],
  ])("%s", (_, walker, best, walkers) => {
    const result = loadSave(
      saveContextFrom(gameData),
      JSON.stringify(versionTwoSave(walker, best)),
    );
    expect(result.status).toBe("loaded");
    expect(result.save.owned.walkers).toEqual(walkers);
    expect(result.save.walker).toBe(walker);
  });

  it("leaves an owned field of the wrong shape for the schema to reject", () => {
    const document = { owned: "casey", version: 2, walker: "casey" };
    expect(migrateSave(saveMigrations, 3, document)).toEqual({
      document: { ...document, version: 3 },
      ok: true,
    });
  });
});
