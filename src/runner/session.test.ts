import { itemAt } from "@andornaut/game-kit/arrays";
import { STEP_SECONDS } from "@andornaut/game-kit/clock/fixedStep";
import { keysOf } from "@andornaut/game-kit/records";
import { pixels } from "@andornaut/game-kit/units";
import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { CardSource, WalkerId, ZoneId } from "../data/types";
import { firingTimeline } from "../hud/moments";
import type { LaneDirection } from "../layout/lanes";
import { cardFor, offerFork, openCard } from "../rules/choices";
import { firstZoneId, walkLength } from "../rules/route";
import { read } from "../rules/units";
import { mapPack } from "../state/pack";
import { newRun, type PackDogs } from "../state/runState";
import { TEST_ROAD_GEOMETRY } from "../testing/packGeometry";
import { testState } from "../testing/runState";
import { clampHearts } from "../units";
import { laneControlIn } from "./laneControl";
import { stillInLane } from "./laneMotion";
import { NO_PULLS, type Strain } from "./pulls";
import { screenRoadGeometry } from "./screenGeometry";
import {
  chooseCard,
  chooseShownCard,
  headHomeSession,
  resumeSession,
  runStreams,
  type Session,
  type SessionData,
  type SessionEvent,
  type SessionInput,
  type SessionStep,
  startSession,
  stepSession,
} from "./session";
import { itemHeight, startRoad, zoneLength } from "./walk";
import { type WalkItem } from "./walkItems";

const SKUNK: CardSource = { affected: ["kilo"], encounter: "skunk", kind: "encounter" };
const STOP: CardSource = { affected: ["kilo"], encounter: "thief", kind: "encounter" };
const geometry = () => TEST_ROAD_GEOMETRY;
const FIRING_SECONDS = read(gameData.tuning, "seconds", "firingHoldSeconds");

// The walk started on seed 1: planning its first zone of the game's road is most of a test's
// time, so every test shares the one start, which no step changes.
const STARTED = startSession(gameData, runStreams(1), geometry, {
  road: startRoad(5),
  run: newRun(gameData, 3, { dogs: ["kilo", "lady"], gear: null, walker: "casey" }),
});

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
      const { cards, forks, upgrades } = runStreams(seed);
      return [take(5, cards), take(5, forks), take(5, upgrades)];
    };
    expect(draws(3)).toEqual(draws(3));
    expect(draws(4)).not.toEqual(draws(3));
  });

  // A card's draws never shift the fork offers, so a card tuning change or another way of
  // walking keeps same-seed routes and upgrades.
  it("keeps the fork and upgrade streams apart from the card stream and each other", () => {
    const fresh = runStreams(3);
    const [cards, forks, upgrades] = [
      take(5, fresh.cards),
      take(5, fresh.forks),
      take(5, fresh.upgrades),
    ];
    const drawn = runStreams(3);
    take(50, drawn.cards);
    expect([take(5, drawn.forks), take(5, drawn.upgrades)]).toEqual([forks, upgrades]);
    expect(new Set([cards, forks, upgrades].map((draws) => JSON.stringify(draws))).size).toBe(3);
  });

  // A resumed walk's streams go on from where the saved walk's had drawn to.
  it("counts each stream's draws, and a count given takes the streams up from there", () => {
    const drawn = runStreams(3);
    take(5, drawn.cards);
    take(2, drawn.forks);
    take(3, drawn.upgrades);
    expect(drawn.draws()).toEqual({ cards: 5, forks: 2, upgrades: 3 });
    const resumed = runStreams(3, drawn.draws());
    expect([take(4, resumed.cards), take(4, resumed.forks), take(4, resumed.upgrades)]).toEqual([
      take(4, drawn.cards),
      take(4, drawn.forks),
      take(4, drawn.upgrades),
    ]);
    expect(resumed.draws()).toEqual({ cards: 9, forks: 6, upgrades: 7 });
  });
});

// A walk's forks from its seed: each fork's offer, taking the path at the seed's own index
// (seed mod the fork's paths) to the next.
function seedForks(seed: number): ForkOffer[] {
  const streams = runStreams(seed);
  const offers: ForkOffer[] = [];
  let state = testState({ kilo: 5 }, { route: [firstZoneId(gameData)] });
  while (state.route.length < walkLength(gameData)) {
    const fork = offerFork(gameData, streams, state);
    offers.push(fork);
    const index = seed % fork.paths.length;
    const upgrade = fork.upgrades[index] ?? null;
    state = {
      ...state,
      route: [...state.route, itemAt(fork.paths, index)],
      upgradesPicked: [...state.upgradesPicked, ...(upgrade === null ? [] : [upgrade])],
    };
  }
  return offers;
}

type ForkOffer = ReturnType<typeof offerFork>;

const SEEDS = Array.from({ length: 400 }, (_, index) => index + 1);
const OFFERS = new Map(SEEDS.map((seed) => [seed, seedForks(seed)]));
const offersOf = (seed: number) => OFFERS.get(seed) ?? [];

describe("a walk's forks, drawn from its seed", () => {
  it.each(SEEDS.slice(0, 40))("offers the same upgrades every time for seed %i", (seed) => {
    expect(seedForks(seed)).toEqual(offersOf(seed));
  });

  it.each(SEEDS.slice(0, 40))(
    "for seed %i, bares one path of a fork with several; the rest carry upgrades, none twice or picked, one trade-off",
    (seed) => {
      const picked = new Set<string>();
      for (const fork of offersOf(seed)) {
        const upgrades = fork.upgrades.filter((id) => id !== null);
        expect(fork.upgrades).toHaveLength(fork.paths.length);
        expect(upgrades.length).toBeGreaterThan(0);
        expect(fork.paths.length - upgrades.length).toBe(fork.paths.length > 1 ? 1 : 0);
        expect(new Set(upgrades).size).toBe(upgrades.length);
        expect(upgrades.filter((id) => picked.has(id))).toEqual([]);
        expect(
          upgrades.filter((id) => gameData.upgrades[id].kind === "tradeOff").length,
        ).toBeLessThanOrEqual(1);
        const taken = fork.upgrades[seed % fork.paths.length] ?? null;
        if (taken !== null) {
          picked.add(taken);
        }
      }
    },
  );

  it("varies with the seed", () => {
    const distinct = new Set(SEEDS.map((seed) => JSON.stringify(offersOf(seed)[0])));
    expect(distinct.size).toBeGreaterThan(SEEDS.length / 4);
  });

  it("offers every upgrade, and leaves every zone a fork offers without one, on some seed", () => {
    const forks = SEEDS.flatMap(offersOf);
    const offered = new Set(forks.flatMap(({ upgrades }) => upgrades));
    expect([...offered].sort()).toEqual([...keysOf(gameData.upgrades), null].sort());
    const bare = new Set(
      forks.flatMap(({ paths, upgrades }) => paths.filter((_, index) => upgrades[index] === null)),
    );
    const offeredZones = new Set(forks.flatMap(({ paths }) => paths));
    offeredZones.delete(gameData.world.lastZone as ZoneId);
    expect([...bare].sort()).toEqual([...offeredZones].sort());
  });

  // A fork with more than one path leaves exactly one bare, any of them; the last fork's one
  // path always carries an upgrade.
  it("leaves one path of each fork with several bare, at every position, and never the last fork's", () => {
    const forks = SEEDS.flatMap(offersOf);
    const bareAt = (upgrades: readonly unknown[]) => upgrades.indexOf(null);
    const multi = forks.filter(({ paths }) => paths.length > 1);
    expect(
      multi.filter(({ upgrades }) => upgrades.filter((id) => id === null).length !== 1),
    ).toEqual([]);
    expect(new Set(multi.map(({ upgrades }) => bareAt(upgrades)))).toEqual(new Set([0, 1, 2]));
    expect(
      forks.filter(({ paths, upgrades }) => paths.length === 1 && upgrades.includes(null)),
    ).toEqual([]);
  });
});

describe("resumeSession", () => {
  it.each<{ name: string; session: Session }>([
    { name: "mid-zone", session: STARTED },
    {
      name: "with a card open",
      session: {
        ...STARTED,
        card: cardFor(gameData, STARTED.walk.run, SKUNK),
        needsZonePlan: true,
      },
    },
    {
      name: "with the zone's end pending",
      session: { ...STARTED, needsZonePlan: true, zoneEndPending: true },
    },
  ])("refuses a walk saved $name", ({ session }) => {
    expect(() => resumeSession(gameData, runStreams(1), geometry, session)).toThrow(
      "A walk resumes only between zones or at its start",
    );
  });
});

describe("stepSession", () => {
  it("does nothing while a card is open or the walk has ended", () => {
    for (const { session } of [
      {
        name: "a card is open",
        session: () => {
          const session = STARTED;
          return { ...session, card: cardFor(gameData, session.walk.run, STOP) };
        },
      },
      { name: "the walk has ended", session: () => headHomeSession(STARTED).session },
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
    const before = STARTED;
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
      emptyRoad(STARTED),
    );

    expect(kinds(events)).toEqual(["pulled", "walked"]);
    expect(session.timeMs).toBe(STEP_SECONDS * 1000);
    expect(session.walk.run.zoneDistance).toBeGreaterThan(0);
  });

  it("ends the zone, offers the fork with its upgrades, and plans the next zone once a path is chosen", () => {
    const streams = runStreams(1);
    const walked = emptyRoad(STARTED);
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

  // Kilo straining toward a squirrel in the middle lane, the pack still in lane.
  function straining(lane: number): Session {
    const session = emptyRoad(STARTED);
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
      dog: "kilo",
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
      expect(failed).toEqual(cancelled ? ["kilo"] : []);
    }
  });
});

describe("a firing in the walk", { timeout: 60_000 }, () => {
  it("holds the road, the queued cards and the zone's end for firingHoldSeconds of steps", () => {
    // Kilo's owner down to 1 heart with Second chance's forgiveness used, a skunk card open on Kilo,
    // a puddle queued behind it and the zone's end waiting.
    const streams = runStreams(1);
    const walk = emptyRoad(STARTED).walk;
    const run = {
      ...walk.run,
      heartsForgiven: 1,
      pack: mapPack(
        (slot) => (slot.dog === "kilo" ? { ...slot, hearts: clampHearts(10, 1) } : slot),
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
      ...emptyRoad(STARTED),
      card: cardFor(gameData, opened, SKUNK),
      queue: [STOP],
      walk: { ...walk, run: opened },
      zoneEndPending: true,
    };

    const chosen = chooseCard(gameData, streams, geometry, holdNose, open);
    const [event] = chosen.events;
    expect(event?.kind === "chosen" && event.outcome.fired).toEqual(["kilo"]);
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
  // The walk with nothing to come, Kilo's owner on their last heart and the walker's
  // forgiveness used, so Kilo's next lost heart fires you while Lady walks on.
  const lastHeart = (): Session => {
    const session = emptyRoad(STARTED);
    const run = {
      ...session.walk.run,
      heartsForgiven: 1,
      pack: mapPack(
        (slot) => (slot.dog === "kilo" ? { ...slot, hearts: clampHearts(10, 1) } : slot),
        session.walk.run.pack,
      ),
    };
    return { ...session, walk: { ...session.walk, run } };
  };
  // kind in the pack's lane, its bottom just inside the pack's band, met head-on by Kilo.
  const meeting = (kind: WalkItem["kind"], session: Session): Session => {
    const item: WalkItem = { height: 12, id: 0, kind, lane: 2, laneSpan: 1, y: 560 };
    const road = { ...session.walk.road, items: [item], nextItemId: 1 };
    return { ...session, walk: { ...session.walk, road } };
  };
  // The data with encounter costing the dogs it meets a heart.
  const costing = (encounter: "friendlyNeighbour" | "puddle"): SessionData => {
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
  // The skunk card open on Kilo, chosen on its option that costs a heart.
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
      data: costing("friendlyNeighbour"),
      fire: (data, session) => walkOn(data, meeting("friendlyNeighbour", session)),
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
      expect(firedIn(fired.events)).toEqual(["kilo"]);
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
    const session = emptyRoad(STARTED);
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
  // it steers across. The road is left unplanned: a step reads only its pending spawns, and
  // there are none.
  const crossing = (
    walker: WalkerId,
    dogs: PackDogs,
    kind: "cone" | "tip",
    lanes: readonly number[],
  ): Session => {
    const run = newRun(gameData, 3, { dogs, gear: null, walker });
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
    return { ...STARTED, walk: { road: { ...startRoad(5), control, items }, run } };
  };

  // A tap every other step, as quick as a thumb taps, until the pack is taps lanes over, then
  // steps until the row has passed: every tip in a lane it passes is collected, and a cone in a
  // lane it passes is hit.
  it("meets the row in every lane it passes", () => {
    for (const [name, walker, dogs, kind, taps, lanes] of [
      [
        "three dogs across tips in three lanes",
        "casey",
        ["kilo", "lady", "pepe"],
        "tip",
        3,
        [1, 2, 3],
      ],
      ["two dogs across tips in two lanes", "ada", ["ginger", "sequoia"], "tip", 2, [1, 2]],
      ["one dog across tips in two lanes", "trista", ["reggie"], "tip", 2, [1, 2]],
      ["three dogs past a cone two lanes back", "casey", ["kilo", "lady", "pepe"], "cone", 3, [1]],
      ["one dog past a cone a lane back", "trista", ["reggie"], "cone", 2, [1]],
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
      expect(met, name).toEqual(lanes);
      expect(session.walk.road.control.motion, name).toEqual({ kind: "still", lane: taps });
    }
  });
});
