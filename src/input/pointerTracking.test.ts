import { describe, expect, it } from "vitest";

import { clampIndex } from "../arrays";
import { type ScreenConfig, screenLayout } from "../layout/screenLayout";
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
import { chance, type Random, randomInt, seededRandom } from "../runner/random";
import { type GestureAction, type GestureContext, reanchorDrag } from "./gestures";
import {
  idleTrack,
  type PointerPhase,
  type PointerTrack,
  type Press,
  trackPointer,
} from "./pointerTracking";

// Road x 80-360 in five 56px lanes; the top bar is y 0-40.
const screen: ScreenConfig = {
  backdropHeight: 0,
  dogColumnWidth: 80,
  dogSlotCount: 3,
  dogSlotPadding: 4,
  height: 640,
  topBarHeight: 40,
  width: 360,
};
const LANES = 5;
const LANE_WIDTH = 56;
const context: GestureContext = {
  config: { laneCount: LANES, tapMaxDistance: 10 },
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
  track: PointerTrack = idleTrack,
): { actions: GestureAction[]; track: PointerTrack } {
  const actions: GestureAction[] = [];
  let current = track;
  for (const { held = false, onButton = false, phase, press, x, y = 400 } of events) {
    const result = trackPointer(
      context,
      held,
      { onButton, phase, point: { x, y }, press },
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
  it("drives the gestures from a press it saw go down", () => {
    const press = finger(1);
    expect(
      feed([
        { phase: "down", press, x: 200 },
        { phase: "move", press, x: 257 },
        { phase: "up", press, x: 257 },
      ]),
    ).toEqual({ actions: [right], track: idleTrack });
  });

  it("drops the press under way while a card or the menu holds the walk", () => {
    const press = finger(1);
    const { actions, track } = feed([
      { phase: "down", press, x: 200 },
      { held: true, phase: "move", press, x: 210 },
      { phase: "move", press, x: 300 },
    ]);
    expect(actions).toEqual([]);
    expect(track).toEqual(idleTrack);
  });

  it("ends a cancelled press without acting: no tap, and no steps from where it was cancelled", () => {
    const tap = finger(1);
    expect(
      feed([
        { phase: "down", press: tap, x: 100 },
        { phase: "cancel", press: tap, x: 100 },
      ]),
    ).toEqual({ actions: [], track: idleTrack });
    const drag = finger(2);
    expect(
      feed([
        { phase: "down", press: drag, x: 300 },
        { phase: "move", press: drag, x: 290 },
        { phase: "cancel", press: drag, x: 0 },
      ]),
    ).toEqual({ actions: [], track: idleTrack });
  });

  it("ignores a press whose down it never saw, rather than steering it from a stale anchor", () => {
    const lost = finger(1);
    const unseen = finger(2);
    const { actions, track } = feed([
      { phase: "down", press: lost, x: 200 },
      { phase: "move", press: lost, x: 220 },
      // The release went to another scene, and so did the next press's down.
      { phase: "move", press: unseen, x: 330 },
      { phase: "up", press: unseen, x: 330 },
    ]);
    expect(actions).toEqual([]);
    expect(track).toEqual(idleTrack);
  });

  it("lets a new press take over from one whose release was lost", () => {
    const lost = finger(1, 0);
    const next = finger(2, 1);
    const { actions } = feed([
      { phase: "down", press: lost, x: 200 },
      { phase: "move", press: lost, x: 220 },
      { phase: "down", press: next, x: 300 },
      { phase: "move", press: next, x: 243 },
      { phase: "up", press: next, x: 243 },
    ]);
    expect(actions).toEqual([left]);
  });

  it("gives a press on a top-bar button no gesture", () => {
    const press = finger(1);
    expect(
      feed([
        { onButton: true, phase: "down", press, x: 190, y: 20 },
        { phase: "move", press, x: 300, y: 300 },
        { phase: "up", press, x: 300, y: 300 },
      ]),
    ).toEqual({ actions: [], track: idleTrack });
  });

  it("keeps a drag by another pointer while a top-bar button is pressed", () => {
    const drag = finger(1, 1);
    const button = finger(2, 0);
    const { actions } = feed([
      { phase: "down", press: drag, x: 200 },
      { onButton: true, phase: "down", press: button, x: 190, y: 20 },
      { phase: "up", press: button, x: 190, y: 20 },
      { phase: "move", press: drag, x: 257 },
    ]);
    expect(actions).toEqual([right]);
  });
});

// Random walks over presses, losses, holds, hit stops, pulls and locks, against the real gesture
// and lane-control logic. A hit stop and a lock drop the moves that reach them, as the walk does.
describe("trackPointer fuzz", () => {
  interface World {
    control: LaneControl;
    held: boolean;
    hitStop: boolean;
    // The pointers physically down, by id, with their press.
    down: Map<number, Press & { x: number; y: number }>;
    time: number;
    track: PointerTrack;
  }

  const roadX = (random: Random) => 80 + random() * 280;
  const anyY = (random: Random) => random() * 640;

  function apply(world: World, actions: readonly GestureAction[]): void {
    for (const action of actions) {
      if (action.kind === "move" && !world.held && !world.hitStop) {
        world.control = steerLane(laneConfig, action.direction, world.control);
      }
    }
  }

  function send(world: World, phase: PointerPhase, id: number, onButton = false): void {
    const press = world.down.get(id);
    if (press === undefined) {
      return;
    }
    const sample = { onButton, phase, point: { x: press.x, y: press.y }, press };
    const result = trackPointer(context, world.held, sample, world.track);
    world.track = result.track;
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
    const id = randomInt(random, 0, 2);
    const roll = random();
    const pressed = world.down.get(id);
    if (roll < 0.2) {
      if (pressed !== undefined) {
        send(world, "up", id);
      }
      const onButton = chance(random, 0.1);
      world.down.set(id, { downTime: world.time, id, x: roadX(random), y: anyY(random) });
      send(world, "down", id, onButton);
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
      world.control = pullLane(laneConfig, 0.5, chance(random, 0.5) ? 1 : -1, world.control);
      world.track = { ...world.track, gesture: reanchorDrag(world.track.gesture) };
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
      time: 0,
      track: idleTrack,
    };
  }

  it("keeps a press tracked only while its gesture is under way, and the lane on the road", () => {
    for (let seed = 1; seed <= 300; seed += 1) {
      const random = seededRandom(seed);
      const world = newWorld(random);
      for (let i = 0; i < 80; i += 1) {
        randomStep(world, random);
        expect(world.track.press === undefined).toBe(world.track.gesture.kind === "idle");
        expect(world.control.target).toBeGreaterThanOrEqual(0);
        expect(world.control.target).toBeLessThan(LANES);
        expect(world.control.lockSeconds).toBeGreaterThanOrEqual(0);
      }
    }
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
      expect(actions).toEqual([x < 220 ? left : right]);
    }
  });
});
