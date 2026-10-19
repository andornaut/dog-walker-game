// Upgrades a save document from version `from` to `from + 1`. The runner sets the new
// version, so a migration only reshapes the fields that changed.
export interface Migration {
  from: number;
  migrate(document: Record<string, unknown>): Record<string, unknown>;
}

export type MigrationResult =
  { document: Record<string, unknown>; ok: true } | { ok: false; reason: string };

// One entry per version step, in order. A renamed dog or gear id needs one.
export const saveMigrations: readonly Migration[] = [];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

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
