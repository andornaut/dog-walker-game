import { LANE_COUNT, ROAD_CAMERA, SCREEN_CONFIG, SCREEN_LAYOUT } from "../data/screen";
import type {
  CardSource,
  DogId,
  EncounterId,
  GameData,
  HelpPictureId,
  MinorObstacleId,
} from "../data/types";
import { cardRowIn } from "../layout/cardLayout";
import { laneCentreXs } from "../layout/lanes";
import { itemAt } from "../lib/arrays";
import { keysOf } from "../lib/records";
import type { Point, Rect } from "../lib/rect";
import { addCents, cents, clampHearts, pixels } from "../lib/units";
import type { Change } from "../rules/causes";
import { cardFor, type CardView, forkCard, MAX_CARD_OPTIONS } from "../rules/choices";
import { firstZoneId, forkPaths, middleZoneId } from "../rules/route";
import { tipValue } from "../rules/run";
import { read } from "../rules/units";
import { laneControlIn } from "../runner/laneControl";
import { type LaneMotion, stillInLane } from "../runner/laneMotion";
import type { MoverOnRoad } from "../runner/movers";
import { NO_PULLS, type Pulls } from "../runner/pulls";
import { screenRoadGeometry } from "../runner/screenGeometry";
import { itemHeight, startRoad, type Walk, zoneLength } from "../runner/walk";
import { walkProjection } from "../runner/walkGeometry";
import { type WalkItem, type WalkItemKind } from "../runner/walkItems";
import { heartsOf, mapPack } from "../state/pack";
import { newRun, type PackDogs, type PackSlot, type RunState } from "../state/runState";
import { cardHeader } from "../ui/cardRow";
import { HELP_LAYOUT } from "./helpLayout";

// Each help page's picture: a moment of the walk screen, drawn by the game's own road, pack, HUD
// and card renderers at their screen positions, still but for the lanes page's drag. The
// picture shows strips of the screen's rows, top to bottom. This module says which rows, and
// what the walk holds at that moment, built by the game's rules, so every name and number in a
// picture is the game's.

const SCREEN = SCREEN_LAYOUT;
const PROJECTION = walkProjection(ROAD_CAMERA, SCREEN.road);
const LANES = laneCentreXs(LANE_COUNT, SCREEN.road);

// The help screen's picture height: its strips fill it.
const HELP_PICTURE_HEIGHT = HELP_LAYOUT.illustration.height;

// A run of screen rows the picture shows.
export interface PictureStrip {
  readonly height: number;
  readonly screenY: number;
}

// The ui-touch-drag sprite: its anchor, frame pixel (20,6), stands on the drag's start. Its
// right tag swipes a lane's width right, its frames dragPx.from on moving the fingertip
// dragPx.px along; left is right mirrored, swiping back from where right ends, with the same
// frame times; still is the swipe right, held for reduced motion.
export const TOUCH_DRAG = {
  anchor: { x: 20, y: 6 },
  dragPx: { from: 3, px: [4, 12, 24, 38, 51, 60, 64] },
  key: "ui-touch-drag",
  tags: { left: "left", right: "right", still: "still" },
} as const;

export type TouchTag = keyof typeof TOUCH_DRAG.tags;

// The pack's move on a drag right: dots along row y from fromX, stopping at toX, then a
// chevron pointing right at chevronX.
export interface PackMove {
  readonly chevronX: number;
  readonly fromX: number;
  readonly toX: number;
  readonly y: number;
}

// The lanes page's drag: a swipe right from touchStart moves the pack from fromLane to toLane,
// then a swipe left brings it back, in a loop.
export interface DragLoop {
  readonly fromLane: number;
  // The marks of the move right, shown only with reduced motion.
  readonly packMove: PackMove;
  readonly toLane: number;
  readonly touchStart: Point;
}

// One moment of the drag: the touch frame, the pack's lane motion and the move's marks.
export interface DragMoment {
  readonly motion: LaneMotion;
  readonly packMove: PackMove | null;
  readonly touch: { readonly index: number; readonly tag: TouchTag };
}

export interface HelpPicture {
  // A card over the dimmed walk, as the card scene draws it.
  readonly card: CardView | null;
  // A drag that moves the pack, its touch hint and the pack's move drawn over the walk.
  readonly drag: DragLoop | null;
  // Changes the walk raises, which the HUD shows: a heart change pops over its dog.
  readonly changes: readonly Change[];
  // Whether the walk is held, as under a card: the pack and items stand idle.
  readonly halted: boolean;
  // Whether the HUD (the walk bar and the dog cards) is drawn.
  readonly hud: boolean;
  readonly pulls: Pulls;
  readonly strips: readonly PictureStrip[];
  // Whether the pack has just bumped something: the walker stumbles and the dogs react.
  readonly stumble: boolean;
  readonly walk: Walk;
}

// The pages' choices: who walks, in which lane (from 0, left to right), what is on the road
// and how far ahead of the walker's feet in road pixels, and the moment shown.
export const HELP_SCENES = {
  // The card scene's header band starts this many rows into a card page's picture, clear of
  // its top rule.
  cardBandInset: 6,
  cards: { dogs: ["archie"], encounter: "skunk", lane: 2 },
  lanes: {
    dogs: ["archie", "biscuit", "duchess"],
    // The pack glides a lane over glideFrames of the swipe's frames, from the first whose drag
    // reaches the walk's first lane step.
    glideFrames: 3,
    lane: 3,
    mover: { distance: 190, kind: "cat" },
    // The pack's move from the lane it left: dots from dotsFrom past that lane's centre,
    // stopping dotsShort before the pack's, and the chevron chevronInset before it, on the
    // row rise above the walker's feet.
    packMove: { chevronInset: 26, dotsFrom: 4, dotsShort: 30, rise: 12 },
    // The drag right starts on lane fromLane's centre, rise rows above the walker's feet.
    touch: { fromLane: 1, rise: 144 },
    // A neighbourhood where cats cross, its grey road setting off the touch hint.
    zone: "snoozeCrescent",
  },
  owners: {
    // The dog that loses a heart to a bump.
    bumped: { dog: "archie", lost: 1 },
    dogs: ["kilo", "archie", "duchess"],
    fired: "duchess",
    lane: 1,
    // How far through the neighbourhood the walk is, which the progress line under the cards
    // shows.
    zoneFraction: 0.6,
  },
  pickups: {
    dogs: ["archie", "biscuit"],
    lane: 2,
    // Tips, a treat, a lucky find and a gear drop.
    pickups: [
      { distance: 270, kind: "tip", lane: 2 },
      { distance: 240, kind: "lostWallet", lane: 1 },
      { distance: 210, kind: "tip", lane: 2 },
      { distance: 170, kind: "runningShoes", lane: 3 },
      { distance: 150, kind: "tip", lane: 2 },
      { distance: 110, kind: "treat", lane: 1 },
    ],
    // Tips grabbed so far, on top of the starting purse.
    tips: 7,
    zoneFraction: 0.4,
  },
  pulls: {
    dogs: ["archie", "biscuit"],
    lane: 2,
    squirrel: { distance: 260, lane: 3 },
    strainer: "biscuit",
    zone: "park",
  },
  zones: { dogs: ["archie", "biscuit", "duchess"], lane: 2 },
} as const;

// The strip of height rows ending on the road's last row.
function roadStrip(height: number): PictureStrip {
  return { height, screenY: SCREEN.roadView.y + SCREEN.roadView.height - height };
}

// The card scene's three-card row, its header band cardBandInset rows into the strip.
function cardStrip(): PictureStrip {
  const rows = cardRowIn(SCREEN.walkView, MAX_CARD_OPTIONS, MAX_CARD_OPTIONS);
  const { band } = cardHeader(false, rows);
  return { height: HELP_PICTURE_HEIGHT, screenY: band.y - HELP_SCENES.cardBandInset };
}

function startRun(data: GameData, dogs: readonly DogId[]): RunState {
  return newRun(data, dogs.length, {
    dogs: dogs as PackDogs,
    gear: null,
    walker: data.defaultWalker,
  });
}

// A road item whose near edge stands distance road pixels ahead of the walker's feet.
function itemAhead(
  data: GameData,
  run: RunState,
  item: { distance: number; id: number; kind: WalkItemKind; lane: number },
  mover?: MoverOnRoad,
): WalkItem {
  const height = itemHeight(data, screenRoadGeometry(run), item.kind, mover !== undefined);
  const placed = {
    height,
    id: item.id,
    kind: item.kind,
    lane: item.lane,
    laneSpan: 1,
    y: PROJECTION.footY - item.distance - height,
  };
  return mover === undefined ? placed : { ...placed, mover };
}

function walkIn(run: RunState, lane: number, items: readonly WalkItem[]): Walk {
  return {
    road: { ...startRoad(LANE_COUNT), control: laneControlIn(stillInLane(lane)), items },
    run,
  };
}

const STILL: Omit<HelpPicture, "strips" | "walk"> = {
  card: null,
  changes: [],
  drag: null,
  halted: false,
  hud: false,
  pulls: NO_PULLS,
  stumble: false,
};

function lanes(data: GameData): HelpPicture {
  const { dogs, lane, mover, packMove, touch, zone } = HELP_SCENES.lanes;
  const run: RunState = { ...startRun(data, dogs), route: [zone] };
  // A mover about to dart across from the left, showing its cue.
  const kind: MinorObstacleId = mover.kind;
  const crosser = itemAhead(
    data,
    run,
    { distance: mover.distance, id: 0, kind, lane: 0 },
    {
      path: {
        direction: 1,
        enterTravel: 0,
        idle: 0,
        lanesPerPixel: LANE_COUNT / SCREEN.road.width,
        motion: "cross",
        movement: "dart",
        stopAfter: null,
        tilt: 0,
        turnAfter: null,
        warning: 1,
      },
      since: 0,
    },
  );
  return {
    ...STILL,
    drag: {
      fromLane: lane - 1,
      packMove: {
        chevronX: itemAt(LANES, lane) - packMove.chevronInset,
        fromX: itemAt(LANES, lane - 1) + packMove.dotsFrom,
        toX: itemAt(LANES, lane) - packMove.dotsShort,
        y: PROJECTION.footY - packMove.rise,
      },
      toLane: lane,
      touchStart: { x: itemAt(LANES, touch.fromLane), y: PROJECTION.footY - touch.rise },
    },
    strips: [roadStrip(HELP_PICTURE_HEIGHT)],
    walk: walkIn(run, lane, [crosser]),
  };
}

// The drag held still, for reduced motion: the swipe right done, the pack in its new lane and
// the move's marks.
export function stillDragMoment(loop: DragLoop): DragMoment {
  return {
    motion: stillInLane(loop.toLane),
    packMove: loop.packMove,
    touch: { index: 0, tag: "still" },
  };
}

// Which frame of a tag whose frames last frameMs plays at ms into it, from 0, its last frame
// holding past its end.
function frameAt(frameMs: readonly number[], ms: number): number {
  let end = 0;
  for (const [index, duration] of frameMs.entries()) {
    end += duration;
    if (ms < end) {
      return index;
    }
  }
  return frameMs.length - 1;
}

// The ms into the swipe at which the pack glides: from the start of the first frame whose drag
// reaches the walk's first lane step, swipeStart px, over glideFrames frames.
export function dragGlide(
  frameMs: readonly number[],
  swipeStart: number,
): { readonly end: number; readonly start: number } {
  const { from, px } = TOUCH_DRAG.dragPx;
  const passed = px.findIndex((travel) => travel >= swipeStart);
  const first = from + (passed < 0 ? px.length - 1 : passed);
  const before = (count: number) => frameMs.slice(0, count).reduce((sum, ms) => sum + ms, 0);
  return { end: before(first + HELP_SCENES.lanes.glideFrames), start: before(first) };
}

// The drag at seconds into its loop: a swipe right as the right tag plays, the pack gliding a
// lane over its glide, then a swipe left that brings it back, and again. frameMs is each
// frame's time, the same in both tags.
export function dragMomentAt(
  frameMs: readonly number[],
  swipeStart: number,
  loop: DragLoop,
  seconds: number,
): DragMoment {
  const swipe = frameMs.reduce((sum, ms) => sum + ms, 0);
  const ms = (((seconds * 1000) % (2 * swipe)) + 2 * swipe) % (2 * swipe);
  const right = ms < swipe;
  const into = right ? ms : ms - swipe;
  const [from, to] = right ? [loop.fromLane, loop.toLane] : [loop.toLane, loop.fromLane];
  const glide = dragGlide(frameMs, swipeStart);
  const duration = (glide.end - glide.start) / 1000;
  const elapsed = (into - glide.start) / 1000;
  const motion: LaneMotion =
    elapsed < 0
      ? stillInLane(from)
      : elapsed >= duration
        ? stillInLane(to)
        : { duration, elapsed, from, kind: "moving", to };
  return {
    motion,
    packMove: null,
    touch: { index: frameAt(frameMs, into), tag: right ? "right" : "left" },
  };
}

function pickups(data: GameData): HelpPicture {
  const { dogs, lane, pickups: items, tips, zoneFraction } = HELP_SCENES.pickups;
  const started = startRun(data, dogs);
  const tip = tipValue(data, started).amount;
  // The second neighbourhood, the first finished.
  const run: RunState = {
    ...started,
    money: addCents(started.money, cents(tip * tips)),
    route: [firstZoneId(data), middleZoneId(data)],
    zoneDistance: pixels(zoneLength(data) * zoneFraction),
    zoneIndex: 1,
  };
  const bar = SCREEN.topBar;
  return {
    ...STILL,
    hud: true,
    strips: [{ height: bar.height, screenY: bar.y }, roadStrip(HELP_PICTURE_HEIGHT - bar.height)],
    walk: walkIn(
      run,
      lane,
      items.map((item, id) => itemAhead(data, run, { ...item, id })),
    ),
  };
}

function cards(data: GameData): HelpPicture {
  const { dogs, encounter, lane } = HELP_SCENES.cards;
  const started = startRun(data, dogs);
  const id: EncounterId = encounter;
  const source: CardSource = { affected: [...dogs], encounter: id, kind: "encounter" };
  // Cash enough for every option, so none is disabled.
  const cost = Math.max(...cardFor(data, started, source).options.map((option) => option.cost));
  // Second chance has already forgiven this neighbourhood's heart, so the hearts option shows
  // its full loss.
  const run: RunState = {
    ...started,
    heartsForgiven: read(data.tuning, "hearts", "secondChanceForgiven"),
    money: cents(Math.max(started.money, cost)),
  };
  return {
    ...STILL,
    card: cardFor(data, run, source),
    halted: true,
    strips: [cardStrip()],
    stumble: true,
    walk: walkIn(run, lane, []),
  };
}

function owners(data: GameData): HelpPicture {
  const { bumped, dogs, fired, lane, zoneFraction } = HELP_SCENES.owners;
  const started = startRun(data, dogs);
  const before = heartsOf(started, bumped.dog) ?? 0;
  const after = clampHearts(before, before - bumped.lost);
  const pack = mapPack((slot): PackSlot => {
    if (slot.dog === fired) {
      return { dog: slot.dog, status: "fired", zoneIndex: 0 };
    }
    return slot.dog === bumped.dog && slot.status === "walking" ? { ...slot, hearts: after } : slot;
  }, started.pack);
  const change: Change = {
    after,
    before: clampHearts(before, before),
    causes: [{ amount: after - before, kind: "bump" }],
    dog: bumped.dog,
    kind: "hearts",
  };
  return {
    ...STILL,
    changes: [change],
    hud: true,
    strips: [{ height: HELP_PICTURE_HEIGHT, screenY: SCREEN_CONFIG.height - HELP_PICTURE_HEIGHT }],
    walk: walkIn(
      { ...started, pack, zoneDistance: pixels(zoneLength(data) * zoneFraction) },
      lane,
      [],
    ),
  };
}

function pulls(data: GameData): HelpPicture {
  const { dogs, lane, squirrel, strainer, zone } = HELP_SCENES.pulls;
  const run: RunState = { ...startRun(data, dogs), route: [zone] };
  const target = itemAhead(data, run, { ...squirrel, id: 0, kind: "squirrel" });
  return {
    ...STILL,
    pulls: {
      ...NO_PULLS,
      strain: {
        blocked: false,
        direction: squirrel.lane > lane ? 1 : -1,
        dog: strainer,
        fromLane: lane,
        itemId: target.id,
        kind: "squirrel",
        pullsLeft: 1,
        tellSeconds: 0,
      },
    },
    strips: [roadStrip(HELP_PICTURE_HEIGHT)],
    walk: walkIn(run, lane, [target]),
  };
}

// The fork after the first neighbourhood, its paths easiest on the left, each carrying an
// upgrade in the upgrades' order.
function zones(data: GameData): HelpPicture {
  const { dogs, lane } = HELP_SCENES.zones;
  const run = startRun(data, dogs);
  const paths = forkPaths(data, () => 0, run.route);
  const upgrades = keysOf(data.upgrades).slice(0, paths.length);
  return {
    ...STILL,
    card: forkCard(data, run, { kind: "fork", paths, upgrades }),
    halted: true,
    strips: [cardStrip()],
    walk: walkIn(run, lane, []),
  };
}

const PICTURES: Readonly<Record<HelpPictureId, (data: GameData) => HelpPicture>> = {
  cards,
  lanes,
  owners,
  pickups,
  pulls,
  zones,
};

export function helpPicture(data: GameData, id: HelpPictureId): HelpPicture {
  return PICTURES[id](data);
}

// Where each strip shows, top to bottom, in the help screen's picture frame.
export function stripViewports(frame: Rect, strips: readonly PictureStrip[]): Rect[] {
  let y = frame.y;
  return strips.map((strip) => {
    const viewport = { height: strip.height, width: frame.width, x: frame.x, y };
    y += strip.height;
    return viewport;
  });
}
