import { LANE_COUNT, ROAD_CAMERA, SCREEN_CONFIG } from "../data/screen";
import type {
  AchievementId,
  DogId,
  EncounterId,
  ForcedStopId,
  GameData,
  GearId,
  UpgradeId,
} from "../data/types";
import { screenLayout } from "../layout/screenLayout";
import { countBump, earnedByRun, runCountersOf } from "../rules/achievements";
import {
  applyInstantEncounter,
  cardFor,
  type ChoiceData,
  type ChoiceOutcome,
  chooseOption,
  offerUpgrades,
  openCard,
} from "../rules/choices";
import { affectedDogs, opensCard } from "../rules/encounters";
import { minorBump } from "../rules/run";
import { giveTreat } from "../rules/treats";
import { addCents, type Cents, cents, read } from "../rules/units";
import { chance, type Random } from "../runner/random";
import {
  collect,
  finishZone,
  isMinorObstacle,
  planZone,
  startRoad,
  type Walk,
  type WalkData,
  type WalkItemKind,
  walkScrollSpeed,
} from "../runner/walk";
import { walkGeometry, walkProjection } from "../runner/walkGeometry";
import { packDogs } from "../state/pack";
import { type CardSource, newRun, type PackDogs, type RunState } from "../state/runState";
import { chooseCardOption, chooseUpgrade, type PolicyId, treatTarget } from "./policies";

export type SimData = ChoiceData &
  WalkData &
  Pick<GameData, "achievements" | "dogSlots" | "upgrades">;

// Rates are chances from 0 to 1 per item spawned: hitRate for each obstacle, the others for
// each pickup or lucky encounter the bot steers into.
export interface SimConfig {
  readonly gear: GearId | null;
  readonly hitRate: number;
  readonly luckyRate: number;
  readonly pack: PackDogs;
  readonly policy: PolicyId;
  readonly tipRate: number;
  readonly treatRate: number;
}

export const DEFAULT_RATES = { luckyRate: 0.7, tipRate: 0.7, treatRate: 0.7 } as const;

export type CardFrom = "forcedStop" | "lucky" | "obstacle";

// One encounter or forced stop card and the option the policy took.
export interface ChoiceRecord {
  readonly cost: Cents;
  // Some enabled option cost money.
  readonly couldPay: boolean;
  readonly fired: readonly DogId[];
  readonly from: CardFrom;
  readonly option: string;
  readonly title: string;
  readonly zoneIndex: number;
}

export interface FiringRecord {
  // What the owner took back: their dog's fees, cut short if money ran out.
  readonly clawback: Cents;
  readonly dog: DogId;
  // The fees the dog had paid this run when its owner fired you.
  readonly feesEarned: Cents;
  readonly zoneIndex: number;
}

export interface ZoneRecord {
  readonly fees: readonly { readonly amount: Cents; readonly dog: DogId }[];
  readonly zoneIndex: number;
}

export interface RunResult {
  // The achievements the run earns on its own facts, whatever the profile holds.
  readonly badges: readonly AchievementId[];
  // Encounter and forced stop cards; upgrade offers are not counted.
  readonly cardsSeen: number;
  readonly choices: readonly ChoiceRecord[];
  // The money banked at the end of the run.
  readonly earnings: Cents;
  readonly finished: boolean;
  readonly firings: readonly FiringRecord[];
  // The share of choices that cost money, 0 with no choices.
  readonly moneyShare: number;
  readonly tips: Cents;
  readonly upgrades: readonly UpgradeId[];
  readonly zones: readonly ZoneRecord[];
  readonly zonesCompleted: number;
}

// An item of a planned zone, or the zone's forced stop, at its zone distance.
type ZoneEvent =
  | { readonly distance: number; readonly kind: "item"; readonly item: WalkItemKind }
  | { readonly distance: number; readonly kind: "stop"; readonly stop: ForcedStopId };

function zoneEvents(walk: Walk): ZoneEvent[] {
  const { forcedStopAhead, pending } = walk.road;
  const events: ZoneEvent[] = pending.map((spawn) => ({
    distance: spawn.distance,
    item: spawn.kind,
    kind: "item",
  }));
  if (forcedStopAhead !== null) {
    events.push({ distance: forcedStopAhead.distance, kind: "stop", stop: forcedStopAhead.stop });
  }
  return events.sort((a, b) => a.distance - b.distance);
}

// The run state and everything recorded about the run so far.
interface Session {
  cardsSeen: number;
  readonly choices: ChoiceRecord[];
  readonly firings: FiringRecord[];
  run: RunState;
  tips: Cents;
  readonly upgrades: UpgradeId[];
  readonly zones: ZoneRecord[];
}

function recordFirings(session: Session, before: RunState, outcome: ChoiceOutcome): void {
  for (const dog of outcome.fired) {
    const taken = outcome.moneyChanges
      .filter((change) => change.dog === dog)
      .reduce((sum, change) => sum - change.amount, 0);
    session.firings.push({
      clawback: cents(taken),
      dog,
      feesEarned: before.feesEarned[dog] ?? cents(0),
      zoneIndex: before.zoneIndex,
    });
  }
}

function playCard(
  data: SimData,
  random: Random,
  config: SimConfig,
  session: Session,
  from: CardFrom,
  source: Exclude<CardSource, { readonly kind: "upgradeOffer" }>,
): void {
  const run = openCard(source, session.run);
  const card = cardFor(data, run, source);
  const choice = chooseCardOption(data, config.policy, run, card);
  const option = card.options.find(({ index }) => index === choice);
  const outcome = chooseOption(data, random, run, card, choice);
  session.cardsSeen += 1;
  session.choices.push({
    cost: option?.cost ?? cents(0),
    couldPay: card.options.some((view) => view.availability.enabled && view.cost > 0),
    fired: outcome.fired,
    from,
    option: option?.label ?? "Skip",
    title: card.title,
    zoneIndex: run.zoneIndex,
  });
  recordFirings(session, run, outcome);
  session.run = outcome.state;
}

// The pack meets an encounter: nothing happens unless it affects a dog, and an instant lucky
// find applies at once instead of opening a card.
function meet(
  data: SimData,
  random: Random,
  config: SimConfig,
  session: Session,
  from: CardFrom,
  encounter: EncounterId,
): void {
  const affected = affectedDogs(data, random, session.run, encounter);
  if (!opensCard(data, affected, session.run, encounter)) {
    return;
  }
  if (data.encounters[encounter].resolution.kind === "instant") {
    const outcome = applyInstantEncounter(data, random, session.run, encounter, affected);
    recordFirings(session, session.run, outcome);
    session.run = outcome.state;
    return;
  }
  playCard(data, random, config, session, from, { affected, encounter, kind: "encounter" });
}

function giveTreats(data: SimData, session: Session): void {
  while (session.run.treats > 0) {
    const dog = treatTarget(data, session.run);
    if (dog === undefined) {
      return;
    }
    session.run = giveTreat(data, dog, session.run).state;
  }
}

// Plays one planned zone's items and forced stop in road order, until the zone ends or no
// dogs are left.
function playZone(
  data: SimData,
  random: Random,
  config: SimConfig,
  session: Session,
  walk: Walk,
): void {
  // After an obstacle hit, obstacles are ignored for the grace window: modelled as the road
  // distance the zone's speed covers in that time.
  const graceDistance =
    read(data.tuning, "seconds", "collisionGrace") * walkScrollSpeed(data, session.run);
  let graceUntil = -Infinity;
  for (const event of zoneEvents(walk)) {
    if (event.kind === "stop") {
      playCard(data, random, config, session, "forcedStop", {
        kind: "forcedStop",
        stop: event.stop,
      });
    } else if (event.item === "tip") {
      if (chance(random, config.tipRate)) {
        const pickup = collect(data, "tip", session.run);
        session.tips = addCents(session.tips, pickup.tip?.amount ?? cents(0));
        session.run = pickup.run;
      }
    } else if (event.item === "treat") {
      if (chance(random, config.treatRate)) {
        session.run = collect(data, "treat", session.run).run;
      }
    } else if (isMinorObstacle(data, event.item)) {
      // A minor obstacle opens no card: the pack drops tips, and its grace window starts.
      if (event.distance >= graceUntil && chance(random, config.hitRate)) {
        graceUntil = event.distance + graceDistance;
        session.run = minorBump(data, countBump(session.run)).state;
      }
    } else if (data.encounters[event.item].kind === "lucky") {
      if (chance(random, config.luckyRate)) {
        meet(data, random, config, session, "lucky", event.item);
      }
    } else if (event.distance >= graceUntil && chance(random, config.hitRate)) {
      graceUntil = event.distance + graceDistance;
      session.run = countBump(session.run);
      meet(data, random, config, session, "obstacle", event.item);
    }
    if (hasEnded(session)) {
      return;
    }
    giveTreats(data, session);
  }
}

// A function, so a check after a call that replaced session.run is not narrowed away.
function hasEnded(session: Session): boolean {
  return session.run.phase.kind === "ended";
}

// One run on the real rules: each zone planned as the game plans it, every item collected,
// hit or avoided by the config's rates, cards chosen by the policy, fees paid at each zone's
// end, then an upgrade picked before the next zone. Deterministic for a given random.
export function simulateRun(data: SimData, random: Random, config: SimConfig): RunResult {
  const road = screenLayout(SCREEN_CONFIG).road;
  const view = walkProjection(ROAD_CAMERA, road);
  const session: Session = {
    cardsSeen: 0,
    choices: [],
    firings: [],
    run: newRun(data, config.pack.length, { dogs: config.pack, gear: config.gear }),
    tips: cents(0),
    upgrades: [],
    zones: [],
  };
  let walk: Walk = { road: startRoad(LANE_COUNT), run: session.run };
  while (!hasEnded(session)) {
    const geometry = walkGeometry(LANE_COUNT, packDogs(session.run).length, view, road);
    walk = planZone(data, geometry, random, { ...walk, run: session.run });
    playZone(data, random, config, session, walk);
    if (hasEnded(session)) {
      break;
    }
    // finishZone pays the fees, then expires the zone-long debuffs and next-zone upgrades.
    const end = finishZone(data, session.run);
    session.zones.push({
      fees: end.fees.flatMap(({ amount, dog }) => (dog === null ? [] : [{ amount, dog }])),
      zoneIndex: session.run.zoneIndex,
    });
    session.run = end.run;
    if (!hasEnded(session)) {
      pickUpgrade(data, random, session);
    }
  }
  const paidChoices = session.choices.filter((choice) => choice.cost > 0).length;
  const facts = {
    ...runCountersOf(session.run),
    earnedCents: session.run.money,
    packSize: config.pack.length,
    zonesFinished: session.zones.length,
  };
  return {
    badges: earnedByRun(data, facts),
    cardsSeen: session.cardsSeen,
    choices: session.choices,
    earnings: session.run.money,
    finished: session.run.phase.kind === "ended" && session.run.phase.reason === "finished",
    firings: session.firings,
    moneyShare: session.choices.length === 0 ? 0 : paidChoices / session.choices.length,
    tips: session.tips,
    upgrades: session.upgrades,
    zones: session.zones,
    zonesCompleted: session.zones.length,
  };
}

function pickUpgrade(data: SimData, random: Random, session: Session): void {
  const source = {
    kind: "upgradeOffer",
    offered: offerUpgrades(data, random, session.run),
  } as const;
  const run = openCard(source, session.run);
  const card = cardFor(data, run, source);
  const choice = chooseUpgrade(data, run, card);
  const picked = typeof choice === "number" ? source.offered[choice] : undefined;
  if (picked !== undefined) {
    session.upgrades.push(picked);
  }
  session.run = chooseOption(data, random, run, card, choice).state;
}
