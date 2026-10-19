import type { DogId } from "../data/types";
import type { LaneDirection } from "../layout/lanes";
import { inputLockSeconds } from "../rules/dogs";
import { read } from "../rules/units";
import { STEP_SECONDS } from "../runner/fixedStep";
import { hasLeftRoad, laneAt, moverPlace } from "../runner/movers";
import { isNeedUrgent, needFill, needSpotOf, spotMeets } from "../runner/needs";
import type { PullEvent, Pulls } from "../runner/pulls";
import { chance, type Random } from "../runner/random";
import {
  isPickup,
  itemCategory,
  laneChangeLockSeconds,
  laneMoveSeconds,
  pickupReach,
  type RoadGeometry,
  steerWalk,
  type Walk,
  type WalkData,
  type WalkItem,
  type WalkItemKind,
} from "../runner/walk";
import { packDogs } from "../state/pack";
import {
  type LaneHazard,
  type LanePrize,
  type LanePull,
  LOCK_MARGIN,
  planLanes,
  type PlannedMove,
} from "./lanePlan";
import type { Skill } from "./skills";

// The walk as the bot reads it in one zone: speed is the scroll speed in pixels per second.
export interface BotRoad {
  readonly data: WalkData;
  readonly geometry: RoadGeometry;
  readonly speed: number;
}

// A steering bot's state. clock is the seconds walked this run, hit stops included and cards
// not. Moves are at clock times. late holds mistimed lane changes still to come; noticeAt,
// when set, is when the bot notices its mistake, and until then it does not replan. tellsAt is
// when each leaning dog's tell started.
export interface Bot {
  readonly appearedAt: Map<number, number>;
  clock: number;
  readonly late: PlannedMove[];
  lastInputAt: number;
  noticeAt: number | null;
  readonly perceived: Set<number>;
  readonly perceivedTells: Set<DogId>;
  plan: PlannedMove[];
  // The bot's own stream: its errors never shift the game's draws.
  readonly random: Random;
  // After a pull, the bot changes lanes no sooner than this clock time.
  recoversAt: number;
  replan: boolean;
  readonly skill: Skill;
  readonly tellsAt: Map<DogId, number>;
}

// Times within this are the same moment.
export const SAME_MOMENT = 1e-9;
// A mistimed lane change comes up to this late.
const MISTIME_SECONDS = 0.25;
// The soonest a mistake is noticed, so a bot with no reaction delay still takes a frame.
const NOTICE_SECONDS = 1 / 60;
// Hazards are widened a walk step at each end: a lane change starts on the first step at or
// after it is due, so a planned miss never turns into a hit.
const MARGIN_SECONDS = STEP_SECONDS;
// How far apart the planner's waiting times are, besides the ends of hazards.
const GRID_SECONDS = 0.1;

const PRIZE_VALUES = { lucky: 1, tip: 1, treat: 1 } as const;
// A need spot is worth NEED_SPOT_VALUE for each dog whose urgent need it meets, and up to half
// of NEED_URGENCY_VALUE more as that need runs on toward going wrong.
const NEED_SPOT_VALUE = 1;
const NEED_URGENCY_VALUE = 3;

export function newBot(random: Random, skill: Skill): Bot {
  return {
    appearedAt: new Map(),
    clock: 0,
    lastInputAt: -Infinity,
    late: [],
    noticeAt: null,
    perceived: new Set(),
    perceivedTells: new Set(),
    plan: [],
    random,
    recoversAt: -Infinity,
    replan: true,
    skill,
    tellsAt: new Map(),
  };
}

// When an item at y, height tall, starts and stops touching the pack, in seconds from now.
export function contactWindow(
  band: RoadGeometry["packBand"],
  speed: number,
  y: number,
  height: number,
): { readonly end: number; readonly start: number } {
  return { end: (band.bottom - y) / speed, start: (band.top - (y + height)) / speed };
}

// How often a mover's path is sampled, in road pixels of scroll.
const MOVER_SAMPLE_SCROLL = 1;
// How far a mover is followed at most: well past any road length.
const MOVER_SCROLL_MAX = 10_000;

// A stretch of walking time, from now, over which something overlaps the pack's band in lane.
export interface LaneContact {
  readonly from: number;
  readonly lane: number;
  readonly to: number;
}

// A mover's contacts with the pack's band, by its scroll since its cue appeared: they depend
// on its path, its height and the band alone, so each is worked out once.
interface ScrollContact {
  readonly from: number;
  readonly lane: number;
  to: number;
}

const SCROLL_CONTACTS = new WeakMap<object, Map<string, readonly ScrollContact[]>>();

function scrollContacts(
  geometry: Pick<RoadGeometry, "laneCount" | "packBand" | "roadTop">,
  height: number,
  path: NonNullable<WalkItem["mover"]>["path"],
): readonly ScrollContact[] {
  const { laneCount, packBand, roadTop } = geometry;
  const key = `${packBand.top} ${packBand.bottom} ${height}`;
  let byBand = SCROLL_CONTACTS.get(path);
  if (byBand === undefined) {
    byBand = new Map();
    SCROLL_CONTACTS.set(path, byBand);
  }
  const known = byBand.get(key);
  if (known !== undefined) {
    return known;
  }
  const contacts: ScrollContact[] = [];
  let touchedBefore = false;
  for (let since = 0; since < MOVER_SCROLL_MAX; since += MOVER_SAMPLE_SCROLL) {
    const place = moverPlace(laneCount, path, since);
    const y = roadTop - height + place.travel;
    if (hasLeftRoad(laneCount, place) || y >= packBand.bottom) {
      break;
    }
    const lane = laneAt(place.lanePosition);
    const touching = place.moving && y + height > packBand.top && lane >= 0 && lane < laneCount;
    const last = contacts.at(-1);
    if (touching && touchedBefore && last?.lane === lane) {
      last.to = since;
    } else if (touching) {
      contacts.push({ from: since, lane, to: since });
    }
    touchedBefore = touching;
  }
  byBand.set(key, contacts);
  return contacts;
}

// The stretches over which a mover, once it moves, overlaps the pack's band, one per lane it
// is in meanwhile, that start within horizon seconds. Its path is sampled, so each stretch is
// widened by a sample at each end.
export function moverContacts(road: BotRoad, horizon: number, item: WalkItem): LaneContact[] {
  const { mover } = item;
  if (mover === undefined) {
    return [];
  }
  const contacts: LaneContact[] = [];
  for (const { from, lane, to } of scrollContacts(road.geometry, item.height, mover.path)) {
    const start = (from - MOVER_SAMPLE_SCROLL - mover.since) / road.speed;
    const end = (to + MOVER_SAMPLE_SCROLL - mover.since) / road.speed;
    if (end > 0 && start < horizon) {
      contacts.push({ from: start, lane, to: end });
    }
  }
  return contacts;
}

// The lanes an item covers, as a lane mask.
export function itemLanes(item: Pick<WalkItem, "lane" | "laneSpan">): number {
  return ((1 << item.laneSpan) - 1) << item.lane;
}

// The lane mask within reach lanes of the mask's lanes, on a road laneCount lanes wide.
export function widenMask(laneCount: number, reach: number, mask: number): number {
  let widened = mask;
  for (let step = 0; step < reach; step++) {
    widened |= (widened << 1) | (widened >> 1);
  }
  return widened & ((1 << laneCount) - 1);
}

// The lane mask from which the pack collects a pickup of kind, or touches anything else.
export function reachMask(road: BotRoad, walk: Walk, kind: WalkItemKind, occupied: number): number {
  return isPickup(kind)
    ? widenMask(road.geometry.laneCount, pickupReach(road.data, walk.run, kind), occupied)
    : occupied;
}

export function treatReachOf(data: WalkData, walk: Walk): number {
  return pickupReach(data, walk.run, "treat");
}

// When an item comes into view: at the far edge of the road, or, with visionSeconds, once it
// is that close to the pack. A mover shows from its warning cue on.
function visibleAt(bot: Bot, appeared: number, contactStart: number, mover: boolean): number {
  const { visionSeconds } = bot.skill;
  return visionSeconds === undefined || mover
    ? appeared
    : Math.max(appeared, bot.clock + contactStart - visionSeconds);
}

function perceiveAt(bot: Bot, road: BotRoad, item: WalkItem): number {
  const appeared = bot.appearedAt.get(item.id) ?? bot.clock;
  const { start } = contactWindow(road.geometry.packBand, road.speed, item.y, item.height);
  return visibleAt(bot, appeared, start, item.mover !== undefined) + bot.skill.reactionSeconds;
}

// Records when each item new on the road came into view, from how far the road has scrolled
// since, and forgets items that have left.
export function observeRoad(bot: Bot, road: BotRoad, walk: Walk): void {
  const { items } = walk.road;
  let oldest = Infinity;
  for (const item of items) {
    oldest = Math.min(oldest, item.id);
    if (!bot.appearedAt.has(item.id)) {
      const scrolled = item.mover?.since ?? item.y - (road.geometry.roadTop - item.height);
      bot.appearedAt.set(item.id, bot.clock - scrolled / road.speed);
    }
  }
  for (const id of bot.appearedAt.keys()) {
    if (id < oldest) {
      bot.appearedAt.delete(id);
      bot.perceived.delete(id);
    }
  }
}

// What the bot steers around and toward: every item it has perceived that has not yet passed
// the pack, within its planning horizon.
function botView(
  bot: Bot,
  road: BotRoad,
  pulls: Pulls,
  walk: Walk,
): {
  readonly hazards: LaneHazard[];
  readonly prizes: LanePrize[];
  readonly pulls: LanePull[];
} {
  const { data, geometry, speed } = road;
  const hazards: LaneHazard[] = [];
  const prizes: LanePrize[] = [];
  const treatReach = treatReachOf(data, walk);
  const treatsFull = walk.run.treats >= read(data.tuning, "counts", "treatCarryMax");
  const horizon = bot.skill.lookAheadSeconds;
  for (const item of walk.road.items) {
    if (!bot.perceived.has(item.id)) {
      continue;
    }
    if (item.mover !== undefined) {
      for (const contact of moverContacts(road, horizon, item)) {
        hazards.push({ from: contact.from, lanes: 1 << contact.lane, to: contact.to });
      }
      continue;
    }
    const { end, start } = contactWindow(geometry.packBand, speed, item.y, item.height);
    if (end <= 0 || start > horizon) {
      continue;
    }
    const lanes = itemLanes(item);
    const category = itemCategory(data, item.kind);
    if (category === "minor" || category === "obstacle") {
      hazards.push({ from: start - MARGIN_SECONDS, lanes, to: end + MARGIN_SECONDS });
    } else if (category === "treat") {
      if (!treatsFull) {
        prizes.push({
          at: start,
          lanes: widenMask(geometry.laneCount, treatReach, lanes),
          value: PRIZE_VALUES.treat,
        });
      }
    } else if (category === "needSpot") {
      const value = needSpotValue(data, walk, item);
      if (value > 0) {
        prizes.push({ at: start, lanes, value });
      }
    } else {
      const reach = category === "tip" ? pickupReach(data, walk.run, "tip") : 0;
      prizes.push({
        at: start,
        lanes: widenMask(geometry.laneCount, reach, lanes),
        value: PRIZE_VALUES[category],
      });
    }
  }
  // A strain seen coming is planned as a pull when its tell runs out within the look-ahead;
  // one waiting on its target, such as a squirrel that does not move yet, is reacted to once
  // it pulls.
  const { strain } = pulls;
  const seenPulls: LanePull[] =
    strain !== null &&
    strain.tellSeconds > 0 &&
    strain.tellSeconds < horizon &&
    bot.perceivedTells.has(strain.dog)
      ? [
          {
            at: strain.tellSeconds,
            direction: strain.direction,
            lockSeconds: inputLockSeconds(data.tuning, walk.run.modifiers, data.dogs[strain.dog]),
            reactSeconds: bot.skill.reactionSeconds,
          },
        ]
      : [];
  return { hazards, prizes, pulls: seenPulls };
}

// What steering into a need spot is worth to the bot: only a dog whose need is urgent gains
// from it, more the longer that need has been urgent.
function needSpotValue(data: WalkData, walk: Walk, item: WalkItem): number {
  const spot = needSpotOf(data, item.kind);
  if (spot === null) {
    return 0;
  }
  return packDogs(walk.run)
    .filter((dog) => spotMeets(data, spot, dog) && isNeedUrgent(data, walk.run, dog))
    .reduce(
      (value, dog) =>
        value + NEED_SPOT_VALUE + NEED_URGENCY_VALUE * Math.min(1.5, needFill(data, walk.run, dog)),
      0,
    );
}

// The walk steps' length a lane change lasts: it ends on the first step at or after its
// duration.
function wholeSteps(seconds: number): number {
  return Math.ceil(seconds / STEP_SECONDS - SAME_MOMENT) * STEP_SECONDS;
}

function replan(bot: Bot, road: BotRoad, pulls: Pulls, walk: Walk): void {
  const { control } = walk.road;
  const { motion } = control;
  const moving = motion.kind === "moving";
  const readyAt = moving ? motion.duration - motion.elapsed : 0;
  const lock = Math.max(control.lockSeconds, readyAt + (control.lockOnArrival ?? 0));
  const locked = lock > 0 ? lock + LOCK_MARGIN : 0;
  const moveSeconds = wholeSteps(laneMoveSeconds(road.data, walk.run));
  // A lane change's own lock, such as Tangled's, spaces the moves after it.
  const lockAfterMove = laneChangeLockSeconds(road.data, walk.run);
  const changeLock = lockAfterMove > 0 ? lockAfterMove + LOCK_MARGIN : 0;
  const { laneChangeCooldown, lookAheadSeconds } = bot.skill;
  const view = botView(bot, road, pulls, walk);
  const moves = planLanes(
    {
      gridSeconds: GRID_SECONDS,
      horizon: lookAheadSeconds,
      laneCount: road.geometry.laneCount,
      moveSeconds,
      moveStep: Math.max(moveSeconds + changeLock, laneChangeCooldown),
    },
    {
      lane: moving ? motion.to : motion.lane,
      movableAt: Math.max(
        readyAt,
        locked,
        bot.lastInputAt + laneChangeCooldown - bot.clock,
        bot.recoversAt - bot.clock,
      ),
      readyAt,
    },
    view.hazards,
    view.prizes,
    view.pulls,
  );
  bot.plan = moves.map((move) => ({ ...move, at: bot.clock + move.at }));
  bot.replan = false;
}

// A lane change that does not take, such as one during a lock, makes the bot replan.
function steer(
  bot: Bot,
  road: BotRoad,
  lanes: LaneDirection[],
  direction: LaneDirection,
  walk: Walk,
): Walk {
  const steered = steerWalk(road.data, road.geometry.laneCount, direction, walk);
  lanes.push(direction);
  bot.lastInputAt = bot.clock;
  if (steered.road.control.target === walk.road.control.target) {
    bot.replan = true;
  }
  return steered;
}

// A planned lane change, unless the bot errs: then it is missed or comes late, the rest of
// the plan is dropped, and the bot replans once it notices.
function attempt(
  bot: Bot,
  road: BotRoad,
  lanes: LaneDirection[],
  direction: LaneDirection,
  walk: Walk,
): Walk {
  const { errorRate, reactionSeconds } = bot.skill;
  if (!chance(bot.random, errorRate)) {
    return steer(bot, road, lanes, direction, walk);
  }
  bot.plan = [];
  const noticed = Math.max(reactionSeconds, NOTICE_SECONDS);
  if (chance(bot.random, 0.5)) {
    bot.noticeAt = bot.clock + noticed;
  } else {
    const at = bot.clock + bot.random() * MISTIME_SECONDS;
    bot.late.push({ at, direction });
    bot.noticeAt = at + noticed;
  }
  return walk;
}

// A dog's tell starts the wait before the bot sees it. After a pull, the bot drags back, if
// that is better, once it has reacted to the pull and the lock allows. A pull the bot did not
// see coming spoils its plan until it has seen the tell; one it saw coming was in its plan. A
// blocked pull moved nothing, so the bot replans without the pull. A tell after a pull, for a
// target with pulls left, starts the wait again.
export function observePulls(
  bot: Bot,
  tells: readonly { readonly dog: DogId }[],
  pulled: readonly PullEvent[],
): void {
  for (const { dog, moved } of pulled) {
    if (moved) {
      bot.recoversAt = Math.max(bot.recoversAt, bot.clock + bot.skill.reactionSeconds);
    }
    if (bot.perceivedTells.has(dog) || !moved) {
      bot.replan = true;
    } else {
      bot.plan = [];
      const seen = (bot.tellsAt.get(dog) ?? bot.clock) + bot.skill.reactionSeconds;
      bot.noticeAt = Math.max(bot.noticeAt ?? -Infinity, seen, bot.clock + NOTICE_SECONDS);
    }
    bot.tellsAt.delete(dog);
    bot.perceivedTells.delete(dog);
  }
  for (const { dog } of tells) {
    bot.tellsAt.set(dog, bot.clock);
    bot.perceivedTells.delete(dog);
  }
}

// Everything the bot does at its clock time: perceives the items and tells due, notices a
// mistake, replans when it has something new, and makes the lane changes due: the lane moves
// it makes, in order, and the walk they steer. Nothing during a hit stop, which drops lane
// changes.
export function actBot(
  bot: Bot,
  road: BotRoad,
  pulls: Pulls,
  walk: Walk,
): { readonly lanes: readonly LaneDirection[]; readonly walk: Walk } {
  const lanes: LaneDirection[] = [];
  if (walk.road.hitStop !== null) {
    return { lanes, walk };
  }
  const due = bot.clock + SAME_MOMENT;
  let acted = walk;
  for (const item of acted.road.items) {
    if (!bot.perceived.has(item.id) && perceiveAt(bot, road, item) <= due) {
      bot.perceived.add(item.id);
      bot.replan = true;
    }
  }
  for (const [dog, at] of bot.tellsAt) {
    if (!bot.perceivedTells.has(dog) && at + bot.skill.reactionSeconds <= due) {
      bot.perceivedTells.add(dog);
      bot.replan = true;
    }
  }
  for (;;) {
    const lateIndex = bot.late.findIndex((move) => move.at <= due);
    const late = bot.late[lateIndex];
    if (late !== undefined) {
      bot.late.splice(lateIndex, 1);
      acted = steer(bot, road, lanes, late.direction, acted);
      continue;
    }
    if (bot.noticeAt !== null && bot.noticeAt <= due) {
      bot.noticeAt = null;
      bot.replan = true;
    }
    if (bot.noticeAt === null && bot.replan) {
      replan(bot, road, pulls, acted);
    }
    const move = bot.plan[0];
    if (move === undefined || move.at > due) {
      return { lanes, walk: acted };
    }
    bot.plan.shift();
    acted = attempt(bot, road, lanes, move.direction, acted);
  }
}
