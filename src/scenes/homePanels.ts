import type { GameObjects, Scene } from "phaser";

import { ownerFaceKey } from "../assets/spriteKeys";
import { gameData } from "../data";
import { SCREEN_LAYOUT } from "../data/screen";
import type { DetailCard, DetailPicture } from "../home/detail";
import {
  CARD_TEXT_ROOM,
  cardBand,
  detailCardLayout,
  detailCardRect,
  detailOwner,
  type DetailRow,
  HOME_LAYOUT,
} from "../home/homeLayout";
import { withNamePills } from "../hud/effectNames";
import { insetRect, type Point, type Rect } from "../lib/rect";
import { barTitleLeft } from "../ui/barTitle";
import { closeControl } from "../ui/closeControl";
import { addDim, drawFramedRect, drawRing } from "../ui/phaser/draw";
import { PALETTE } from "../ui/phaser/palette";
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
import { playFirstTag } from "./sprites";
import {
  addBodyText,
  addCloseButton,
  addLoopingFrame,
  addNineSlice,
  BODY_TEXT,
  selectOuter,
  type SliceKey,
} from "./uiKit";

// The home screen's drawing beyond its tiles: the gold outline on the Pet shop while the
// player can afford something in it, and the detail card that opens over the screen. Positions
// inside a piece are the art's, from the style guide.

const SCREEN = SCREEN_LAYOUT.screen;

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
  addDetailCard(scene, parent, rect, cardBand(rect));
  content.setPosition(rect.x, rect.y);
  parent.add([content, addCardTitle(scene, rect, title)]);
  addCloseButton(scene, parent, closeControl(rect), closePressed);
}

// The title of a card drawn as the detail card is: white 2x title text in its band, the
// capitals card.band.titleY under the band's top and the ink where barTitleLeft puts it beside
// the card's close control.
export function addCardTitle(scene: Scene, card: Rect, title: string): GameObjects.BitmapText {
  const band = cardBand(card);
  const label = addPixelText(scene, 0, 0, title, {
    colour: PALETTE.white,
    font: "title",
    scale: TEXT_SCALE,
  });
  const ink = inkSpan(label);
  const x = barTitleLeft(band, closeControl(card), ink.right - ink.left);
  placePixelText(label, x, band.y + CARD.band.titleY);
  return label;
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
  // Rows of text at the tops the card's layout gives them, each wrapped on the font within its
  // room at 2x.
  type Row = { colour: number; value: string };
  const lineCount = (row: Row, room: number) =>
    wrapPixelText(scene, BODY_TEXT, room, row.value).length;
  const draw = (rows: readonly Row[], x: number, room: number, tops: readonly number[]) =>
    rows.forEach((row, i) => {
      const y = tops[i] ?? 0;
      const lines = wrapPixelText(scene, BODY_TEXT, room, row.value);
      const label = addBodyText(scene, content, { x, y }, lines.join("\n"), {
        colour: row.colour,
      });
      addNamePills([label]);
    });
  const status: Row = {
    colour: card.locked ? PALETTE.darkRed : PALETTE.forest,
    value: card.status,
  };
  // Each effect's name a line leads with, as a perk's "Second chance: …", in its pill.
  const plum: Row[] = card.lines.map((value) => ({
    colour: PALETTE.plum,
    value: withNamePills(gameData, value),
  }));
  const subtitle: Row = { colour: PALETTE.darkBrown, value: card.subtitle };
  const owner = card.owner === undefined ? [] : [card.owner];
  const besideRows: (Row | Owner)[] =
    kind === "gear" ? [...plum, status] : [subtitle, ...owner, status];
  const belowRows = kind === "gear" ? [] : plum;
  const counts = (rows: readonly (Row | Owner)[], room: number): DetailRow[] =>
    rows.map((row) =>
      "dog" in row ? { roleLines: roleLines(scene, row.role).length } : lineCount(row, room),
    );
  const layout = detailCardLayout(pixelFontMetrics(scene, "body"), {
    below: counts(belowRows, CARD_TEXT_ROOM.full),
    beside: counts(besideRows, CARD_TEXT_ROOM.beside),
  });
  besideRows.forEach((row, i) => {
    const y = layout.beside[i] ?? 0;
    if ("dog" in row) {
      addDetailOwner(scene, content, { x: CARD.besideX, y }, row);
    } else {
      draw([row], CARD.besideX, CARD_TEXT_ROOM.beside, [y]);
    }
  });
  draw(belowRows, CARD.pad, CARD_TEXT_ROOM.full, layout.below);
  const rect = detailCardRect(SCREEN, layout.height);
  drawCardFrame(scene, parent, closePressed, rect, card.title, content);
  return rect;
}
