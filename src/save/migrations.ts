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
