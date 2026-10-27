import { LANE_COUNT } from "../data/screen";
import type { AchievementId, DogId, GameData, GearId, WalkerId, ZoneId } from "../data/types";
import type { InputEvent } from "../dev/inputLog";
import { type Random, randomStream } from "../lib/random";
import { earnedByRun, runCountersOf, type RunFacts } from "../rules/achievements";
import { type CardView, type Choice, type ChoiceData, type ChoiceOutcome } from "../rules/choices";
import { currentZoneId } from "../rules/route";
import { addCents, type Cents, cents } from "../rules/units";
import { STEP_SECONDS } from "../runner/fixedStep";
import { destinationLane } from "../runner/laneMotion";
import { hasLeftRoad, moverPlace } from "../runner/movers";
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
  laneMoveSeconds,
  type RoadGeometry,
  startRoad,
  type Walk,
  type WalkData,
  type WalkItemKind,
  walkScrollSpeed,
} from "../runner/walk";
import { packDogs } from "../state/pack";
import { newRun, type PackDogs, type RunState } from "../state/runState";
import { actBot, type BotRoad, newBot, observePulls, observeRoad } from "./bot";
import { type ZoneDelivery, zoneDelivery } from "./delivery";
import { chooseCardOption, choosePath, type PolicyId, type RoutePolicyId } from "./policies";
import type { BotSight } from "./sight";
import type { Skill } from "./skills";

export type SimData = ChoiceData &
  WalkData &
  Pick<
    GameData,
    "achievements" | "defaultWalker" | "dogSlots" | "runText" | "upgrades" | "walkerPerks"
  >;

// Who plays the walk: a steering bot of a skill, reading movers by sight or by foresight, plays
// the real walk loop, and what it hits and collects is measured.
export interface SimPlayer {
  readonly kind: "skill";
  readonly sight: BotSight;
  readonly skill: Skill;
}

export interface SimConfig {
  readonly gear: GearId | null;
  readonly pack: PackDogs;
  readonly player: SimPlayer;
  readonly policy: PolicyId;
  readonly route: RoutePolicyId;
  readonly walker: WalkerId;
}

// One encounter card: what the option the policy took cost.
interface ChoiceRecord {
  readonly cost: Cents;
}

interface FiringRecord {
  readonly dog: DogId;
  readonly zoneIndex: number;
}

interface ZoneRecord {
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

type ItemCounts = Partial<Record<WalkItemKind, ItemCount>>;

// Obstacle hits, minor ones and movers included, and those of them that came while a pull's move,
// AFTER_PULL_REACTION_SECONDS and a lane move back had not yet passed, from something not in the
// lane the pull moved the pack out of: hits the pull left the player no time to avoid.
interface HitCounts {
  afterPull: number;
  all: number;
}

// The reaction time a hit after a pull is measured against, fixed so the measure stays
// comparable when the tuning changes.
const AFTER_PULL_REACTION_SECONDS = 0.6;

// Movers are counted by the kind they meet the pack as.
type MoverCounts = Partial<Record<WalkItemKind, ItemCount>>;

export interface RunResult {
  // The achievements the run earns on its own facts, whatever the profile holds.
  readonly badges: readonly AchievementId[];
  // Encounter cards; forks are not counted.
  readonly cardsSeen: number;
  readonly choices: readonly ChoiceRecord[];
  // Each zone planned, in order: what its plan asked for and what it placed.
  readonly deliveries: readonly ZoneDelivery[];
  // The money banked at the end of the run.
  readonly earnings: Cents;
  // What the achievements judge the run on: its session counters and how it ended.
  readonly facts: RunFacts;
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
  // The zones walked, in order.
  readonly route: readonly ZoneId[];
  // The run as it ended.
  readonly run: RunState;
  readonly tips: Cents;
  // The zones finished, in order.
  readonly zones: readonly ZoneRecord[];
}

// The run state and everything recorded about the run so far.
interface Tally {
  // The lane the last pull moved the pack out of, and the bot clock until which a hit counts
  // as coming after it.
  afterPull: { readonly fromLane: number; readonly until: number } | null;
  cardsSeen: number;
  readonly choices: ChoiceRecord[];
  readonly deliveries: ZoneDelivery[];
  readonly firings: FiringRecord[];
  readonly hits: HitCounts;
  readonly inputs: InputEvent[];
  pullsMoved: number;
  readonly items: ItemCounts;
  readonly movers: MoverCounts;
  // What the card policy draws from, kept apart from the game's and the bot's draws so the
  // policies that never draw play identical runs.
  readonly policyRandom: Random;
  run: RunState;
  tips: Cents;
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
    } else {
      const place = moverPlace(geometry.laneCount, mover.path, mover.since + travel);
      const y = geometry.roadTop - item.height + place.travel;
      touched = !(hasLeftRoad(geometry.laneCount, place) || y >= geometry.roadBottom);
    }
    countItem(tally, touched, { kind: item.kind, moving: mover !== undefined });
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
  for (const { moved } of pulled) {
    if (moved) {
      tally.pullsMoved += 1;
      tally.afterPull = {
        fromLane: destinationLane(walk.road.control.motion),
        until: clock + move + AFTER_PULL_REACTION_SECONDS + move,
      };
    }
  }
}

// The policies' choice on the open card: the route policy's path at a fork, or the card
// policy's option.
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
  return chooseCardOption(data, tally.policyRandom, config.policy, run, card);
}

// The counts of the zone just planned, read from the road the plan left.
function noteZonePlan(data: SimData, tally: Tally, walk: Walk): void {
  const { run } = walk;
  tally.deliveries.push(zoneDelivery(data, run.zoneIndex + 1, currentZoneId(data, run), walk.road));
}

// A choice's record: an encounter card seen, and the firings it brought about.
function noteChoice(
  tally: Tally,
  run: RunState,
  event: Extract<SessionEvent, { kind: "chosen" }>,
): void {
  const { choice, outcome, view } = event;
  recordFirings(tally, run, outcome);
  if (view.source.kind === "fork") {
    return;
  }
  const option = view.options.find(({ index }) => index === choice);
  tally.cardsSeen += 1;
  tally.choices.push({ cost: option?.cost ?? cents(0) });
}

// What the bot reads of the road: its geometry for the pack and the zone's scroll speed.
function botRoadOf(data: SimData, walk: Walk): BotRoad & { readonly pack: RunState["pack"] } {
  const speed = walkScrollSpeed(data, walk.run) * walk.road.speedFactor;
  return {
    data,
    geometry: screenRoadGeometry(walk.run),
    pack: walk.run.pack,
    speed,
  };
}

// The bot plays the walk on the game's own session, a step of STEP_SECONDS at a time as the
// game steps it: its lane moves are the steps' inputs, and the policies choose each
// card as it opens. The inputs are logged as the game logs them, so the run's seed and log
// replay it in the game.
function playBySkill(
  data: SimData,
  seed: number,
  config: SimConfig,
  player: SimPlayer,
  tally: Tally,
): void {
  const streams = runStreams(seed);
  const bot = newBot(randomStream(seed, "bot"), player.sight, player.skill);
  const start = { road: startRoad(LANE_COUNT), run: tally.run };
  let session = startSession(data, streams, screenRoadGeometry, start);
  noteZonePlan(data, tally, session.walk);
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
      const inputs = action.lanes.map((direction): SessionInput => ({ direction, kind: "lane" }));
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
          noteChoice(tally, walk.run, event);
          tally.inputs.push({ choice: event.choice, kind: "card", timeMs: event.timeMs });
          break;
        case "input":
          tally.inputs.push({ ...event.input, timeMs: event.timeMs });
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
          for (const { outcome } of [...event.step.contacts, ...event.step.instants]) {
            recordFirings(tally, pulledWalk.run, outcome);
          }
          for (const dog of event.step.fired) {
            tally.firings.push({ dog, zoneIndex: pulledWalk.run.zoneIndex });
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
          noteZonePlan(data, tally, step.session.walk);
          road = botRoadOf(data, step.session.walk);
          bot.replan = true;
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
  const tally: Tally = {
    afterPull: null,
    cardsSeen: 0,
    choices: [],
    deliveries: [],
    firings: [],
    hits: { afterPull: 0, all: 0 },
    inputs: [],
    items: {},
    movers: {},
    policyRandom: randomStream(seed, "policy"),
    pullsMoved: 0,
    run: newRun(data, config.pack.length, {
      dogs: config.pack,
      gear: config.gear,
      walker: config.walker,
    }),
    tips: cents(0),
    zones: [],
  };
  playBySkill(data, seed, config, config.player, tally);
  const facts: RunFacts = {
    ...runCountersOf(tally.run),
    dogsHome: packDogs(tally.run).length,
    earnedCents: tally.run.money,
    packSize: config.pack.length,
    zonesFinished: tally.zones.length,
  };
  return {
    badges: earnedByRun(data, facts),
    cardsSeen: tally.cardsSeen,
    choices: tally.choices,
    deliveries: tally.deliveries,
    earnings: tally.run.money,
    facts,
    finished: tally.run.phase.kind === "ended" && tally.run.phase.reason === "finished",
    firings: tally.firings,
    hits: tally.hits,
    inputs: tally.inputs,
    items: tally.items,
    movers: tally.movers,
    pullsMoved: tally.pullsMoved,
    route: tally.run.route,
    run: tally.run,
    tips: tally.tips,
    zones: tally.zones,
  };
}
