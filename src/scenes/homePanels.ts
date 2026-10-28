import type { GameObjects, Scene } from "phaser";

import { ownerFaceKey } from "../assets/spriteKeys";
import { gameData } from "../data";
import { SCREEN_LAYOUT } from "../data/screen";
import type { DogId } from "../data/types";
import type { DetailCard, DetailPicture } from "../home/detail";
import {
  CARD_TEXT_ROOM,
  cardBand,
  detailCardLayout,
  detailOwner,
  type DetailRow,
  HOME_LAYOUT,
  OWNER_ROW,
} from "../home/homeLayout";
import { withNamePills } from "../hud/effectNames";
import { insetRect, type Point, type Rect } from "../lib/rect";
import { closeControl } from "../ui/closeControl";
import { addDim, drawFramedRect, drawRing } from "../ui/phaser/draw";
import { PALETTE } from "../ui/phaser/palette";
import {
  addPixelText,
  fitPixelText,
  type FontRole,
  pixelFontMetrics,
  wrapPixelText,
} from "../ui/phaser/pixelText";
import { AFFORD_OUTSET } from "../ui/selection";
import { TEXT_SCALE, WRAPPING_TEXT_FIT_STYLES } from "../ui/textFit";
import { addNamePills } from "./effectNameColours";
import { playFirstTag } from "./sprites";
import { addCloseButton, addLoopingFrame, addNineSlice, selectOuter, type SliceKey } from "./uiKit";

// The home screen's drawing beyond its tiles: the gold outline on the Pet shop while the
// player can afford something in it, and the detail card that opens over the screen. Positions
// inside a piece are the art's, from the style guide.

const SCREEN = SCREEN_LAYOUT.screen;

function text(
  scene: Scene,
  parent: GameObjects.Container,
  at: { x: number; y: number },
  value: string,
  style: { colour: number; font?: FontRole; originX?: number },
): GameObjects.BitmapText {
  const label = addPixelText(scene, at.x, at.y, value, { scale: TEXT_SCALE, ...style });
  parent.add(label);
  return label;
}

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

// A dim layer over the whole screen, then the card's frame, title band and close control; the
// content goes in a container placed at the card.
function drawCardFrame(
  scene: Scene,
  parent: GameObjects.Container,
  closePressed: boolean,
  rect: Rect,
  title: string,
  content: GameObjects.Container,
): void {
  parent.add(addDim(scene, SCREEN));
  const { inset, titleY } = CARD.band;
  addDetailCard(scene, parent, rect, cardBand(rect));
  content.setPosition(rect.x, rect.y);
  parent.add(content);
  text(scene, content, { x: rect.width / 2, y: inset + titleY }, title, {
    colour: PALETTE.white,
    font: "title",
    originX: 0.5,
  });
  addCloseButton(scene, parent, closeControl(rect), closePressed);
}

// A nine-slice in parent, or the rect framed in code while its art is missing.
function addFramedSlice(
  scene: Scene,
  parent: GameObjects.Container,
  key: SliceKey,
  rect: Rect,
  colours: { border: number; fill: number },
): void {
  const slice = addNineSlice(scene, key, rect);
  if (slice !== undefined) {
    parent.add(slice);
    return;
  }
  const g = scene.add.graphics();
  drawFramedRect(g, colours, rect);
  parent.add(g);
}

// The ui-detail-card over card with its ui-detail-band over band, or a framed cream card and a
// forest band while the art is missing. The detail cards, the shop, settings and the purchase
// confirm all wear it.
export function addDetailCard(
  scene: Scene,
  parent: GameObjects.Container,
  card: Rect,
  band: Rect,
): void {
  addFramedSlice(scene, parent, "ui-detail-card", card, {
    border: PALETTE.darkBrown,
    fill: PALETTE.cream,
  });
  addFramedSlice(scene, parent, "ui-detail-band", band, {
    border: PALETTE.forest,
    fill: PALETTE.forest,
  });
}

// The detail card's well the picture sits in.
export const DETAIL_WELL_KEY = "ui-detail-well";

// The detail card's well at rect's top-left, or a framed grey box while its art is missing.
export function addDetailWell(scene: Scene, parent: GameObjects.Container, rect: Rect): void {
  if (scene.textures.exists(DETAIL_WELL_KEY)) {
    parent.add(scene.add.image(rect.x, rect.y, DETAIL_WELL_KEY).setOrigin(0));
    return;
  }
  const g = scene.add.graphics();
  drawFramedRect(g, { border: PALETTE.plum, fill: PALETTE.grey }, rect);
  parent.add(g);
}

// The photo and name of dog's owner, the photo's top-left at at: the neutral face-owner-<art>
// face in the walk card's white mat and ink frame, and the name beside it.
function addDetailOwner(scene: Scene, parent: GameObjects.Container, at: Point, dog: DogId): void {
  const owner = detailOwner(pixelFontMetrics(scene, "body"), at);
  const g = scene.add.graphics();
  drawFramedRect(g, { border: PALETTE.ink, fill: PALETTE.white }, owner.photo);
  parent.add(g);
  const key = ownerFaceKey(gameData, dog);
  if (scene.textures.exists(key)) {
    const face = scene.add.sprite(owner.face.x, owner.face.y, key).setOrigin(0);
    playFirstTag(face, key, ["neutral"]);
    parent.add(face);
  }
  text(scene, parent, owner.name, gameData.dogs[dog].owner.name, {
    colour: PALETTE[CARD.owner.nameColour],
  });
}

// A held dog's, walker's or gear item's detail card over a dim layer, as tall as what it
// shows. A dog's or walker's card puts its breed and status beside the portrait and its rows
// below, a dog's with its owner's photo and name between its breed and status; a gear card
// puts its effect and status beside the icon. Returns the card's rect, so a tap outside it or
// on its close control closes it.
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
  addDetailWell(scene, content, { height: well.size, width: well.size, x: well.x, y: well.y });
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
  type Row = { colour: number; fit?: boolean; value: string };
  const style = { colour: PALETTE.plum, scale: TEXT_SCALE };
  const fitted = (row: Row, room: number, x: number, y: number) => {
    const label = text(scene, content, { x, y }, row.value, { colour: row.colour });
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
      const label =
        row.fit === true
          ? fitted(row, room, x, y).label
          : text(
              scene,
              content,
              { x, y },
              wrapPixelText(scene, style, room, row.value).join("\n"),
              {
                colour: row.colour,
              },
            );
      addNamePills([label]);
    });
  const status: Row = {
    colour: card.locked ? PALETTE.darkRed : PALETTE.forest,
    fit: true,
    value: card.status,
  };
  // Each effect's name a line leads with, as a perk's "Second chance: …", in its pill.
  const plum: Row[] = card.lines.map((value) => ({
    colour: PALETTE.plum,
    value: withNamePills(gameData, value),
  }));
  const subtitle: Row = { colour: PALETTE.darkBrown, value: card.subtitle };
  const owner = card.owner === undefined ? [] : [OWNER_ROW];
  const besideRows: (Row | typeof OWNER_ROW)[] =
    kind === "gear" ? [...plum, status] : [subtitle, ...owner, status];
  const belowRows = kind === "gear" ? [] : plum;
  const counts = (rows: readonly (Row | typeof OWNER_ROW)[], room: number): DetailRow[] =>
    rows.map((row) => (row === OWNER_ROW ? row : lineCount(row, room)));
  const layout = detailCardLayout(pixelFontMetrics(scene, "body"), {
    below: counts(belowRows, CARD_TEXT_ROOM.full),
    beside: counts(besideRows, CARD_TEXT_ROOM.beside),
  });
  besideRows.forEach((row, i) => {
    const y = layout.beside[i] ?? 0;
    if (row !== OWNER_ROW) {
      draw([row], CARD.besideX, CARD_TEXT_ROOM.beside, [y]);
    } else if (card.owner !== undefined) {
      addDetailOwner(scene, content, { x: CARD.besideX, y }, card.owner);
    }
  });
  draw(belowRows, CARD.pad, CARD_TEXT_ROOM.full, layout.below);
  const rect = centredCard(layout.height);
  drawCardFrame(scene, parent, closePressed, rect, card.title, content);
  return rect;
}
