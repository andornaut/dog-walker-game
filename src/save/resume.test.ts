import { describe, expect, it, vi } from "vitest";

import { gameData } from "../data";
import { LANE_COUNT } from "../data/screen";
import type { ZoneId } from "../data/types";
import { firstZoneId } from "../rules/route";
import { NO_DRAWS, unplannedStart } from "../runner/session";
import { startRoad } from "../runner/walk";
import type { WalkItem } from "../runner/walkItems";
import { newRun, type RunState } from "../state/runState";
import { clampHearts } from "../units";
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
    draws: { cards: 41, forks: 3 },
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

// The walk at the fork after zone 1, its path not yet picked.
const AT_FORK: ResumeWalk = {
  ...ZONE_START,
  session: {
    ...ZONE_START.session,
    queue: [
      { kind: "fork", paths: [SECOND, "theBeaches"], upgrades: ["sweetTalker", "bigTipper"] },
    ],
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
