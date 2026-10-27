import { LANE_COUNT, ROAD_CAMERA, SCREEN_CONFIG } from "../data/screen";
import type {
  DogId,
  EncounterId,
  GameData,
  HelpPictureId,
  MinorObstacleId,
  UpgradeId,
} from "../data/types";
import { cardRowIn } from "../layout/cardLayout";
import { laneCentreXs } from "../layout/lanes";
import { screenLayout } from "../layout/screenLayout";
import { itemAt } from "../lib/arrays";
import type { Point, Rect } from "../lib/rect";
import type { Change } from "../rules/causes";
import { cardFor, type CardView, forkCard, MAX_CARD_OPTIONS } from "../rules/choices";
import { firstZoneId, forkPaths, middleZoneId } from "../rules/route";
import { tipValue } from "../rules/run";
import { addCents, cents, clampHearts, pixels, read } from "../rules/units";
import { laneControlIn } from "../runner/laneControl";
import { stillInLane } from "../runner/laneMotion";
import type { MoverOnRoad } from "../runner/movers";
import { NO_PULLS, type Pulls } from "../runner/pulls";
import { screenRoadGeometry } from "../runner/screenGeometry";
import {
  itemHeight,
  startRoad,
  type Walk,
  type WalkItem,
  type WalkItemKind,
  zoneLength,
} from "../runner/walk";
import { walkProjection } from "../runner/walkGeometry";
import {
  type CardSource,
  newRun,
  type PackDogs,
  type PackSlot,
  type RunState,
} from "../state/runState";
import { cardHeader } from "../ui/cardRow";
import { HELP_LAYOUT } from "./helpLayout";

// Each help page's picture: a still moment of the walk screen, drawn by the game's own road,
// pack, HUD and card renderers at their screen positions. The picture shows strips of the
// screen's rows, top to bottom. This module says which rows, and what the walk holds at that
// moment, built by the game's rules, so every name and number in a picture is the game's.

const SCREEN = screenLayout(SCREEN_CONFIG);
const PROJECTION = walkProjection(ROAD_CAMERA, SCREEN.road);
const LANES = laneCentreXs(LANE_COUNT, SCREEN.road);

// The help screen's picture height: its strips fill it.
const HELP_PICTURE_HEIGHT = HELP_LAYOUT.illustration.height;

// A run of screen rows the picture shows.
export interface PictureStrip {
  readonly height: number;
  readonly screenY: number;
}

// The ui-touch-drag sprite, drawn dragging right: its anchor, frame pixel (20,6), stands on the
// drag's start, and its drag tag's frames move the fingertip along.
export const TOUCH_DRAG = { anchor: { x: 20, y: 6 }, key: "ui-touch-drag", tag: "drag" } as const;

export interface HelpPicture {
  // A card over the dimmed walk, as the card scene draws it.
  readonly card: CardView | null;
  // Changes the walk raises, which the HUD shows: a heart change pops over its dog.
  readonly changes: readonly Change[];
  // Whether the walk is held, as under a card: the pack and items stand idle.
  readonly halted: boolean;
  // Whether the HUD (the walk bar and the dog cards) is drawn.
  readonly hud: boolean;
  // The pack's move on a drag: dots along row y from fromX, stopping at toX, then a chevron
  // pointing right at chevronX.
  readonly packMove: {
    readonly chevronX: number;
    readonly fromX: number;
    readonly toX: number;
    readonly y: number;
  } | null;
  readonly pulls: Pulls;
  readonly strips: readonly PictureStrip[];
  // Whether the pack has just bumped something: the walker stumbles and the dogs react.
  readonly stumble: boolean;
  // The touch hint's drag frame, its anchor on start.
  readonly touch: { readonly frame: number; readonly start: Point } | null;
  readonly walk: Walk;
}

// The pages' choices: who walks, in which lane (from 0, left to right), what is on the road
// and how far ahead of the walker's feet in road pixels, and the moment shown.
export const HELP_SCENES = {
  // The card scene's title stands this many rows into a card page's picture.
  cardTitleInset: 8,
  cards: { dogs: ["archie"], encounter: "skunk", lane: 2 },
  lanes: {
    dogs: ["archie", "biscuit", "duchess"],
    lane: 3,
    mover: { distance: 190, kind: "cat" },
    // The pack's move from the lane before: dots from dotsFrom right of that lane's centre,
    // stopping dotsShort before the pack's, and the chevron chevronInset before it, on the
    // row rise above the walker's feet.
    packMove: { chevronInset: 26, dotsFrom: 4, dotsShort: 30, rise: 12 },
    // The drag starts on lane fromLane's centre, rise rows above the walker's feet.
    touch: { frame: 3, fromLane: 1, rise: 120 },
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
    pickups: [
      { distance: 270, kind: "tip", lane: 2 },
      { distance: 210, kind: "tip", lane: 2 },
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

// The card scene's three-card row, its title cardTitleInset rows into the strip.
function cardStrip(): PictureStrip {
  const rows = cardRowIn(SCREEN.walkView, MAX_CARD_OPTIONS, MAX_CARD_OPTIONS);
  const { titleTop } = cardHeader(false, rows);
  return { height: HELP_PICTURE_HEIGHT, screenY: titleTop - HELP_SCENES.cardTitleInset };
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
  halted: false,
  hud: false,
  packMove: null,
  pulls: NO_PULLS,
  stumble: false,
  touch: null,
};

function lanes(data: GameData): HelpPicture {
  const { dogs, lane, mover, packMove, touch } = HELP_SCENES.lanes;
  const run = startRun(data, dogs);
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
  const arriving = itemAt(LANES, lane);
  return {
    ...STILL,
    packMove: {
      chevronX: arriving - packMove.chevronInset,
      fromX: itemAt(LANES, lane - 1) + packMove.dotsFrom,
      toX: arriving - packMove.dotsShort,
      y: PROJECTION.footY - packMove.rise,
    },
    strips: [roadStrip(HELP_PICTURE_HEIGHT)],
    touch: {
      frame: touch.frame,
      start: { x: itemAt(LANES, touch.fromLane), y: PROJECTION.footY - touch.rise },
    },
    walk: walkIn(run, lane, [crosser]),
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
  const hearts = (slot: PackSlot | undefined) => (slot?.status === "walking" ? slot.hearts : 0);
  const before = hearts(started.pack.find((slot) => slot.dog === bumped.dog));
  const after = clampHearts(before, before - bumped.lost);
  const pack = started.pack.map((slot): PackSlot => {
    if (slot.dog === fired) {
      return { dog: slot.dog, status: "fired", zoneIndex: 0 };
    }
    return slot.dog === bumped.dog && slot.status === "walking" ? { ...slot, hearts: after } : slot;
  }) as unknown as RunState["pack"];
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
  const upgrades = (Object.keys(data.upgrades) as UpgradeId[]).slice(0, paths.length);
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
