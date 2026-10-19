import * as v from "valibot";
import { describe, expect, it } from "vitest";

import { veteranSave } from "./fixtures";
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
    const result = migrateSave([versionZeroToOne], 1, versionZeroSave());
    const parsed = v.safeParse(saveSchema, result.ok ? result.document : null);
    expect(parsed.success).toBe(true);
    expect(parsed.output).toEqual(veteranSave());
  });

  it("runs every step in version order, whatever order the registry lists them in", () => {
    const shuffled = [recordingStep(2), recordingStep(0), recordingStep(1)];
    expect(migrateSave(shuffled, 3, { steps: [], version: 0 })).toEqual({
      document: { steps: [0, 1, 2], version: 3 },
      ok: true,
    });
  });

  it("starts from the document's own version", () => {
    const registry = [recordingStep(0), recordingStep(1), recordingStep(2)];
    expect(migrateSave(registry, 3, { steps: [], version: 2 })).toEqual({
      document: { steps: [2], version: 3 },
      ok: true,
    });
  });

  it("leaves a document at the target version as it is", () => {
    expect(migrateSave([recordingStep(0)], 1, { steps: [], version: 1 })).toEqual({
      document: { steps: [], version: 1 },
      ok: true,
    });
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

  it("rejects a document when a step is missing", () => {
    expect(migrateSave([recordingStep(0), recordingStep(2)], 3, { steps: [], version: 0 })).toEqual(
      { ok: false, reason: "no migration from version 1" },
    );
  });

  it.each([
    ["null", null],
    ["an array", [1]],
    ["a string", "save"],
    ["no version", { bankCents: 0 }],
    ["a string version", { version: "1" }],
    ["a fractional version", { version: 0.5 }],
  ])("rejects %s", (_, document) => {
    expect(migrateSave([recordingStep(0)], 1, document).ok).toBe(false);
  });
});

describe("saveMigrations", () => {
  it("has one step per version, ending at the current version", () => {
    const froms = saveMigrations.map((migration) => migration.from);
    const expected = froms.map((_, index) => SAVE_VERSION - froms.length + index);
    expect(froms).toEqual(expected);
  });
});
