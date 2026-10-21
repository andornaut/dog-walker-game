import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { cardFor, openCard } from "../rules/choices";
import { clampHearts, pixels, read } from "../rules/units";
import { mapPack } from "../state/pack";
import { type CardSource, newRun } from "../state/runState";
import { STEP_SECONDS } from "./fixedStep";
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
import { type RoadGeometry, startRoad, zoneLength } from "./walk";

const SKUNK: CardSource = { affected: ["koda"], encounter: "skunk", kind: "encounter" };
const STOP: CardSource = { affected: ["koda"], encounter: "thief", kind: "encounter" };
const GEOMETRY: RoadGeometry = {
  cell: { inset: 12, length: 56 },
  itemHeights: { lucky: 20, tip: 12, treat: 12 },
  laneCount: 5,
  packBand: { bottom: 630, top: 554 },
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

describe("a firing in the walk", () => {
  it("holds the road, the queued cards and the zone's end for firingHoldSeconds of steps", () => {
    // Koda's owner down to 1 heart with Kind words' forgiveness used, a skunk card open on Koda,
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
