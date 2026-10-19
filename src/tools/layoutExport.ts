import { DEPTH_STEPS } from "../assets/depthSteps";
import { LANE_COUNT, ROAD_CAMERA, SCREEN_CONFIG } from "../data/screen";
import type { GameData } from "../data/types";
import { dotRects, HELP_LAYOUT } from "../help/helpLayout";
import { END_LAYOUT } from "../home/endLayout";
import { HOME_LAYOUT } from "../home/homeLayout";
import { settingsLayout } from "../home/settings";
import { SHOP_LAYOUT, shopTabRects } from "../home/shopLayout";
import { STATS_LAYOUT, statsTabRects } from "../home/statsLayout";
import { CELEBRATION_LAYOUT } from "../hud/celebrationLayout";
import { DOGHOUSE } from "../hud/doghouse";
import { hudLanes } from "../hud/hudLanes";
import { PAUSE_MENU_ITEMS, pauseMenuLayout } from "../hud/pauseMenu";
import { STRIP } from "../hud/stateStrip";
import { buttonIcon, TOP_BAR, TOP_BAR_BUTTONS, type TopBarButton } from "../hud/topBar";
import { CARD_LAYOUT, cardRows, largeCardRect } from "../layout/cardLayout";
import { gridRects } from "../layout/grid";
import { laneCenterXs, laneDividerXs } from "../layout/lanes";
import { LOADING_ART, LOADING_TRACK, LOADING_WALKER } from "../layout/loadingScreen";
import { COLLAR_HEIGHT, packPlacements, WALKER_HANDS } from "../layout/packFormation";
import {
  columnSpan,
  distanceAtY,
  lineColumn,
  type RoadProjection,
  rowScale,
} from "../layout/projection";
import type { Rect } from "../layout/rect";
import { VERGES } from "../layout/roadside";
import { GAG_KEYS, GAG_SIZES, GAG_Y, ZONE_GAGS } from "../layout/sceneryGags";
import { screenLayout } from "../layout/screenLayout";
import { MAX_CARD_OPTIONS } from "../rules/choices";
import { read } from "../rules/units";
import { walkerFootY, walkProjection } from "../runner/walkGeometry";

// The screen geometry art's tools read, as shared/export/layout.json, all in screen pixels
// unless a comment says otherwise. Each block is read from the module the game draws by.

// packPlacements holds a pack larger than its largest formation to that formation.
function packFormations(): ReturnType<typeof packPlacements>[] {
  const sizes: ReturnType<typeof packPlacements>[] = [];
  for (let count = 1; sizes.at(-1) !== packPlacements(count); count++) {
    sizes.push(packPlacements(count));
  }
  return sizes;
}

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
  const { approach, backdrop, road, roadView } = regions;
  const projection = walkProjection(ROAD_CAMERA, road);
  const scrollSpeed = read(data.tuning, "pixels", "roadScrollSpeed");
  const bandRows = Array.from({ length: approach.height }, (_, i) => approach.y + i);
  return {
    camera: {
      ...ROAD_CAMERA,
      centerX: projection.centerX,
      farY: projection.farY,
      focal: projection.focal,
      footY: projection.footY,
      // How long the road in view takes to scroll by at the first zone's speed.
      secondsInView: projection.visibleDistance / scrollSpeed,
      visibleDistance: projection.visibleDistance,
    },
    // The depth steps table as the game reads it: each step's key suffix and scale.
    depthSteps: DEPTH_STEPS,
    doghouse: {
      // Positions inside the doghouse, from its top-left corner; each fills its dog slot.
      parts: DOGHOUSE,
      slots: regions.dogSlots,
    },
    gags: { keys: GAG_KEYS, sizes: GAG_SIZES, y: GAG_Y, zones: ZONE_GAGS },
    // The walk HUD's transient layers, each kept to its lane: money changes under the bank,
    // the achievement toast, the first-time hint, the state strip's bubble (which shares the
    // hint's rows and never shows with it), owners' quips over the doghouse roofs, and heart
    // changes by slot.
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
    pack: {
      collarHeight: COLLAR_HEIGHT,
      // By pack size, from 1: each dog's feet from the walker's feet, the first dog leading.
      formations: packFormations(),
      walkerFootY: walkerFootY(road),
      walkerHands: WALKER_HANDS,
    },
    regions,
    scenes: {
      cards: {
        ...CARD_LAYOUT,
        largeRect: largeCardRect(roadView),
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
        ...pauseMenuLayout(roadView, PAUSE_MENU_ITEMS.length),
      },
      settings: settingsLayout(SCREEN_CONFIG),
      shop: { ...SHOP_LAYOUT, tabRects: shopTabRects() },
      stats: { ...STATS_LAYOUT, tabRects: statsTabRects() },
    },
    screen: { height: SCREEN_CONFIG.height, width: SCREEN_CONFIG.width },
    topBar: {
      buttons: {
        home: withIcon(TOP_BAR_BUTTONS.home),
        pause: withIcon(TOP_BAR_BUTTONS.pause),
        sound: withIcon(TOP_BAR_BUTTONS.sound),
      },
      // The state strip hangs under the bar at its right end.
      strip: STRIP,
      wells: TOP_BAR,
    },
    // What lies beside the road, across from its centre line in road pixels; null for no limit.
    verges: VERGES,
  };
}
