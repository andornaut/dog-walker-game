import type { DebuffId, DogId } from "../data/types";
import type { LaneDirection } from "../layout/lanes";
import type { HeartChange, MoneyChange } from "../rules/causes";
import {
  type CardData,
  cardFor,
  type CardView,
  type Choice,
  type ChoiceOutcome,
  chooseOption,
  offerFork,
  offerUpgrades,
  openCard,
} from "../rules/choices";
import { currentZoneId } from "../rules/route";
import { giveTreat } from "../rules/treats";
import { read } from "../rules/units";
import type { CardSource, RunState } from "../state/runState";
import { holdForFiring } from "./firingStop";
import { isNeedSpot, type NeedData, type NeedStep, stepNeeds } from "./needs";
import { NO_PULLS, type PullData, type Pulls, type PullStep, stepPulls } from "./pulls";
import { type Random, randomStream } from "./random";
import { startStatuses, type StatusData, type StatusMark } from "./statuses";
import {
  finishZone,
  headHome,
  planZone,
  type RoadGeometry,
  steerWalk,
  stepWalk,
  type Walk,
  type WalkData,
  type WalkStep,
  zoneLength,
} from "./walk";

// One walk's step order, shared by the run scene and the simulator: the inputs, the pulls, the
// walk, the needs, the firing hold, then the queued cards, the zone's end and the next zone's
// plan. The walk stands still while a card waits for its choice.

export type SessionData = CardData & NeedData & PullData & StatusData & WalkData;

// The run's random streams, each named from the seed, so a seed replays the same walk however
// the walk is driven. Each zone is planned from a stream of its own, spawns-<zone index>.
export interface RunStreams {
  readonly cards: Random;
  readonly forks: Random;
  readonly needs: Random;
  readonly seed: number;
}

// The road's geometry for the run's pack, which changes when an owner fires you.
export type SessionGeometry = (run: RunState) => RoadGeometry;

// What a step applies before it walks, in order: a lane move, a treat for the dog in a slot
// (an empty slot takes none), or heading home, which ends the walk before the step.
export type SessionInput =
  | { readonly direction: LaneDirection; readonly kind: "lane" }
  | { readonly kind: "home" }
  | { readonly kind: "treat"; readonly slot: number };

export interface Session {
  // The card waiting for a choice.
  readonly card: CardView | null;
  // The road walked in the zones before this one.
  readonly distanceBeforeZone: number;
  // The next zone is planned once the cards after a zone's end are chosen.
  readonly needsZonePlan: boolean;
  readonly pulls: Pulls;
  // Cards still to open, in order.
  readonly queue: readonly CardSource[];
  readonly statusMarks: readonly StatusMark[];
  // Run time: the milliseconds walked, hit stops included and cards not.
  readonly timeMs: number;
  readonly walk: Walk;
  // The zone's end waits behind the queued cards.
  readonly zoneEndPending: boolean;
}

// What a step or a choice did, in order. input and chosen are stamped with the run time they
// applied at, which is where a replay applies them. needs follows walked, met on the walked
// run, with the road walked this run, zones before included. zoneEnded has the run before and
// after the zone's fees.
export type SessionEvent =
  | { readonly kind: "cardOpened"; readonly view: CardView }
  | {
      readonly choice: Choice;
      readonly kind: "chosen";
      readonly outcome: ChoiceOutcome;
      readonly timeMs: number;
      readonly view: CardView;
    }
  | { readonly input: SessionInput; readonly kind: "input"; readonly timeMs: number }
  | { readonly distance: number; readonly kind: "needs"; readonly step: NeedStep }
  | { readonly kind: "pulled"; readonly step: PullStep }
  | {
      readonly change: HeartChange;
      readonly cured: readonly DebuffId[];
      readonly dog: DogId;
      readonly kind: "treat";
    }
  | { readonly kind: "walked"; readonly step: WalkStep }
  | {
      readonly after: RunState;
      readonly before: RunState;
      readonly fees: readonly MoneyChange[];
      readonly kind: "zoneEnded";
    }
  | { readonly kind: "zonePlanned" };

export interface SessionStep {
  readonly events: readonly SessionEvent[];
  readonly session: Session;
}

export function runStreams(seed: number): RunStreams {
  return {
    cards: randomStream(seed, "cards"),
    forks: randomStream(seed, "forks"),
    needs: randomStream(seed, "needs"),
    seed,
  };
}

// A walk about to start, its first zone planned.
export function startSession(
  data: SessionData,
  streams: RunStreams,
  geometry: SessionGeometry,
  walk: Walk,
): Session {
  return {
    card: null,
    distanceBeforeZone: 0,
    needsZonePlan: false,
    pulls: NO_PULLS,
    queue: [],
    statusMarks: [],
    timeMs: 0,
    walk: planned(data, streams, geometry, walk),
    zoneEndPending: false,
  };
}

// One step of seconds: the inputs, the pulls, the walk, then the needs on the walked run, then
// the step's cards are queued and an owner who fired you holds the walk. Then the next card
// opens, or the zone ends, or the next zone is planned. Does nothing while a card is open or
// unless walking.
export function stepSession(
  data: SessionData,
  streams: RunStreams,
  geometry: SessionGeometry,
  seconds: number,
  inputs: readonly SessionInput[],
  session: Session,
): SessionStep {
  if (session.card !== null || session.walk.run.phase.kind !== "walking") {
    return { events: [], session };
  }
  const events: SessionEvent[] = [];
  let { walk } = session;
  for (const input of inputs) {
    events.push({ input, kind: "input", timeMs: session.timeMs });
    if (input.kind === "home") {
      return { events, session: { ...session, walk: { ...walk, run: headHome(walk.run) } } };
    }
    walk =
      input.kind === "lane"
        ? steerWalk(data, geometry(walk.run).laneCount, input.direction, walk)
        : treated(data, events, input.slot, walk);
  }
  const road = geometry(walk.run);
  const pulled = stepPulls(data, road, seconds, session.pulls, walk);
  events.push({ kind: "pulled", step: pulled });
  const moving = pulled.walk.road.hitStop === null;
  const step = stepWalk(data, road, streams.cards, seconds, pulled.walk);
  const spots =
    step.spots.length === 0
      ? []
      : step.spots.flatMap(({ kind }) => (isNeedSpot(data, kind) ? [kind] : []));
  const needs = stepNeeds(data, streams.needs, seconds, moving, spots, step.walk.run);
  walk = { ...step.walk, run: needs.run };
  const distance = session.distanceBeforeZone + walk.run.zoneDistance;
  events.push({ kind: "walked", step }, { distance, kind: "needs", step: needs });
  const fired =
    step.instants.length === 0 && needs.moments.length === 0
      ? []
      : [
          ...step.instants.flatMap(({ outcome }) => outcome.fired),
          ...needs.moments.flatMap(({ outcome }) => outcome?.fired ?? []),
        ];
  const walked: Session = {
    ...session,
    pulls: pulled.pulls,
    queue:
      step.cards.length === 0 && needs.cards.length === 0
        ? session.queue
        : [...session.queue, ...step.cards, ...needs.cards],
    timeMs: session.timeMs + seconds * 1000,
    walk,
    zoneEndPending: session.zoneEndPending || step.zoneEnded,
  };
  return continueWalk(data, streams, geometry, events, heldForFiring(data, fired, walked));
}

// Applies the choice on the open card, then opens the next card, or ends the zone, or plans
// the next zone. Throws with no card open.
export function chooseCard(
  data: SessionData,
  streams: RunStreams,
  geometry: SessionGeometry,
  choice: Choice,
  session: Session,
): SessionStep {
  const view = session.card;
  if (view === null) {
    throw new Error("No card is open");
  }
  const { run } = session.walk;
  const outcome = chooseOption(data, streams.cards, run, view, choice);
  const events: SessionEvent[] = [
    { choice, kind: "chosen", outcome, timeMs: session.timeMs, view },
  ];
  const at = {
    timeMs: session.timeMs,
    zone: currentZoneId(data, run),
    zoneIndex: run.zoneIndex,
  };
  const chosen: Session = {
    ...session,
    card: null,
    statusMarks: startStatuses(data, view, at, choice, session.statusMarks),
    walk: { ...session.walk, run: outcome.state },
  };
  return continueWalk(data, streams, geometry, events, heldForFiring(data, outcome.fired, chosen));
}

// Heading home keeps what was earned; it is stamped at the run time of the step it comes
// before.
export function headHomeSession(session: Session): SessionStep {
  const input: SessionInput = { kind: "home" };
  return {
    events: [{ input, kind: "input", timeMs: session.timeMs }],
    session: { ...session, walk: { ...session.walk, run: headHome(session.walk.run) } },
  };
}

function planned(
  data: SessionData,
  streams: RunStreams,
  geometry: SessionGeometry,
  walk: Walk,
): Walk {
  const spawns = randomStream(streams.seed, `spawns-${walk.run.zoneIndex}`);
  return planZone(data, geometry(walk.run), spawns, walk);
}

function treated(data: SessionData, events: SessionEvent[], slot: number, walk: Walk): Walk {
  const dog = walk.run.pack[slot]?.dog;
  if (dog === undefined) {
    return walk;
  }
  const { change, cured, state: run } = giveTreat(data, dog, walk.run);
  if (change !== null) {
    events.push({ change, cured, dog, kind: "treat" });
  }
  return { ...walk, run };
}

// An owner who just fired you holds the walk while their moment plays, as a hit stop does:
// the queued cards and the zone's end wait for it.
function heldForFiring(data: SessionData, fired: readonly DogId[], session: Session): Session {
  const { walk } = session;
  // No firing holds nothing.
  if (fired.length === 0 || walk.run.phase.kind === "ended") {
    return session;
  }
  const hold = holdForFiring(
    read(data.tuning, "seconds", "firingHoldSeconds"),
    fired,
    { cards: session.queue, zoneEnded: session.zoneEndPending },
    walk.road.hitStop,
  );
  return {
    ...session,
    queue: hold.queued.cards,
    walk: { ...walk, road: { ...walk.road, hitStop: hold.stop } },
    zoneEndPending: hold.queued.zoneEnded,
  };
}

function continueWalk(
  data: SessionData,
  streams: RunStreams,
  geometry: SessionGeometry,
  events: SessionEvent[],
  session: Session,
): SessionStep {
  const { walk } = session;
  if (walk.run.phase.kind === "ended") {
    return { events, session };
  }
  const [source, ...queue] = session.queue;
  if (source !== undefined) {
    const run = openCard(source, walk.run);
    const view = cardFor(data, run, source);
    events.push({ kind: "cardOpened", view });
    return { events, session: { ...session, card: view, queue, walk: { ...walk, run } } };
  }
  if (session.zoneEndPending) {
    return endZone(data, streams, geometry, events, { ...session, zoneEndPending: false });
  }
  if (session.needsZonePlan) {
    const next = planned(data, streams, geometry, walk);
    events.push({ kind: "zonePlanned" });
    return { events, session: { ...session, needsZonePlan: false, walk: next } };
  }
  return { events, session };
}

// Pays the zone's fees, then, unless the walk is over, queues the upgrade offer and the fork
// before the next zone is planned.
function endZone(
  data: SessionData,
  streams: RunStreams,
  geometry: SessionGeometry,
  events: SessionEvent[],
  session: Session,
): SessionStep {
  const before = session.walk.run;
  const { fees, run } = finishZone(data, before);
  events.push({ after: run, before, fees, kind: "zoneEnded" });
  const ended: Session = { ...session, walk: { ...session.walk, run } };
  if (run.phase.kind === "ended") {
    return { events, session: ended };
  }
  const offers: CardSource[] = [
    { kind: "upgradeOffer", offered: offerUpgrades(data, streams.cards, run) },
    offerFork(data, streams.forks, run),
  ];
  return continueWalk(data, streams, geometry, events, {
    ...ended,
    distanceBeforeZone: session.distanceBeforeZone + zoneLength(data, before),
    needsZonePlan: true,
    queue: [...session.queue, ...offers],
  });
}
