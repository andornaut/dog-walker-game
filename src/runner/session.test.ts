import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { WalkerId } from "../data/types";
import { firingTimeline } from "../hud/moments";
import type { LaneDirection } from "../layout/lanes";
import { cardFor, openCard } from "../rules/choices";
import { clampHearts, pixels, read } from "../rules/units";
import { mapPack } from "../state/pack";
import { type CardSource, newRun, type PackDogs } from "../state/runState";
import { TEST_ROAD_GEOMETRY } from "../testing/packGeometry";
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
  type SessionData,
  type SessionEvent,
  type SessionInput,
  type SessionStep,
  startSession,
  stepSession,
} from "./session";
import { itemHeight, startRoad, type WalkItem, zoneLength } from "./walk";

const SKUNK: CardSource = { affected: ["koda"], encounter: "skunk", kind: "encounter" };
const STOP: CardSource = { affected: ["koda"], encounter: "thief", kind: "encounter" };
const geometry = () => TEST_ROAD_GEOMETRY;
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

  // A card's draws never shift the fork offers, so a card tuning change keeps same-seed routes.
  it("keeps the fork stream apart from the card stream", () => {
    const [cards, forks] = [take(5, runStreams(3).cards), take(5, runStreams(3).forks)];
    const drawn = runStreams(3);
    take(50, drawn.cards);
    expect(take(5, drawn.forks)).toEqual(forks);
    expect(forks).not.toEqual(cards);
  });
});

describe("stepSession", () => {
  it("does nothing while a card is open or the walk has ended", () => {
    for (const { session } of [
      {
        name: "a card is open",
        session: () => {
          const session = started();
          return { ...session, card: cardFor(gameData, session.walk.run, STOP) };
        },
      },
      { name: "the walk has ended", session: () => headHomeSession(started()).session },
    ] satisfies readonly { name: string; session: () => Session }[]) {
      const before = session();
      const lane: SessionInput = { direction: 1, kind: "lane" };
      expect(stepSession(gameData, runStreams(1), geometry, 1, [lane], before)).toEqual({
        events: [],
        session: before,
      });
    }
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

describe("a strain in the session", { timeout: 30_000 }, () => {
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
  it("cancels a pull on a press away from the squirrel, and keeps it on one toward it", () => {
    for (const [, lane, direction, cancelled] of [
      ["cancels the pull on a press toward the edge from the left edge lane", 0, -1, true],
      [
        "cancels the pull on a press toward the edge from the right edge lane",
        TEST_ROAD_GEOMETRY.laneCount - 1,
        1,
        true,
      ],
      ["cancels the pull on a press away from the squirrel from a middle lane", 1, -1, true],
      ["keeps the pull on a press toward the squirrel from the left edge lane", 0, 1, false],
      [
        "keeps the pull on a press toward the squirrel from the right edge lane",
        TEST_ROAD_GEOMETRY.laneCount - 1,
        -1,
        false,
      ],
    ] satisfies readonly [string, number, LaneDirection, boolean][]) {
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
    }
  });
});

describe("a firing in the walk", { timeout: 60_000 }, () => {
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
      firing: true,
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

// Playing every cause of a firing through its hold takes about 6 s on a busy machine; the limit
// is four times that.
describe("a firing's hold", { timeout: 60_000 }, () => {
  const STEP_MS = STEP_SECONDS * 1000;
  const streams = runStreams(1);
  // The walk with nothing to come, Koda's owner on their last heart and the walker's
  // forgiveness used, so Koda's next lost heart fires you while Biscuit walks on.
  const lastHeart = (): Session => {
    const session = emptyRoad(started());
    const run = {
      ...session.walk.run,
      heartsForgiven: 1,
      pack: mapPack(
        (slot) => (slot.dog === "koda" ? { ...slot, hearts: clampHearts(10, 1) } : slot),
        session.walk.run.pack,
      ),
    };
    return { ...session, walk: { ...session.walk, run } };
  };
  // kind in the pack's lane, its bottom just inside the pack's band, met head-on by Koda.
  const meeting = (kind: WalkItem["kind"], session: Session): Session => {
    const item: WalkItem = { height: 12, id: 0, kind, lane: 2, laneSpan: 1, y: 560 };
    const road = { ...session.walk.road, items: [item], nextItemId: 1 };
    return { ...session, walk: { ...session.walk, road } };
  };
  // The data with encounter costing the dogs it meets a heart.
  const costing = (encounter: "pettingNeighbor" | "puddle"): SessionData => {
    const effects = [{ amount: -1, kind: "hearts", target: { kind: "affected" } }] as const;
    const shown = gameData.encounters[encounter];
    return {
      ...gameData,
      encounters: {
        ...gameData.encounters,
        [encounter]: { ...shown, resolution: { ...shown.resolution, effects } },
      },
    };
  };
  const holding = (data: SessionData, seconds: number): SessionData => ({
    ...data,
    tuning: { ...data.tuning, seconds: { ...data.tuning.seconds, firingHoldSeconds: seconds } },
  });
  const walkOn = (data: SessionData, session: Session, inputs: SessionInput[] = []) =>
    stepSession(data, streams, geometry, STEP_SECONDS, inputs, session);
  const firedIn = (events: readonly SessionEvent[]) =>
    events.flatMap((event) => {
      if (event.kind === "chosen") {
        return event.outcome.fired;
      }
      if (event.kind !== "walked") {
        return [];
      }
      const { contacts, fired, instants } = event.step;
      return [...fired, ...[...contacts, ...instants].flatMap(({ outcome }) => outcome.fired)];
    });
  // The skunk card open on Koda, chosen on its option that costs a heart.
  const chooseHoldNose = (data: SessionData, session: Session): SessionStep => {
    const run = openCard(SKUNK, session.walk.run);
    const { resolution } = gameData.encounters.skunk;
    const option =
      resolution.kind === "card"
        ? resolution.options.findIndex((o) => o.effects.some(({ kind }) => kind === "hearts"))
        : -1;
    const open = { ...session, card: cardFor(data, run, SKUNK), walk: { ...session.walk, run } };
    return chooseCard(data, streams, geometry, option, open);
  };

  const CAUSES: {
    cause: string;
    data: SessionData;
    fire: (data: SessionData, session: Session) => SessionStep;
  }[] = [
    { cause: "a card's choice", data: gameData, fire: chooseHoldNose },
    {
      cause: "a contact obstacle",
      data: costing("puddle"),
      fire: (data, session) => walkOn(data, meeting("puddle", session)),
    },
    {
      cause: "a lucky find",
      data: costing("pettingNeighbor"),
      fire: (data, session) => walkOn(data, meeting("pettingNeighbor", session)),
    },
    {
      cause: "a plain obstacle's bump",
      data: gameData,
      fire: (data, session) => walkOn(data, meeting("cone", session)),
    },
  ];
  const HOLDS = [FIRING_SECONDS, 1.5, 4.5];
  const cases = CAUSES.flatMap((cause) => HOLDS.map((seconds) => ({ ...cause, seconds })));

  it("holds the road and the pack still after any cause of a firing, for as long as the moment plays", () => {
    for (const { data: base, fire, seconds } of cases) {
      const data = holding(base, seconds);
      const fired = fire(data, lastHeart());
      expect(firedIn(fired.events)).toEqual(["koda"]);
      expect(fired.session.walk.road.hitStop?.firing).toBe(true);

      // Every step of the hold, a lane press included, leaves the run, the road, the pulls and
      // the zoomies as they were.
      const press: SessionInput = { direction: 1, kind: "lane" };
      let session = fired.session;
      let heldMs = 0;
      while (session.walk.road.hitStop !== null) {
        const next = walkOn(data, session, [press]).session;
        expect(next.walk.run).toEqual(session.walk.run);
        expect({ ...next.walk.road, hitStop: null }).toEqual({
          ...session.walk.road,
          hitStop: null,
        });
        expect([next.pulls, next.zoomiesSeconds]).toEqual([session.pulls, session.zoomiesSeconds]);
        session = next;
        heldMs += STEP_MS;
      }
      expect(Math.abs(heldMs - seconds * 1000)).toBeLessThanOrEqual(STEP_MS);
      expect(walkOn(data, session).session.walk.run.zoneDistance).toBeGreaterThan(
        session.walk.run.zoneDistance,
      );

      // The face, pop, plate and fired line fade out, and the dog trots off, as the hold ends.
      for (const still of [false, true]) {
        const timeline = firingTimeline(read(data.tuning, "seconds", "firingHoldSeconds"), still);
        const ends = [timeline.fadeAtMs + timeline.fadeMs, timeline.trotMs];
        ends.forEach((end) => expect(Math.abs(end - heldMs)).toBeLessThanOrEqual(STEP_MS));
      }
    }
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

  it("picks nothing when no card, or the next card, is open", () => {
    for (const [, session] of [
      ["no card is open", { ...skunk, card: null }],
      ["the next card is open", shown(STOP)],
    ] as const) {
      const step = chooseShownCard(gameData, runStreams(1), geometry, view, 0, session);
      expect(step).toEqual({ events: [], session });
    }
  });

  it("chooses on the card it shows", () => {
    const choice = view.options.find((option) => option.availability.enabled)?.index ?? "skip";
    const step = chooseShownCard(gameData, runStreams(1), geometry, view, choice, skunk);
    expect(kinds(step.events)[0]).toBe("chosen");
    expect(step.session.card).toBeNull();
  });
});

describe("quick lane changes across a row", { timeout: 10_000 }, () => {
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
    const height = itemHeight(gameData, road, kind, false);
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
  it("meets the row in every lane it passes", () => {
    for (const [, walker, dogs, kind, taps, lanes] of [
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
    ] satisfies readonly [string, WalkerId, PackDogs, "cone" | "tip", number, number[]][]) {
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
    }
  });
});
