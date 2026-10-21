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
import { hudLanes } from "../hud/hudLanes";
import { messageLinePanel, messageStripLayout } from "../hud/messageStrip";
import { PAUSE_MENU_ITEMS, pauseMenuLayout } from "../hud/pauseMenu";
import { buttonIcon, TOP_BAR_BUTTONS, type TopBarButton } from "../hud/topBar";
import {
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
import { gridRects } from "../layout/grid";
import { laneCenterXs, laneDividerXs } from "../layout/lanes";
import { LOADING_ART, LOADING_TRACK, LOADING_WALKER } from "../layout/loadingScreen";
import {
  COLLAR_HEIGHTS,
  DOG_SILHOUETTES,
  laneHalfWidth,
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
import type { Rect } from "../layout/rect";
import { VERGES } from "../layout/roadside";
import { GAG_KEYS, GAG_SIZES, GAG_Y, KITE_AT, ZONE_GAGS } from "../layout/sceneryGags";
import { screenLayout } from "../layout/screenLayout";
import { MAX_CARD_OPTIONS } from "../rules/choices";
import { read } from "../rules/units";
import { walkerFootY, walkProjection } from "../runner/walkGeometry";

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

// A top-bar button with where its unpressed icon sits.
function withIcon(button: TopBarButton) {
  return { ...button, icon: buttonIcon(button, false) };
}

export function layoutExport(
  data: Pick<GameData, "dogs" | "help" | "menuText" | "shopGear" | "walkers" | "tuning">,
) {
  const regions = screenLayout(SCREEN_CONFIG);
  const { approach, backdrop, road, roadView, walkView } = regions;
  const projection = walkProjection(ROAD_CAMERA, road);
  const scrollSpeed = read(data.tuning, "pixels", "roadScrollSpeed");
  const bandRows = Array.from({ length: approach.height }, (_, i) => approach.y + i);
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
    gags: { keys: GAG_KEYS, kite: KITE_AT, sizes: GAG_SIZES, y: GAG_Y, zones: ZONE_GAGS },
    // The walk HUD's transient layers, each kept to its lane: money changes under the message
    // strip, the owners' tabs over the cards' tops, and heart changes by slot.
    hudLanes: hudLanes(regions),
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
    // icon, the text column and its room, and each row's capitals top; and its one-row panel
    // under one and two debuff bars.
    messageStrip: {
      ...messageStripLayout(),
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
      laneHalfWidth: laneHalfWidth(),
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
        rows: cardRows(MAX_CARD_OPTIONS, roadView),
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
        // The note wraps to two lines at 2x on the plate.
        ...pauseMenuLayout(walkView, { buttonCount: PAUSE_MENU_ITEMS.length, noteLines: 2 }),
      },
      // SettingsScene's rows: sound, music, effects and reduced motion.
      settings: settingsLayout(SCREEN_CONFIG, ["switch", "slider", "slider", "switch"]),
      shop: { ...SHOP_LAYOUT, tabRects: shopTabRects() },
      stats: { ...STATS_LAYOUT, tabRects: statsTabRects() },
    },
    screen: { height: SCREEN_CONFIG.height, width: SCREEN_CONFIG.width },
    // What lies beside the road, across from its centre line in road pixels; null for no limit.
    verges: VERGES,
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
