import type { DogId } from "../data/types";
import type { LaneDirection } from "../layout/lanes";
import { chance, type Random } from "../lib/random";
import type { LanedBox, ScaledBox } from "../runner/collision";
import { STEP_SECONDS } from "../runner/fixedStep";
import { hasLeftRoad, type MoverPath, moverPlace } from "../runner/movers";
import { moverOutcomes } from "../runner/outcomes";
import type { PullEvent, Pulls } from "../runner/pulls";
import {
  isPullObstacle,
  itemCategory,
  laneMoveSeconds,
  obstacleHitBox,
  pickupReach,
  type RoadGeometry,
  steerWalk,
  type Walk,
  type WalkData,
  type WalkItem,
} from "../runner/walk";
import {
  type LaneHazard,
  type LanePrize,
  type LanePull,
  planLanes,
  type PlannedMove,
  WAIT_MARGIN,
} from "./lanePlan";
import type { Skill } from "./skills";

// The walk as the bot reads it: speed is the scroll speed in pixels per second.
export interface BotRoad {
  readonly data: WalkData;
  readonly geometry: RoadGeometry;
  readonly speed: number;
}

// A steering bot's state. clock is the seconds walked this run, hit stops included and cards
// not. Moves are at clock times. target is the lane the pack headed for when the bot last acted,
// null before it has. late holds mistimed lane changes still to come; noticeAt,
// when set, is when the bot notices its mistake, and until then it does not replan. tellsAt is
// when each leaning dog's tell started, and paths each mover's path as last seen.
interface Bot {
  readonly appearedAt: Map<number, number>;
  clock: number;
  readonly late: PlannedMove[];
  lastInputAt: number;
  noticeAt: number | null;
  readonly paths: Map<number, MoverPath>;
  readonly perceived: Set<number>;
  readonly perceivedTells: Set<DogId>;
  plan: PlannedMove[];
  // The bot's own stream: its errors never shift the game's draws.
  readonly random: Random;
  // After a pull, the bot changes lanes no sooner than this clock time.
  recoversAt: number;
  replan: boolean;
  readonly skill: Skill;
  target: number | null;
  readonly tellsAt: Map<DogId, number>;
}

// Times within this are the same moment.
const SAME_MOMENT = 1e-9;
// A mistimed lane change comes up to this late.
const MISTIME_SECONDS = 0.25;
// The soonest a mistake is noticed, so a bot with no reaction delay still takes a frame.
const NOTICE_SECONDS = 1 / 60;
// Hazards, standing or moving, are widened a walk step at each end: a lane change starts on the
// first step at or after it is due, up to a step late, so a planned miss never turns into a hit.
const MARGIN_SECONDS = STEP_SECONDS;
// How far apart the planner's waiting times are, besides the ends of hazards.
const GRID_SECONDS = 0.1;

const PRIZE_VALUES = { lucky: 1, tip: 1, treat: 1 } as const;

export function newBot(random: Random, skill: Skill): Bot {
  return {
    appearedAt: new Map(),
    clock: 0,
    lastInputAt: -Infinity,
    late: [],
    noticeAt: null,
    paths: new Map(),
    perceived: new Set(),
    perceivedTells: new Set(),
    plan: [],
    random,
    recoversAt: -Infinity,
    replan: true,
    skill,
    target: null,
    tellsAt: new Map(),
  };
}

// When an item at y, height tall, starts and stops overlapping the pack's band, in seconds from
// now: from its near edge reaching the band's top until its far edge passes the band's bottom.
function contactWindow(
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

// A stretch of walking time, from now, over which something touches the pack in lane.
interface LaneContact {
  readonly from: number;
  readonly lane: number;
  readonly to: number;
}

// A mover's contacts with the pack, by its scroll since its cue appeared: they depend on its
// path, its size and the pack's geometry alone, so each is worked out once.
interface ScrollContact {
  readonly from: number;
  readonly lane: number;
  to: number;
}

type ContactGeometry = Pick<
  RoadGeometry,
  "cell" | "itemHeights" | "laneCount" | "lens" | "packBand" | "packParts" | "roadTop"
>;

const SCROLL_CONTACTS = new WeakMap<
  ContactGeometry,
  WeakMap<object, Map<string, readonly ScrollContact[]>>
>();

// A mover as one sample of its path finds it: its hit box, the top and bottom of its rows on the
// screen, whether it is between lanes, and whether it is solid.
interface MoverSample {
  readonly between: boolean;
  readonly bottom: number;
  readonly box: LanedBox;
  readonly solid: boolean;
  readonly top: number;
}

// Where an edge is at one sample and at the next, moving evenly between them.
type Edge = readonly [number, number];

// Whether, at some moment between two samples, every pair's first edge is before its second, as
// each edge moves evenly from one sample to the next.
function holdTogether(pairs: readonly (readonly [Edge, Edge])[]): boolean {
  let start = 0;
  let end = 1;
  for (const [before, after] of pairs) {
    const gapFrom = after[0] - before[0];
    const gapTo = after[1] - before[1];
    if (gapFrom <= 0 && gapTo <= 0) {
      return false;
    }
    if (gapFrom <= 0) {
      start = Math.max(start, gapFrom / (gapFrom - gapTo));
    } else if (gapTo <= 0) {
      end = Math.min(end, gapFrom / (gapFrom - gapTo));
    }
  }
  return start < end;
}

// Whether a mover moving from one sample to the next touches a part as drawn at some moment
// between them while level with the pack's band: touchesAsDrawn's comparisons and the band's
// all holding at once. A box moving down the road and across it at once, as a tilted dart does,
// can clip a part's corner between two samples, where the walk's collision, at its own walk
// steps, can meet it. With the two samples the same, it is touchesAsDrawn's test.
function touchesBetween(
  centerX: number,
  band: RoadGeometry["packBand"],
  part: ScaledBox,
  from: MoverSample,
  to: MoverSample,
): boolean {
  const across = (scale: number, x: number) => centerX + (x - centerX) * scale;
  const a = from.box;
  const b = to.box;
  // Clear of the part all the way along: the box between them stays within both samples'.
  if (
    Math.max(a.bottom, b.bottom) <= part.top ||
    Math.min(a.top, b.top) >= part.bottom ||
    Math.max(across(a.scale, a.right), across(b.scale, b.right)) <= across(part.scale, part.left) ||
    Math.min(across(a.scale, a.left), across(b.scale, b.left)) >= across(part.scale, part.right)
  ) {
    return false;
  }
  const edge = (at: (sample: MoverSample) => number): Edge => [at(from), at(to)];
  const still = (value: number): Edge => [value, value];
  // The box's sides, each cut to its lanes as drawn on the part's row.
  const lefts = [
    edge(({ box }) => across(box.scale, box.left)),
    edge(({ box }) => across(part.scale, box.lanes.left)),
  ];
  const rights = [
    edge(({ box }) => across(box.scale, box.right)),
    edge(({ box }) => across(part.scale, box.lanes.right)),
  ];
  const partLeft = still(across(part.scale, part.left));
  const partRight = still(across(part.scale, part.right));
  return holdTogether([
    ...lefts.flatMap((left) => rights.map((right) => [left, right] as const)),
    ...rights.map((right) => [partLeft, right] as const),
    ...lefts.map((left) => [left, partRight] as const),
    [still(part.top), edge(({ box }) => box.bottom)],
    [edge(({ box }) => box.top), still(part.bottom)],
    [still(band.top), edge(({ bottom }) => bottom)],
    [edge(({ top }) => top), still(band.bottom)],
  ]);
}

// Whether a mover moving from one sample to the next touches the pack in lane, as the walk's
// collision has it: one of the pack's hit rectangles touches it as drawn, placed at the lane's
// centre, or, for a box between lanes, anywhere on the road within half a lane of it on the box's
// side of each lane edge. A box as narrow as a cat's can pass between a pack standing in either
// of two lanes and still meet it changing lanes, which the plan counts as in both, so the half
// lane each side of an edge counts for the lane on the box's side of it alone: the lane beyond
// stays clear for a pack that stands there while the box passes.
function touchesPackIn(
  geometry: ContactGeometry,
  lane: number,
  from: MoverSample,
  to: MoverSample,
): boolean {
  const { cell, laneCount } = geometry;
  const x = (lane + 0.5) * cell.length;
  const centre = ({ box }: MoverSample) => (box.lanes.left + box.lanes.right) / 2;
  const widens = (side: (sample: MoverSample) => boolean) =>
    [from, to].some((sample) => sample.between && side(sample)) ? cell.length / 2 : 0;
  const left = widens((sample) => lane > 0 && centre(sample) >= lane * cell.length);
  const right = widens(
    (sample) => lane < laneCount - 1 && centre(sample) < (lane + 1) * cell.length,
  );
  const { dogs, walker } = geometry.packParts;
  return [...dogs, walker].some((part) =>
    touchesBetween(
      geometry.lens.centerX,
      geometry.packBand,
      { ...part, left: part.left + x - left, right: part.right + x + right },
      from,
      to,
    ),
  );
}

function scrollContacts(
  road: Pick<BotRoad, "data">,
  geometry: ContactGeometry,
  item: WalkItem,
  path: NonNullable<WalkItem["mover"]>["path"],
): readonly ScrollContact[] {
  const { laneCount, packBand, roadTop } = geometry;
  const { height, kind, laneSpan } = item;
  const key = `${kind} ${height} ${laneSpan}`;
  let byPath = SCROLL_CONTACTS.get(geometry);
  if (byPath === undefined) {
    byPath = new WeakMap();
    SCROLL_CONTACTS.set(geometry, byPath);
  }
  let bySize = byPath.get(path);
  if (bySize === undefined) {
    bySize = new Map();
    byPath.set(path, bySize);
  }
  const known = bySize.get(key);
  if (known !== undefined) {
    return known;
  }
  const contacts: ScrollContact[] = [];
  // The contact under way in each lane, by lane. Between lanes, a mover's box can touch the
  // pack standing in either lane it straddles.
  const current = new Map<number, ScrollContact>();
  let previous: MoverSample | null = null;
  for (let since = 0; since < MOVER_SCROLL_MAX; since += MOVER_SAMPLE_SCROLL) {
    const place = moverPlace(laneCount, path, since);
    const y = roadTop - height + place.travel;
    if (hasLeftRoad(laneCount, place) || y >= packBand.bottom) {
      break;
    }
    const sample: MoverSample = {
      between: Math.abs(place.lanePosition - Math.round(place.lanePosition)) > 1e-9,
      bottom: y + height,
      box: obstacleHitBox(road.data, geometry, { ...item, mover: { path, since }, y }),
      solid: place.solid,
      top: y,
    };
    // Since the sample before: a contact found here may have started any time after it.
    const from = previous ?? sample;
    previous = sample;
    const level =
      sample.solid &&
      Math.max(from.bottom, sample.bottom) > packBand.top &&
      Math.min(from.top, sample.top) < packBand.bottom;
    for (let lane = 0; lane < laneCount; lane++) {
      const touching = level && touchesPackIn(geometry, lane, from, sample);
      const under = current.get(lane);
      if (touching && under !== undefined) {
        under.to = since;
      } else if (touching) {
        const contact = { from: since, lane, to: since };
        contacts.push(contact);
        current.set(lane, contact);
      } else {
        current.delete(lane);
      }
    }
  }
  bySize.set(key, contacts);
  return contacts;
}

// The stretches over which a mover, once it moves, touches the pack standing in a lane, one
// per lane and stretch, that start within horizon seconds. Its path is sampled, so each stretch is
// widened by a sample at each end.
function moverContacts(road: BotRoad, horizon: number, item: WalkItem): LaneContact[] {
  const { mover } = item;
  if (mover === undefined) {
    return [];
  }
  const contacts: LaneContact[] = [];
  for (const path of pathsAhead(mover.path)) {
    for (const { from, lane, to } of scrollContacts(road, road.geometry, item, path)) {
      const start = (from - MOVER_SAMPLE_SCROLL - mover.since) / road.speed;
      const end = (to + MOVER_SAMPLE_SCROLL - mover.since) / road.speed;
      if (end > 0 && start < horizon) {
        contacts.push({ from: start, lane, to: end });
      }
    }
  }
  return contacts;
}

const OUTCOMES = new WeakMap<object, readonly MoverPath[]>();

// The paths a mover may yet take: its own, or, for a stalker or shy hopper with moves still to
// choose, every way it may choose them, since each choice waits on where the pack is then.
function pathsAhead(path: MoverPath): readonly MoverPath[] {
  if ((path.motion !== "approach" && path.motion !== "shy") || path.pending.length === 0) {
    return [path];
  }
  let outcomes = OUTCOMES.get(path);
  if (outcomes === undefined) {
    outcomes = moverOutcomes(path);
    OUTCOMES.set(path, outcomes);
  }
  return outcomes;
}

// The hazards a mover makes, one per lane and stretch it touches the pack in, each
// widened a walk step at each end as a standing obstacle's is.
export function moverHazards(road: BotRoad, horizon: number, item: WalkItem): LaneHazard[] {
  return moverContacts(road, horizon, item).map(({ from, lane, to }) => ({
    from: from - MARGIN_SECONDS,
    lanes: 1 << lane,
    to: to + MARGIN_SECONDS,
  }));
}

// The lanes an item covers, as a lane mask.
function itemLanes(item: Pick<WalkItem, "lane" | "laneSpan">): number {
  return ((1 << item.laneSpan) - 1) << item.lane;
}

// The lane mask within reach lanes of the mask's lanes, on a road laneCount lanes wide.
function widenMask(laneCount: number, reach: number, mask: number): number {
  let widened = mask;
  for (let step = 0; step < reach; step++) {
    widened |= (widened << 1) | (widened >> 1);
  }
  return widened & ((1 << laneCount) - 1);
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
// since, and forgets items that have left. A mover whose path has changed, a stalker that has
// chosen a step, makes the bot replan.
export function observeRoad(bot: Bot, road: BotRoad, walk: Walk): void {
  const { items } = walk.road;
  let oldest = Infinity;
  for (const item of items) {
    oldest = Math.min(oldest, item.id);
    if (!bot.appearedAt.has(item.id)) {
      const scrolled = item.mover?.since ?? item.y - (road.geometry.roadTop - item.height);
      bot.appearedAt.set(item.id, bot.clock - scrolled / road.speed);
    }
    const path = item.mover?.path;
    if (path !== undefined) {
      const seen = bot.paths.get(item.id);
      if (seen !== undefined && seen !== path) {
        bot.replan = true;
      }
      bot.paths.set(item.id, path);
    }
  }
  for (const id of bot.appearedAt.keys()) {
    if (id < oldest) {
      bot.appearedAt.delete(id);
      bot.paths.delete(id);
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
  const horizon = bot.skill.lookAheadSeconds;
  for (const item of walk.road.items) {
    // A pull obstacle is harmless to touch: only its pulls matter.
    if (!bot.perceived.has(item.id) || isPullObstacle(data, item.kind)) {
      continue;
    }
    if (item.mover !== undefined) {
      hazards.push(...moverHazards(road, horizon, item));
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
    } else {
      const reach = category === "lucky" ? 0 : pickupReach(data, walk.run, category);
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
            reactSeconds: bot.skill.reactionSeconds,
          },
        ]
      : [];
  return { hazards, prizes, pulls: seenPulls };
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
  // A pull during a lane change moves the target without turning the pack: it finishes the
  // change, then heads for the target, a lane change per lane.
  const lane = control.target;
  const turns = moving ? Math.abs(lane - motion.to) : 0;
  const readyAt = moving ? motion.duration - motion.elapsed + turns * motion.duration : 0;
  const settled = readyAt > 0 ? readyAt + WAIT_MARGIN : 0;
  const moveSeconds = wholeSteps(laneMoveSeconds(road.data, walk.run));
  const { laneChangeCooldown, lookAheadSeconds } = bot.skill;
  const view = botView(bot, road, pulls, walk);
  const moves = planLanes(
    {
      gridSeconds: GRID_SECONDS,
      horizon: lookAheadSeconds,
      laneCount: road.geometry.laneCount,
      moveSeconds,
      moveStep: Math.max(moveSeconds, laneChangeCooldown),
    },
    {
      lane,
      movableAt: Math.max(
        readyAt,
        settled,
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

// A lane change that does not take, such as one off the road, makes the bot replan.
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
// that is better, once it has reacted to the pull and the pull's move has ended. A pull the bot did not
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
// mistake, replans when it has something new or the pack heads for a lane it did not steer
// for, such as after a Zoomies drift, and makes the lane changes due: the lane moves it makes,
// in order, and the walk they steer. Nothing during a hit stop, which drops lane changes.
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
  if (bot.target !== null && bot.target !== walk.road.control.target) {
    bot.replan = true;
  }
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
      bot.target = acted.road.control.target;
      return { lanes, walk: acted };
    }
    bot.plan.shift();
    acted = attempt(bot, road, lanes, move.direction, acted);
  }
}
