import type { GameObjects, Scene } from "phaser";

import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import type { DetailCard } from "../home/detail";
import type { Logbook } from "../home/home";
import { HOME_LAYOUT } from "../home/homeLayout";
import { HOME_TEXT_FIELDS } from "../home/homeText";
import { insetRect, type Rect } from "../layout/rect";
import { fillLine } from "../text/lines";
import { addDim, drawFramedRect, drawRing, fillRect } from "./draw";
import { PALETTE } from "./palette";
import { addPixelText, type FontRole } from "./pixelText";
import { addCloseButton, addLoopingFrame, addNineSlice, selectOuter, TEXT_SCALE } from "./uiKit";

// The home screen's drawing beyond its tiles: the gold outline on what the player can
// afford, and the detail card and logbook that open over the screen. Positions inside a
// piece are the art's, from the style guide.

const SCREEN = SCREEN_CONFIG;

function text(
  scene: Scene,
  parent: GameObjects.Container,
  at: { x: number; y: number },
  value: string,
  style: { color: number; font?: FontRole; maxWidth?: number; originX?: number },
): GameObjects.BitmapText {
  const { maxWidth, ...rest } = style;
  const label = addPixelText(scene, at.x, at.y, value, {
    scale: TEXT_SCALE,
    ...rest,
    ...(maxWidth === undefined ? {} : { maxWidth }),
  });
  parent.add(label);
  return label;
}

// ui-afford sits this far outside an affordable item.
const AFFORD_OUTSET = 2;

// The ui-afford outline 2px outside rect, playing its glint tag, or holding its first frame
// with reduced motion; while the art is missing, an amber line in a plum keyline. A selected
// item never takes it: ui-select wins.
export function addAffordFrame(
  scene: Scene,
  parent: GameObjects.Container,
  rect: Rect,
  reducedMotion: boolean,
): void {
  const outer = selectOuter(rect, AFFORD_OUTSET);
  addLoopingFrame(scene, parent, { key: "ui-afford", outer, tag: "glint" }, reducedMotion, (g) => {
    drawRing(g, PALETTE.plum, outer, 1);
    drawRing(g, PALETTE.amber, insetRect(1, outer), 1);
  });
}

// A dim layer over the whole screen, under a card.
function addScrim(scene: Scene, parent: GameObjects.Container): void {
  parent.add(addDim(scene, { height: SCREEN.height, width: SCREEN.width, x: 0, y: 0 }));
}

const CARD = HOME_LAYOUT.card;
const DOG_CARD: Rect = HOME_LAYOUT.dogCard;
const GEAR_CARD_HEIGHT = HOME_LAYOUT.gearCardHeight;

// The card's frame, title band and close control; the content goes in a container placed at
// the card.
function drawCardFrame(
  scene: Scene,
  parent: GameObjects.Container,
  closePressed: boolean,
  rect: Rect,
  title: string,
  content: GameObjects.Container = scene.add.container(0, 0),
): GameObjects.Container {
  addScrim(scene, parent);
  const frame = addNineSlice(scene, "ui-detail-card", rect);
  if (frame !== undefined) {
    parent.add(frame);
  } else {
    const g = scene.add.graphics();
    drawFramedRect(g, { border: PALETTE.darkBrown, fill: PALETTE.cream }, rect);
    parent.add(g);
  }
  const { height, inset, titleY } = CARD.band;
  const band = { height, width: rect.width - inset * 2, x: rect.x + inset, y: rect.y + inset };
  const bandSlice = addNineSlice(scene, "ui-detail-band", band);
  if (bandSlice !== undefined) {
    parent.add(bandSlice);
  } else {
    const bg = scene.add.graphics();
    fillRect(bg, PALETTE.forest, band);
    parent.add(bg);
  }
  content.setPosition(rect.x, rect.y);
  parent.add(content);
  text(scene, content, { x: rect.width / 2, y: inset + titleY }, title, {
    color: PALETTE.white,
    font: "title",
    originX: 0.5,
  });
  addCloseButton(scene, parent, rect, closePressed);
  return content;
}

// What a detail card shows in its well: a dog's portrait or a gear item's icon, by key.
export interface DetailPicture {
  // A dog's 16x16 quirk icon, drawn beside the portrait under the status where the art has it.
  readonly badge?: string;
  readonly key: string;
  // Drawn at this whole-number scale: 1 for a 64x64 portrait, 2 for a 32x32 icon.
  readonly scale: number;
}

const LINE_GAP = 8;

// A held dog's or gear item's detail card over a dim layer. A dog's card puts its breed and
// status beside the portrait and its rows below; a gear card is shorter, with its effect and
// status beside the icon. Returns the card's rect, so a tap outside it or on its close
// control closes it.
export function drawDetailCard(
  scene: Scene,
  parent: GameObjects.Container,
  closePressed: boolean,
  card: DetailCard,
  picture: DetailPicture,
  kind: "dog" | "gear",
): Rect {
  const rect =
    kind === "dog"
      ? DOG_CARD
      : {
          ...DOG_CARD,
          height: GEAR_CARD_HEIGHT,
          y: Math.round((SCREEN.height - GEAR_CARD_HEIGHT) / 2),
        };
  const content = drawCardFrame(scene, parent, closePressed, rect, card.title);
  const { well } = CARD;
  if (scene.textures.exists("ui-detail-well")) {
    content.add(scene.add.image(well.x, well.y, "ui-detail-well").setOrigin(0));
  } else {
    const g = scene.add.graphics();
    drawFramedRect(
      g,
      { border: PALETTE.plum, fill: PALETTE.grey },
      { height: well.size, width: well.size, x: well.x, y: well.y },
    );
    content.add(g);
  }
  if (scene.textures.exists(picture.key)) {
    const inner = { x: well.x + well.picture, y: well.y + well.picture };
    content.add(
      scene.add.image(inner.x, inner.y, picture.key).setOrigin(0).setScale(picture.scale),
    );
  }
  const besideX = well.x + well.size + 10;
  const beside = (rows: readonly { color: number; value: string }[], top: number): number => {
    let y = top;
    for (const row of rows) {
      const label = text(scene, content, { x: besideX, y }, row.value, {
        color: row.color,
        maxWidth: rect.width - besideX - CARD.pad,
      });
      y += Math.ceil(label.height) + LINE_GAP;
    }
    return y;
  };
  const status = { color: card.locked ? PALETTE.darkRed : PALETTE.forest, value: card.status };
  if (kind === "gear") {
    beside([...card.lines.map((value) => ({ color: PALETTE.plum, value })), status], well.y + 4);
    return rect;
  }
  const belowStatus = beside(
    [{ color: PALETTE.darkBrown, value: card.subtitle }, status],
    well.y + 4,
  );
  if (picture.badge !== undefined && scene.textures.exists(picture.badge)) {
    content.add(scene.add.image(besideX, belowStatus, picture.badge).setOrigin(0));
  }
  let y = well.y + well.size + CARD.pad;
  for (const line of card.lines) {
    const label = text(scene, content, { x: CARD.pad, y }, line, {
      color: PALETTE.plum,
      maxWidth: rect.width - CARD.pad * 2,
    });
    y += Math.ceil(label.height) + LINE_GAP;
  }
  return rect;
}

export interface LogbookPanel {
  // The Badges button, in screen pixels.
  readonly badges: Rect;
  readonly panel: Rect;
  // The Stats button, in screen pixels.
  readonly stats: Rect;
}

const LOGBOOK_BUTTON = HOME_LAYOUT.logbookButton;
const FIELDS = HOME_TEXT_FIELDS.logbook;

// A secondary ui-button with its label, in the card's content.
function addCardButton(
  scene: Scene,
  content: GameObjects.Container,
  button: Rect,
  label: string,
): void {
  const slice = addNineSlice(scene, "ui-button", button, "secondary");
  if (slice !== undefined) {
    content.add(slice);
  } else {
    const g = scene.add.graphics();
    fillRect(g, PALETTE.brown, button);
    fillRect(g, PALETTE.tan, { ...button, height: button.height - 4 });
    content.add(g);
  }
  text(scene, content, { x: button.x + button.width / 2, y: button.y + 15 }, label, {
    color: PALETTE.plum,
    font: "title",
    originX: 0.5,
  });
}

// The logbook over the screen, as a card: the best walk, totals and the last walk, then
// Stats and Badges buttons, Badges opening Stats on its badge wall.
export function drawLogbookPanel(
  scene: Scene,
  parent: GameObjects.Container,
  closePressed: boolean,
  log: Logbook | null,
): LogbookPanel {
  // The rows are laid out first, so the card is as tall as they and the button need.
  const content = scene.add.container(0, 0);
  const words = gameData.homeText.logbook;
  const rows =
    log === null
      ? [words.empty, words.emptyNote]
      : [
          fillLine(FIELDS, words, "best", { best: log.best, note: log.bestNote }),
          log.totals,
          fillLine(FIELDS, words, "last", { last: log.last }),
        ];
  let y = CARD.well.y + 4;
  for (const row of rows) {
    const label = text(scene, content, { x: CARD.pad, y }, row, {
      color: PALETTE.plum,
      maxWidth: CARD.width - CARD.pad * 2,
    });
    y += Math.ceil(label.height) + LINE_GAP;
  }
  const { gap, height: buttonHeight, width: buttonWidth } = LOGBOOK_BUTTON;
  const left = (CARD.width - buttonWidth * 2 - gap) / 2;
  const button = { height: buttonHeight, width: buttonWidth, x: left, y: y + LINE_GAP };
  const badges = { ...button, x: left + buttonWidth + gap };
  const height = button.y + button.height + CARD.pad;
  const rect = {
    height,
    width: CARD.width,
    x: (SCREEN.width - CARD.width) / 2,
    y: Math.round((SCREEN.height - height) / 2),
  };
  drawCardFrame(scene, parent, closePressed, rect, words.title, content);
  addCardButton(scene, content, button, words.stats);
  addCardButton(scene, content, badges, words.badges);
  const onScreen = (r: Rect) => ({ ...r, x: rect.x + r.x, y: rect.y + r.y });
  return { badges: onScreen(badges), panel: rect, stats: onScreen(button) };
}
