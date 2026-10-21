import { LANE_COUNT } from "../data/screen";
import type {
  AchievementId,
  DogId,
  EncounterId,
  ForcedStopId,
  GameData,
  GearId,
  UpgradeId,
  WalkerId,
  ZoneId,
} from "../data/types";
import type { InputEvent } from "../dev/inputLog";
import { countBump, earnedByRun, runCountersOf } from "../rules/achievements";
import {
  applyInstantEncounter,
  cardFor,
  type CardView,
  type Choice,
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
import { STEP_SECONDS } from "../runner/fixedStep";
import { destinationLane } from "../runner/laneMotion";
import { hasLeftRoad, moverPlace } from "../runner/movers";
import { isNeedSpot, meetNeedAt, type NeedMoment } from "../runner/needs";
import { chance, type Random, randomStream, seededRandom } from "../runner/random";
import { screenRoadGeometry } from "../runner/screenGeometry";
import {
  chooseCard,
  runStreams,
  type SessionEvent,
  type SessionInput,
  type SessionStep,
  startSession,
  stepSession,
} from "../runner/session";
import {
  blocksLane,
  collect,
  finishZone,
  isMinorObstacle,
  laneMoveSeconds,
  planZone,
  type RoadGeometry,
  startRoad,
  type Walk,
  type WalkData,
  type WalkItemKind,
  walkScrollSpeed,
} from "../runner/walk";
import { type CardSource, newRun, type PackDogs, type RunState } from "../state/runState";
import { actBot, type BotRoad, newBot, observePulls, observeRoad } from "./bot";
import {
  chooseCardOption,
  choosePath,
  chooseUpgrade,
  type PolicyId,
  type RoutePolicyId,
  treatTarget,
} from "./policies";
import type { Skill } from "./skills";

export type SimData = ChoiceData &
  WalkData &
  Pick<
    GameData,
    | "achievements"
    | "defaultWalker"
    | "dogSlots"
    | "needs"
    | "runText"
    | "upgrades"
    | "walkerPaces"
    | "walkerStyles"
  >;

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
  readonly walker: WalkerId;
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
  readonly dog: DogId;
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

// Movers are counted by the kind they meet the pack as.
export type MoverCounts = Partial<Record<WalkItemKind, ItemCount>>;

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
  // A skill player's inputs, as the game logs them: with the seed, a replay of the run.
  readonly inputs: readonly InputEvent[];
  // Pulls that moved the pack.
  readonly pullsMoved: number;
  // Items that do not move, by kind, and movers, by mover.
  readonly items: ItemCounts;
  readonly movers: MoverCounts;
  // The share of choices that cost money, 0 with no choices.
  readonly moneyShare: number;
  // The zones walked, in order.
  readonly route: readonly ZoneId[];
  // The run as it ended.
  readonly run: RunState;
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
      readonly moving: boolean;
    }
  | { readonly distance: number; readonly kind: "stop"; readonly stop: ForcedStopId };

function zoneEvents(walk: Walk): ZoneEvent[] {
  const { forcedStopAhead, pending } = walk.road;
  const events: ZoneEvent[] = pending.map((spawn) => ({
    distance: spawn.distance,
    item: spawn.kind,
    kind: "item",
    moving: spawn.mover !== undefined,
  }));
  if (forcedStopAhead !== null) {
    events.push({ distance: forcedStopAhead.distance, kind: "stop", stop: forcedStopAhead.stop });
  }
  return events.sort((a, b) => a.distance - b.distance);
}

// The run state and everything recorded about the run so far.
interface Tally {
  // The lane the last pull moved the pack out of, and the bot clock until which a hit counts
  // as coming after it.
  afterPull: { readonly fromLane: number; readonly until: number } | null;
  cardsSeen: number;
  readonly choices: ChoiceRecord[];
  readonly firings: FiringRecord[];
  readonly hits: HitCounts;
  readonly inputs: InputEvent[];
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
  tally: Tally,
  touched: boolean,
  item: { readonly kind: WalkItemKind; readonly moving: boolean },
): void {
  const counts: Partial<Record<string, ItemCount>> = item.moving ? tally.movers : tally.items;
  const key = item.kind;
  const count = counts[key] ?? { met: 0, touched: 0 };
  count.met += 1;
  count.touched += touched ? 1 : 0;
  counts[key] = count;
}

function recordFirings(tally: Tally, before: RunState, outcome: ChoiceOutcome): void {
  for (const dog of outcome.fired) {
    tally.firings.push({ dog, zoneIndex: before.zoneIndex });
  }
}

function playCard(
  data: SimData,
  random: Random,
  config: SimConfig,
  tally: Tally,
  from: CardFrom,
  source: Exclude<CardSource, { readonly kind: "upgradeOffer" }>,
): void {
  const run = openCard(source, tally.run);
  const card = cardFor(data, run, source);
  const choice = chooseCardOption(data, tally.policyRandom, config.policy, run, card);
  const option = card.options.find(({ index }) => index === choice);
  const outcome = chooseOption(data, random, run, card, choice);
  tally.cardsSeen += 1;
  tally.choices.push({
    cost: option?.cost ?? cents(0),
    couldPay: card.options.some((view) => view.availability.enabled && view.cost > 0),
    fired: outcome.fired,
    from,
    option: option?.label ?? "Skip",
    title: card.title,
    zoneIndex: run.zoneIndex,
  });
  recordFirings(tally, run, outcome);
  tally.run = outcome.state;
}

// The pack meets an encounter: nothing happens unless it affects a dog, and an instant lucky
// find applies at once instead of opening a card. Returns false for a meeting that was only
// scenery.
function meet(
  data: SimData,
  random: Random,
  config: SimConfig,
  tally: Tally,
  from: CardFrom,
  encounter: EncounterId,
): boolean {
  const affected = affectedDogs(data, tally.run, encounter);
  if (!opensCard(data, affected, tally.run, encounter)) {
    return false;
  }
  if (data.encounters[encounter].resolution.kind === "instant") {
    const outcome = applyInstantEncounter(data, random, tally.run, encounter, affected);
    recordFirings(tally, tally.run, outcome);
    tally.run = outcome.state;
    return true;
  }
  if (from === "obstacle") {
    tally.run = countBump(tally.run);
  }
  playCard(data, random, config, tally, from, { affected, encounter, kind: "encounter" });
  return true;
}

function giveTreats(data: SimData, tally: Tally): void {
  while (tally.run.treats > 0) {
    const dog = treatTarget(data, tally.run);
    if (dog === undefined) {
      return;
    }
    tally.run = giveTreat(data, dog, tally.run).state;
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
  tally: Tally,
  walk: Walk,
): void {
  // After an obstacle hit, obstacles are ignored for the grace window: modelled as the road
  // distance the zone's speed covers in that time.
  const graceDistance =
    read(data.tuning, "seconds", "collisionGrace") * walkScrollSpeed(data, tally.run);
  let graceUntil = -Infinity;
  for (const event of zoneEvents(walk)) {
    if (event.kind === "stop") {
      playCard(data, random, config, tally, "forcedStop", {
        kind: "forcedStop",
        stop: event.stop,
      });
    } else if (event.item === "tip") {
      const collected = chance(random, rates.tipRate);
      countItem(tally, collected, { kind: event.item, moving: event.moving });
      if (collected) {
        const pickup = collect(data, "tip", tally.run);
        tally.tips = addCents(tally.tips, pickup.tip?.amount ?? cents(0));
        tally.run = pickup.run;
      }
    } else if (event.item === "treat") {
      const collected = chance(random, rates.treatRate);
      countItem(tally, collected, { kind: event.item, moving: event.moving });
      if (collected) {
        tally.run = collect(data, "treat", tally.run).run;
      }
    } else if (isNeedSpot(data, event.item)) {
      // Needs do not fill here: a spot is steered into at the lucky rate, and meets the need.
      const collected = chance(random, rates.luckyRate);
      countItem(tally, collected, { kind: event.item, moving: event.moving });
      if (collected) {
        const met = meetNeedAt(data, random, event.item, tally.run);
        tally.run = met.run;
        playNeedOutcomes(
          data,
          random,
          config,
          tally,
          met.moment === null ? [] : [met.moment],
          met.card === null ? [] : [met.card],
        );
      }
    } else if (isMinorObstacle(data, event.item)) {
      // A minor obstacle opens no card: the pack drops tips, and its grace window starts.
      const hit = event.distance >= graceUntil && chance(random, rates.hitRate);
      countItem(tally, hit, { kind: event.item, moving: event.moving });
      if (hit) {
        graceUntil = event.distance + graceDistance;
        tally.run = minorBump(data, countBump(tally.run)).state;
      }
    } else if (data.encounters[event.item].kind === "lucky") {
      const collected = chance(random, rates.luckyRate);
      countItem(tally, collected, { kind: event.item, moving: event.moving });
      if (collected) {
        meet(data, random, config, tally, "lucky", event.item);
      }
    } else {
      // A hit that opens no card is scenery: it starts no grace window.
      const hit = event.distance >= graceUntil && chance(random, rates.hitRate);
      countItem(tally, hit, { kind: event.item, moving: event.moving });
      if (hit && meet(data, random, config, tally, "obstacle", event.item)) {
        graceUntil = event.distance + graceDistance;
      }
    }
    if (hasEnded(tally)) {
      return;
    }
    giveTreats(data, tally);
  }
}

// Needs met or gone wrong: their outcomes' firings are recorded, and their cards are played
// in order.
function playNeedOutcomes(
  data: SimData,
  random: Random,
  config: SimConfig,
  tally: Tally,
  moments: readonly NeedMoment[],
  cards: readonly CardSource[],
): void {
  for (const { outcome } of moments) {
    if (outcome !== null) {
      recordFirings(tally, tally.run, outcome);
    }
  }
  for (const card of cards) {
    if (card.kind !== "upgradeOffer" && !hasEnded(tally)) {
      playCard(data, random, config, tally, cardFrom(data, card), card);
    }
  }
}

// Counts the items that left the road in a step: those that left while still on it touched
// the pack, and the rest scrolled past it or, for a crosser, ran off its side.
function countLeaving(
  data: SimData,
  tally: Tally,
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
      countItem(tally, touched, { kind: item.kind, moving: false });
    } else {
      const place = moverPlace(geometry.laneCount, mover.path, mover.since + travel);
      const y = geometry.roadTop - item.height + place.travel;
      touched = !(hasLeftRoad(geometry.laneCount, place) || y >= geometry.roadBottom);
      countItem(tally, touched, { kind: item.kind, moving: true });
    }
    if (touched && blocksLane(data, item.kind)) {
      const inFromLane =
        pulledFrom !== null && pulledFrom >= item.lane && pulledFrom < item.lane + item.laneSpan;
      tally.hits.all += 1;
      tally.hits.afterPull += pulledFrom !== null && !inFromLane ? 1 : 0;
    }
  }
}

// Each pull that moved the pack starts the stretch in which a hit counts as coming after it.
function notePulls(
  data: SimData,
  tally: Tally,
  clock: number,
  walk: Walk,
  pulled: readonly { readonly dog: DogId; readonly moved: boolean }[],
): void {
  const move = laneMoveSeconds(data, walk.run);
  for (const { dog, moved } of pulled) {
    if (moved) {
      tally.pullsMoved += 1;
      const lock = inputLockSeconds(data.tuning, walk.run.modifiers, data.dogs[dog]);
      tally.afterPull = {
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

// A function, so a check after a call that replaced tally.run is not narrowed away.
function hasEnded(tally: Tally): boolean {
  return tally.run.phase.kind === "ended";
}

// Pays the zone's fees, then, unless that was the last zone, picks an upgrade and takes the
// route policy's path at the fork, drawn from forks.
function endZone(
  data: SimData,
  random: Random,
  forks: Random,
  config: SimConfig,
  tally: Tally,
): void {
  // finishZone pays the fees, then expires the zone-long debuffs and next-zone upgrades.
  const end = finishZone(data, tally.run);
  tally.zones.push({
    fees: end.fees.flatMap(({ amount, dog }) => (dog === null ? [] : [{ amount, dog }])),
    zoneIndex: tally.run.zoneIndex,
  });
  tally.run = end.run;
  if (!hasEnded(tally)) {
    pickUpgrade(data, random, tally);
    takeFork(data, forks, config.route, tally);
  }
}

function playByRates(
  data: SimData,
  random: Random,
  config: SimConfig,
  rates: Rates,
  tally: Tally,
): void {
  let walk: Walk = { road: startRoad(LANE_COUNT), run: tally.run };
  while (!hasEnded(tally)) {
    walk = planZone(data, screenRoadGeometry(tally.run), random, { ...walk, run: tally.run });
    playZoneByRates(data, random, config, rates, tally, walk);
    if (!hasEnded(tally)) {
      endZone(data, random, random, config, tally);
    }
  }
}

// The policies' choice on the open card: the route policy's path at a fork, the upgrade policy's
// pick, or the card policy's option.
function policyChoice(
  data: SimData,
  config: SimConfig,
  tally: Tally,
  run: RunState,
  card: CardView,
): Choice {
  const { source } = card;
  if (source.kind === "fork") {
    return choosePath(tally.policyRandom, config.route, source.paths.length);
  }
  if (source.kind === "upgradeOffer") {
    return chooseUpgrade(data, run, card);
  }
  return chooseCardOption(data, tally.policyRandom, config.policy, run, card);
}

// A choice's record: an upgrade picked, or an encounter, forced stop or need card seen, and
// the firings it brought about.
function noteChoice(
  data: SimData,
  tally: Tally,
  run: RunState,
  event: Extract<SessionEvent, { kind: "chosen" }>,
): void {
  const { choice, outcome, view } = event;
  const { source } = view;
  recordFirings(tally, run, outcome);
  if (source.kind === "upgradeOffer") {
    const picked = typeof choice === "number" ? source.offered[choice] : undefined;
    if (picked !== undefined) {
      tally.upgrades.push(picked);
    }
    return;
  }
  if (source.kind === "fork") {
    return;
  }
  const option = view.options.find(({ index }) => index === choice);
  tally.cardsSeen += 1;
  tally.choices.push({
    cost: option?.cost ?? cents(0),
    couldPay: view.options.some((option) => option.availability.enabled && option.cost > 0),
    fired: outcome.fired,
    from: cardFrom(data, source),
    option: option?.label ?? "Skip",
    title: view.title,
    zoneIndex: run.zoneIndex,
  });
}

// What the bot reads of the road: its geometry for the pack and the zone's scroll speed.
function botRoadOf(data: SimData, walk: Walk): BotRoad & { readonly pack: RunState["pack"] } {
  const speed = walkScrollSpeed(data, walk.run) * walk.road.speedFactor;
  return { data, geometry: screenRoadGeometry(walk.run), pack: walk.run.pack, speed };
}

// A treat for the dog furthest below its owner's max hearts, while one is carried.
function treatInputs(data: SimData, run: RunState): SessionInput[] {
  const dog = run.treats > 0 ? treatTarget(data, run) : undefined;
  const slot = run.pack.findIndex((member) => member.dog === dog);
  return dog === undefined || slot < 0 ? [] : [{ kind: "treat", slot }];
}

// The bot plays the walk on the game's own session, a step of STEP_SECONDS at a time as the
// game steps it: its lane moves and treats are the steps' inputs, and the policies choose each
// card as it opens. The inputs are logged as the game logs them, so the run's seed and log
// replay it in the game.
function playBySkill(
  data: SimData,
  seed: number,
  config: SimConfig,
  skill: Skill,
  tally: Tally,
): void {
  const streams = runStreams(seed);
  const bot = newBot(randomStream(seed, "bot"), skill);
  tally.policyRandom = randomStream(seed, "policy");
  const start = { road: startRoad(LANE_COUNT), run: tally.run };
  let session = startSession(data, streams, screenRoadGeometry, start);
  let road = botRoadOf(data, session.walk);
  bot.replan = true;
  while (session.walk.run.phase.kind !== "ended") {
    const { card, walk } = session;
    const clock = bot.clock;
    let acted = walk;
    let step: SessionStep;
    if (card === null) {
      if (walk.run.pack !== road.pack) {
        road = botRoadOf(data, walk);
      }
      observeRoad(bot, road, walk);
      const action = actBot(bot, road, session.pulls, walk);
      const lanes = action.lanes.map((direction): SessionInput => ({ direction, kind: "lane" }));
      const inputs = [...lanes, ...treatInputs(data, walk.run)];
      step = stepSession(data, streams, screenRoadGeometry, STEP_SECONDS, inputs, session);
      bot.clock += STEP_SECONDS;
      acted = action.walk;
      if (walk.road.hitStop !== null) {
        bot.replan = true;
      }
    } else {
      const choice = policyChoice(data, config, tally, walk.run, card);
      step = chooseCard(data, streams, screenRoadGeometry, choice, session);
      bot.replan = true;
    }
    let pulledWalk = acted;
    for (const event of step.events) {
      switch (event.kind) {
        case "cardOpened":
          bot.replan = true;
          break;
        case "chosen":
          noteChoice(data, tally, walk.run, event);
          tally.inputs.push({ choice: event.choice, kind: "card", timeMs: event.timeMs });
          break;
        case "input":
          tally.inputs.push({ ...event.input, timeMs: event.timeMs });
          break;
        case "needs":
          for (const { outcome } of event.step.moments) {
            if (outcome !== null) {
              recordFirings(tally, pulledWalk.run, outcome);
            }
          }
          break;
        case "pulled":
          observePulls(bot, event.step.tells, event.step.pulled);
          notePulls(data, tally, clock, acted, event.step.pulled);
          pulledWalk = event.step.walk;
          break;
        case "walked": {
          const { afterPull } = tally;
          const pulledFrom =
            afterPull !== null && bot.clock <= afterPull.until ? afterPull.fromLane : null;
          countLeaving(data, tally, road.geometry, pulledFrom, pulledWalk, event.step.walk);
          for (const { outcome } of event.step.instants) {
            recordFirings(tally, pulledWalk.run, outcome);
          }
          tally.tips = event.step.tips.reduce((sum, tip) => addCents(sum, tip.amount), tally.tips);
          if (event.step.bumps.length > 0) {
            bot.replan = true;
          }
          break;
        }
        case "zoneEnded":
          tally.zones.push({
            fees: event.fees.flatMap(({ amount, dog }) => (dog === null ? [] : [{ amount, dog }])),
            zoneIndex: event.before.zoneIndex,
          });
          break;
        case "zonePlanned":
          road = botRoadOf(data, step.session.walk);
          bot.replan = true;
          break;
        case "treat":
          break;
      }
    }
    session = step.session;
  }
  tally.run = session.walk.run;
}

// One run on the real rules: each zone planned as the game plans it, items hit, collected or
// avoided by the player, cards chosen by the policy, fees paid at each zone's end, then an
// upgrade picked and the route policy's path taken at the fork before the next zone.
// Deterministic for a given seed. A skill player's run draws from the game's named streams
// (runStreams) and the bot's and policies' own, so its seed and inputs replay it in the game.
export function simulateRun(data: SimData, seed: number, config: SimConfig): RunResult {
  const random = seededRandom(seed);
  const tally: Tally = {
    afterPull: null,
    cardsSeen: 0,
    choices: [],
    firings: [],
    hits: { afterPull: 0, all: 0 },
    inputs: [],
    items: {},
    movers: {},
    // A skill player's runs draw from a stream of their own instead.
    policyRandom: random,
    pullsMoved: 0,
    run: newRun(data, config.pack.length, {
      dogs: config.pack,
      gear: config.gear,
      walker: config.walker,
    }),
    tips: cents(0),
    upgrades: [],
    zones: [],
  };
  const { player } = config;
  if (player.kind === "rates") {
    playByRates(data, random, config, player, tally);
  } else {
    playBySkill(data, seed, config, player.skill, tally);
  }
  const paidChoices = tally.choices.filter((choice) => choice.cost > 0).length;
  const facts = {
    ...runCountersOf(tally.run),
    earnedCents: tally.run.money,
    packSize: config.pack.length,
    zonesFinished: tally.zones.length,
  };
  return {
    badges: earnedByRun(data, facts),
    cardsSeen: tally.cardsSeen,
    choices: tally.choices,
    earnings: tally.run.money,
    finished: tally.run.phase.kind === "ended" && tally.run.phase.reason === "finished",
    firings: tally.firings,
    hits: tally.hits,
    inputs: tally.inputs,
    items: tally.items,
    moneyShare: tally.choices.length === 0 ? 0 : paidChoices / tally.choices.length,
    movers: tally.movers,
    pullsMoved: tally.pullsMoved,
    route: tally.run.route,
    run: tally.run,
    tips: tally.tips,
    upgrades: tally.upgrades,
    zones: tally.zones,
    zonesCompleted: tally.zones.length,
  };
}

function pickUpgrade(data: SimData, random: Random, tally: Tally): void {
  const source = {
    kind: "upgradeOffer",
    offered: offerUpgrades(data, random, tally.run),
  } as const;
  const run = openCard(source, tally.run);
  const card = cardFor(data, run, source);
  const choice = chooseUpgrade(data, run, card);
  const picked = typeof choice === "number" ? source.offered[choice] : undefined;
  if (picked !== undefined) {
    tally.upgrades.push(picked);
  }
  tally.run = chooseOption(data, random, run, card, choice).state;
}

// The fork after a zone: the route policy picks the path, which sets the next zone.
function takeFork(data: SimData, random: Random, policy: RoutePolicyId, tally: Tally): void {
  const source = offerFork(data, random, tally.run);
  const run = openCard(source, tally.run);
  const card = cardFor(data, run, source);
  const choice = choosePath(random, policy, source.paths.length);
  tally.run = chooseOption(data, random, run, card, choice).state;
}
