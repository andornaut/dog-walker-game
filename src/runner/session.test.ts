import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { WalkerId } from "../data/types";
import type { LaneDirection } from "../layout/lanes";
import { cardFor, openCard } from "../rules/choices";
import { clampHearts, pixels, read } from "../rules/units";
import { mapPack } from "../state/pack";
import { type CardSource, newRun, type PackDogs } from "../state/runState";
import { testPack } from "../testing/packGeometry";
import { STEP_SECONDS } from "./fixedStep";
import { laneControlIn } from "./laneControl";
import { stillInLane } from "./laneMotion";
import { NO_PULLS, type Strain } from "./pulls";
import { screenRoadGeometry } from "./screenGeometry";
import {
  chooseCard,
  chooseShownCard,
  headHomeSession,
  runStreams,
  type Session,
  type SessionEvent,
  type SessionInput,
  startSession,
  stepSession,
} from "./session";
import { itemHeight, type RoadGeometry, startRoad, type WalkItem, zoneLength } from "./walk";

const SKUNK: CardSource = { affected: ["koda"], encounter: "skunk", kind: "encounter" };
const STOP: CardSource = { affected: ["koda"], encounter: "thief", kind: "encounter" };
const GEOMETRY: RoadGeometry = {
  cell: { inset: 12, length: 56 },
  itemHeights: { lucky: 20, tip: 12, treat: 12 },
  laneCount: 5,
  ...testPack(634),
  roadBottom: 640,
  roadTop: 40,
  sightLength: 514,
  tallestPackBand: 76,
  walkerFootY: 634,
};
const geometry = () => GEOMETRY;
const FIRING_SECONDS = read(gameData.tuning, "seconds", "firingHoldSeconds");

function started(seed = 1): Session {
  const run = newRun(gameData, 3, { dogs: ["koda", "biscuit"], gear: null, walker: "casey" });
  return startSession(gameData, runStreams(seed), geometry, { road: startRoad(5), run });
}

// A started walk with nothing on its road or still to come, so a step only walks.
function emptyRoad(session: Session): Session {
  const road = { ...session.walk.road, pending: [] };
  return { ...session, walk: { ...session.walk, road } };
}

const take = (count: number, random: () => number) => Array.from({ length: count }, random);
const kinds = (events: readonly SessionEvent[]) => events.map(({ kind }) => kind);

describe("runStreams", () => {
  it("names each stream from the seed, so a seed repeats them and another seed does not", () => {
    const draws = (seed: number) => {
      const { cards, forks } = runStreams(seed);
      return [take(5, cards), take(5, forks)];
    };
    expect(draws(3)).toEqual(draws(3));
    expect(draws(4)).not.toEqual(draws(3));
  });
});

describe("stepSession", () => {
  it.each<{ name: string; session: () => Session }>([
    {
      name: "a card is open",
      session: () => {
        const session = started();
        return { ...session, card: cardFor(gameData, session.walk.run, STOP) };
      },
    },
    { name: "the walk has ended", session: () => headHomeSession(started()).session },
  ])("does nothing while $name", ({ session }) => {
    const before = session();
    const lane: SessionInput = { direction: 1, kind: "lane" };
    expect(stepSession(gameData, runStreams(1), geometry, 1, [lane], before)).toEqual({
      events: [],
      session: before,
    });
  });

  it("heads home before the step, after the inputs before it and without those after it", () => {
    const before = started();
    const inputs: SessionInput[] = [
      { direction: 1, kind: "lane" },
      { kind: "home" },
      { direction: 1, kind: "lane" },
    ];
    const { events, session } = stepSession(
      gameData,
      runStreams(1),
      geometry,
      STEP_SECONDS,
      inputs,
      before,
    );

    expect(events).toEqual(
      inputs.slice(0, 2).map((input) => ({ input, kind: "input", timeMs: 0 })),
    );
    expect(session.walk.run.phase).toEqual({ kind: "ended", reason: "wentHome" });
    expect(session.walk.road.control.target).toBe(before.walk.road.control.target + 1);
    expect(session.timeMs).toBe(0);
  });

  it("walks a step: pulls, then the walk", () => {
    const { events, session } = stepSession(
      gameData,
      runStreams(1),
      geometry,
      STEP_SECONDS,
      [],
      emptyRoad(started()),
    );

    expect(kinds(events)).toEqual(["pulled", "walked"]);
    expect(session.timeMs).toBe(STEP_SECONDS * 1000);
    expect(session.walk.run.zoneDistance).toBeGreaterThan(0);
  });

  it("ends the zone, offers the fork with its upgrades, and plans the next zone once a path is chosen", () => {
    const streams = runStreams(1);
    const walked = emptyRoad(started());
    const length = zoneLength(gameData);
    const atEnd: Session = {
      ...walked,
      walk: { ...walked.walk, run: { ...walked.walk.run, zoneDistance: pixels(length - 0.01) } },
    };

    const end = stepSession(gameData, streams, geometry, STEP_SECONDS, [], atEnd);
    expect(kinds(end.events)).toEqual(["pulled", "walked", "zoneEnded", "cardOpened"]);
    expect(end.session.card?.source.kind).toBe("fork");
    expect(end.session.distanceBeforeZone).toBe(length);

    const fork = chooseCard(gameData, streams, geometry, 0, end.session);
    expect(kinds(fork.events)).toEqual(["chosen", "zonePlanned"]);
    expect(fork.session.card).toBeNull();
    expect(fork.session.walk.run.zoneIndex).toBe(1);
    expect(fork.session.walk.road.pending.length).toBeGreaterThan(0);
  });
});

describe("a strain in the session", () => {
  const SQUIRREL_LANE = 2;

  // Koda straining toward a squirrel in the middle lane, the pack still in lane.
  function straining(lane: number): Session {
    const session = emptyRoad(started());
    const squirrel: WalkItem = {
      height: 12,
      id: 0,
      kind: "squirrel",
      lane: SQUIRREL_LANE,
      laneSpan: 1,
      y: 100,
    };
    const road = {
      ...session.walk.road,
      control: laneControlIn(stillInLane(lane)),
      items: [squirrel],
      nextItemId: 1,
    };
    const strain: Strain = {
      blocked: false,
      direction: lane < SQUIRREL_LANE ? 1 : -1,
      dog: "koda",
      fromLane: lane,
      itemId: squirrel.id,
      kind: "squirrel",
      pullsLeft: 1,
      tellSeconds: 0.5,
    };
    return { ...session, pulls: { ...NO_PULLS, strain }, walk: { ...session.walk, road } };
  }

  // Every press, a key, a tap or a drag's step, reaches the session as a lane input.
  it.each<[string, number, LaneDirection, boolean]>([
    ["cancels the pull on a press toward the edge from the left edge lane", 0, -1, true],
    [
      "cancels the pull on a press toward the edge from the right edge lane",
      GEOMETRY.laneCount - 1,
      1,
      true,
    ],
    ["cancels the pull on a press away from the squirrel from a middle lane", 1, -1, true],
    ["keeps the pull on a press toward the squirrel from the left edge lane", 0, 1, false],
    [
      "keeps the pull on a press toward the squirrel from the right edge lane",
      GEOMETRY.laneCount - 1,
      -1,
      false,
    ],
  ])("%s", (_, lane, direction, cancelled) => {
    const input: SessionInput = { direction, kind: "lane" };
    const { events, session } = stepSession(
      gameData,
      runStreams(1),
      geometry,
      STEP_SECONDS,
      [input],
      straining(lane),
    );
    const failed = events.flatMap((event) => (event.kind === "pulled" ? event.step.failed : []));
    expect(session.pulls.strain === null).toBe(cancelled);
    expect(failed).toEqual(cancelled ? ["koda"] : []);
  });
});

describe("a firing in the walk", () => {
  it("holds the road, the queued cards and the zone's end for firingHoldSeconds of steps", () => {
    // Koda's owner down to 1 heart with Second chance's forgiveness used, a skunk card open on Koda,
    // a puddle queued behind it and the zone's end waiting.
    const streams = runStreams(1);
    const walk = emptyRoad(started()).walk;
    const run = {
      ...walk.run,
      heartsForgiven: 1,
      pack: mapPack(
        (slot) => (slot.dog === "koda" ? { ...slot, hearts: clampHearts(10, 1) } : slot),
        walk.run.pack,
      ),
    };
    const opened = openCard(SKUNK, run);
    const { resolution } = gameData.encounters.skunk;
    const holdNose =
      resolution.kind === "card"
        ? resolution.options.findIndex((option) =>
            option.effects.some((effect) => effect.kind === "hearts"),
          )
        : -1;
    const open: Session = {
      ...emptyRoad(started()),
      card: cardFor(gameData, opened, SKUNK),
      queue: [STOP],
      walk: { ...walk, run: opened },
      zoneEndPending: true,
    };

    const chosen = chooseCard(gameData, streams, geometry, holdNose, open);
    const [event] = chosen.events;
    expect(event?.kind === "chosen" && event.outcome.fired).toEqual(["koda"]);
    expect(kinds(chosen.events)).toEqual(["chosen"]);
    expect(chosen.session.walk.road.hitStop).toEqual({
      cards: [STOP],
      seconds: FIRING_SECONDS,
      zoneEnded: true,
    });

    let session = chosen.session;
    const frames = Math.round(FIRING_SECONDS / STEP_SECONDS);
    for (let frame = 1; frame < frames; frame++) {
      const still = stepSession(gameData, streams, geometry, STEP_SECONDS, [], session);
      expect(kinds(still.events)).toEqual(["pulled", "walked"]);
      expect(still.session.walk.run.zoneDistance).toBe(session.walk.run.zoneDistance);
      session = still.session;
    }
    const released = stepSession(gameData, streams, geometry, STEP_SECONDS, [], session);
    expect(kinds(released.events)).toEqual(["pulled", "walked", "cardOpened"]);
    expect(released.session.card?.source).toEqual(STOP);
    expect(released.session.zoneEndPending).toBe(true);
  });
});

describe("chooseShownCard", () => {
  // A press reaches a card's scene until it stops, a frame after its choice closed it.
  const shown = (source: CardSource): Session => {
    const session = emptyRoad(started());
    const run = openCard(source, session.walk.run);
    return { ...session, card: cardFor(gameData, run, source), walk: { ...session.walk, run } };
  };
  const skunk = shown(SKUNK);
  const view = skunk.card;
  if (view === null) {
    throw new Error("The skunk card did not open");
  }

  it.each([
    ["no card is open", { ...skunk, card: null }],
    ["the next card is open", shown(STOP)],
  ])("picks nothing when %s", (_, session) => {
    const step = chooseShownCard(gameData, runStreams(1), geometry, view, 0, session);
    expect(step).toEqual({ events: [], session });
  });

  it("chooses on the card it shows", () => {
    const choice = view.options.find((option) => option.availability.enabled)?.index ?? "skip";
    const step = chooseShownCard(gameData, runStreams(1), geometry, view, choice, skunk);
    expect(kinds(step.events)[0]).toBe("chosen");
    expect(step.session.card).toBeNull();
  });
});

describe("quick lane changes across a row", () => {
  // The game's road for the pack, the pack in the first lane and a row of kind in lanes, the
  // row's near edge just reaching the top of the pack's outline: the drawn pack meets the row as
  // it steers across.
  const crossing = (
    walker: WalkerId,
    dogs: PackDogs,
    kind: "cone" | "tip",
    lanes: readonly number[],
  ): Session => {
    const run = newRun(gameData, 3, { dogs, gear: null, walker });
    const session = emptyRoad(
      startSession(gameData, runStreams(1), screenRoadGeometry, { road: startRoad(5), run }),
    );
    const road = screenRoadGeometry(run);
    const height = itemHeight(gameData, road, kind);
    const items = lanes.map((lane, id) => ({
      height,
      id,
      kind,
      lane,
      laneSpan: 1,
      y: road.packBand.top - height + 1,
    }));
    const control = laneControlIn(stillInLane(0));
    return {
      ...session,
      walk: { ...session.walk, road: { ...session.walk.road, control, items } },
    };
  };

  // A tap every other step, as quick as a thumb taps, until the pack is taps lanes over, then
  // steps until the row has passed: every tip in a lane it passes is collected, and a cone in a
  // lane it passes is hit.
  it.each<[string, WalkerId, PackDogs, "cone" | "tip", number, number[]]>([
    [
      "three dogs across tips in three lanes",
      "casey",
      ["koda", "biscuit", "zippy"],
      "tip",
      3,
      [1, 2, 3],
    ],
    ["two dogs across tips in two lanes", "ada", ["duchess", "snowball"], "tip", 2, [1, 2]],
    ["one dog across tips in two lanes", "trista", ["nugget"], "tip", 2, [1, 2]],
    [
      "three dogs past a cone two lanes back",
      "casey",
      ["koda", "biscuit", "zippy"],
      "cone",
      3,
      [1],
    ],
    ["one dog past a cone a lane back", "trista", ["nugget"], "cone", 2, [1]],
  ])("meets the row in every lane it passes: %s", (_, walker, dogs, kind, taps, lanes) => {
    let session = crossing(walker, dogs, kind, lanes);
    const met: number[] = [];
    const right: SessionInput = { direction: 1, kind: "lane" };
    for (let frame = 0; frame < 90; frame++) {
      const inputs = frame % 2 === 0 && frame < taps * 2 ? [right] : [];
      const { events, session: next } = stepSession(
        gameData,
        runStreams(1),
        screenRoadGeometry,
        STEP_SECONDS,
        inputs,
        session,
      );
      for (const event of events) {
        if (event.kind === "walked") {
          const { bumps, collected } = event.step;
          met.push(...[...collected, ...bumps.map(({ item }) => item)].map(({ lane }) => lane));
        }
      }
      session = next;
    }
    expect(met).toEqual(lanes);
    expect(session.walk.road.control.motion).toEqual({ kind: "still", lane: taps });
  });
});
