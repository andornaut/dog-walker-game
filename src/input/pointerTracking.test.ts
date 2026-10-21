import { describe, expect, it } from "vitest";

import { type ScreenConfig, screenLayout } from "../layout/screenLayout";
import { clampIndex } from "../lib/arrays";
import { chance, type Random, randomInt, randomPick, seededRandom } from "../lib/random";
import {
  advanceLaneControl,
  isSteeringLocked,
  type LaneControl,
  laneControlIn,
  lockSteering,
  pullLane,
  steerLane,
} from "../runner/laneControl";
import { destinationLane, stillInLane } from "../runner/laneMotion";
import type { GestureAction } from "./gestures";
import {
  type ExplainChange,
  explaining,
  idleTrack,
  type PointerPhase,
  type PointerTrack,
  type Press,
  tickTrack,
  type TrackContext,
  trackPointer,
} from "./pointerTracking";

// Road y 40-470 with its lanes at x 40-320, five of 56px; the top bar is y 0-40 and the
// dog cards y 470-560. A drag's first step is at 20px.
const screen: ScreenConfig = {
  backdropHeight: 0,
  dogCardHeight: 90,
  dogRowHeight: 90,
  dogSlotCount: 3,
  height: 560,
  roadIntoBand: 0,
  roadWidth: 280,
  topBarHeight: 40,
  width: 360,
};
const LANES = 5;
const LANE_WIDTH = 56;
// Nothing explains itself here; the hold-to-explain tests below give a context that does.
const context: TrackContext<string> = {
  config: { laneCount: LANES, swipeStartDistance: 20, tapMaxDistance: 10 },
  explainAt: () => undefined,
  hold: { holdMs: 300, slopPx: 20 },
  layout: screenLayout(screen),
};
const laneConfig = { laneCount: LANES, moveDuration: 0.2 };

interface Event {
  held?: boolean;
  onButton?: boolean;
  phase: PointerPhase;
  press: Press;
  x: number;
  y?: number;
}

// Feeds the events in order; returns every action and the last track.
function feed(
  events: readonly Event[],
  track: PointerTrack<string> = idleTrack,
): { actions: GestureAction[]; track: PointerTrack<string> } {
  const actions: GestureAction[] = [];
  let current = track;
  for (const event of events) {
    const { held = false, onButton = false, phase, press, x, y = 400 } = event;
    const result = trackPointer(
      context,
      held,
      { onButton, phase, point: { x, y }, press, timeMs: 0 },
      current,
    );
    actions.push(...result.actions);
    current = result.track;
  }
  return { actions, track: current };
}

const finger = (downTime: number, id = 1): Press => ({ downTime, id });
const right: GestureAction = { direction: 1, kind: "move" };
const left: GestureAction = { direction: -1, kind: "move" };

describe("trackPointer", () => {
  const first = finger(1, 1);
  const second = finger(2, 2);
  // The first pointer pressed again later.
  const again = finger(2, 1);

  // Every action the events emit, and whether a press is still tracked after the last; the fuzz
  // below holds that an untracked press leaves the gesture idle.
  it("tracks each pointer sequence", () => {
    for (const { actions, events, tracking } of [
      {
        actions: [right],
        events: [
          { phase: "down", press: first, x: 200 },
          { phase: "move", press: first, x: 257 },
          { phase: "up", press: first, x: 257 },
        ],
        name: "drives the gestures from a press it saw go down",
        tracking: false,
      },
      {
        actions: [],
        events: [
          { phase: "down", press: first, x: 200 },
          { held: true, phase: "move", press: first, x: 210 },
          { phase: "move", press: first, x: 300 },
        ],
        name: "drops the press under way while a card or the menu holds the walk",
        tracking: false,
      },
      {
        actions: [],
        events: [
          { phase: "down", press: first, x: 100 },
          { phase: "cancel", press: first, x: 100 },
        ],
        name: "ends a cancelled press without a tap",
        tracking: false,
      },
      {
        actions: [],
        events: [
          { phase: "down", press: first, x: 300 },
          { phase: "move", press: first, x: 290 },
          { phase: "cancel", press: first, x: 0 },
        ],
        name: "ends a cancelled press without steps from where it was cancelled",
        tracking: false,
      },
      {
        actions: [],
        events: [
          { phase: "down", press: first, x: 200 },
          { phase: "move", press: first, x: 210 },
          // The release went to another scene, and so did the same pointer's next down.
          { phase: "move", press: again, x: 330 },
          { phase: "up", press: again, x: 330 },
        ],
        name: "ignores a press whose down it never saw, rather than steering it from a stale anchor",
        tracking: false,
      },
      {
        actions: [left],
        events: [
          { phase: "down", press: first, x: 200 },
          { phase: "move", press: first, x: 210 },
          { phase: "down", press: second, x: 300 },
          { phase: "move", press: second, x: 243 },
          { phase: "up", press: second, x: 243 },
        ],
        name: "lets a new press take over from one whose release was lost",
        tracking: false,
      },
      {
        actions: [],
        events: [
          { onButton: true, phase: "down", press: first, x: 190, y: 20 },
          { phase: "move", press: first, x: 300, y: 300 },
          { phase: "up", press: first, x: 300, y: 300 },
        ],
        name: "gives a press on a top-bar button no gesture",
        tracking: false,
      },
      {
        actions: [right],
        events: [
          { phase: "down", press: first, x: 200 },
          { onButton: true, phase: "down", press: second, x: 190, y: 20 },
          { phase: "up", press: second, x: 190, y: 20 },
          { phase: "move", press: first, x: 257 },
        ],
        name: "keeps a drag by another pointer while a top-bar button is pressed",
        tracking: true,
      },
      {
        actions: [right, right],
        events: [
          { phase: "down", press: first, x: 40, y: 300 },
          { phase: "down", press: second, x: 200 },
          { phase: "move", press: first, x: 140, y: 300 },
          { phase: "move", press: second, x: 257 },
          { phase: "up", press: first, x: 140, y: 300 },
          { phase: "move", press: second, x: 313 },
        ],
        name: "steers by the latest finger, ignoring one that rests on the screen",
        tracking: true,
      },
    ] satisfies readonly {
      actions: GestureAction[];
      events: Event[];
      name: string;
      tracking: boolean;
    }[]) {
      const result = feed(events);
      expect({ actions: result.actions, tracking: result.track.press !== undefined }).toEqual({
        actions,
        tracking,
      });
    }
  });
});

// Random walks over presses, losses, holds, hit stops, pulls and locks, against the real gesture
// and lane-control logic. A hit stop and a lock drop the moves that reach them, as the walk does.
describe("trackPointer fuzz", () => {
  interface World {
    control: LaneControl;
    held: boolean;
    hitStop: boolean;
    // The last press that went down on the walk itself, while nothing held it.
    latest: Press | undefined;
    // The pointers physically down, by id, with their press.
    down: Map<number, Press & { x: number; y: number }>;
    time: number;
    track: PointerTrack<string>;
  }

  const roadX = (random: Random) => 40 + random() * 280;
  const anyY = (random: Random) => random() * 560;

  function apply(world: World, actions: readonly GestureAction[]): void {
    for (const action of actions) {
      if (action.kind === "move" && !world.held && !world.hitStop) {
        world.control = steerLane(laneConfig, action.direction, world.control);
      }
    }
  }

  const same = (a: Press | undefined, b: Press | undefined) =>
    a?.id === b?.id && a?.downTime === b?.downTime;

  function send(
    world: World,
    phase: PointerPhase,
    id: number,
    on: "button" | "walk" = "walk",
  ): void {
    const press = world.down.get(id);
    if (press === undefined) {
      return;
    }
    const sample = {
      onButton: on === "button",
      phase,
      point: { x: press.x, y: press.y },
      press,
      timeMs: world.time,
    };
    const driver = world.track.press;
    const result = trackPointer(context, world.held, sample, world.track);
    world.track = result.track;
    if (phase === "down" && on !== "button" && !world.held) {
      world.latest = { downTime: press.downTime, id };
    }
    // Only the latest press acts, and only the press already driving it.
    if (result.actions.length > 0) {
      expect(same(driver, press)).toBe(true);
    }
    if (world.track.press !== undefined) {
      expect(same(world.track.press, world.latest)).toBe(true);
    }
    apply(world, result.actions);
    if (phase === "up" || phase === "cancel") {
      world.down.delete(id);
      expect(world.track.press?.id === id && world.track.press.downTime === press.downTime).toBe(
        false,
      );
    }
  }

  function randomStep(world: World, random: Random): void {
    world.time += 1 + randomInt(random, 0, 50);
    const id = randomInt(random, 0, 3);
    const roll = random();
    const pressed = world.down.get(id);
    if (roll < 0.2) {
      if (pressed !== undefined) {
        send(world, "up", id);
      }
      const on = randomPick(random, ["button", "walk", "walk", "walk"] as const);
      world.down.set(id, { downTime: world.time, id, x: roadX(random), y: anyY(random) });
      send(world, "down", id, on);
    } else if (roll < 0.55) {
      if (pressed !== undefined) {
        pressed.x += (random() - 0.5) * 3 * LANE_WIDTH;
        pressed.y += (random() - 0.5) * 40;
        send(world, "move", id);
      }
    } else if (roll < 0.65) {
      send(world, "up", id);
    } else if (roll < 0.7) {
      send(world, "cancel", id);
    } else if (roll < 0.75) {
      // A release the scene never sees.
      world.down.delete(id);
    } else if (roll < 0.8) {
      world.held = !world.held;
    } else if (roll < 0.85) {
      world.hitStop = !world.hitStop;
    } else if (roll < 0.9) {
      world.control = pullLane(laneConfig, 0, chance(random, 0.5) ? 1 : -1, world.control);
    } else if (roll < 0.93) {
      world.control = lockSteering(random() * 0.6, world.control);
    } else {
      world.control = advanceLaneControl(laneConfig, random() * 0.4, world.control);
    }
  }

  // Lifts every finger, some releases unseen, and lets the walk settle with nothing holding it.
  function liftAll(world: World, random: Random): void {
    for (const id of [...world.down.keys()]) {
      if (chance(random, 0.5)) {
        send(world, "up", id);
      } else {
        world.down.delete(id);
      }
    }
    world.held = false;
    world.hitStop = false;
    world.control = advanceLaneControl(laneConfig, 5, world.control);
  }

  function newWorld(random: Random): World {
    return {
      control: laneControlIn(stillInLane(randomInt(random, 0, LANES))),
      down: new Map(),
      held: false,
      hitStop: false,
      latest: undefined,
      time: 0,
      track: idleTrack,
    };
  }

  it("keeps a press tracked only while its gesture is under way, and the lane on the road", () => {
    // Checked plainly and reported once: an expect per step makes this the slowest test here.
    const broken: string[] = [];
    for (let seed = 1; seed <= 300; seed += 1) {
      const random = seededRandom(seed);
      const world = newWorld(random);
      for (let i = 0; i < 80; i += 1) {
        randomStep(world, random);
        const { control, track } = world;
        if (
          (track.press === undefined) !== (track.gesture.kind === "idle") ||
          control.target < 0 ||
          control.target >= LANES ||
          control.lockSeconds < 0
        ) {
          broken.push(`seed ${seed} step ${i}`);
        }
      }
    }
    expect(broken).toEqual([]);
  });

  it("settles every lane change and lock once input stops", () => {
    for (let seed = 1; seed <= 300; seed += 1) {
      const random = seededRandom(seed);
      const world = newWorld(random);
      for (let i = 0; i < 80; i += 1) {
        randomStep(world, random);
      }
      const settled = advanceLaneControl(laneConfig, 5, world.control);
      expect(settled.motion).toEqual(stillInLane(settled.target));
      expect(isSteeringLocked(settled)).toBe(false);
      expect(settled.lockOnArrival).toBeUndefined();
    }
  });

  it("moves N lanes for a fresh drag of N lane-widths from any state, clamped to the road", () => {
    for (let seed = 1; seed <= 300; seed += 1) {
      const random = seededRandom(seed);
      const world = newWorld(random);
      for (let i = 0; i < 80; i += 1) {
        randomStep(world, random);
      }
      liftAll(world, random);
      const lanes = randomInt(random, 1, 5) * (chance(random, 0.5) ? 1 : -1);
      const id = randomInt(random, 0, 2);
      const startX = roadX(random);
      const y = 100 + random() * 500;
      const before = destinationLane(world.control.motion);
      world.time += 1;
      world.down.set(id, { downTime: world.time, id, x: startX, y });
      send(world, "down", id);
      const press = world.down.get(id);
      if (press === undefined) {
        throw new Error("the press went down");
      }
      const endX = startX + (lanes + Math.sign(lanes) * random() * 0.9) * LANE_WIDTH;
      for (let k = 1; k <= 6; k += 1) {
        press.x = startX + ((endX - startX) * k) / 6;
        send(world, "move", id);
      }
      send(world, "up", id);
      const after = advanceLaneControl(laneConfig, 5, world.control);
      expect(world.track).toEqual(idleTrack);
      expect(destinationLane(after.motion)).toBe(clampIndex(LANES, before + lanes));
    }
  });

  it("steers N lanes by a new finger's drag while another rests and jitters", () => {
    for (let seed = 1; seed <= 300; seed += 1) {
      const random = seededRandom(seed);
      const world = newWorld(random);
      for (let i = 0; i < 80; i += 1) {
        randomStep(world, random);
      }
      liftAll(world, random);
      const rest = randomInt(random, 0, 3);
      const id = (rest + randomInt(random, 1, 3)) % 3;
      world.time += 1;
      world.down.set(rest, { downTime: world.time, id: rest, x: 40, y: 300 });
      send(world, "down", rest);
      const lanes = randomInt(random, 1, 5) * (chance(random, 0.5) ? 1 : -1);
      const startX = roadX(random);
      const before = destinationLane(world.control.motion);
      world.time += 1;
      world.down.set(id, { downTime: world.time, id, x: startX, y: 400 });
      send(world, "down", id);
      const press = world.down.get(id);
      const resting = world.down.get(rest);
      if (press === undefined || resting === undefined) {
        throw new Error("both fingers went down");
      }
      const lift = randomInt(random, 1, 7);
      const endX = startX + (lanes + Math.sign(lanes) * random() * 0.9) * LANE_WIDTH;
      for (let k = 1; k <= 6; k += 1) {
        resting.x += (random() - 0.5) * 2 * LANE_WIDTH;
        send(world, k === lift ? "up" : "move", rest);
        press.x = startX + ((endX - startX) * k) / 6;
        send(world, "move", id);
      }
      send(world, "up", id);
      const after = advanceLaneControl(laneConfig, 5, world.control);
      expect(destinationLane(after.motion)).toBe(clampIndex(LANES, before + lanes));
    }
  });

  it("taps from any state that allows gameplay", () => {
    for (let seed = 1; seed <= 300; seed += 1) {
      const random = seededRandom(seed);
      const world = newWorld(random);
      for (let i = 0; i < 80; i += 1) {
        randomStep(world, random);
      }
      liftAll(world, random);
      const press = { downTime: world.time + 1, id: randomInt(random, 0, 2) };
      const x = roadX(random);
      const { actions } = feed(
        [
          { phase: "down", press, x },
          { phase: "up", press, x: x + 3 },
        ],
        world.track,
      );
      expect(actions).toEqual([x < 180 ? left : right]);
    }
  });
});

// A press on the walk bar (y < 40) or a debuff bar (y 40 to 55) or a card (y 470 on) is on
// something that explains itself; a tap on a debuff bar does nothing, as on the walk bar.
describe("hold to explain", () => {
  const explainContext: TrackContext<string> = {
    ...context,
    explainAt: ({ y }) => (y < 40 ? "icon" : y < 56 ? "bar" : y >= 470 ? "card" : undefined),
    quietTaps: [{ height: 16, width: 360, x: 0, y: 40 }],
  };
  const { holdMs } = explainContext.hold;
  // A pointer event at a time, or a frame's tick. held: a card or a menu takes the press.
  type PointerStep = {
    at: number;
    held?: boolean;
    id?: number;
    kind: PointerPhase;
    x: number;
    y: number;
  };
  type Step = PointerStep | { at: number; kind: "tick" };

  function play(steps: readonly Step[]): {
    actions: GestureAction[];
    explained: ExplainChange<string>[];
  } {
    const actions: GestureAction[] = [];
    const explained: ExplainChange<string>[] = [];
    let track: PointerTrack<string> = idleTrack;
    for (const step of steps) {
      if (step.kind === "tick") {
        const ticked = tickTrack(step.at, track);
        track = ticked.track;
        explained.push(...(ticked.explain === undefined ? [] : [ticked.explain]));
        continue;
      }
      const press = finger(0, step.id ?? 1);
      const sample = { onButton: false, phase: step.kind, point: step, press, timeMs: step.at };
      const result = trackPointer(explainContext, step.held ?? false, sample, track);
      track = result.track;
      actions.push(...result.actions);
      explained.push(...(result.explain === undefined ? [] : [result.explain]));
    }
    expect(explaining(track)).toBe(false);
    return { actions, explained };
  }

  const at = (kind: PointerPhase, ms: number, x: number, y: number, id = 1): PointerStep => ({
    at: ms,
    id,
    kind,
    x,
    y,
  });
  const tick = (ms: number): Step => ({ at: ms, kind: "tick" });
  const start = (target: string): ExplainChange<string> => ({ kind: "start", target });
  const end: ExplainChange<string> = { kind: "end" };
  const card = 500;
  const icon = 20;
  const bar = 48;
  const road = 300;

  it("holds to explain by its rules", () => {
    for (const [, steps, actions, explained] of [
      [
        "explains a card held still, until its release, which taps nothing",
        [
          at("down", 0, 100, card),
          tick(holdMs - 1),
          tick(holdMs),
          at("up", holdMs + 100, 100, card),
        ],
        [],
        [start("card"), end],
      ],
      [
        "explains a card held within the slop, past the tap distance",
        [
          at("down", 0, 100, card),
          at("move", 50, 115, card),
          tick(holdMs),
          at("up", 400, 115, card),
        ],
        [],
        [start("card"), end],
      ],
      [
        "steers on a tap on a card",
        [at("down", 0, 100, card), at("up", 50, 101, card)],
        [left],
        [],
      ],
      [
        "steers on a drag from a card past the swipe distance, and never explains it",
        [
          at("down", 0, 100, card),
          at("move", 50, 125, card),
          tick(holdMs),
          at("up", 400, 125, card),
        ],
        [right],
        [],
      ],
      [
        "neither steers nor explains while it explains, until the release",
        [
          at("down", 0, 100, card),
          tick(holdMs),
          at("move", 350, 200, card),
          at("up", 400, 200, card),
        ],
        [],
        [start("card"), end],
      ],
      [
        "holds, never taps, on a release past the hold time before a frame ticks",
        [at("down", 0, 100, card), at("up", holdMs, 100, card)],
        [],
        [],
      ],
      [
        "explains an effect icon held still",
        [at("down", 0, 100, icon), tick(holdMs), at("up", 400, 100, icon)],
        [],
        [start("icon"), end],
      ],
      [
        "does nothing on a tap on an effect icon",
        [at("down", 0, 100, icon), at("up", 50, 100, icon)],
        [],
        [],
      ],
      [
        "never steers from the walk bar, nor explains past the slop",
        [
          at("down", 0, 100, icon),
          at("move", 50, 200, icon),
          tick(holdMs),
          at("up", 400, 200, icon),
        ],
        [],
        [],
      ],
      [
        "explains a debuff bar held still",
        [at("down", 0, 100, bar), tick(holdMs), at("up", 400, 100, bar)],
        [],
        [start("bar"), end],
      ],
      [
        "does nothing on a tap on a debuff bar",
        [at("down", 0, 100, bar), at("up", 50, 100, bar)],
        [],
        [],
      ],
      [
        "steers on a drag from a debuff bar",
        [at("down", 0, 100, bar), at("move", 50, 125, bar), at("up", 100, 125, bar)],
        [right],
        [],
      ],
      [
        "never explains the road, however long the press",
        [at("down", 0, 100, road), tick(10 * holdMs), at("up", 10 * holdMs, 100, road)],
        [left],
        [],
      ],
      [
        "ends the explanation when a card or a menu takes the press",
        [at("down", 0, 100, card), tick(holdMs), { ...at("move", 400, 100, card), held: true }],
        [],
        [start("card"), end],
      ],
      [
        "ends the explanation when the press is cancelled",
        [at("down", 0, 100, card), tick(holdMs), at("cancel", 400, 100, card)],
        [],
        [start("card"), end],
      ],
      [
        "ends the explanation when another finger presses",
        [
          at("down", 0, 100, card),
          tick(holdMs),
          at("down", 400, 100, road, 2),
          at("up", 450, 100, road, 2),
        ],
        [left],
        [start("card"), end],
      ],
    ] satisfies readonly [string, Step[], GestureAction[], ExplainChange<string>[]][]) {
      expect(play(steps)).toEqual({ actions, explained });
    }
  });
});
