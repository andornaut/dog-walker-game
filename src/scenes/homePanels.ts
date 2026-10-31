import { insetRect, type Point, type Rect } from "@andornaut/game-kit/rect";
import type { GameObjects, Scene } from "phaser";

import { ownerFaceKey } from "../assets/spriteKeys";
import { gameData } from "../data";
import { type DetailCard, type DetailPart, detailParts, type DetailPicture } from "../home/detail";
import {
  CARD_TEXT_ROOM,
  cardTitleRow,
  detailCardLayout,
  detailOwner,
  type DetailRow,
  HOME_LAYOUT,
} from "../home/homeLayout";
import { MODAL, modalRect, modalTitleWidth } from "../home/modalLayout";
import { withNamePills } from "../hud/effectNames";
import { barTitleLeft } from "../ui/barTitle";
import { closeControl } from "../ui/closeControl";
import { PALETTE } from "../ui/palette";
import { addDim, drawFramedRect, drawRing } from "../ui/phaser/draw";
import {
  addPixelText,
  inkSpan,
  pixelFontMetrics,
  placePixelText,
  wrapPixelText,
} from "../ui/phaser/pixelText";
import { AFFORD_OUTSET } from "../ui/selection";
import { TEXT_SCALE } from "../ui/textFit";
import { addNamePills } from "./effectNameColours";
import { modalTextWidth } from "./modalMeasure";
import { playFirstTag } from "./sprites";
import {
  addBodyText,
  addCloseButton,
  addLoopingFrame,
  addNineSlice,
  BODY_TEXT,
  type IconButton,
  selectOuter,
  type SliceKey,
} from "./uiKit";

// The home screen's drawing beyond its tiles: the gold outline on the Pet shop while the
// player can afford something in it, and the detail card that opens over the screen. Positions
// inside a piece are the art's, from the style guide.

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

// A dim layer over dim, then the modal card; the content goes in a container placed at the card.
function drawCardFrame(
  scene: Scene,
  parent: GameObjects.Container,
  dim: Rect,
  closePressed: boolean,
  rect: Rect,
  title: string,
  content: GameObjects.Container,
): void {
  parent.add(addDim(scene, dim));
  addModalCard(scene, parent, rect, title, { pressed: closePressed });
  content.setPosition(rect.x, rect.y);
  parent.add(content);
}

// Every modal card's frame, in one layout: the ui-detail-card with no title bar, its title in
// plum on the card's title row (addCardTitle), and, for a card that closes, the close control in
// its top-right corner. close: whether that control shows pressed, or undefined for a card
// without one.
export function addModalCard(
  scene: Scene,
  parent: GameObjects.Container,
  card: Rect,
  title: string,
  close: { readonly pressed: boolean } | undefined,
): void {
  addDetailCard(scene, parent, card);
  const row = cardTitleRow(card);
  const label = addCardTitle(scene, card, title, close !== undefined, row.y + CARD.titleRow.titleY);
  parent.add(label);
  if (close !== undefined) {
    addCardClose(scene, parent, card, close.pressed);
  }
}

// A modal card's title, on any card's background: plum 2x title text, its capitals at capTop,
// the ink centred where barTitleLeft puts it on the card's title row: beside the close control
// on a card that closes, else across the card.
export function addCardTitle(
  scene: Scene,
  card: Rect,
  title: string,
  closes: boolean,
  capTop: number,
): GameObjects.BitmapText {
  const row = cardTitleRow(card);
  const label = addPixelText(scene, 0, 0, title, {
    colour: PALETTE.plum,
    font: "title",
    scale: TEXT_SCALE,
  });
  const ink = inkSpan(label);
  const x = barTitleLeft(row, closes ? closeControl(card) : undefined, ink.right - ink.left);
  placePixelText(label, x, capTop);
  return label;
}

// A modal card's close control in its top-right corner (closeControl), on any card's background.
export function addCardClose(
  scene: Scene,
  parent: GameObjects.Container,
  card: Rect,
  pressed: boolean,
): IconButton {
  return addCloseButton(scene, parent, closeControl(card), pressed);
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

// The ui-detail-card over card, or a framed cream card while the art is missing. The detail
// cards, the shop, settings and the purchase confirm all wear it (addModalCard).
function addDetailCard(scene: Scene, parent: GameObjects.Container, card: Rect): void {
  addFramedSlice(scene, parent, "ui-detail-card", card, {
    border: PALETTE.darkBrown,
    fill: PALETTE.cream,
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

type Owner = NonNullable<DetailCard["owner"]>;

// The role's 2x body text, in the card's role colour.
const ROLE_STYLE = { colour: PALETTE[CARD.owner.roleColour], scale: TEXT_SCALE } as const;

// The owner's role, wrapped within the name's room.
function roleLines(scene: Scene, role: string): string[] {
  return wrapPixelText(scene, ROLE_STYLE, CARD_TEXT_ROOM.ownerName, role);
}

// The owner's photo, name and role, the photo's top-left at at: their neutral face-owner-<art>
// face in the walk card's white mat and ink frame, and beside it their name over their role.
function addDetailOwner(
  scene: Scene,
  parent: GameObjects.Container,
  at: Point,
  owner: Owner,
): void {
  const role = roleLines(scene, owner.role);
  const spot = detailOwner(pixelFontMetrics(scene, "body"), at, role.length);
  const g = scene.add.graphics();
  drawFramedRect(g, { border: PALETTE.ink, fill: PALETTE.white }, spot.photo);
  parent.add(g);
  const key = ownerFaceKey(gameData, owner.dog);
  if (scene.textures.exists(key)) {
    const face = scene.add.sprite(spot.face.x, spot.face.y, key).setOrigin(0);
    playFirstTag(face, key, ["neutral"]);
    parent.add(face);
  }
  addBodyText(scene, parent, spot.name, owner.name, { colour: PALETTE[CARD.owner.nameColour] });
  role.forEach((line, i) =>
    parent.add(
      addPixelText(scene, spot.role.x, spot.role.y + i * spot.role.pitch, line, ROLE_STYLE),
    ),
  );
}

// A held dog's, walker's or gear item's detail card over a dim layer, as tall as what it
// shows, its rows beside the well and under it as detailParts places them. Returns the card's
// rect, so a tap outside it or on its close control closes it. dim is the part of the screen
// dimmed under it (overlayRegion on a home page).
export function drawDetailCard(
  scene: Scene,
  parent: GameObjects.Container,
  dim: Rect,
  closePressed: boolean,
  card: DetailCard,
  picture: DetailPicture,
  kind: "dog" | "gear" | "walker",
): Rect {
  // The content is laid out first, so the card is as tall as it needs.
  const content = scene.add.container(0, 0);
  const parts = detailParts(kind, card);
  // Each row of text's value: each effect's name a line leads with, as a perk's "Second
  // chance: …", in its pill.
  const valueOf = (part: Extract<DetailPart, { text: string }>) =>
    part.tone === "line" ? withNamePills(gameData, part.text) : part.text;
  const counts = (rows: readonly DetailPart[], room: number): DetailRow[] =>
    rows.map((row) =>
      "owner" in row
        ? { roleLines: roleLines(scene, row.owner.role).length }
        : wrapPixelText(scene, BODY_TEXT, room, valueOf(row)).length,
    );
  const layout = detailCardLayout(pixelFontMetrics(scene, "body"), {
    below: counts(parts.below, CARD_TEXT_ROOM.full),
    beside: counts(parts.beside, CARD_TEXT_ROOM.beside),
  });
  const { well } = CARD;
  const wellRect = { height: well.size, width: well.size, x: well.x, y: layout.wellY };
  addDetailWell(scene, content, wellRect);
  if (scene.textures.exists(picture.key)) {
    const inner = { x: wellRect.x + well.picture, y: wellRect.y + well.picture };
    content.add(
      scene.add.image(inner.x, inner.y, picture.key).setOrigin(0).setScale(picture.scale),
    );
  } else if (picture.fallback !== undefined && scene.textures.exists(picture.fallback)) {
    const centre = { x: wellRect.x + well.size / 2, y: wellRect.y + well.size / 2 };
    content.add(scene.add.image(centre.x, centre.y, picture.fallback));
  }
  const colours = {
    line: PALETTE.plum,
    status: card.locked ? PALETTE.darkRed : PALETTE.forest,
    subtitle: PALETTE.darkBrown,
  } as const;
  // Each row at the top the card's layout gives it, its text wrapped on the font within its
  // room at 2x.
  const draw = (rows: readonly DetailPart[], x: number, room: number, tops: readonly number[]) =>
    rows.forEach((row, i) => {
      const y = tops[i] ?? 0;
      if ("owner" in row) {
        addDetailOwner(scene, content, { x, y }, row.owner);
        return;
      }
      const lines = wrapPixelText(scene, BODY_TEXT, room, valueOf(row));
      const label = addBodyText(scene, content, { x, y }, lines.join("\n"), {
        colour: colours[row.tone],
      });
      addNamePills([label]);
    });
  draw(parts.beside, CARD.besideX, CARD_TEXT_ROOM.beside, layout.beside);
  draw(parts.below, CARD.pad, CARD_TEXT_ROOM.full, layout.below);
  const bounds = content.getBounds();
  const titleWidth = modalTextWidth(scene, "title", [card.title]);
  const width = Math.min(
    dim.width - 2 * MODAL.margin,
    Math.ceil(
      Math.max(
        wellRect.x + wellRect.width + MODAL.pad,
        bounds.right + MODAL.pad,
        modalTitleWidth(titleWidth),
      ),
    ),
  );
  const rect = modalRect(dim, undefined, { height: layout.height, width });
  drawCardFrame(scene, parent, dim, closePressed, rect, card.title, content);
  return rect;
}
