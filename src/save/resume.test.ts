import { encodeSave } from "@andornaut/game-kit/save/versionedSave";
import { describe, expect, it, vi } from "vitest";

import { gameData } from "../data";
import { LANE_COUNT } from "../data/screen";
import type { ZoneId } from "../data/types";
import { firstZoneId } from "../rules/route";
import { moverPlace } from "../runner/movers";
import { screenRoadGeometry } from "../runner/screenGeometry";
import {
  NO_DRAWS,
  resumeSession,
  runStreams,
  startSession,
  unplannedStart,
} from "../runner/session";
import { componentHitLength, itemHeight, startRoad } from "../runner/walk";
import { footprintOf, type WalkItem } from "../runner/walkItems";
import { newRun, type RunState } from "../state/runState";
import { newPlayerSave, testContext } from "../testing/saves";
import { clampHearts } from "../units";
import { saveFormat } from "./load";
import { encodeResume, launchWalk, RESUME_VERSION, type ResumeWalk } from "./resume";
import { checkpointOf } from "./runSlices";
import type { Checkpoint } from "./schema";

const FIRST = firstZoneId(gameData);
const SECOND: ZoneId = "cabbagetown";

// A dart that has started across the road, as the planner makes one.
const DART: WalkItem = {
  height: 32,
  id: 7,
  kind: "squirrel",
  lane: 1,
  laneSpan: 1,
  mover: {
    path: {
      direction: 1,
      enterTravel: 120,
      idle: 0.2,
      lanesPerPixel: 0.01,
      motion: "cross",
      movement: "dart",
      stopAfter: null,
      tilt: 0,
      turnAfter: null,
      warning: 60,
    },
    since: 30,
  },
  y: 140,
};

// Zone 2 about to start, its fork taken: Kilo and Lady walking with the Fanny pack, Muddy on,
// a dart left on the road from zone 1, and the dev panel's invincibility on.
function zoneStartRun(): RunState {
  const run = newRun(gameData, 2, { dogs: ["kilo", "lady"], gear: "fannyPack", walker: "casey" });
  return {
    ...run,
    debuffs: [{ debuff: "muddy", secondsLeft: 4.5, untilZone: 1 }],
    debuffsGot: { muddy: 1 },
    invincible: true,
    pack: [
      { dog: "kilo", hearts: clampHearts(5, 2), status: "walking" },
      { dog: "lady", status: "fired", zoneIndex: 0 },
    ],
    route: [FIRST, SECOND],
    upgradesPicked: ["sweetTalker"],
    zoneIndex: 1,
  };
}

const ZONE_START: ResumeWalk = (() => {
  const walk = { road: startRoad(LANE_COUNT), run: zoneStartRun() };
  const session = unplannedStart(walk);
  return {
    draws: { cards: 41, forks: 3, upgrades: 4 },
    seed: 1234,
    session: {
      ...session,
      distanceBeforeZone: 9_000,
      timeMs: 61_000,
      walk: {
        ...walk,
        road: {
          ...walk.road,
          items: [DART],
          nextItemId: 8,
          path: [
            { distance: 8_900, lane: 2 },
            { distance: 9_000, lane: 3 },
          ],
        },
      },
    },
  };
})();

// The walk at the fork after zone 1, its path not yet picked, one path carrying no upgrade.
const AT_FORK: ResumeWalk = {
  ...ZONE_START,
  session: {
    ...ZONE_START.session,
    queue: [{ kind: "fork", paths: [SECOND, "theBeaches"], upgrades: ["sweetTalker", null] }],
    walk: { ...ZONE_START.session.walk, run: { ...zoneStartRun(), route: [FIRST] } },
  },
};

const START: ResumeWalk = {
  draws: NO_DRAWS,
  seed: 99,
  session: unplannedStart({
    road: startRoad(LANE_COUNT),
    run: newRun(gameData, 1, { dogs: ["ginger"], gear: null, walker: "casey" }),
  }),
};

function checkpointFor(
  walk: ResumeWalk,
  resume: string | null = encodeResume(gameData, walk) ?? null,
): Checkpoint {
  const slice = checkpointOf(gameData, walk.session.walk.run);
  return resume === null ? slice : { ...slice, resume };
}

// The checkpoint of walk with its stored resume point changed by edit, as JSON.
function edited(walk: ResumeWalk, edit: (stored: Record<string, unknown>) => void): Checkpoint {
  const stored = JSON.parse(encodeResume(gameData, walk) ?? "null") as Record<string, unknown>;
  edit(stored);
  return checkpointFor(walk, JSON.stringify(stored));
}

type Stored = {
  draws: { cards: number };
  session: {
    needsZonePlan: boolean;
    walk: {
      run: {
        gear: string;
        modifiers: { by: string }[];
        pack: { dog: string }[];
        route: string[];
      };
    };
  };
  version: number;
};
const storedOf = (stored: Record<string, unknown>) => stored as unknown as Stored;

// As stored: the zone's plan left out but for the path's last row, and no invincibility.
function asStored(walk: ResumeWalk): ResumeWalk {
  const { road, run } = walk.session.walk;
  const played = Object.fromEntries(
    Object.entries(run).filter(([key]) => key !== "invincible"),
  ) as RunState;
  return {
    ...walk,
    session: {
      ...walk.session,
      walk: { road: { ...road, path: road.path.slice(-1) }, run: played },
    },
  };
}

describe("encodeResume and launchWalk", () => {
  it.each([
    { name: "a new walk's start", walk: START },
    { name: "a zone's start", walk: ZONE_START },
    { name: "a fork", walk: AT_FORK },
  ])("resumes $name as stored", ({ walk }) => {
    expect(launchWalk(gameData, true, checkpointFor(walk))).toEqual({
      kind: "resume",
      walk: asStored(walk),
    });
  });

  // CLEANUP (added 2026-10-29): remove with the schema's default for draws.upgrades.
  it("resumes a walk saved before the upgrades stream with that stream undrawn", () => {
    const old = edited(AT_FORK, (stored) => {
      delete (stored.draws as Record<string, unknown>).upgrades;
    });
    expect(launchWalk(gameData, true, old)).toEqual({
      kind: "resume",
      walk: asStored({ ...AT_FORK, draws: { ...AT_FORK.draws, upgrades: 0 } }),
    });
  });

  it.each([
    { name: "walk start", walk: START },
    { name: "fork", walk: AT_FORK },
    { name: "zone start", walk: ZONE_START },
  ])("omits all transient movement state at a $name boundary", ({ walk }) => {
    const runtime = {
      ...walk,
      draws: { ...walk.draws, debuffMovement: 99 },
      session: {
        ...walk.session,
        debuffMovement: { debuff: "zoomies" as const, elapsed: 0.35, interval: 0.8 },
        walk: {
          ...walk.session.walk,
          road: {
            ...walk.session.walk.road,
            admission: {
              capacity: { limits: [], rows: 0 },
              counts: [],
              rejections: [],
              substitutions: [],
            },
            control: { ...walk.session.walk.road.control, manualDirection: 1 as const },
          },
        },
      },
    };
    const encoded = encodeResume(gameData, runtime);
    expect(encoded).toBeDefined();
    expect(encoded).not.toContain('"debuffMovement"');
    expect(encoded).not.toContain('"admission"');
    expect(encoded).not.toContain('"manualDirection"');
    const checkpoint = checkpointFor(runtime, encoded);
    expect(JSON.stringify(checkpoint)).not.toContain("manualDirection");
    const saved = encodeSave(saveFormat(testContext), { ...newPlayerSave, checkpoint });
    expect(saved.ok).toBe(true);
    if (saved.ok) {
      expect(saved.value).not.toContain("manualDirection");
    }
    const stored = JSON.parse(encoded ?? "null") as {
      draws: typeof walk.draws;
      session: { zoomiesSeconds: number };
      version: number;
    };
    expect(stored.draws).toEqual(walk.draws);
    expect(stored.session.zoomiesSeconds).toBe(0);
    expect(stored.version).toBe(RESUME_VERSION);
    const restored = launchWalk(gameData, true, checkpointFor(runtime, encoded));
    expect(restored.kind).toBe("resume");
    if (restored.kind !== "resume") {
      throw new Error("Expected a saved boundary");
    }
    expect(restored.walk.draws).toEqual(walk.draws);
    expect(restored.walk.session.debuffMovement).toBeNull();
    expect(restored.walk.session).not.toHaveProperty("zoomiesSeconds");
  });

  it("reads the original codec without retaining its legacy movement timer", () => {
    const checkpoint = edited(AT_FORK, (stored) => {
      (stored.session as Record<string, unknown>).zoomiesSeconds = 1.75;
    });
    const restored = launchWalk(gameData, true, checkpoint);
    expect(restored).toEqual({ kind: "resume", walk: asStored(AT_FORK) });
    if (restored.kind !== "resume") {
      throw new Error("Expected a legacy boundary");
    }
    const encoded = JSON.parse(encodeResume(gameData, restored.walk) ?? "null") as {
      session: { zoomiesSeconds: number };
    };
    expect(encoded.session.zoomiesSeconds).toBe(0);
  });

  it("refuses a mid-walk session instead of saving its transient clock", () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(
      encodeResume(gameData, {
        ...ZONE_START,
        session: {
          ...ZONE_START.session,
          debuffMovement: { debuff: "zoomies", elapsed: 0.35, interval: 0.8 },
          needsZonePlan: false,
        },
      }),
    ).toBeUndefined();
    logged.mockRestore();
  });

  it("roundtrips a production signature item through a checkpoint and resumes with its route intact", () => {
    const road = screenRoadGeometry(ZONE_START.session.walk.run);
    const planned = startSession(
      gameData,
      runStreams(ZONE_START.seed, ZONE_START.draws),
      screenRoadGeometry,
      ZONE_START.session.walk,
    ).walk;
    const event = planned.road.pending.find(({ mover }) => mover?.motion === "signature");
    if (event?.mover?.motion !== "signature") {
      throw new Error("Expected a production signature spawn");
    }
    const profile = event.mover.route.profile;
    const height =
      profile.kind === "delayedTrail"
        ? componentHitLength(road, profile)
        : itemHeight(gameData, road, event.kind, true);
    const item: WalkItem = {
      height,
      id: 9,
      kind: event.kind,
      lane: event.lane,
      laneSpan: footprintOf(gameData, event.kind).lanes,
      mover: { path: event.mover, since: 0 },
      y: road.roadTop - height + moverPlace(road.laneCount, event.mover, 0).travel,
    };
    const walk: ResumeWalk = {
      ...ZONE_START,
      session: {
        ...ZONE_START.session,
        walk: {
          ...ZONE_START.session.walk,
          road: { ...ZONE_START.session.walk.road, items: [item] },
        },
      },
    };
    const restored = launchWalk(gameData, true, checkpointFor(walk));
    expect(restored).toEqual({ kind: "resume", walk: asStored(walk) });
    if (restored.kind !== "resume") {
      throw new Error("Expected a resumable signature checkpoint");
    }
    const resumed = resumeSession(
      gameData,
      runStreams(walk.seed, walk.draws),
      screenRoadGeometry,
      restored.walk.session,
    );
    expect(resumed.session.walk.road.items).toEqual([item]);
    expect(resumed.session.debuffMovement).toEqual(walk.session.debuffMovement);
  });

  it.each<{
    backup: boolean;
    checkpoint: () => Checkpoint;
    name: string;
    reason: RegExp;
  }>([
    {
      backup: false,
      checkpoint: () => checkpointFor(ZONE_START, null),
      name: "a checkpoint with no resume point",
      reason: /no resume point/,
    },
    {
      backup: true,
      checkpoint: () => edited(ZONE_START, (s) => (storedOf(s).version = RESUME_VERSION - 1)),
      name: "an older version",
      reason: /older than this game/,
    },
    {
      backup: false,
      checkpoint: () => edited(ZONE_START, (s) => (storedOf(s).version = RESUME_VERSION + 1)),
      name: "a newer version",
      reason: /newer than this game/,
    },
    {
      backup: true,
      checkpoint: () => checkpointFor(ZONE_START, "{ not json"),
      name: "text that is not JSON",
      reason: /not valid JSON/,
    },
    {
      backup: true,
      checkpoint: () =>
        edited(ZONE_START, (s) => {
          const [slot] = storedOf(s).session.walk.run.pack;
          if (slot !== undefined) {
            slot.dog = "rex";
          }
        }),
      name: "a dog the game no longer has",
      reason: /unknown dog: rex/,
    },
    {
      backup: true,
      checkpoint: () =>
        edited(ZONE_START, (s) => (storedOf(s).session.walk.run.route = [FIRST, "atlantis"])),
      name: "a zone the game no longer has",
      reason: /unknown zone: atlantis/,
    },
    {
      backup: true,
      checkpoint: () => edited(ZONE_START, (s) => (storedOf(s).session.walk.run.gear = "jetpack")),
      name: "gear the game no longer has",
      reason: /unknown gear: jetpack/,
    },
    {
      backup: true,
      checkpoint: () =>
        edited(ZONE_START, (s) => {
          const [modifier] = storedOf(s).session.walk.run.modifiers;
          if (modifier !== undefined) {
            modifier.by = "retiredKey";
          }
        }),
      name: "a modifier naming a tuning key the game no longer has",
      reason: /unknown modifier/,
    },
    {
      backup: true,
      checkpoint: () => edited(ZONE_START, (s) => (storedOf(s).draws.cards = 2_000_000)),
      name: "a stream drawn past any walk's count",
      reason: /draws/,
    },
    {
      backup: true,
      checkpoint: () => edited(ZONE_START, (s) => (storedOf(s).session.needsZonePlan = false)),
      name: "a walk saved mid-zone",
      reason: /needsZonePlan/,
    },
    {
      backup: true,
      checkpoint: () => edited(ZONE_START, (s) => (storedOf(s).session.walk.run.route = [FIRST])),
      name: "a route without the zone it starts",
      reason: /not between zones/,
    },
    {
      backup: false,
      checkpoint: () => ({
        ...checkpointFor(ZONE_START),
        dogs: [{ firedInZone: null, id: "kilo" }],
      }),
      name: "another walk's resume point",
      reason: /not the checkpoint's walk/,
    },
  ])("banks $name as heading home", ({ backup, checkpoint, reason }) => {
    const stored = checkpoint();
    const decided = launchWalk(gameData, true, stored);
    expect(decided).toMatchObject({ kind: "bank", reason: expect.stringMatching(reason) });
    expect(decided.kind === "bank" ? decided.backup : undefined).toBe(
      backup ? stored.resume : undefined,
    );
  });

  it("banks a good resume point when a dev link starts its own walk", () => {
    expect(launchWalk(gameData, false, checkpointFor(ZONE_START))).toEqual({
      kind: "bank",
      reason: "a dev link starts its own walk",
    });
  });

  it("does nothing without a checkpoint", () => {
    expect(launchWalk(gameData, true, null)).toEqual({ kind: "none" });
  });

  it("stores no point it could not read back", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const run = { ...zoneStartRun(), walker: "nobody" } as unknown as RunState;
    const walk = {
      ...ZONE_START,
      session: { ...ZONE_START.session, walk: { ...ZONE_START.session.walk, run } },
    };
    expect(encodeResume(gameData, walk)).toBeUndefined();
  });
});
