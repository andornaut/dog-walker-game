import { clampIndex } from "@andornaut/game-kit/arrays";
import {
  chance,
  type Random,
  randomInt,
  randomPick,
  seededRandom,
} from "@andornaut/game-kit/random";
import { describe, expect, it } from "vitest";

import { walkPaused } from "../hud/topBar";
import { type ScreenConfig, screenLayout } from "../layout/screenLayout";
import {
  advanceLaneControl,
  type LaneControl,
  laneControlIn,
  pullLane,
  steerLane,
} from "../runner/laneControl";
import { destinationLane, stillInLane } from "../runner/laneMotion";
import type { GestureAction } from "./gestures";
import {
  idleTrack,
  type PointerPhase,
  type PointerTrack,
  type Press,
  type PressMode,
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
  junctionRows: 0,
  roadIntoBand: 0,
  roadWidth: 280,
  topBarHeight: 40,
  width: 360,
  zoneProgressHeight: 0,
};
const LANES = 5;
const LANE_WIDTH = 56;
// Nothing explains itself here; the hold-to-explain tests below give a context that does. Every
// tap moves the pack, which lands a press on the road's left half (x < 180) with a step left.
const context: TrackContext<string> = {
  config: { laneCount: LANES, swipeStartDistance: 20 },
  explainAt: () => undefined,
  hold: { holdMs: 300, slopPx: 20 },
  layout: screenLayout(screen),
  opensOnTap: () => false,
  stepMoves: () => true,
};
const laneConfig = { laneCount: LANES, moveDuration: 0.2 };

interface Event {
  onButton?: boolean;
  phase: PointerPhase;
  press: Press;
  presses?: PressMode;
  x: number;
  y?: number;
}

// Feeds the events in order from idle; returns every action and the last track.
function feed(events: readonly Event[]): { actions: GestureAction[]; track: PointerTrack<string> } {
  const actions: GestureAction[] = [];
  let current: PointerTrack<string> = idleTrack;
  for (const event of events) {
    const { onButton = false, phase, press, presses = "steer", x, y = 400 } = event;
    const result = trackPointer(
      context,
      presses,
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
        actions: [right],
        events: [
          { phase: "down", press: first, x: 200 },
          { phase: "move", press: first, presses: "none", x: 210 },
          { phase: "move", press: first, x: 300 },
        ],
        name: "drops the press under way while a card or the menu holds the walk",
        tracking: false,
      },
      {
        actions: [left],
        events: [
          { phase: "down", press: first, x: 100 },
          { phase: "cancel", press: first, x: 100 },
        ],
        name: "ends a cancelled press, keeping the tap it landed with",
        tracking: false,
      },
      {
        actions: [right],
        events: [
          { phase: "down", press: first, x: 300 },
          { phase: "move", press: first, x: 290 },
          { phase: "cancel", press: first, x: 0 },
        ],
        name: "ends a cancelled press without steps from where it was cancelled",
        tracking: false,
      },
      {
        actions: [right],
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
        actions: [right, right, left, left],
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
        actions: [left, right, right],
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

// Random walks over presses, losses, holds, hit stops and pulls, against the real gesture and
// lane-control logic. A hit stop drops the moves that reach it, as the walk does.
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

  // A tap moves the pack only when a lane step would, as the walk tells the gestures.
  const worldContext = (world: World): TrackContext<string> => ({
    ...context,
    stepMoves: (direction) =>
      !world.held &&
      !world.hitStop &&
      steerLane(laneConfig, direction, world.control).target !== world.control.target,
  });

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
    const result = trackPointer(
      worldContext(world),
      world.held ? "none" : "steer",
      sample,
      world.track,
    );
    world.track = result.track;
    if (phase === "down" && on !== "button" && !world.held) {
      world.latest = { downTime: press.downTime, id };
    }
    // Only the latest press acts: the press already driving it, or one that lands to drive it
    // with its tap.
    if (result.actions.length > 0) {
      expect(same(phase === "down" ? world.track.press : driver, press)).toBe(true);
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
      world.control = pullLane(laneConfig, chance(random, 0.5) ? 1 : -1, world.control);
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
          control.target >= LANES
        ) {
          broken.push(`seed ${seed} step ${i}`);
        }
      }
    }
    expect(broken).toEqual([]);
  });

  it("settles every lane change once input stops", () => {
    for (let seed = 1; seed <= 300; seed += 1) {
      const random = seededRandom(seed);
      const world = newWorld(random);
      for (let i = 0; i < 80; i += 1) {
        randomStep(world, random);
      }
      const settled = advanceLaneControl(laneConfig, 5, world.control);
      expect(settled.motion).toEqual(stillInLane(settled.target));
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

  it("taps one lane toward the pressed half from any state that allows gameplay", () => {
    for (let seed = 1; seed <= 300; seed += 1) {
      const random = seededRandom(seed);
      const world = newWorld(random);
      for (let i = 0; i < 80; i += 1) {
        randomStep(world, random);
      }
      liftAll(world, random);
      const id = randomInt(random, 0, 2);
      const x = roadX(random);
      const before = destinationLane(world.control.motion);
      world.time += 1;
      world.down.set(id, { downTime: world.time, id, x, y: 300 });
      send(world, "down", id);
      const press = world.down.get(id);
      if (press === undefined) {
        throw new Error("the press went down");
      }
      press.x += 3;
      send(world, "up", id);
      const after = advanceLaneControl(laneConfig, 5, world.control);
      expect(destinationLane(after.motion)).toBe(clampIndex(LANES, before + (x < 180 ? -1 : 1)));
    }
  });
});

// A press on the walk bar (y < 40) or a debuff bar (y 40 to 55) or a card (y 470 on) is on
// something that explains itself; a tap on a debuff bar does nothing, as on the walk bar. On the
// walk bar, x 300 on is a gear icon, which a tap opens too. A
// press at x 100 is on the left half: the road taps left as it lands, a card on release. A hold
// opens the explanation's detail card, which pauses the walk until a later press lifts.
describe("hold to explain", () => {
  const explainContext: TrackContext<string> = {
    ...context,
    explainAt: ({ x, y }) => {
      if (y < 40) {
        return x >= 300 ? "gear" : "icon";
      }
      return y < 56 ? "bar" : y >= 470 ? "card" : undefined;
    },
    opensOnTap: (target) => target === "gear",
    quietTaps: [{ height: 16, width: 360, x: 0, y: 40 }],
  };
  const { holdMs } = explainContext.hold;
  // A pointer event at a time, or a frame's tick, each under what the walk's presses do then:
  // steer when not given.
  type PointerStep = {
    at: number;
    id?: number;
    kind: PointerPhase;
    presses?: PressMode;
    x: number;
    y: number;
  };
  type Step = PointerStep | { at: number; kind: "tick"; presses?: PressMode };

  // Every action, and each change of the open explanation as "<target>@<step>" or
  // "closed@<step>", and each tap that opens one once its burst has played out as
  // "tapped <target>@<step>". The walk is paused exactly while one is open.
  function play(steps: readonly Step[]): { actions: GestureAction[]; changes: string[] } {
    const actions: GestureAction[] = [];
    const changes: string[] = [];
    let track: PointerTrack<string> = idleTrack;
    for (const step of steps) {
      const before = track.open;
      const presses = step.presses ?? "steer";
      if (step.kind === "tick") {
        track = tickTrack(explainContext, presses, step.at, track);
      } else {
        const press = finger(0, step.id ?? 1);
        const sample = { onButton: false, phase: step.kind, point: step, press, timeMs: step.at };
        const result = trackPointer(explainContext, presses, sample, track);
        track = result.track;
        actions.push(...result.actions);
        if (result.tapped !== undefined) {
          changes.push(
            `tapped ${explainContext.explainAt(result.tapped) ?? "nothing"}@${step.kind}`,
          );
        }
      }
      if (track.open !== before) {
        changes.push(`${track.open ?? "closed"}@${step.kind}`);
      }
      const hold = track.open !== undefined;
      expect(walkPaused({ card: false, hold, menu: "closed", page: "shown" })).toBe(hold);
    }
    return { actions, changes };
  }

  const at = (kind: PointerPhase, ms: number, x: number, y: number, id = 1): PointerStep => ({
    at: ms,
    id,
    kind,
    x,
    y,
  });
  const tick = (ms: number): Step => ({ at: ms, kind: "tick" });
  const card = 500;
  const icon = 20;
  const gearX = 320;
  const bar = 48;
  const road = 300;
  // A card held open, its finger lifted.
  const heldCard = [at("down", 0, 100, card), tick(holdMs), at("up", holdMs + 100, 100, card)];
  // Steps under the pause menu or the Home question, where only a hold acts.
  const underMenu = (steps: readonly Step[]): Step[] =>
    steps.map((step): Step => ({ ...step, presses: "explain" }));

  it.each<[string, Step[], GestureAction[], string[]]>([
    [
      "opens a card held still, and keeps it open after the release, which taps nothing",
      [at("down", 0, 100, card), tick(holdMs - 1), ...heldCard.slice(1)],
      [],
      ["card@tick"],
    ],
    [
      "closes it when a tap on the road lifts, which steers nothing",
      [...heldCard, at("down", 500, 100, road), tick(600), at("up", 650, 100, road)],
      [],
      ["card@tick", "closed@up"],
    ],
    [
      "closes it when a tap on the walk bar lifts, which opens nothing",
      [...heldCard, at("down", 500, 100, icon), tick(500 + holdMs), at("up", 900, 100, icon)],
      [],
      ["card@tick", "closed@up"],
    ],
    [
      "closes it when a drag lifts, which steers nothing",
      [
        ...heldCard,
        at("down", 500, 100, road),
        at("move", 550, 300, road),
        at("up", 600, 300, road),
      ],
      [],
      ["card@tick", "closed@up"],
    ],
    [
      "keeps it open when the closing press is cancelled",
      [...heldCard, at("down", 500, 100, road), at("cancel", 550, 100, road)],
      [],
      ["card@tick"],
    ],
    [
      "neither steers nor closes on the moves of the press that opened it",
      [
        at("down", 0, 100, card),
        tick(holdMs),
        at("move", 350, 200, card),
        at("up", 400, 200, card),
      ],
      [],
      ["card@tick"],
    ],
    [
      "closes it on another finger's tap, and the finger still down then steers nothing",
      [
        at("down", 0, 100, card),
        tick(holdMs),
        at("down", 400, 100, road, 2),
        at("up", 450, 100, road, 2),
        at("move", 500, 300, card),
        at("up", 550, 300, card),
      ],
      [],
      ["card@tick", "closed@up"],
    ],
    [
      "closes it when a card or a menu takes the press",
      [at("down", 0, 100, card), tick(holdMs), { ...at("move", 400, 100, card), presses: "none" }],
      [],
      ["card@tick", "closed@move"],
    ],
    [
      "opens a card held within the slop, past the tap distance",
      [at("down", 0, 100, card), at("move", 50, 115, card), tick(holdMs)],
      [],
      ["card@tick"],
    ],
    [
      "opens a card released past the hold time before a frame ticks, and steps nothing",
      [at("down", 0, 100, card), at("move", 50, 115, card), at("up", holdMs, 125, card)],
      [],
      ["card@up"],
    ],
    ["steers on a tap on a card", [at("down", 0, 100, card), at("up", 50, 101, card)], [left], []],
    [
      "steers on a drag from a card past the swipe distance, and never opens it",
      [at("down", 0, 100, card), at("move", 50, 125, card), tick(holdMs), at("up", 400, 125, card)],
      [right],
      [],
    ],
    [
      "opens an effect icon held still",
      [at("down", 0, 100, icon), tick(holdMs), at("up", 400, 100, icon)],
      [],
      ["icon@tick"],
    ],
    [
      "does nothing on a tap on an effect icon",
      [at("down", 0, 100, icon), at("up", 50, 100, icon)],
      [],
      [],
    ],
    [
      "never steers from the walk bar, nor opens past the slop",
      [at("down", 0, 100, icon), at("move", 50, 200, icon), tick(holdMs), at("up", 400, 200, icon)],
      [],
      [],
    ],
    [
      "opens a debuff bar held still",
      [at("down", 0, 100, bar), tick(holdMs), at("up", 400, 100, bar)],
      [],
      ["bar@tick"],
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
      "never opens the road, however long the press",
      [at("down", 0, 100, road), tick(10 * holdMs), at("up", 10 * holdMs, 100, road)],
      [left],
      [],
    ],
    [
      "under the menu, opens an effect icon held still, and keeps it open after the release",
      underMenu([at("down", 0, 100, icon), tick(holdMs), at("up", 400, 100, icon)]),
      [],
      ["icon@tick"],
    ],
    [
      "under the menu, closes it when a tap on the road lifts, which steers nothing",
      underMenu([...heldCard, at("down", 500, 100, road), at("up", 550, 100, road)]),
      [],
      ["card@tick", "closed@up"],
    ],
    [
      "under the menu, opens a card released past the hold time before a frame ticks",
      underMenu([at("down", 0, 100, card), at("up", holdMs, 100, card)]),
      [],
      ["card@up"],
    ],
    [
      "under the menu, does nothing on a tap on a card",
      underMenu([at("down", 0, 100, card), at("up", 50, 100, card)]),
      [],
      [],
    ],
    [
      "under the menu, opens nothing past the slop",
      underMenu([
        at("down", 0, 100, icon),
        at("move", 50, 200, icon),
        tick(holdMs),
        at("up", 400, 200, icon),
      ]),
      [],
      [],
    ],
    [
      "under the menu, never steers from the road, even when its release comes after the menu",
      [
        ...underMenu([at("down", 0, 300, road), at("move", 50, 100, road)]),
        at("up", 100, 100, road),
      ],
      [],
      [],
    ],
    [
      "taps a gear icon open",
      [at("down", 0, gearX, icon), at("up", 50, gearX, icon)],
      [],
      ["tapped gear@up"],
    ],
    [
      "opens a gear icon held still once, its release tapping nothing",
      [at("down", 0, gearX, icon), tick(holdMs), at("up", 400, gearX, icon)],
      [],
      ["gear@tick"],
    ],
    [
      "opens a gear icon released past the hold time before a frame ticks once",
      [at("down", 0, gearX, icon), at("up", holdMs, gearX, icon)],
      [],
      ["gear@up"],
    ],
    [
      "taps no gear icon open past the slop",
      [
        at("down", 0, gearX, icon),
        at("move", 20, gearX + 30, icon),
        at("up", 50, gearX + 30, icon),
      ],
      [],
      [],
    ],
    [
      "taps no gear icon open from a press that lands elsewhere on the bar",
      [at("down", 0, 100, icon), at("up", 50, gearX, icon)],
      [],
      [],
    ],
    [
      "under the menu, taps a gear icon open",
      underMenu([at("down", 0, gearX, icon), at("up", 50, gearX, icon)]),
      [],
      ["tapped gear@up"],
    ],
    [
      "closes an open explanation on a tap on a gear icon, which opens nothing",
      [...heldCard, at("down", 500, gearX, icon), at("up", 550, gearX, icon)],
      [],
      ["card@tick", "closed@up"],
    ],
    [
      "drops a hold under way when help takes the presses before its time comes",
      [at("down", 0, 100, icon), { ...tick(holdMs), presses: "none" }, tick(holdMs + 10)],
      [],
      [],
    ],
  ])("%s", (_name, steps, actions, changes) => {
    expect(play(steps)).toEqual({ actions, changes });
  });
});
