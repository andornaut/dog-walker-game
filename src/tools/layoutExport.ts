import { DEPTH_STEPS } from "../assets/depthSteps";
import { ROAD_HIT_SIZE, ROAD_SPRITE_SIZE } from "../assets/spriteKeys";
import { LANE_COUNT, ROAD_CAMERA, ROAD_FAR_SCALE, SCREEN_CONFIG } from "../data/screen";
import type { GameData } from "../data/types";
import { dotRects, HELP_LAYOUT } from "../help/helpLayout";
import { END_LAYOUT } from "../home/endLayout";
import { HOME_LAYOUT } from "../home/homeLayout";
import { settingsLayout } from "../home/settings";
import { SHOP_LAYOUT, shopTabRects } from "../home/shopLayout";
import { STATS_LAYOUT, statsTabRects } from "../home/statsLayout";
import { CELEBRATION_LAYOUT } from "../hud/celebrationLayout";
import { INLINE_FACE, inlineFaceBox } from "../hud/faceText";
import { hudLanes } from "../hud/hudLanes";
import {
  type LeadSlot,
  lineLeadSlot,
  messageLinePanel,
  messagePanel,
  messageStripLayout,
  OWNER_LEAD,
  ownerLeadLayout,
  ownerLeadPanel,
  stripLeadSlot,
} from "../hud/messageStrip";
import { PAUSE_MENU_ITEMS, PAUSE_NOTE_LINES, pauseMenuLayout } from "../hud/pauseMenu";
import { buttonIcon, TOP_BAR_BUTTONS } from "../hud/topBar";
import {
  type BarButton,
  DEBUFF_BAR,
  debuffBarRects,
  DOG_CARD,
  OWNER_TAB,
  ownerTabRect,
  WALK_BAR,
  WALK_BAR_BUTTONS,
  walkBarLayout,
} from "../hud/walkHud";
import { CARD_LAYOUT, cardRows, largeCardRect } from "../layout/cardLayout";
import { COMIC_WORDS } from "../layout/comicWords";
import { laneCenterXs, laneDividerXs } from "../layout/lanes";
import { LOADING_ART, LOADING_TRACK, LOADING_WALKER } from "../layout/loadingScreen";
import {
  COLLAR_HEIGHTS,
  DOG_SILHOUETTES,
  LANE_HALF_WIDTH,
  PACK_FEET,
  PACK_SLOTS,
  PART_INSET,
  WALKER_HANDS,
  WALKER_SILHOUETTES,
} from "../layout/packFormation";
import {
  columnSpan,
  distanceAtY,
  lineColumn,
  type RoadProjection,
  rowScale,
} from "../layout/projection";
import { screenLayout, walkerFootY } from "../layout/screenLayout";
import type { Rect } from "../lib/rect";
import { MAX_CARD_OPTIONS } from "../rules/choices";
import { read } from "../rules/units";
import { walkProjection } from "../runner/walkGeometry";
import { type FontMetrics, fontMetrics } from "../ui/fontMetrics";
import { gridRects } from "../ui/grid";
import { readBitmapFont } from "./fontFile";

// The screen geometry art's tools read, as shared/export/layout.json, all in screen pixels
// unless a comment says otherwise. Each block is read from the module the game draws by.

// Where the projected road falls on a screen row: the row's road distance and scale, the
// columns the road strip covers (both ends included), and the lane centres and dividers.
function roadRow(projection: RoadProjection, road: Rect, row: number) {
  return {
    distance: distanceAtY(projection, row + 0.5),
    laneCenters: laneCenterXs(LANE_COUNT, road).map((x) => lineColumn(projection, row, x)),
    laneDividers: laneDividerXs(LANE_COUNT, road).map((x) => lineColumn(projection, row, x)),
    road: columnSpan(projection, row, road.x, road.x + road.width),
    row,
    scale: rowScale(projection, row),
  };
}

// An owner's quip's lead in slot, for a name no wider than its frame, and the panel it grows
// line's panel to.
function ownerLead(body: FontMetrics, slot: LeadSlot, line: Rect) {
  const lead = ownerLeadLayout(body, slot, 0);
  return { ...lead, panel: ownerLeadPanel(line, lead) };
}

// A top-bar button with where its icon sits.
function withIcon(button: BarButton) {
  return { ...button, icon: buttonIcon(button) };
}

export function layoutExport(
  data: Pick<GameData, "dogs" | "help" | "menuText" | "shopGear" | "walkers" | "tuning">,
) {
  const regions = screenLayout(SCREEN_CONFIG);
  const { approach, backdrop, road, walkView } = regions;
  const projection = walkProjection(ROAD_CAMERA, road);
  const scrollSpeed = read(data.tuning, "pixels", "roadScrollSpeed");
  const bandRows = Array.from({ length: approach.height }, (_, i) => approach.y + i);
  const body = fontMetrics(readBitmapFont("font-body"));
  return {
    camera: {
      ...ROAD_CAMERA,
      centerX: projection.centerX,
      farScale: ROAD_FAR_SCALE,
      farY: projection.farY,
      focal: projection.focal,
      footY: projection.footY,
      // How long the road in view takes to scroll by at the first zone's speed.
      secondsInView: projection.visibleDistance / scrollSpeed,
      visibleDistance: projection.visibleDistance,
    },
    // Where the comic words sit on the effects they letter, in effect frame pixels.
    comicWords: COMIC_WORDS,
    // The depth steps table as the game reads it: each step's key suffix and scale.
    depthSteps: DEPTH_STEPS,
    // The dog cards: positions inside a card from its top-left corner, each card in its slot,
    // and the owner's tab on each card.
    dogCards: {
      ownerTab: OWNER_TAB,
      ownerTabs: regions.dogSlots.map(ownerTabRect),
      parts: DOG_CARD,
      slots: regions.dogSlots,
    },
    // The walk HUD's transient layers, each kept to its lane: money changes under the message
    // strip, the owners' tabs over the cards' tops, and heart changes by slot.
    hudLanes: hudLanes(body, regions),
    // The road on each of the band's approach rows, where the moving road draws over the
    // backdrop, down to the band's bottom row; bandRow counts from the band's top.
    join: bandRows.map((row) => ({
      bandRow: row - backdrop.y,
      ...roadRow(projection, road, row),
    })),
    lanes: {
      centers: laneCenterXs(LANE_COUNT, road),
      count: LANE_COUNT,
      dividers: laneDividerXs(LANE_COUNT, road),
      width: road.width / LANE_COUNT,
    },
    // The message strip under the walk bar: its panel at its tallest (two rows), the line's
    // icon, the text column and its room, and each row's capitals top; its one-row panel
    // under one and two debuff bars; and an owner's quip's lead (OWNER_LEAD) for a name no
    // wider than the frame, on the strip and under one and two bars, with the panels it grows
    // a one-row line to. inlineFace: an owner's face inline before their name in walk text at
    // 2x (INLINE_FACE): the frame's side, the gap from the frame to the name, and how far the
    // frame rises above the row's capitals. At 1x the name shows alone.
    messageStrip: {
      ...messageStripLayout(body),
      inlineFace: { ...INLINE_FACE, ...inlineFaceBox(body, INLINE_FACE.textScale) },
      ownerLead: {
        ...OWNER_LEAD,
        strip: ownerLead(body, stripLeadSlot(body), messagePanel(body, 1)),
        underBars: [1, 2].map((bars) =>
          ownerLead(body, lineLeadSlot(body, bars), messageLinePanel(bars).panel),
        ),
      },
      underBars: [1, 2].map((bars) => messageLinePanel(bars)),
    },
    // The pack as drawn and hit. silhouettes: each sprite's opaque pixels over its walk loop,
    // left and right columns from its column (right exclusive) and the rows above its feet row.
    // slots: by pack size, from 1, the slots in formation order (the biggest dog first, ties in
    // roster order). feet: the feet rows up the screen from the walker's feet by size: a lone
    // dog's, a side dog's, a side dog's among three bigs, and a trio's lead's by the lead's, left
    // and right dogs' sizes. A side dog stands the lane's half width on its feet row less half
    // its opaque width, rounded in, across from the walker's lane. Dogs are drawn by depth, the
    // farthest feet first, then the leashes, then the walker; each leash runs from the walker's
    // hand to the dog's collar, collarHeights over its feet. Obstacles hit the parts, partInset
    // screen pixels inside each sprite; pickups touch the outline around them all.
    pack: {
      collarHeights: COLLAR_HEIGHTS,
      feet: PACK_FEET,
      laneHalfWidth: LANE_HALF_WIDTH,
      partInset: PART_INSET,
      silhouettes: { dogs: DOG_SILHOUETTES, walkers: WALKER_SILHOUETTES },
      slots: PACK_SLOTS,
      walkerFootY: walkerFootY(road),
      walkerHands: WALKER_HANDS,
    },
    regions,
    // A 1-lane road sprite's drawn frame side, and its hit box side whatever size it is drawn.
    // An object spanning n lanes is drawn n lanes wide less (lane width - drawSize), and hit n
    // lanes wide less (lane width - hitSize).
    roadSprites: { drawSize: ROAD_SPRITE_SIZE, hitSize: ROAD_HIT_SIZE },
    scenes: {
      cards: {
        ...CARD_LAYOUT,
        largeRect: largeCardRect(walkView),
        // By count of cards, from 1.
        rows: cardRows(MAX_CARD_OPTIONS, walkView),
      },
      celebration: CELEBRATION_LAYOUT,
      end: END_LAYOUT,
      help: {
        ...HELP_LAYOUT,
        dots: { ...HELP_LAYOUT.dots, rects: dotRects(data.help.length) },
      },
      home: {
        ...HOME_LAYOUT,
        dogRects: gridRects(
          HOME_LAYOUT.dogTiles,
          Object.keys(data.dogs).length,
          HOME_LAYOUT.dogOrigin,
        ),
        pocketRects: gridRects(
          HOME_LAYOUT.pocket.cells,
          Object.keys(data.shopGear).length,
          HOME_LAYOUT.pocket.origin,
        ),
        walkerRects: gridRects(
          HOME_LAYOUT.walkerTiles,
          Object.keys(data.walkers).length,
          HOME_LAYOUT.walkerOrigin,
        ),
      },
      loading: { art: LOADING_ART, track: LOADING_TRACK, walker: LOADING_WALKER },
      pause: {
        labels: PAUSE_MENU_ITEMS.map((item) => data.menuText.pause[item]),
        // The note fits one line at 2x on the plate.
        ...pauseMenuLayout(body, walkView, {
          buttonCount: PAUSE_MENU_ITEMS.length,
          noteLines: PAUSE_NOTE_LINES,
        }),
      },
      // SettingsScene's rows: sound, music, effects and reduced motion.
      settings: settingsLayout(SCREEN_CONFIG, ["switch", "slider", "slider", "switch"]),
      shop: { ...SHOP_LAYOUT, tabRects: shopTabRects() },
      stats: { ...STATS_LAYOUT, tabRects: statsTabRects() },
    },
    screen: regions.screen,
    // The walk bar: its buttons left to right, each with its icon's place, its wells and
    // effect wells, and the debuff bars under it, one and two.
    walkBar: {
      ...walkBarLayout(regions.topBar),
      buttons: WALK_BAR_BUTTONS.map((id) => ({ id, ...withIcon(TOP_BAR_BUTTONS[id]) })),
      debuffBar: DEBUFF_BAR,
      debuffBars: debuffBarRects(regions.topBar, 2),
      parts: WALK_BAR,
    },
  };
}
