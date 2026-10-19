import { LANE_COUNT, ROAD_CAMERA, SCREEN_CONFIG } from "../data/screen";
import type {
  AchievementId,
  DogId,
  EncounterId,
  ForcedStopId,
  GameData,
  GearId,
  UpgradeId,
  ZoneId,
} from "../data/types";
import { randomStream } from "../dev/randomStreams";
import { screenLayout } from "../layout/screenLayout";
import { countBump, earnedByRun, runCountersOf } from "../rules/achievements";
import {
  applyInstantEncounter,
  cardFor,
  type ChoiceData,
  type ChoiceOutcome,
  chooseOption,
  offerFork,
  offerUpgrades,
  openCard,
} from "../rules/choices";
import { inputLockSeconds } from "../rules/dogs";
import { affectedDogs, opensCard } from "../rules/encounters";
import { minorBump } from "../rules/run";
import { giveTreat } from "../rules/treats";
import { addCents, type Cents, cents, read } from "../rules/units";
import { destinationLane } from "../runner/laneMotion";
import { hasLeftRoad, isMoverObstacle, type MoverKind, moverPlace } from "../runner/movers";
import { isNeedSpot, meetNeedAt, type NeedMoment, stepNeeds } from "../runner/needs";
import { NO_PULLS, type Pulls, stepPulls } from "../runner/pulls";
import { chance, type Random, seededRandom } from "../runner/random";
import {
  blocksLane,
  collect,
  finishZone,
  isMinorObstacle,
  laneMoveSeconds,
  planZone,
  type RoadGeometry,
  startRoad,
  stepWalk,
  type Walk,
  type WalkData,
  type WalkItemKind,
  walkScrollSpeed,
} from "../runner/walk";
import { walkGeometry, walkProjection } from "../runner/walkGeometry";
import { packDogs } from "../state/pack";
import { type CardSource, newRun, type PackDogs, type RunState } from "../state/runState";
import {
  actBot,
  type Bot,
  type BotRoad,
  newBot,
  nextBotTime,
  observePulls,
  observeRoad,
} from "./bot";
import {
  chooseCardOption,
  choosePath,
  chooseUpgrade,
  type PolicyId,
  type RoutePolicyId,
  treatTarget,
} from "./policies";
import type { Skill } from "./skills";
import { nextWalkEvent } from "./walkEvents";

export type SimData = ChoiceData &
  WalkData &
  Pick<GameData, "achievements" | "dogSlots" | "needs" | "runText" | "upgrades">;

// Who plays the walk. rates: each item spawned is met in road order, and hit or collected by
// chance, with rates from 0 to 1: hitRate for each obstacle, the others for each pickup or
// lucky encounter. skill: a steering bot plays the real walk loop, and what it hits and
// collects is measured.
export type SimPlayer =
  | {
      readonly hitRate: number;
      readonly kind: "rates";
      readonly luckyRate: number;
      readonly tipRate: number;
      readonly treatRate: number;
    }
  | { readonly kind: "skill"; readonly skill: Skill };

export interface SimConfig {
  readonly gear: GearId | null;
  readonly pack: PackDogs;
  readonly player: SimPlayer;
  readonly policy: PolicyId;
  readonly route: RoutePolicyId;
}

export const DEFAULT_RATES = { luckyRate: 0.7, tipRate: 0.7, treatRate: 0.7 } as const;

export type CardFrom = "forcedStop" | "lucky" | "need" | "obstacle";

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

// Of the items of a kind that reached the pack, met counts them all and touched those that
// touched it: an obstacle hit, or a pickup or lucky encounter collected. An obstacle passed
// during the grace after a hit counts as met, not touched.
export interface ItemCount {
  met: number;
  touched: number;
}

export type ItemCounts = Partial<Record<WalkItemKind, ItemCount>>;

// Obstacle hits, minor ones and movers included, and those of them that came while a pull's
// move, the pulling dog's input lock, AFTER_PULL_REACTION_SECONDS and a lane move back had not
// yet passed, from something not in the lane the pull moved the pack out of: hits the pull
// left the player no time to avoid.
export interface HitCounts {
  afterPull: number;
  all: number;
}

// The reaction time a hit after a pull is measured against, fixed so the measure stays
// comparable when the tuning changes.
const AFTER_PULL_REACTION_SECONDS = 0.6;

export type MoverCounts = Partial<Record<MoverKind, ItemCount>>;

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
  readonly hits: HitCounts;
  // Pulls that moved the pack.
  readonly pullsMoved: number;
  // Items that do not move, by kind, and movers, by mover.
  readonly items: ItemCounts;
  readonly movers: MoverCounts;
  // The share of choices that cost money, 0 with no choices.
  readonly moneyShare: number;
  // The zones walked, in order.
  readonly route: readonly ZoneId[];
  readonly tips: Cents;
  readonly upgrades: readonly UpgradeId[];
  readonly zones: readonly ZoneRecord[];
  readonly zonesCompleted: number;
}

// An item of a planned zone, or the zone's forced stop, at its zone distance.
type ZoneEvent =
  | {
      readonly distance: number;
      readonly item: WalkItemKind;
      readonly kind: "item";
      readonly mover: MoverKind | undefined;
    }
  | { readonly distance: number; readonly kind: "stop"; readonly stop: ForcedStopId };

function zoneEvents(walk: Walk): ZoneEvent[] {
  const { forcedStopAhead, pending } = walk.road;
  const events: ZoneEvent[] = pending.map((spawn) => ({
    distance: spawn.distance,
    item: spawn.kind,
    kind: "item",
    mover: spawn.mover?.mover,
  }));
  if (forcedStopAhead !== null) {
    events.push({ distance: forcedStopAhead.distance, kind: "stop", stop: forcedStopAhead.stop });
  }
  return events.sort((a, b) => a.distance - b.distance);
}

// The run state and everything recorded about the run so far.
interface Session {
  // The lane the last pull moved the pack out of, and the bot clock until which a hit counts
  // as coming after it.
  afterPull: { readonly fromLane: number; readonly until: number } | null;
  cardsSeen: number;
  readonly choices: ChoiceRecord[];
  readonly firings: FiringRecord[];
  readonly hits: HitCounts;
  pullsMoved: number;
  readonly items: ItemCounts;
  readonly movers: MoverCounts;
  // What the card policy draws from, kept apart from the game's and the bot's draws so the
  // policies that never draw play identical runs.
  policyRandom: Random;
  run: RunState;
  tips: Cents;
  readonly upgrades: UpgradeId[];
  readonly zones: ZoneRecord[];
}

// An item that reached the pack: under its mover if it moves, otherwise under its kind.
function countItem(
  session: Session,
  touched: boolean,
  item: { readonly kind: WalkItemKind; readonly mover: MoverKind | undefined },
): void {
  const counts: Partial<Record<string, ItemCount>> =
    item.mover === undefined ? session.items : session.movers;
  const key = item.mover ?? item.kind;
  const count = counts[key] ?? { met: 0, touched: 0 };
  count.met += 1;
  count.touched += touched ? 1 : 0;
  counts[key] = count;
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
  const choice = chooseCardOption(data, session.policyRandom, config.policy, run, card);
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
// find applies at once instead of opening a card. Returns false for a meeting that was only
// scenery.
function meet(
  data: SimData,
  random: Random,
  config: SimConfig,
  session: Session,
  from: CardFrom,
  encounter: EncounterId,
): boolean {
  const affected = affectedDogs(data, random, session.run, encounter);
  if (!opensCard(data, affected, session.run, encounter)) {
    return false;
  }
  if (data.encounters[encounter].resolution.kind === "instant") {
    const outcome = applyInstantEncounter(data, random, session.run, encounter, affected);
    recordFirings(session, session.run, outcome);
    session.run = outcome.state;
    return true;
  }
  if (from === "obstacle") {
    session.run = countBump(session.run);
  }
  playCard(data, random, config, session, from, { affected, encounter, kind: "encounter" });
  return true;
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

type Rates = Extract<SimPlayer, { readonly kind: "rates" }>;

// Plays one planned zone's items and forced stop in road order, until the zone ends or no
// dogs are left.
function playZoneByRates(
  data: SimData,
  random: Random,
  config: SimConfig,
  rates: Rates,
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
      const collected = chance(random, rates.tipRate);
      countItem(session, collected, { kind: event.item, mover: event.mover });
      if (collected) {
        const pickup = collect(data, "tip", session.run);
        session.tips = addCents(session.tips, pickup.tip?.amount ?? cents(0));
        session.run = pickup.run;
      }
    } else if (event.item === "treat") {
      const collected = chance(random, rates.treatRate);
      countItem(session, collected, { kind: event.item, mover: event.mover });
      if (collected) {
        session.run = collect(data, "treat", session.run).run;
      }
    } else if (isNeedSpot(data, event.item)) {
      // Needs do not fill here: a spot is steered into at the lucky rate, and meets the need.
      const collected = chance(random, rates.luckyRate);
      countItem(session, collected, { kind: event.item, mover: event.mover });
      if (collected) {
        const met = meetNeedAt(data, random, event.item, session.run);
        session.run = met.run;
        playNeedOutcomes(
          data,
          random,
          config,
          session,
          met.moment === null ? [] : [met.moment],
          met.card === null ? [] : [met.card],
        );
      }
    } else if (isMinorObstacle(data, event.item) || isMoverObstacle(event.item)) {
      // A minor obstacle opens no card: the pack drops tips, and its grace window starts.
      const hit = event.distance >= graceUntil && chance(random, rates.hitRate);
      countItem(session, hit, { kind: event.item, mover: event.mover });
      if (hit) {
        graceUntil = event.distance + graceDistance;
        session.run = minorBump(data, countBump(session.run)).state;
      }
    } else if (data.encounters[event.item].kind === "lucky") {
      const collected = chance(random, rates.luckyRate);
      countItem(session, collected, { kind: event.item, mover: event.mover });
      if (collected) {
        meet(data, random, config, session, "lucky", event.item);
      }
    } else {
      // A hit that opens no card is scenery: it starts no grace window.
      const hit = event.distance >= graceUntil && chance(random, rates.hitRate);
      countItem(session, hit, { kind: event.item, mover: event.mover });
      if (hit && meet(data, random, config, session, "obstacle", event.item)) {
        graceUntil = event.distance + graceDistance;
      }
    }
    if (hasEnded(session)) {
      return;
    }
    giveTreats(data, session);
  }
}

// The game's own streams, as the run screen keeps them, the bot's and the card policy's.
interface Streams {
  readonly bot: Random;
  readonly cards: Random;
  readonly forks: Random;
  readonly needs: Random;
  readonly policy: Random;
  readonly rolls: Random;
  readonly spawnSeed: number;
}

// The policy's seed is drawn last, so adding it left every other stream as it was.
function streamsFrom(random: Random): Streams {
  const seed = () => Math.floor(random() * 2 ** 32);
  const bot = seededRandom(seed());
  const cards = seededRandom(seed());
  const forks = seededRandom(seed());
  const needs = seededRandom(seed());
  const rolls = seededRandom(seed());
  const spawnSeed = seed();
  const policy = seededRandom(seed());
  return { bot, cards, forks, needs, policy, rolls, spawnSeed };
}

// Needs met or gone wrong: their outcomes' firings are recorded, and their cards are played
// in order.
function playNeedOutcomes(
  data: SimData,
  random: Random,
  config: SimConfig,
  session: Session,
  moments: readonly NeedMoment[],
  cards: readonly CardSource[],
): void {
  for (const { outcome } of moments) {
    if (outcome !== null) {
      recordFirings(session, session.run, outcome);
    }
  }
  for (const card of cards) {
    if (card.kind !== "upgradeOffer" && !hasEnded(session)) {
      playCard(data, random, config, session, cardFrom(data, card), card);
    }
  }
}

const ROAD = screenLayout(SCREEN_CONFIG).road;
const VIEW = walkProjection(ROAD_CAMERA, ROAD);
const GEOMETRIES = new Map<number, RoadGeometry>();

function geometryOf(run: RunState): RoadGeometry {
  const dogs = packDogs(run).length;
  let geometry = GEOMETRIES.get(dogs);
  if (geometry === undefined) {
    geometry = walkGeometry(LANE_COUNT, dogs, VIEW, ROAD);
    GEOMETRIES.set(dogs, geometry);
  }
  return geometry;
}

// The shortest step, so a step cut at a moment just reached still moves the walk.
const MIN_STEP_SECONDS = 1e-6;

// Counts the items that left the road in a step: those that left while still on it touched
// the pack, and the rest scrolled past it or, for a crosser, ran off its side.
function countLeaving(
  data: SimData,
  session: Session,
  geometry: RoadGeometry,
  pulledFrom: number | null,
  before: Walk,
  after: Walk,
): void {
  if (after.road.items === before.road.items) {
    return;
  }
  const travel = after.run.zoneDistance - before.run.zoneDistance;
  for (const item of before.road.items) {
    if (after.road.items.some(({ id }) => id === item.id)) {
      continue;
    }
    const { mover } = item;
    let touched: boolean;
    if (mover === undefined) {
      touched = item.y + travel < geometry.roadBottom;
      countItem(session, touched, { kind: item.kind, mover: undefined });
    } else {
      const place = moverPlace(geometry.laneCount, mover.path, mover.since + travel);
      const y = geometry.roadTop - item.height + place.travel;
      touched = !(hasLeftRoad(geometry.laneCount, place) || y >= geometry.roadBottom);
      countItem(session, touched, { kind: item.kind, mover: mover.path.mover });
    }
    if (touched && blocksLane(data, item.kind)) {
      const inFromLane =
        pulledFrom !== null && pulledFrom >= item.lane && pulledFrom < item.lane + item.laneSpan;
      session.hits.all += 1;
      session.hits.afterPull += pulledFrom !== null && !inFromLane ? 1 : 0;
    }
  }
}

// Each pull that moved the pack starts the stretch in which a hit counts as coming after it.
function notePulls(
  data: SimData,
  session: Session,
  clock: number,
  walk: Walk,
  pulled: readonly { readonly dog: DogId; readonly moved: boolean }[],
): void {
  const move = laneMoveSeconds(data, walk.run);
  for (const { dog, moved } of pulled) {
    if (moved) {
      session.pullsMoved += 1;
      const lock = inputLockSeconds(data.tuning, walk.run.modifiers, data.dogs[dog]);
      session.afterPull = {
        fromLane: destinationLane(walk.road.control.motion),
        until: clock + move + lock + AFTER_PULL_REACTION_SECONDS + move,
      };
    }
  }
}

function cardFrom(data: SimData, source: CardSource): CardFrom {
  if (source.kind === "encounter") {
    return data.encounters[source.encounter].kind === "lucky" ? "lucky" : "obstacle";
  }
  return source.kind === "need" ? "need" : "forcedStop";
}

// The bot walks the planned zone on the real walk loop, pulls and chases included, until the
// zone ends or no dogs are left. The walk is stepped from moment to moment rather than frame
// by frame: between the moments nextWalkEvent and the bot name, nothing reaches the pack
// and nothing changes its lanes, so one long step plays out as the frames would.
function playZoneBySkill(
  data: SimData,
  streams: Streams,
  config: SimConfig,
  session: Session,
  bot: Bot,
  state: { readonly pulls: Pulls; readonly walk: Walk },
): { readonly pulls: Pulls; readonly walk: Walk } {
  let { pulls, walk } = state;
  const speed = walkScrollSpeed(data, walk.run) * walk.road.speedFactor;
  bot.replan = true;
  // The geometry follows the pack, which changes only when an owner fires you.
  let road: BotRoad & { readonly pack: RunState["pack"] } = {
    data,
    geometry: geometryOf(walk.run),
    pack: walk.run.pack,
    speed,
  };
  for (;;) {
    if (walk.run.pack !== road.pack) {
      road = { data, geometry: geometryOf(walk.run), pack: walk.run.pack, speed };
    }
    observeRoad(bot, road, walk);
    walk = actBot(bot, road, pulls, walk);
    const held = walk.road.hitStop !== null;
    const seconds = Math.max(
      MIN_STEP_SECONDS,
      held
        ? nextWalkEvent(road, pulls, walk)
        : Math.min(nextWalkEvent(road, pulls, walk), nextBotTime(bot, road, walk) - bot.clock),
    );
    const pulled = stepPulls(data, road.geometry, seconds, pulls, walk);
    pulls = pulled.pulls;
    const step = stepWalk(data, road.geometry, streams.rolls, seconds, pulled.walk);
    bot.clock += seconds;
    observePulls(bot, pulled.tells, pulled.pulled);
    notePulls(data, session, bot.clock - seconds, walk, pulled.pulled);
    const { afterPull } = session;
    const pulledFrom =
      afterPull !== null && bot.clock <= afterPull.until ? afterPull.fromLane : null;
    countLeaving(data, session, road.geometry, pulledFrom, pulled.walk, step.walk);
    for (const { outcome } of step.instants) {
      recordFirings(session, pulled.walk.run, outcome);
    }
    session.tips = step.tips.reduce((sum, tip) => addCents(sum, tip.amount), session.tips);
    session.run = step.walk.run;
    for (const card of step.cards) {
      if (card.kind !== "upgradeOffer" && !hasEnded(session)) {
        playCard(data, streams.cards, config, session, cardFrom(data, card), card);
      }
    }
    const moving = !held && step.walk.road.hitStop === null;
    const spots = step.spots.flatMap(({ kind }) => (isNeedSpot(data, kind) ? [kind] : []));
    const needs = hasEnded(session)
      ? null
      : stepNeeds(data, streams.needs, seconds, moving, spots, session.run);
    if (needs !== null) {
      session.run = needs.run;
      playNeedOutcomes(data, streams.cards, config, session, needs.moments, needs.cards);
    }
    if (held || step.bumps.length > 0 || step.cards.length > 0 || (needs?.cards.length ?? 0) > 0) {
      bot.replan = true;
    }
    if (!hasEnded(session)) {
      giveTreats(data, session);
    }
    walk = { road: step.walk.road, run: session.run };
    if (hasEnded(session) || step.zoneEnded) {
      return { pulls, walk };
    }
  }
}

// A function, so a check after a call that replaced session.run is not narrowed away.
function hasEnded(session: Session): boolean {
  return session.run.phase.kind === "ended";
}

// Pays the zone's fees, then, unless that was the last zone, picks an upgrade and takes the
// route policy's path at the fork, drawn from forks.
function endZone(
  data: SimData,
  random: Random,
  forks: Random,
  config: SimConfig,
  session: Session,
): void {
  // finishZone pays the fees, then expires the zone-long debuffs and next-zone upgrades.
  const end = finishZone(data, session.run);
  session.zones.push({
    fees: end.fees.flatMap(({ amount, dog }) => (dog === null ? [] : [{ amount, dog }])),
    zoneIndex: session.run.zoneIndex,
  });
  session.run = end.run;
  if (!hasEnded(session)) {
    pickUpgrade(data, random, session);
    takeFork(data, forks, config.route, session);
  }
}

function playByRates(
  data: SimData,
  random: Random,
  config: SimConfig,
  rates: Rates,
  session: Session,
): void {
  let walk: Walk = { road: startRoad(LANE_COUNT), run: session.run };
  while (!hasEnded(session)) {
    walk = planZone(data, geometryOf(session.run), random, { ...walk, run: session.run });
    playZoneByRates(data, random, config, rates, session, walk);
    if (!hasEnded(session)) {
      endZone(data, random, random, config, session);
    }
  }
}

// Each zone is planned from its own stream, as the run screen plans it, so how the bot played
// one zone does not change the next zone's plan.
function playBySkill(
  data: SimData,
  random: Random,
  config: SimConfig,
  skill: Skill,
  session: Session,
): void {
  const streams = streamsFrom(random);
  const bot = newBot(streams.bot, skill);
  session.policyRandom = streams.policy;
  let walk: Walk = { road: startRoad(LANE_COUNT), run: session.run };
  let pulls = NO_PULLS;
  while (!hasEnded(session)) {
    const spawns = randomStream(streams.spawnSeed, `spawns-${session.run.zoneIndex}`);
    walk = planZone(data, geometryOf(session.run), spawns, { ...walk, run: session.run });
    ({ pulls, walk } = playZoneBySkill(data, streams, config, session, bot, { pulls, walk }));
    if (!hasEnded(session)) {
      endZone(data, streams.cards, streams.forks, config, session);
      walk = { ...walk, run: session.run };
    }
  }
}

// One run on the real rules: each zone planned as the game plans it, items hit, collected or
// avoided by the player, cards chosen by the policy, fees paid at each zone's end, then an
// upgrade picked and the route policy's path taken at the fork before the next zone.
// Deterministic for a given random.
export function simulateRun(data: SimData, random: Random, config: SimConfig): RunResult {
  const session: Session = {
    afterPull: null,
    cardsSeen: 0,
    choices: [],
    firings: [],
    hits: { afterPull: 0, all: 0 },
    items: {},
    movers: {},
    // A skill player's runs draw from a stream of their own instead.
    policyRandom: random,
    pullsMoved: 0,
    run: newRun(data, config.pack.length, { dogs: config.pack, gear: config.gear }),
    tips: cents(0),
    upgrades: [],
    zones: [],
  };
  const { player } = config;
  if (player.kind === "rates") {
    playByRates(data, random, config, player, session);
  } else {
    playBySkill(data, random, config, player.skill, session);
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
    hits: session.hits,
    items: session.items,
    moneyShare: session.choices.length === 0 ? 0 : paidChoices / session.choices.length,
    movers: session.movers,
    pullsMoved: session.pullsMoved,
    route: session.run.route,
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

// The fork after a zone: the route policy picks the path, which sets the next zone.
function takeFork(data: SimData, random: Random, policy: RoutePolicyId, session: Session): void {
  const source = offerFork(data, random, session.run);
  const run = openCard(source, session.run);
  const card = cardFor(data, run, source);
  const choice = choosePath(random, policy, source.paths.length);
  session.run = chooseOption(data, random, run, card, choice).state;
}
