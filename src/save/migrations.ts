// Upgrades a save document from version `from` to `from + 1`. The runner sets the new
// version, so a migration only reshapes the fields that changed.
export interface Migration {
  from: number;
  migrate(document: Record<string, unknown>): Record<string, unknown>;
}

export type MigrationResult =
  { document: Record<string, unknown>; ok: true } | { ok: false; reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type FieldChange = readonly [key: string, change: (field: unknown) => unknown];

// value with each named field replaced by its change, in order. A missing field, or a value
// that is not an object, is left as it is for the schema to judge.
function updateFields<T>(changes: readonly FieldChange[], value: T): Record<string, unknown> | T {
  return changes.reduce<Record<string, unknown> | T>(
    (current, [key, change]) =>
      isRecord(current) && key in current ? { ...current, [key]: change(current[key]) } : current,
    value,
  );
}

// Every place a version 1 save holds a dog id, with each renamed id replaced.
function renameDogIds(
  renames: ReadonlyMap<string, string>,
  document: Record<string, unknown>,
): Record<string, unknown> {
  const id = (value: unknown) =>
    typeof value === "string" ? (renames.get(value) ?? value) : value;
  const ids = (value: unknown) => (Array.isArray(value) ? value.map(id) : value);
  const keys = (value: unknown) =>
    isRecord(value)
      ? Object.fromEntries(Object.entries(value).map(([key, entry]) => [id(key), entry]))
      : value;
  const each = (changes: readonly FieldChange[]) => (value: unknown) =>
    Array.isArray(value) ? value.map((entry) => updateFields(changes, entry)) : value;
  const walk = (value: unknown) => updateFields([["dogs", ids]], value);
  return updateFields(
    [
      ["checkpoint", (checkpoint) => updateFields([["dogs", each([["id", id]])]], checkpoint)],
      ["lastLoadout", (loadout) => updateFields([["dogs", ids]], loadout)],
      ["owned", (owned) => updateFields([["dogs", ids]], owned)],
      [
        "stats",
        (stats) =>
          updateFields(
            [
              ["bestWalk", walk],
              ["dogs", keys],
              ["dogsFinishedWith", ids],
              ["lastWalk", (last) => updateFields([["firings", each([["dog", id]])]], walk(last))],
            ],
            stats,
          ),
      ],
    ],
    document,
  );
}

// The zones one walk had to finish to unlock each walker when version 3 added unlocks, the
// starting walker first, as a load lists the walkers owned.
const VERSION_3_WALKER_GOALS: readonly (readonly [walker: string, zones: number])[] = [
  ["casey", 0],
  ["ada", 2],
  ["ben", 1],
  ["trista", 3],
];

// Version 2 let every walker walk: a version 3 save owns the walker in use, and each walker
// whose goal the best zones finished already met.
function unlockWalkers(document: Record<string, unknown>): Record<string, unknown> {
  const { stats, walker } = document;
  const best = isRecord(stats) ? stats.bestZoneFinished : undefined;
  const walkers = VERSION_3_WALKER_GOALS.flatMap(([id, zones]) =>
    id === walker || (typeof best === "number" && zones <= best) ? [id] : [],
  );
  return updateFields(
    [["owned", (owned) => (isRecord(owned) ? { ...owned, walkers } : owned)]],
    document,
  );
}

// A count kept under its own key in version 3 moves into tallies under its new name, and a
// count already in tallies stays.
function moveIntoTallies(from: string, tally: string, record: unknown): unknown {
  if (!isRecord(record) || !(from in record)) {
    return record;
  }
  const { [from]: moved, ...rest } = record;
  const tallies = isRecord(rest.tallies) ? rest.tallies : {};
  return { ...rest, tallies: { [tally]: moved, ...tallies } };
}

// Version 3 counted squirrel chases on their own; version 4 keeps them in the tallies as
// squirrelPulls, both the lifetime count and a checkpoint's run count.
function tallySquirrelPulls(document: Record<string, unknown>): Record<string, unknown> {
  return updateFields(
    [
      [
        "checkpoint",
        (checkpoint) =>
          updateFields(
            [
              [
                "counters",
                (counters) => moveIntoTallies("squirrelChases", "squirrelPulls", counters),
              ],
            ],
            checkpoint,
          ),
      ],
      ["stats", (stats) => moveIntoTallies("squirrelsChased", "squirrelPulls", stats)],
    ],
    document,
  );
}

// One entry per version step, in order. A renamed dog or gear id needs one. Each step keeps
// its own copy of what it renames, so a later rename adds a step rather than editing this one.
export const saveMigrations: readonly Migration[] = [
  {
    from: 1,
    migrate: (document) =>
      renameDogIds(
        new Map([
          ["dash", "archie"],
          ["waffles", "penny"],
        ]),
        document,
      ),
  },
  { from: 2, migrate: unlockWalkers },
  { from: 3, migrate: tallySquirrelPulls },
];

// Runs each migration from the document's version up to targetVersion, in order. A
// document from a later version than targetVersion is rejected rather than downgraded.
export function migrateSave(
  migrations: readonly Migration[],
  targetVersion: number,
  document: unknown,
): MigrationResult {
  if (!isRecord(document)) {
    return { ok: false, reason: "the save is not an object" };
  }
  const { version } = document;
  if (typeof version !== "number" || !Number.isSafeInteger(version)) {
    return { ok: false, reason: "the save has no integer version" };
  }
  if (version > targetVersion) {
    return { ok: false, reason: `the save is from version ${version}, newer than this game` };
  }
  let current = document;
  for (let from = version; from < targetVersion; from++) {
    const step = migrations.find((migration) => migration.from === from);
    if (step == null) {
      return { ok: false, reason: `no migration from version ${from}` };
    }
    current = { ...step.migrate(current), version: from + 1 };
  }
  return { document: current, ok: true };
}
