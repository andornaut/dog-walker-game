import { describe, expect, it, vi } from "vitest";

import { gameData } from "../data";
import type { GearId } from "../data/types";
import { cents } from "../rules/units";
import { packOf, runFactsFor, saveFor } from "../testing/achievements";
import { earnedSince } from "./achievements";
import { quietCounters, testAwards, testContext, veteranSave } from "./fixtures";
import { type Awards, ProfileSession } from "./profile";
import { DEFAULT_SETTINGS, SAVE_VERSION, type SaveDocument } from "./schema";
import { memoryStorage, SAVE_KEY, type SaveStorage, saveStore } from "./storage";

const awards: Awards = { data: testAwards.data, now: () => testAwards.now };

function stored(entries: Map<string, string>): SaveDocument {
  return JSON.parse(entries.get(SAVE_KEY) ?? "null") as SaveDocument;
}

async function opened(save: SaveDocument | null = null) {
  const entries = new Map<string, string>();
  if (save !== null) {
    entries.set(SAVE_KEY, JSON.stringify(save));
  }
  const { load, session } = await ProfileSession.open(
    testContext,
    awards,
    saveStore(memoryStorage(entries)),
  );
  return { entries, load, session };
}

// Lets every write already asked for start.
const settle = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });

const throwing: SaveStorage = {
  read: () => Promise.reject(new Error("blocked")),
  write: () => Promise.reject(new Error("blocked")),
};

describe("ProfileSession.open", () => {
  it("starts a new player from the defaults, through newPlayer", async () => {
    const { session } = await ProfileSession.open(
      testContext,
      awards,
      saveStore(memoryStorage()),
      (save) => ({ ...save, settings: { ...save.settings, reducedMotion: true } }),
    );
    expect(session.save.settings.reducedMotion).toBe(true);
    expect(session.save.owned.dogSlots).toBe(1);
    expect(session.save.lastLoadout.dogs).toEqual(testContext.defaults.freeDogs.slice(0, 1));
  });

  it("keeps a loaded save as stored", async () => {
    const { session } = await opened(veteranSave());
    expect(session.save).toEqual(veteranSave());
    expect(session.storage).toBe("available");
  });

  it("banks a run left at a checkpoint as headed home and writes it back", async () => {
    const checkpoint = {
      counters: quietCounters(),
      dogs: [{ fired: false, id: "koda" as const, zonesFinished: 2 }],
      earnedCents: cents(1_000),
      route: ["street" as const, "park" as const],
      zonesFinished: 2,
    };
    const { entries, session } = await opened({ ...veteranSave(), checkpoint });
    expect(session.save.checkpoint).toBeNull();
    expect(session.save.bankCents).toBe(12_345 + 1_000);
    expect(session.save.stats.runs.wentHome).toBe(3);
    expect(stored(entries).bankCents).toBe(12_345 + 1_000);
  });

  it("plays on in memory when storage throws", async () => {
    const { load, session } = await ProfileSession.open(testContext, awards, saveStore(throwing));
    expect(load.status).toBe("unavailable");
    expect(session.storage).toBe("unavailable");
    await session.update((save) => ({ ...save, bankCents: cents(5) }));
    expect(session.save.bankCents).toBe(5);
  });
});

describe("achievements away from a run", () => {
  it("awards on launch what the save already meets, and celebrates it once", async () => {
    const fired = saveFor(gameData, ["youreFired"], veteranSave());
    const { entries, session } = await opened(fired);
    expect(session.save.achievements.youreFired).toBe(testAwards.now);
    expect(stored(entries).achievements.youreFired).toBe(testAwards.now);
    expect(session.takeCelebrations()).toEqual(["youreFired"]);
    expect(session.takeCelebrations()).toEqual([]);
  });

  it("awards and celebrates an ownership achievement bought on the home screen", async () => {
    const { session } = await opened(veteranSave());
    const allGear = Object.keys(gameData.shopGear) as GearId[];
    await session.purchase((save) => ({ ...save, owned: { ...save.owned, gear: [...allGear] } }));
    expect(session.save.achievements.kittedOut).toBe(testAwards.now);
    expect(session.takeCelebrations()).toEqual(["kittedOut"]);
  });

  it("leaves a save that meets nothing new unwritten", async () => {
    const storage = memoryStorage(new Map([[SAVE_KEY, JSON.stringify(veteranSave())]]));
    const write = vi.spyOn(storage, "write");
    await ProfileSession.open(testContext, awards, saveStore(storage));
    expect(write).not.toHaveBeenCalled();
  });
});

describe("ProfileSession.update", () => {
  it("changes the save at once and writes the changes in order, each after the last", async () => {
    // The first write waits until released, so a second write not chained after it lands first.
    const written: number[] = [];
    let release = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const storage: SaveStorage = {
      read: async () => null,
      write: async (_key, value) => {
        const { bankCents } = JSON.parse(value) as SaveDocument;
        if (bankCents === 100) {
          await held;
        }
        written.push(bankCents);
      },
    };
    const { session } = await ProfileSession.open(testContext, awards, saveStore(storage));
    const first = session.update((save) => ({ ...save, bankCents: cents(100) }));
    expect(session.save.bankCents).toBe(100);
    const second = session.update((save) => ({ ...save, bankCents: cents(200) }));
    await settle();
    release();
    await Promise.all([first, second]);
    expect(written.slice(-2)).toEqual([100, 200]);
  });

  it("reports storage unavailable once a write fails", async () => {
    const entries = new Map<string, string>();
    const failing: SaveStorage = {
      read: async (key) => entries.get(key) ?? null,
      write: () => Promise.reject(new Error("quota")),
    };
    const { session } = await ProfileSession.open(testContext, awards, saveStore(failing));
    await session.update((save) => save);
    expect(session.storage).toBe("unavailable");
  });
});

describe("settings", () => {
  it("saves new settings and tells every listener until it stops listening", async () => {
    const { entries, session } = await opened();
    const listener = vi.fn();
    const off = session.onSettingsChanged(listener);
    const quiet = { ...DEFAULT_SETTINGS, musicVolume: 0 };
    await session.setSettings(quiet);
    expect(listener).toHaveBeenCalledWith(quiet);
    expect(stored(entries).settings).toEqual(quiet);
    off();
    await session.setSettings(DEFAULT_SETTINGS);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("hints", () => {
  it("marks a hint shown once", async () => {
    const { entries, session } = await opened();
    await session.markHintShown("tip");
    await session.markHintShown("tip");
    expect([...session.shownHints()]).toEqual(["tip"]);
    expect(stored(entries).shownHints).toEqual(["tip"]);
  });
});

const result = {
  counters: quietCounters(),
  dogs: [{ fired: false, id: "koda" as const, zonesFinished: 4 }],
  earnedCents: cents(9_500),
  outcome: "finished" as const,
  route: ["street" as const, "park" as const, "shops" as const, "homeStretch" as const],
  walker: "casey" as const,
  zone: 4,
};

describe("runs", () => {
  it("saves a checkpoint, then banks the finished run and clears it", async () => {
    const { entries, session } = await opened(veteranSave());
    await session.checkpointRun({
      counters: quietCounters(),
      dogs: result.dogs,
      earnedCents: cents(500),
      route: ["street"],
      zonesFinished: 1,
    });
    expect(stored(entries).checkpoint?.zonesFinished).toBe(1);
    await session.finishRun(result, []);
    expect(stored(entries).checkpoint).toBeNull();
    expect(stored(entries).bankCents).toBe(12_345 + 9_500);
  });

  it("lists the achievements the run earned for the end screen", async () => {
    // A finished walk as Not a Scratch's goal asks.
    const goal = runFactsFor(gameData, ["notAScratch"]);
    const walk = {
      ...result,
      dogs: packOf(gameData, goal.packSize).map((id) => ({
        fired: false,
        id,
        zonesFinished: result.zone,
      })),
      earnedCents: goal.earnedCents,
    };
    const { session } = await opened(veteranSave());
    await session.finishRun(walk, []);
    const earned = earnedSince(gameData, veteranSave(), session.save);
    expect(earned).toContain("notAScratch");
    expect(session.lastRunEnd?.achievements).toEqual(earned);
    expect(earned.map((id) => session.save.achievements[id])).toEqual(
      earned.map(() => testAwards.now),
    );
    expect(session.takeCelebrations()).toEqual([]);
  });

  it("flags a new best walk from the stats before the run is banked", async () => {
    const { session } = await opened(veteranSave());
    expect(session.lastRunEnd).toBeNull();
    void session.finishRun(result, []);
    expect(session.lastRunEnd?.newBestWalk).toBe(true);
    void session.finishRun({ ...result, earnedCents: cents(100) }, []);
    expect(session.lastRunEnd?.newBestWalk).toBe(false);
  });
});

const newerRaw = JSON.stringify({ ...veteranSave(), version: SAVE_VERSION + 1 });

describe("a save from a newer version", () => {
  async function openedNewer() {
    const entries = new Map([[SAVE_KEY, newerRaw]]);
    const storage = memoryStorage(entries);
    const write = vi.spyOn(storage, "write");
    const { load, session } = await ProfileSession.open(testContext, awards, saveStore(storage));
    return { entries, load, session, write };
  }

  it("plays from a default save in memory and writes nothing on open", async () => {
    const { entries, load, session, write } = await openedNewer();
    expect(load.status).toBe("newer");
    expect(session.storage).toBe("newer");
    expect(session.save.bankCents).toBe(0);
    expect(write).not.toHaveBeenCalled();
    expect(entries.get(SAVE_KEY)).toBe(newerRaw);
  });

  it.each<[string, (session: ProfileSession) => Promise<void>]>([
    [
      "checkpointRun",
      (session) =>
        session.checkpointRun({
          counters: quietCounters(),
          dogs: result.dogs,
          earnedCents: cents(500),
          route: ["street"],
          zonesFinished: 1,
        }),
    ],
    ["finishRun", (session) => session.finishRun(result, [])],
    ["markHintShown", (session) => session.markHintShown("tip")],
    ["purchase", (session) => session.purchase((save) => ({ ...save, bankCents: cents(5) }))],
    ["setSettings", (session) => session.setSettings({ ...DEFAULT_SETTINGS, muted: true })],
    ["update", (session) => session.update((save) => ({ ...save, bankCents: cents(5) }))],
  ])("keeps %s in memory and leaves the stored save untouched", async (_name, change) => {
    const { entries, session, write } = await openedNewer();
    const before = session.save;
    await change(session);
    expect(session.save).not.toEqual(before);
    expect(session.storage).toBe("newer");
    expect(write).not.toHaveBeenCalled();
    expect(entries.get(SAVE_KEY)).toBe(newerRaw);
  });
});
