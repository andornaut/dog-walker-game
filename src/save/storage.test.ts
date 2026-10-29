import { memoryStorage } from "@andornaut/game-kit/save/storage";
import { describe, expect, it } from "vitest";

import { newPlayerSave, STARTER_DOGS, testContext, veteranSave } from "../testing/saves";
import { cents } from "../units";
import { SAVE_VERSION, storedSave } from "./schema";
import { gameSaveStore, SAVE_KEYS } from "./storage";

// The veteran save as the store writes it.
const VETERAN_STORED = JSON.stringify(storedSave(testContext.defaults, veteranSave()));

const NEWER_RAW = JSON.stringify({ ...veteranSave(), version: SAVE_VERSION + 1 });

// The kit's save store tests its storage faults; these test it with the game's format.
describe("gameSaveStore", () => {
  it("round-trips a save, writing only what a load cannot add back", async () => {
    const entries = new Map<string, string>();
    const store = gameSaveStore(testContext, memoryStorage(entries));
    expect(await store.save(veteranSave())).toEqual({ status: "saved" });
    expect([...entries.keys()]).toEqual([SAVE_KEYS.save]);
    expect(JSON.parse(entries.get(SAVE_KEYS.save) ?? "null").owned).toEqual({
      dogSlots: [3],
      dogs: veteranSave().owned.dogs.filter((dog) => !STARTER_DOGS.includes(dog)),
      gear: ["fannyPack", "runningShoes"],
      walkers: ["ada", "mrB", "trista"],
    });
    expect(await gameSaveStore(testContext, memoryStorage(entries)).load()).toEqual({
      save: veteranSave(),
      status: "loaded",
    });
  });

  // A corrupt save is backed up and replaced by the next write; a later version's save is
  // neither backed up nor written over for the session.
  it.each<[string, string, "corrupt" | "newer", string | undefined, string]>([
    ["a corrupt save", "{not json", "corrupt", "{not json", "saved"],
    ["a newer version's save", NEWER_RAW, "newer", undefined, "unavailable"],
  ])("starts %s as a new player", async (_name, raw, status, backup, written) => {
    const entries = new Map([[SAVE_KEYS.save, raw]]);
    const store = gameSaveStore(testContext, memoryStorage(entries));
    expect(await store.load()).toEqual({ reason: expect.any(String), save: newPlayerSave, status });
    expect(entries.get(SAVE_KEYS.backup)).toBe(backup);
    expect((await store.save(veteranSave())).status).toBe(written);
    expect(entries.get(SAVE_KEYS.save)).toBe(written === "saved" ? VETERAN_STORED : raw);
  });

  it("refuses to write a save the schema rejects and keeps the stored one", async () => {
    const entries = new Map([[SAVE_KEYS.save, VETERAN_STORED]]);
    const result = await gameSaveStore(testContext, memoryStorage(entries)).save({
      ...veteranSave(),
      bankCents: cents(-5),
    });
    expect(result).toEqual({ reason: expect.any(String), status: "invalid" });
    expect(entries.get(SAVE_KEYS.save)).toBe(VETERAN_STORED);
  });
});
