import type { GameObjects, Scene } from "phaser";

import { animationKey } from "../assets/asepriteAnimations";
import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import type { DetailCard } from "../home/detail";
import { loopFrame } from "../home/feedback";
import type { Logbook } from "../home/home";
import { HOME_LAYOUT } from "../home/homeLayout";
import type { SlotSign } from "../home/homeLines";
import { HOME_TEXT_FIELDS } from "../home/homeText";
import type { Rect } from "../layout/rect";
import { fillLine } from "../text/lines";
import { drawFramedRect, fillRect } from "./draw";
import { PALETTE } from "./palette";
import { addPixelText, type FontRole } from "./pixelText";
import { addCloseButton, addNineSlice, TEXT_SCALE } from "./uiKit";

// The home screen's drawing beyond its tiles: the gold outline on what the player can
// afford, the slot sign, and the detail card and logbook that open over the
// screen. Positions inside a piece are the art's, from the style guide.

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

// A ring of the given thickness just inside rect.
function drawRing(g: GameObjects.Graphics, color: number, rect: Rect, thickness: number): void {
  const { height, width, x, y } = rect;
  fillRect(g, color, { height: thickness, width, x, y });
  fillRect(g, color, { height: thickness, width, x, y: y + height - thickness });
  fillRect(g, color, { height, width: thickness, x, y });
  fillRect(g, color, { height, width: thickness, x: x + width - thickness, y });
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
  const outer = {
    height: rect.height + AFFORD_OUTSET * 2,
    width: rect.width + AFFORD_OUTSET * 2,
    x: rect.x - AFFORD_OUTSET,
    y: rect.y - AFFORD_OUTSET,
  };
  const frames = scene.anims.get(animationKey("ui-afford", "glint"))?.frames ?? [];
  const slices = frames.flatMap((_, i) => {
    const slice = addNineSlice(scene, "ui-afford", outer, "glint", i);
    return slice === undefined ? [] : [slice];
  });
  const first = slices[0];
  if (first === undefined) {
    const g = scene.add.graphics();
    drawRing(g, PALETTE.plum, outer, 1);
    drawRing(
      g,
      PALETTE.amber,
      {
        ...outer,
        height: outer.height - 2,
        width: outer.width - 2,
        x: outer.x + 1,
        y: outer.y + 1,
      },
      1,
    );
    parent.add(g);
    return;
  }
  parent.add(slices);
  const durations = frames.map((frame) => frame.duration);
  const show = () => {
    const shown = loopFrame(reducedMotion, durations, scene.time.now);
    slices.forEach((slice, i) => slice.setVisible(i === shown));
  };
  show();
  if (!reducedMotion && slices.length > 1) {
    scene.events.on("update", show);
    first.once("destroy", () => scene.events.off("update", show));
  }
}

// The slot sign's text, in sign pixels: line 1 in font-title over the header plank, line 2
// in font-body on the panel below it, left of the padlock.
const SIGN_TEXT = { line1: { x: 5, y: 6 }, line2: { x: 5, y: 27 } };

// The slot sign's board, ui-slot-locked, or a tan plank over a cream panel in a plum rim
// while the art is missing, with its two lines.
export function drawSlotSign(
  scene: Scene,
  parent: GameObjects.Container,
  rect: Rect,
  sign: SlotSign,
): void {
  if (scene.textures.exists("ui-slot-locked")) {
    parent.add(scene.add.image(rect.x, rect.y, "ui-slot-locked").setOrigin(0));
  } else {
    const g = scene.add.graphics();
    drawFramedRect(g, { border: PALETTE.plum, fill: PALETTE.cream }, rect);
    fillRect(g, PALETTE.tan, { height: 20, width: rect.width - 2, x: rect.x + 1, y: rect.y + 1 });
    parent.add(g);
  }
  const { line1, line2 } = SIGN_TEXT;
  text(scene, parent, { x: rect.x + line1.x, y: rect.y + line1.y }, sign.sign, {
    color: PALETTE.plum,
    font: "title",
  });
  text(scene, parent, { x: rect.x + line2.x, y: rect.y + line2.y }, sign.status, {
    color: sign.short ? PALETTE.darkRed : PALETTE.forest,
  });
}

// A dim layer over the whole screen, under a card.
function addScrim(scene: Scene, parent: GameObjects.Container): void {
  const g = scene.add.graphics();
  g.fillStyle(PALETTE.ink, 0.6).fillRect(0, 0, SCREEN.width, SCREEN.height);
  parent.add(g);
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
  const beside = (rows: readonly { color: number; value: string }[], top: number) => {
    let y = top;
    for (const row of rows) {
      const label = text(scene, content, { x: besideX, y }, row.value, {
        color: row.color,
        maxWidth: rect.width - besideX - CARD.pad,
      });
      y += Math.ceil(label.height) + LINE_GAP;
    }
  };
  const status = { color: PALETTE.forest, value: card.status };
  if (kind === "gear") {
    beside([...card.lines.map((value) => ({ color: PALETTE.plum, value })), status], well.y + 4);
    return rect;
  }
  beside([{ color: PALETTE.darkBrown, value: card.subtitle }, status], well.y + 4);
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
