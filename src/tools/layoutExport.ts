import { wrapWords } from "@andornaut/game-kit/lines";
import type { Rect } from "@andornaut/game-kit/rect";
import { type FontMetrics, fontMetrics, inkWidth } from "@andornaut/game-kit/text/bitmapFont";

import { DEPTH_STEPS } from "../assets/depthSteps";
import { LOADING_ART, ROAD_HIT_SIZE, ROAD_SPRITE_SIZE } from "../assets/spriteKeys";
import { MENU_TEXT } from "../data/menuText";
import {
  LANE_COUNT,
  ROAD_CAMERA,
  ROAD_FAR_SCALE,
  SCREEN_CONFIG,
  SCREEN_LAYOUT,
} from "../data/screen";
import type { GameData } from "../data/types";
import { dotRects, HELP_LAYOUT } from "../help/helpLayout";
import { END_LAYOUT } from "../home/endLayout";
import { overlayRegion } from "../home/homeBar";
import {
  HOME_LAYOUT,
  homeBarButtons,
  updateModalLayout,
  updateModalText,
} from "../home/homeLayout";
import { MODAL, modalActionWidth } from "../home/modalLayout";
import { noteRoomForControl, settingsLayout, type SettingsRowShape } from "../home/settings";
import { SHOP_TABS } from "../home/shop";
import { SHOP_LAYOUT, shopTabRects } from "../home/shopLayout";
import { STATS_LAYOUT, statsTabRects } from "../home/statsLayout";
import {
  CELEBRATION_LAYOUT,
  GREETING_FIT,
  newWalkerRows,
  ZONE_EARNINGS_FIT,
  zoneDoneRows,
} from "../hud/celebrationLayout";
import { INLINE_FACE, inlineFaceBox } from "../hud/faceText";
import { hudLanes } from "../hud/hudLanes";
import {
  type LeadSlot,
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
  ZONE_PROGRESS,
  zoneProgressLayout,
} from "../hud/walkHud";
import {
  CARD_LAYOUT,
  cardEffectArea,
  cardRows,
  largeBodyBox,
  largeCardRect,
} from "../layout/cardLayout";
import { COMIC_WORDS } from "../layout/comicWords";
import { laneCentreXs, laneDividerXs } from "../layout/lanes";
import { LOADING_TRACK, LOADING_WALKER } from "../layout/loadingScreen";
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
import { walkerFootY } from "../layout/screenLayout";
import { MAX_CARD_OPTIONS } from "../rules/choices";
import { read } from "../rules/units";
import { walkProjection } from "../runner/walkGeometry";
import { gridRects } from "../ui/grid";
import { plainMarks } from "../ui/pixelFont";
import { readBitmapFont } from "./fontFile";

// The screen geometry art's tools read, as shared/export/layout.json, all in screen pixels
// unless a comment says otherwise. Each block is read from the module the game draws by.

// Where the projected road falls on a screen row: the row's road distance and scale, the
// columns the road strip covers (both ends included), and the lane centres and dividers.
function roadRow(projection: RoadProjection, road: Rect, row: number) {
  return {
    distance: distanceAtY(projection, row + 0.5),
    laneCentres: laneCentreXs(LANE_COUNT, road).map((x) => lineColumn(projection, row, x)),
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

// SettingsScene's rows with the install row: sound, music, effects, reduced motion and install,
// each note on the lines the shipped notes wrap to (src/home/settings.test.ts checks them).
const installWidth = modalActionWidth(
  inkWidth(
    readBitmapFont("font-title"),
    2,
    plainMarks(MENU_TEXT.settings.installButton).toUpperCase(),
  ),
);
const noteLines = (width: number, text: string) =>
  wrapWords(
    (line) => inkWidth(readBitmapFont("font-body"), 2, plainMarks(line)),
    noteRoomForControl(width),
    text,
  ).length;
export const SETTINGS_EXPORT_ROWS: readonly SettingsRowShape[] = [
  { kind: "switch", noteLines: noteLines(32, MENU_TEXT.settings.soundNote) },
  { kind: "slider" },
  { kind: "slider" },
  { kind: "switch", noteLines: noteLines(32, MENU_TEXT.settings.motionNote) },
  {
    controlWidth: installWidth,
    kind: "button",
    noteLines: noteLines(installWidth, MENU_TEXT.settings.installNote),
  },
];

// A top-bar button with where its icon sits.
function withIcon(button: BarButton) {
  return { ...button, icon: buttonIcon(button) };
}

export function layoutExport(
  data: Pick<
    GameData,
    "dogs" | "help" | "homeText" | "menuText" | "runText" | "shopGear" | "walkers" | "tuning"
  >,
) {
  const regions = SCREEN_LAYOUT;
  const { backdrop, rasterView, road, walkView } = regions;
  const projection = walkProjection(ROAD_CAMERA, road);
  const scrollSpeed = read(data.tuning, "pixels", "roadScrollSpeed");
  const bandRows = Array.from({ length: road.y - rasterView.y }, (_, i) => rasterView.y + i);
  const body = fontMetrics(readBitmapFont("font-body"));
  const title = fontMetrics(readBitmapFont("font-title"));
  const titleInk = (text: string) =>
    inkWidth(readBitmapFont("font-title"), 2, plainMarks(text).toUpperCase());
  const notice = updateModalLayout(overlayRegion("home"), {
    action: titleInk(data.homeText.update.button),
    title: titleInk(data.homeText.update.title),
  });
  // Reference rows use the maximum greeting/info budgets, with the actual fixed-size font.
  const walkerRows = newWalkerRows(
    body,
    2,
    { lines: ["", ""], style: { scale: 2 } },
    {
      action: titleInk(data.runText.newWalker.button),
      content: GREETING_FIT.room,
    },
  );
  const zoneRows = zoneDoneRows(body, {
    action: titleInk(data.runText.zoneDone.button),
    earnings: ZONE_EARNINGS_FIT.room,
  });
  return {
    camera: {
      ...ROAD_CAMERA,
      centreX: projection.centreX,
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
    // The walk HUD's transient layers, each kept to its lane: the owners' tabs over the cards'
    // tops, and heart changes by slot.
    hudLanes: hudLanes(regions),
    // The road on each of the band's junction and approach rows, where the moving road draws
    // over the backdrop, down to the band's bottom row; bandRow counts from the band's top.
    join: bandRows.map((row) => ({
      bandRow: row - backdrop.y,
      ...roadRow(projection, road, row),
    })),
    lanes: {
      centres: laneCentreXs(LANE_COUNT, road),
      count: LANE_COUNT,
      dividers: laneDividerXs(LANE_COUNT, road),
      width: road.width / LANE_COUNT,
    },
    // The message strip under the walk bar: its panel at its tallest (two rows), the line's
    // icon, the text column and its room, and each row's capitals top; the same under one and
    // two debuff bars; and an owner's quip's lead (OWNER_LEAD) for a name no wider than the
    // frame, on the strip and under one and two bars, with the panels it grows a one-row line
    // to. inlineFace: an owner's face inline before their name in walk text at
    // 2x (INLINE_FACE): the frame's side, the gap from the frame to the name, and how far the
    // frame rises above the row's capitals. At 1x the name shows alone.
    messageStrip: {
      ...messageStripLayout(body),
      inlineFace: { ...INLINE_FACE, ...inlineFaceBox(body, INLINE_FACE.textScale) },
      ownerLead: {
        ...OWNER_LEAD,
        strip: ownerLead(body, stripLeadSlot(body), messagePanel(body, 1)),
        underBars: [1, 2].map((bars) =>
          ownerLead(body, stripLeadSlot(body, bars), messagePanel(body, 1, bars)),
        ),
      },
      underBars: [1, 2].map((bars) => messageStripLayout(body, bars)),
    },
    // The pack as drawn and hit. silhouettes: each sprite's opaque pixels over its walk loop, left
    // and right columns from its column (right exclusive) and the rows above its feet row. slots:
    // by pack size, from 1, the slots in formation order (the largest dog first, ties in roster
    // order). feet: the feet rows up the screen from the walker's feet by size: a lone dog's, a
    // side dog's, a side dog's among three large dogs, and a trio's lead's by the lead's, left and
    // right dogs' sizes. A side dog stands the lane's half width on its feet row less half its
    // opaque width, rounded in, across from the walker's lane. Dogs are drawn by depth, the
    // farthest feet first, then the leashes, then the walker; each leash runs from the walker's
    // hand to the dog's collar, collarHeights over its feet. Obstacles hit the parts, partInset
    // screen pixels inside each sprite; pickups touch the outline around them all.
    modal: MODAL,
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
        // The effect's area, in card pixels, on a card that fires an owner and one that does not.
        effect: {
          ...CARD_LAYOUT.effect,
          area: { fires: cardEffectArea(body, true), plain: cardEffectArea(body, false) },
        },
        // The enlarged card's changes' top in its body, under no firing warning.
        large: { ...CARD_LAYOUT.large, changesTop: largeBodyBox({ body, title }, 0).top },
        largeRect: largeCardRect(walkView),
        // By count of cards, from 1.
        rows: cardRows(MAX_CARD_OPTIONS, walkView),
      },
      celebration: {
        ...CELEBRATION_LAYOUT,
        newWalker: {
          ...CELEBRATION_LAYOUT.newWalker,
          ...walkerRows,
          info: { ...CELEBRATION_LAYOUT.newWalker.info, y: walkerRows.info.map(({ y }) => y) },
        },
        zoneDone: { ...CELEBRATION_LAYOUT.zoneDone, ...zoneRows },
      },
      end: END_LAYOUT,
      help: {
        ...HELP_LAYOUT,
        dots: { ...HELP_LAYOUT.dots, rects: dotRects(data.help.length) },
      },
      home: {
        ...HOME_LAYOUT,
        // The top bar's buttons left to right, each its face and hit: with Exit, and where Exit
        // is hidden (an installed app whose window a script cannot close).
        barButtons: {
          exitHidden: Object.fromEntries(homeBarButtons(false)),
          exitShown: Object.fromEntries(homeBarButtons(true)),
        },
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
        // The update modal and its button label's capitals.
        updateModal: {
          ...notice,
          ...updateModalText(title, notice.button),
        },
        walkerRects: gridRects(
          HOME_LAYOUT.walkerTiles,
          Object.keys(data.walkers).length,
          HOME_LAYOUT.walkerOrigin,
        ),
      },
      loading: { art: LOADING_ART, track: LOADING_TRACK, walker: LOADING_WALKER },
      pause: {
        labels: PAUSE_MENU_ITEMS.map((item) => data.menuText.pause[item]),
        // The note takes a line per sentence at 2x on the plate.
        ...pauseMenuLayout(body, walkView, {
          buttonCount: PAUSE_MENU_ITEMS.length,
          buttonWidths: PAUSE_MENU_ITEMS.map((item, i) =>
            modalActionWidth(
              inkWidth(
                readBitmapFont("font-title"),
                2,
                `${i + 1} ${plainMarks(data.menuText.pause[item])}`.toUpperCase(),
              ),
            ),
          ),
          noteLines: PAUSE_NOTE_LINES,
          titleWidth: inkWidth(
            readBitmapFont("font-title"),
            2,
            plainMarks(data.menuText.pause.title).toUpperCase(),
          ),
        }),
      },
      settings: settingsLayout({ body, title }, SCREEN_CONFIG, SETTINGS_EXPORT_ROWS),
      shop: { ...SHOP_LAYOUT, tabRects: shopTabRects(SHOP_TABS.length) },
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
    // The neighbourhood's progress line on the screen's last rows: its parts at the
    // neighbourhood's start, its fill's rows at the end, and its look.
    zoneProgress: {
      ...zoneProgressLayout(regions.zoneProgress, 0),
      full: zoneProgressLayout(regions.zoneProgress, 1).fills,
      look: ZONE_PROGRESS,
    },
  };
}
