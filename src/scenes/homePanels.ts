import type { GameObjects, Scene } from "phaser";

import { SCREEN_CONFIG } from "../data/screen";
import type { DetailCard, DetailPicture } from "../home/detail";
import { CARD_TEXT_ROOM, detailCardLayout, HOME_LAYOUT } from "../home/homeLayout";
import { insetRect, type Rect } from "../lib/rect";
import { closeControl } from "../ui/closeControl";
import { addDim, drawFramedRect, drawRing, fillRect } from "../ui/phaser/draw";
import { PALETTE } from "../ui/phaser/palette";
import {
  addPixelText,
  fitPixelText,
  type FontRole,
  pixelFontMetrics,
  wrapPixelText,
} from "../ui/phaser/pixelText";
import { WRAPPING_TEXT_FIT_STYLES } from "../ui/textFit";
import { addCloseButton, addLoopingFrame, addNineSlice, selectOuter, TEXT_SCALE } from "./uiKit";

// The home screen's drawing beyond its tiles: the gold outline on the Pet shop while the
// player can afford something in it, and the detail card that opens over the screen. Positions
// inside a piece are the art's, from the style guide.

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

// A card height tall, centred on the screen.
function centredCard(height: number): Rect {
  return {
    height,
    width: CARD.width,
    x: (SCREEN.width - CARD.width) / 2,
    y: Math.round((SCREEN.height - height) / 2),
  };
}

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
  addCloseButton(scene, parent, closeControl(rect), closePressed);
  return content;
}

// The detail card's well the picture sits in.
export const DETAIL_WELL_KEY = "ui-detail-well";

// A held dog's, walker's or gear item's detail card over a dim layer, as tall as what it
// shows. A dog's or walker's card puts its breed and status beside the portrait and its rows
// below; a gear card puts its effect and status beside the icon. Returns the card's rect, so a
// tap outside it or on its close control closes it.
export function drawDetailCard(
  scene: Scene,
  parent: GameObjects.Container,
  closePressed: boolean,
  card: DetailCard,
  picture: DetailPicture,
  kind: "dog" | "gear" | "walker",
): Rect {
  // The content is laid out first, so the card is as tall as it needs.
  const content = scene.add.container(0, 0);
  const { well } = CARD;
  if (scene.textures.exists(DETAIL_WELL_KEY)) {
    content.add(scene.add.image(well.x, well.y, DETAIL_WELL_KEY).setOrigin(0));
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
  } else if (picture.fallback !== undefined && scene.textures.exists(picture.fallback)) {
    const centre = { x: well.x + well.size / 2, y: well.y + well.size / 2 };
    content.add(scene.add.image(centre.x, centre.y, picture.fallback));
  }
  // Rows of text at the tops the card's layout gives them: each wrapped on the font within its
  // room, or a fitted row on one line, its glyphs closer, before it wraps.
  type Row = { color: number; fit?: boolean; value: string };
  const style = { color: PALETTE.plum, scale: TEXT_SCALE };
  const fitted = (row: Row, room: number, x: number, y: number) => {
    const label = text(scene, content, { x, y }, row.value, { color: row.color });
    return {
      label,
      lines: fitPixelText(label, { room, styles: WRAPPING_TEXT_FIT_STYLES }, x, y).lines,
    };
  };
  const lineCount = (row: Row, room: number) => {
    if (row.fit !== true) {
      return wrapPixelText(scene, style, room, row.value).length;
    }
    const probe = fitted(row, room, 0, 0);
    probe.label.destroy();
    return probe.lines.length;
  };
  const draw = (rows: readonly Row[], x: number, room: number, tops: readonly number[]) =>
    rows.forEach((row, i) => {
      const y = tops[i] ?? 0;
      if (row.fit === true) {
        fitted(row, room, x, y);
      } else {
        const lines = wrapPixelText(scene, style, room, row.value);
        text(scene, content, { x, y }, lines.join("\n"), { color: row.color });
      }
    });
  const status: Row = {
    color: card.locked ? PALETTE.darkRed : PALETTE.forest,
    fit: true,
    value: card.status,
  };
  const plum: Row[] = card.lines.map((value) => ({ color: PALETTE.plum, value }));
  const besideRows: Row[] =
    kind === "gear"
      ? [...plum, status]
      : [{ color: PALETTE.darkBrown, value: card.subtitle }, status];
  const belowRows = kind === "gear" ? [] : plum;
  const layout = detailCardLayout(pixelFontMetrics(scene, "body"), {
    below: belowRows.map((row) => lineCount(row, CARD_TEXT_ROOM.full)),
    beside: besideRows.map((row) => lineCount(row, CARD_TEXT_ROOM.beside)),
  });
  draw(besideRows, CARD.besideX, CARD_TEXT_ROOM.beside, layout.beside);
  draw(belowRows, CARD.pad, CARD_TEXT_ROOM.full, layout.below);
  const rect = centredCard(layout.height);
  drawCardFrame(scene, parent, closePressed, rect, card.title, content);
  return rect;
}
