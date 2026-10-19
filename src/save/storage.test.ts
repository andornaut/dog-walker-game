import { describe, expect, it } from "vitest";

import { cents } from "../rules/units";
import { newPlayerSave, testContext, veteranSave } from "./fixtures";
import {
  browserStorage,
  lazyStorage,
  memoryStorage,
  SAVE_BACKUP_KEY,
  SAVE_KEY,
  type SaveStorage,
  saveStore,
  type StorageLike,
} from "./storage";

// Memory storage that can be told to throw, and that counts its writes.
function faultyStorage(entries: Map<string, string>, faults: { read?: boolean; write?: boolean }) {
  const inner = memoryStorage(entries);
  const calls = { writes: 0 };
  const storage: SaveStorage = {
    read: async (key) => {
      if (faults.read) {
        throw new Error("storage is disabled");
      }
      return inner.read(key);
    },
    write: async (key, value) => {
      calls.writes += 1;
      if (faults.write) {
        throw new Error("quota exceeded");
      }
      return inner.write(key, value);
    },
  };
  return { calls, storage };
}

function fakeLocalStorage(entries: Map<string, string>): StorageLike {
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => {
      entries.set(key, value);
    },
  };
}

describe("saveStore", () => {
  it("round-trips a save through memory storage", async () => {
    const entries = new Map<string, string>();
    expect(await saveStore(memoryStorage(entries)).save(veteranSave())).toEqual({
      status: "saved",
    });
    expect([...entries.keys()]).toEqual([SAVE_KEY]);
    expect(await saveStore(memoryStorage(entries)).load(testContext)).toEqual({
      save: veteranSave(),
      status: "loaded",
    });
  });

  it("starts a new player when nothing is stored", async () => {
    expect(await saveStore(memoryStorage()).load(testContext)).toEqual({
      save: newPlayerSave,
      status: "new",
    });
  });

  it("backs up a corrupt save and starts fresh", async () => {
    const entries = new Map([[SAVE_KEY, "{not json"]]);
    const result = await saveStore(memoryStorage(entries)).load(testContext);
    expect(result).toEqual({ reason: expect.any(String), save: newPlayerSave, status: "corrupt" });
    expect(entries.get(SAVE_BACKUP_KEY)).toBe("{not json");
  });

  it("refuses to write an invalid document and keeps the stored one", async () => {
    const entries = new Map([[SAVE_KEY, JSON.stringify(veteranSave())]]);
    const result = await saveStore(memoryStorage(entries)).save({
      ...veteranSave(),
      bankCents: cents(-5),
    });
    expect(result).toEqual({ reason: expect.any(String), status: "invalid" });
    expect(entries.get(SAVE_KEY)).toBe(JSON.stringify(veteranSave()));
  });

  describe("when storage throws", () => {
    it("reports a failed read as unavailable and plays on with a default save", async () => {
      const { storage } = faultyStorage(new Map(), { read: true });
      expect(await saveStore(storage).load(testContext)).toEqual({
        reason: "storage is disabled",
        save: newPlayerSave,
        status: "unavailable",
      });
    });

    it("stops writing after a failed read, so an unread save is never overwritten", async () => {
      const entries = new Map([[SAVE_KEY, JSON.stringify(veteranSave())]]);
      const faults = { read: true };
      const { calls, storage } = faultyStorage(entries, faults);
      const store = saveStore(storage);
      await store.load(testContext);
      faults.read = false;
      expect((await store.save(newPlayerSave)).status).toBe("unavailable");
      expect(calls.writes).toBe(0);
      expect(entries.get(SAVE_KEY)).toBe(JSON.stringify(veteranSave()));
    });

    it("reports a failed write as unavailable, and a later write can succeed", async () => {
      const entries = new Map<string, string>();
      const faults = { write: true };
      const { storage } = faultyStorage(entries, faults);
      const store = saveStore(storage);
      expect(await store.save(veteranSave())).toEqual({
        reason: "quota exceeded",
        status: "unavailable",
      });
      expect(entries.has(SAVE_KEY)).toBe(false);
      faults.write = false;
      expect(await store.save(veteranSave())).toEqual({ status: "saved" });
      expect(entries.get(SAVE_KEY)).toBe(JSON.stringify(veteranSave()));
    });

    it("stops writing when a corrupt save cannot be backed up", async () => {
      const entries = new Map([[SAVE_KEY, "{not json"]]);
      const faults = { write: true };
      const { calls, storage } = faultyStorage(entries, faults);
      const store = saveStore(storage);
      expect((await store.load(testContext)).status).toBe("unavailable");
      faults.write = false;
      expect((await store.save(newPlayerSave)).status).toBe("unavailable");
      expect(calls.writes).toBe(1);
      expect(entries.get(SAVE_KEY)).toBe("{not json");
    });
  });
});

describe("browserStorage", () => {
  it("reads and writes through the Storage-like object", async () => {
    const entries = new Map<string, string>();
    const store = saveStore(browserStorage(fakeLocalStorage(entries)));
    await store.save(veteranSave());
    expect(entries.get(SAVE_KEY)).toBe(JSON.stringify(veteranSave()));
    expect((await store.load(testContext)).save).toEqual(veteranSave());
  });

  it("returns null for a missing key", async () => {
    expect(await browserStorage(fakeLocalStorage(new Map())).read(SAVE_KEY)).toBeNull();
  });

  it("turns a throwing getItem into an unavailable load", async () => {
    const throwing: StorageLike = {
      getItem: () => {
        throw new DOMException("The operation is insecure.", "SecurityError");
      },
      setItem: () => {},
    };
    expect((await saveStore(browserStorage(throwing)).load(testContext)).status).toBe(
      "unavailable",
    );
  });

  it("turns a throwing setItem into an unavailable save", async () => {
    const full: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
      },
    };
    expect(await saveStore(browserStorage(full)).save(veteranSave())).toEqual({
      reason: "The quota has been exceeded.",
      status: "unavailable",
    });
  });
});

describe("lazyStorage", () => {
  it("turns a storage that cannot even be looked up into an unavailable load", async () => {
    const blocked = lazyStorage(() => {
      throw new DOMException("Access is denied for this document.", "SecurityError");
    });
    expect((await saveStore(browserStorage(blocked)).load(testContext)).status).toBe("unavailable");
  });

  it("reads and writes through the storage it looks up", async () => {
    const entries = new Map<string, string>();
    const store = saveStore(browserStorage(lazyStorage(() => fakeLocalStorage(entries))));
    await store.save(veteranSave());
    expect(entries.get(SAVE_KEY)).toBe(JSON.stringify(veteranSave()));
  });
});
