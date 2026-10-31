import { animationKey } from "@andornaut/game-kit/art/aseprite";
import { containsPoint, insetRect, type Point, type Rect } from "@andornaut/game-kit/rect";
import type { GameObjects, Scene, Tweens } from "phaser";

import { SCREEN_LAYOUT } from "../data/screen";
import { FEEDBACK, loopFrame } from "../home/feedback";
import { BUTTON_SIZE } from "../ui/buttonGeometry";
import type { CloseControl } from "../ui/closeControl";
import {
  type ArtLook,
  buttonState,
  type InteractionInput,
  PLAIN_ITEM,
  type TileState,
  tileState,
} from "../ui/interaction";
import { MARK_OFFSET } from "../ui/mark";
import { PALETTE } from "../ui/palette";
import {
  CREAM_PANEL_COLOURS,
  drawFramedRect,
  drawPixelRows,
  drawRing,
  fillCutRect,
  fillRect,
} from "../ui/phaser/draw";
import { disabledTextureKey } from "../ui/phaser/greyTextures";
import {
  addPixelText,
  inkSpan,
  type PixelTextStyle,
  scalePixelText,
  setPixelText,
} from "../ui/phaser/pixelText";
import {
  BUTTON_COLOURS,
  BUTTON_LIP_PX,
  type ButtonLook,
  GREYED,
  SELECT_OUTSET,
  type SelectLook,
  selectLook,
} from "../ui/selection";
import { TEXT_SCALE } from "../ui/textFit";
import { TAP_BURST_SCENE_KEY } from "./sceneKeys";
import { firstTag, playEffect, playTag } from "./sprites";
import { listenTargetPress } from "./targetPress";

// Body text at 2x in plum, the screens' default text.
export const BODY_TEXT = { colour: PALETTE.plum, scale: TEXT_SCALE } as const;

// Text in BODY_TEXT unless style says otherwise, added to parent when there is one.
export function addBodyText(
  scene: Scene,
  parent: GameObjects.Container | undefined,
  at: Point,
  value: string,
  style: Partial<PixelTextStyle> = {},
): GameObjects.BitmapText {
  const label = addPixelText(scene, at.x, at.y, value, { ...BODY_TEXT, ...style });
  parent?.add(label);
  return label;
}

// A graphics object added to parent.
export function addGraphicsIn(scene: Scene, parent: GameObjects.Container): GameObjects.Graphics {
  const g = scene.add.graphics();
  parent.add(g);
  return g;
}

// Whether key's art is loaded with frames of this size, so art drawn for another layout is
// left for the drawn stand-in.
export function artFits(scene: Scene, key: string, size: { height: number; width: number }) {
  if (!scene.textures.exists(key)) {
    return false;
  }
  const texture = scene.textures.get(key);
  const frame = texture.get(texture.getFrameNames()[0]);
  return frame.realWidth === size.width && frame.realHeight === size.height;
}

// The UI kit's nine-slice borders, in pixels from each edge.
const SLICES = {
  // The gold outline on the Pet shop while anything in it is affordable.
  "ui-afford": { bottom: 8, left: 8, right: 8, top: 8 },
  "ui-button": { bottom: 5, left: 3, right: 3, top: 3 },
  // The detail card a held dog or gear tile opens, and the title band across it.
  "ui-detail-card": { bottom: 8, left: 8, right: 8, top: 8 },
  // A buff's well, widened into a card charm's plate: 1px cut corners and edges.
  "ui-effect-well": { bottom: 1, left: 1, right: 1, top: 1 },
  // The Pet shop's message plate across the list's top.
  "ui-hint": { bottom: 8, left: 8, right: 8, top: 8 },
  // The plate over a hit.
  "ui-hit-label": { bottom: 8, left: 8, right: 8, top: 8 },
  "ui-panel": { bottom: 4, left: 4, right: 4, top: 4 },
  // The owners' speech bubble.
  "ui-quip": { bottom: 8, left: 8, right: 8, top: 8 },
  // The Pet shop list's scrollbar: vertical three-slices with 3px caps.
  "ui-scroll-thumb": { bottom: 3, left: 0, right: 0, top: 3 },
  "ui-scroll-track": { bottom: 3, left: 0, right: 0, top: 3 },
  // The home screen's section frames: the top slice holds the frame and the heading band.
  "ui-section": { bottom: 3, left: 3, right: 3, top: 24 },
  "ui-select": { bottom: 8, left: 8, right: 8, top: 8 },
  // The shop's focused row, independent of selected cards and tabs.
  "ui-shop-focus": { bottom: 13, left: 13, right: 13, top: 13 },
  // A three-slice: 4px caps and a middle that stretches.
  "ui-slider": { bottom: 0, left: 4, right: 4, top: 0 },
  // The band behind a choice card row's subtitle.
  "ui-strip-well": { bottom: 8, left: 8, right: 8, top: 8 },
  // A walker, dog or gear tile's face, tagged by its interaction state.
  "ui-tile": { bottom: 4, left: 4, right: 4, top: 4 },
  // The walk's neighbourhood pill: a three-slice with 4px ends.
  "ui-zone-pill": { bottom: 0, left: 4, right: 4, top: 0 },
} as const;
export type SliceKey = keyof typeof SLICES;

// The texture frame an Aseprite tag shows at index, from the animation BootScene made for it.
export function tagFrame(
  scene: Scene,
  key: string,
  tag: string,
  index = 0,
): string | number | undefined {
  const frames = scene.anims.get(animationKey(key, tag))?.frames;
  if (frames === undefined || frames.length === 0) {
    return undefined;
  }
  return frames[index % frames.length]?.textureFrame;
}

// A nine-slice of a UI kit texture over rect, or undefined when the art is missing. tag picks
// a frame of a sprite; an image has none.
export function addNineSlice(
  scene: Scene,
  key: SliceKey,
  rect: Rect,
  tag?: string,
  index = 0,
): GameObjects.NineSlice | undefined {
  if (!scene.textures.exists(key)) {
    return undefined;
  }
  const frame = tag === undefined ? undefined : tagFrame(scene, key, tag, index);
  if (tag !== undefined && frame === undefined) {
    return undefined;
  }
  const { bottom, left, right, top } = SLICES[key];
  return scene.add
    .nineslice(rect.x, rect.y, key, frame, rect.width, rect.height, left, right, top, bottom)
    .setOrigin(0);
}

// One frame of a sprite's tag, placed by its top-left corner, or undefined when missing.
export function addTagImage(
  scene: Scene,
  key: string,
  tag: string,
  x: number,
  y: number,
): GameObjects.Image | undefined {
  const frame = tagFrame(scene, key, tag);
  return frame === undefined ? undefined : scene.add.image(x, y, key, frame).setOrigin(0);
}

// A ui-panel or another bubble or panel nine-slice, or a framed cream box while the art is
// missing.
export function addPanel(
  scene: Scene,
  rect: Rect,
  key: SliceKey = "ui-panel",
): GameObjects.Graphics | GameObjects.NineSlice {
  const panel = addNineSlice(scene, key, rect);
  if (panel !== undefined) {
    return panel;
  }
  const g = scene.add.graphics();
  drawFramedRect(g, CREAM_PANEL_COLOURS, rect);
  return g;
}

// A ui-panel in a 1px tan rim that keeps its edge clear of whatever is behind it. The rim
// leaves out its corner pixels, following the panel's rounded corners.
export function addRimmedPanel(scene: Scene, rect: Rect): void {
  const rim = scene.add.graphics();
  fillCutRect(rim, PALETTE.tan, insetRect(-1, rect), 1);
  addPanel(scene, rect);
}

// The ui-button tags of each look, raised then pressed, or one flat tag when disabled. A
// disabled primary is go-disabled, which looks like disabled.
const BUTTON_TAGS: Readonly<Record<ButtonLook, readonly string[]>> = {
  disabled: ["disabled"],
  normal: ["normal", "pressed"],
  primary: ["go", "go-pressed"],
  secondary: ["secondary", "secondary-pressed"],
};

// The ui-button's face sinks this far into its lip when pressed, as the art draws it.
export const BUTTON_PRESS_PX = BUTTON_SIZE.press;

// The exported button's one-pixel ink outline, raised highlight and lip, or flat sunk face.
function drawButtonChrome(
  g: GameObjects.Graphics,
  look: ButtonLook,
  pressed: boolean,
  rect: Rect,
): void {
  const { face, lip } = BUTTON_COLOURS[look];
  const top = pressed || lip === null ? BUTTON_PRESS_PX : 0;
  const drawn = { ...rect, height: rect.height - top, y: rect.y + top };
  fillCutRect(g, PALETTE.ink, drawn, 1);
  fillRect(g, PALETTE[face], insetRect(1, drawn));
  if (top === 0 && lip !== null) {
    fillRect(g, PALETTE[lip], {
      height: BUTTON_LIP_PX,
      width: rect.width - 2,
      x: rect.x + 1,
      y: rect.y + rect.height - BUTTON_LIP_PX - 1,
    });
    fillRect(g, look === "primary" ? PALETTE.yellow : PALETTE.white, {
      height: 1,
      width: rect.width - 2,
      x: rect.x + 1,
      y: rect.y + 1,
    });
  }
}

export interface MenuButton {
  readonly rect: Rect;
  setPressed(pressed: boolean): void;
}

// The button's faces, raised then pressed, or the one flat face when disabled.
export function buttonFaces(
  scene: Scene,
  primary: boolean,
  rect: Rect,
  look: ButtonLook,
): (GameObjects.Graphics | GameObjects.NineSlice)[] {
  return BUTTON_TAGS[look].map((tag, i) => {
    const artTag = look === "disabled" && primary ? "go-disabled" : tag;
    const slice = addNineSlice(scene, "ui-button", rect, artTag);
    if (slice !== undefined) {
      return slice;
    }
    const g = scene.add.graphics();
    drawButtonChrome(g, look, i === 1, rect);
    return g;
  });
}

interface MenuButtonInput extends Pick<InteractionInput, "available" | "primary"> {
  // The number key that presses the button, drawn like the label and MENU_BUTTON_KEY_GAP
  // before it, the two inks centred together as one group.
  readonly keyNumber?: string;
  // A label at scale with its capitals' top readyY rows under the button's top, as Start walk's
  // is, in place of a 2x label centred on the face.
  readonly labelAt?: { readonly readyY: number; readonly scale: number };
  // An available button that is not primary wears the secondary look, as a card's own
  // controls do, in place of normal.
  readonly secondary?: boolean;
}

// One word space at the label's size: a glyph advance and the tracking.
export const MENU_BUTTON_KEY_GAP = 16;

// The key number and the label, their inks MENU_BUTTON_KEY_GAP apart and centred together on
// centreX, on whole pixels.
function keyedLabels(
  scene: Scene,
  centreX: number,
  keyNumber: string,
  label: string,
  style: PixelTextStyle,
): GameObjects.BitmapText[] {
  const key = addPixelText(scene, 0, 0, keyNumber, style);
  const title = addPixelText(scene, 0, 0, label, style);
  const keyInk = inkSpan(key);
  const titleInk = inkSpan(title);
  const keyWidth = keyInk.right - keyInk.left;
  const width = keyWidth + MENU_BUTTON_KEY_GAP + (titleInk.right - titleInk.left);
  const left = Math.round(centreX - width / 2);
  key.setX(left - keyInk.left);
  title.setX(left + keyWidth + MENU_BUTTON_KEY_GAP - titleInk.left);
  return [key, title];
}

// A ui-button with a centred label in its interaction state, drawn in parent when given.
// Pressed shows the sunk frame and moves the label, and any key number, with it; disabled sits
// at the pressed depth and never moves.
export function addMenuButton(
  scene: Scene,
  rect: Rect,
  label: string,
  input: MenuButtonInput,
  parent?: GameObjects.Container,
): MenuButton {
  const state = buttonState(input);
  const look: ButtonLook = state === "normal" && input.secondary === true ? "secondary" : state;
  const faces = buttonFaces(scene, input.primary, rect, look);
  const disabled = state === "disabled";
  const { labelAt } = input;
  const style = {
    colour: PALETTE[BUTTON_COLOURS[look].label],
    font: "title",
    originY: labelAt === undefined ? 0.5 : 0,
    scale: labelAt?.scale ?? TEXT_SCALE,
  } as const;
  const centreX = rect.x + rect.width / 2;
  const labels =
    input.keyNumber === undefined
      ? [addPixelText(scene, centreX, 0, label, { ...style, originX: 0.5 })]
      : keyedLabels(scene, centreX, input.keyNumber, label, style);
  parent?.add([...faces, ...labels]);
  const centreY = rect.y + (rect.height - BUTTON_LIP_PX) / 2;
  const button: MenuButton = {
    rect,
    setPressed(pressed) {
      const [up, down] = faces;
      if (down !== undefined) {
        up?.setVisible(!pressed);
        down.setVisible(pressed);
      }
      const press = disabled || pressed ? BUTTON_PRESS_PX : 0;
      labels.forEach((text) =>
        text.setY(
          labelAt === undefined
            ? Math.round(centreY + press)
            : rect.y + labelAt.readyY + press - (text.getData("capTop") as number),
        ),
      );
    },
  };
  button.setPressed(false);
  return button;
}

// A screen whose one control is button: it shows pressed while held, and a release over it
// taps it. Every press bursts where it lands.
export function listenButtonTap(scene: Scene, button: MenuButton, onTap: () => void): void {
  listenTargetPress<MenuButton>(scene, {
    onDown: (pointer) => addTapBurst(scene, pointer.x, pointer.y),
    onPressed: (target) => button.setPressed(target !== undefined),
    onTap,
    targetAt: (x, y) => (containsPoint(button.rect, x, y) ? button : undefined),
  });
}

// A game object that can be placed and moved.
type Placed = GameObjects.GameObject & GameObjects.Components.Transform;

// The 20x20 ui-icon-button: its face sinks 2px when pressed, and the 16x16 icon on it sits at
// +2,+1, or +2,+3 when pressed.
const ICON_BUTTON = {
  iconX: 2,
  iconY: 1,
  pressPx: BUTTON_SIZE.press,
  size: BUTTON_SIZE.icon.face,
} as const;

export interface IconButton {
  setPressed(pressed: boolean): void;
}

// An icon button at (x, y) in parent. icon draws the 16x16 icon with its top-left at the
// given point and returns what it drew, so a press can move it.
export function addIconButton(
  scene: Scene,
  parent: GameObjects.Container,
  x: number,
  y: number,
  icon: (iconX: number, iconY: number) => Placed[],
): IconButton {
  const faces = (["normal", "pressed"] as const).map((tag) => {
    const image = addTagImage(scene, "ui-icon-button", tag, x, y);
    if (image !== undefined) {
      return image;
    }
    const g = scene.add.graphics();
    const top = tag === "pressed" ? ICON_BUTTON.pressPx : 0;
    const size = ICON_BUTTON.size;
    if (top === 0) {
      fillCutRect(g, PALETTE.brown, { height: 4, width: size, x, y: y + size - 4 }, 1);
    }
    const face = { height: size - 2, width: size, x, y: y + top };
    fillCutRect(g, PALETTE.tan, face, 1);
    fillRect(g, PALETTE.navy, insetRect(1, face));
    fillRect(g, PALETTE.darkSlate, { height: 1, width: size - 3, x: x + 1, y: y + top + 1 });
    return g;
  });
  parent.add(faces);
  const iconTop = y + ICON_BUTTON.iconY;
  const drawn = icon(x + ICON_BUTTON.iconX, iconTop);
  const starts = drawn.map((object) => object.y);
  parent.add(drawn);
  const button: IconButton = {
    setPressed(pressed) {
      faces[0]?.setVisible(!pressed);
      faces[1]?.setVisible(pressed);
      drawn.forEach((object, i) =>
        object.setY((starts[i] ?? iconTop) + (pressed ? ICON_BUTTON.pressPx : 0)),
      );
    },
  };
  button.setPressed(false);
  return button;
}

// icon-sound's on or off frame, or the word while the art is missing.
export function soundIcon(scene: Scene, on: boolean, x: number, y: number): Placed[] {
  const image = addTagImage(scene, "icon-sound", on ? "on" : "off", x, y);
  if (image !== undefined) {
    return [image];
  }
  return [
    addPixelText(scene, x + 8, y + 4, on ? "On" : "X", { colour: PALETTE.plum, originX: 0.5 }),
  ];
}

// The close control's face: icon-close on a ui-icon-button, or an X while the icon is missing.
export function addCloseButton(
  scene: Scene,
  parent: GameObjects.Container,
  control: CloseControl,
  pressed: boolean,
): IconButton {
  const button = addIconButton(scene, parent, control.x, control.y, (x, y) =>
    imageIconOr(scene, "icon-close", x, y, "X"),
  );
  button.setPressed(pressed);
  return button;
}

// An image icon by key, or nothing while the art is missing.
export function imageIcon(scene: Scene, key: string, x: number, y: number): Placed[] {
  return scene.textures.exists(key) ? [scene.add.image(x, y, key).setOrigin(0)] : [];
}

// An image icon by key, or letter on the icon button's face while the art is missing.
export function imageIconOr(
  scene: Scene,
  key: string,
  x: number,
  y: number,
  letter: string,
): Placed[] {
  const icon = imageIcon(scene, key, x, y);
  return icon.length > 0
    ? icon
    : [addPixelText(scene, x + 8, y + 4, letter, { colour: PALETTE.plum, originX: 0.5 })];
}

// A cog for settings, drawn in code: the art has no settings icon yet.
const COG_ROWS = [
  "...##...",
  ".##..##.",
  ".#....#.",
  "##.##.##",
  "##.##.##",
  ".#....#.",
  ".##..##.",
  "...##...",
];

function cogIcon(scene: Scene, x: number, y: number): Placed[] {
  const g = scene.add.graphics({ x, y });
  drawPixelRows(g, PALETTE.amber, COG_ROWS, { x: 0, y: 0 }, 2);
  return [g];
}

// icon-settings, or the cog while the art is missing.
export function settingsIcon(scene: Scene, x: number, y: number): Placed[] {
  const icon = imageIcon(scene, "icon-settings", x, y);
  return icon.length > 0 ? icon : cogIcon(scene, x, y);
}

// A door with an arrow out of it for Exit, drawn in code while icon-exit is missing.
const EXIT_ROWS = [
  "#####...",
  "#...#...",
  "#...#.#.",
  "#..#####",
  "#...#.#.",
  "#...#...",
  "#...#...",
  "#####...",
];

// icon-exit, or the door while the art is missing.
export function exitIcon(scene: Scene, x: number, y: number): Placed[] {
  const icon = imageIcon(scene, "icon-exit", x, y);
  if (icon.length > 0) {
    return icon;
  }
  const g = scene.add.graphics({ x, y });
  drawPixelRows(g, PALETTE.amber, EXIT_ROWS, { x: 0, y: 0 }, 2);
  return [g];
}

export function selectOuter(rect: Rect, outset = SELECT_OUTSET): Rect {
  return insetRect(-outset, rect);
}

// A looping outline nine-slice over outer, one nine-slice per frame of key's tag, shown one
// at a time from the scene's update, or holding its first frame with reduced motion. While
// the art is missing, drawFallback draws it instead.
export function addLoopingFrame(
  scene: Scene,
  parent: GameObjects.Container,
  frame: { key: SliceKey; outer: Rect; tag: string },
  reducedMotion: boolean,
  drawFallback: (g: GameObjects.Graphics) => void,
): void {
  const { key, outer, tag } = frame;
  const frames = scene.anims.get(animationKey(key, tag))?.frames ?? [];
  const slices = frames.flatMap((_, i) => {
    const slice = addNineSlice(scene, key, outer, tag, i);
    return slice === undefined ? [] : [slice];
  });
  const first = slices[0];
  if (first === undefined) {
    const g = scene.add.graphics();
    drawFallback(g);
    parent.add(g);
    return;
  }
  parent.add(slices);
  const durations = frames.map(({ duration }) => duration);
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

// The ui-select frame around rect at outset, playing its pulse tag. While the art is missing
// it is drawn as the art draws it, without the pulse: an ink line, a 2px amber band, and at
// the default outset an ink line on the edge.
export function addSelectFrame(
  scene: Scene,
  parent: GameObjects.Container,
  rect: Rect,
  reducedMotion: boolean,
  outset = SELECT_OUTSET,
): void {
  const outer = selectOuter(rect, outset);
  addLoopingFrame(scene, parent, { key: "ui-select", outer, tag: "pulse" }, reducedMotion, (g) => {
    drawRing(g, PALETTE.ink, outer, 1);
    drawRing(g, PALETTE.amber, insetRect(1, outer), 2);
    if (outset >= SELECT_OUTSET) {
      drawRing(g, PALETTE.ink, rect, 1);
    }
  });
}

// The shop's focus outline uses its own asset; selected tabs and cards keep ui-select.
export function addShopFocusFrame(
  scene: Scene,
  parent: GameObjects.Container,
  rect: Rect,
  reducedMotion: boolean,
): void {
  const outer = selectOuter(rect);
  addLoopingFrame(
    scene,
    parent,
    { key: "ui-shop-focus", outer, tag: "pulse" },
    reducedMotion,
    (g) => {
      const band = 3;
      const corner = 12;
      const pulse = insetRect(1, outer);
      drawRing(g, PALETTE.ink, outer, 1);
      drawRing(g, PALETTE.cyan, pulse, band);
      drawRing(g, PALETTE.ink, insetRect(1 + band, outer), 1);
      for (const y of [pulse.y, pulse.y + pulse.height - band]) {
        for (const x of [pulse.x, pulse.x + pulse.width - corner]) {
          fillRect(g, PALETTE.cream, { height: band, width: corner, x, y });
        }
      }
      for (const y of [pulse.y, pulse.y + pulse.height - corner]) {
        for (const x of [pulse.x, pulse.x + pulse.width - band]) {
          fillRect(g, PALETTE.cream, { height: corner, width: band, x, y });
        }
      }
    },
  );
}

// The ui-check mark at rect's top-left corner: tag is its art's tag, such as "tick". While the
// art is missing, a green square with the tag, or a plus for a tick.
function addSelectMark(
  scene: Scene,
  parent: GameObjects.Container,
  rect: Rect,
  tag: string,
): GameObjects.Image | undefined {
  const x = rect.x + MARK_OFFSET.x;
  const y = rect.y + MARK_OFFSET.y;
  const image = addTagImage(scene, "ui-check", tag, x, y);
  if (image !== undefined) {
    parent.add(image);
    return image;
  }
  const g = scene.add.graphics();
  fillRect(g, PALETTE.green, { height: 12, width: 12, x: x + 2, y: y + 2 });
  const label = addPixelText(scene, x + 8, y + 4, tag === "tick" ? "+" : tag, {
    colour: PALETTE.white,
    font: "title",
    originX: 0.5,
  });
  parent.add([g, label]);
  return undefined;
}

export interface SelectTile {
  // Moves for the lift and any dip or shake; holds the face, content, frame and mark.
  container: GameObjects.Container;
  // Where the caller adds the item's text and pictures: above the face, under the frame.
  content: GameObjects.Container;
  // The container's resting y: lifted when selected.
  lift: number;
  look: SelectLook;
  mark?: GameObjects.Image;
}

export interface SelectTileOptions {
  // Drawn in code, a slate edge marks the face out from what it sits on; a row on a panel
  // has none.
  edge: boolean;
  // The ui-check tag on a selected tile; none without one.
  mark?: string;
  // How far the ui-select frame sits outside the tile; SELECT_OUTSET when unset.
  outset?: number;
  reducedMotion: boolean;
  state: TileState;
  // A walker, dog or gear tile, drawn with ui-tile; other controls such as tabs draw their
  // face in code, inside ui-select when selected.
  tile: boolean;
}

// The face drawn in code, as ui-tile draws it, for controls without the art.
function drawTileFace(scene: Scene, edge: boolean, look: SelectLook, rect: Rect) {
  const g = scene.add.graphics();
  const fill = PALETTE[look.face];
  const border = look.state === "selected" ? PALETTE.ink : edge ? PALETTE[GREYED.edge] : fill;
  drawFramedRect(g, { border, fill }, rect);
  return g;
}

// Selected tile faces change UVs only, keeping their nine-slice size and origin intact.
function animateTileFace(
  scene: Scene,
  tag: string,
  reducedMotion: boolean,
  face: GameObjects.NineSlice,
): void {
  const frames = scene.anims.get(animationKey("ui-tile", tag))?.frames ?? [];
  if (reducedMotion || frames.length < 2) {
    return;
  }
  const durations = frames.map(({ duration }) => duration);
  let shown = 0;
  const show = () => {
    const index = loopFrame(false, durations, scene.time.now);
    const frame = frames[index]?.textureFrame;
    if (index !== shown && frame !== undefined) {
      face.setFrame(frame, false, false);
      face.updateUVs();
      shown = index;
    }
  };
  show();
  scene.events.on("update", show);
  face.once("destroy", () => scene.events.off("update", show));
}

// A tappable item in its interaction state. Selected, it has the gold face and any ui-check
// mark and is lifted 2px onto a plum shadow; a face drawn in code adds the ui-select frame.
// Normal, its face is cream. Disabled, it is flat grey and never lifts. The caller draws its
// pictures through tileTextureKey or addTileSprite in its look's art. The shadow goes in
// parent so it stays put under the lift.
export function addSelectTile(
  scene: Scene,
  parent: GameObjects.Container,
  rect: Rect,
  options: SelectTileOptions,
): SelectTile {
  const { edge, mark, outset, reducedMotion, state, tile: isTile } = options;
  const look = selectLook(state);
  const selected = state === "selected";
  const tag =
    isTile && selected ? firstTag(scene, "ui-tile", ["selected", "selected-static"]) : state;
  const art = isTile && tag !== undefined ? addNineSlice(scene, "ui-tile", rect, tag) : undefined;
  if (selected && art !== undefined && tag !== undefined) {
    animateTileFace(scene, tag, reducedMotion, art);
  }
  const framed = selected && art === undefined;
  if (selected) {
    const outer = framed ? selectOuter(rect, outset) : rect;
    const shadow = scene.add.graphics();
    fillRect(shadow, PALETTE.plum, {
      height: FEEDBACK.liftPx,
      width: outer.width - 2,
      x: outer.x + 2,
      y: outer.y + outer.height - FEEDBACK.liftPx,
    });
    parent.add(shadow);
  }
  const lift = selected ? -FEEDBACK.liftPx : 0;
  const container = scene.add.container(0, lift);
  parent.add(container);
  const face = art ?? drawTileFace(scene, edge, look, rect);
  const content = scene.add.container(0, 0);
  container.add([face, content]);
  const tile: SelectTile = { container, content, lift, look };
  if (framed) {
    addSelectFrame(scene, container, rect, reducedMotion, outset);
  }
  if (selected) {
    const image = mark === undefined ? undefined : addSelectMark(scene, container, rect, mark);
    if (image !== undefined) {
      tile.mark = image;
    }
  }
  return tile;
}

// A tab in parent: a face drawn in code, selected while it is the open tab, its select frame
// held still, and dipped while pressed, its label centred in the title font.
export function addTab(
  scene: Scene,
  parent: GameObjects.Container,
  rect: Rect,
  label: string,
  look: { open: boolean; pressed: boolean },
): void {
  const tile = addSelectTile(scene, parent, rect, {
    edge: true,
    reducedMotion: true,
    state: tileState({ ...PLAIN_ITEM, picked: look.open }),
    tile: false,
  });
  if (look.pressed) {
    tile.container.y += FEEDBACK.pressDipPx;
  }
  tile.content.add(
    addPixelText(scene, rect.x + rect.width / 2, rect.y + rect.height / 2, label, {
      colour: PALETTE[tile.look.text],
      font: "title",
      originX: 0.5,
      originY: 0.5,
      scale: TEXT_SCALE,
    }),
  );
}

// A picture's texture on a tile in its art look: grey is its disabled tile's grey copy.
export function tileTextureKey(scene: Scene, art: ArtLook, key: string): string {
  return art === "grey" ? disabledTextureKey(scene, key) : key;
}

// A sprite on a tile, placed by its top-left corner, playing tag, or holding its first frame
// while still. Grey art holds the first frame in its grey copy.
export function addTileSprite(
  scene: Scene,
  art: ArtLook,
  still: boolean,
  key: string,
  tag: string,
  at: { x: number; y: number },
): GameObjects.Sprite {
  if (art === "grey") {
    return scene.add
      .sprite(at.x, at.y, tileTextureKey(scene, art, key), tagFrame(scene, key, tag))
      .setOrigin(0);
  }
  const sprite = scene.add.sprite(at.x, at.y, key).setOrigin(0);
  playTag(sprite, key, tag, still);
  return sprite;
}

// Fades parts out over ms after delayMs, easing in, rising rise pixels as they go (0 fades
// them in place, as reduced motion does), then destroys them and calls done.
export function fadeAway(
  scene: Scene,
  parts: readonly GameObjects.GameObject[],
  timing: { delayMs?: number; ms: number; rise: number },
  done: () => void = () => undefined,
): Tweens.Tween {
  return scene.tweens.add({
    alpha: 0,
    delay: timing.delayMs ?? 0,
    duration: timing.ms,
    ease: "Sine.easeIn",
    onComplete: () => {
      parts.forEach((part) => part.destroy());
      done();
    },
    targets: [...parts],
    y: `-=${timing.rise}`,
  });
}

// The "$" and text in their labels, one font advance apart as "$<text>" sets them, at the scale
// place picks from the pair's ink width at 1x, the ink's first column at its left and the
// capitals' top at its top: the bank on the home screen's top bar and the walk bar's cash.
export function setDollarAmount(
  dollar: GameObjects.BitmapText,
  amount: GameObjects.BitmapText,
  text: string,
  place: (inkWidth: number) => { left: number; scale: number; top: number },
): void {
  setPixelText(amount, `$${text}`);
  scalePixelText(amount, 1, 0, 0);
  const whole = inkSpan(amount);
  const wholeAdvance = amount.width;
  setPixelText(amount, text);
  scalePixelText(amount, 1, 0, 0);
  const { left, scale, top } = place(whole.right - whole.left);
  // Each label's ink starts at the x it is placed at; "$" and the digits share a left side
  // bearing, so the two stay one advance apart.
  scalePixelText(dollar, scale, left, top);
  scalePixelText(amount, scale, left + (wholeAdvance - amount.width) * scale, top);
}

// fx-tap bursts where the finger lands on scene, drawn in the tap burst layer (TapBurstScene)
// over every scene, so it plays out over whatever the tap opens or whatever scene does next.
export function addTapBurst(scene: Scene, x: number, y: number): void {
  playEffect(scene.scene.get(TAP_BURST_SCENE_KEY), "fx-tap", "play", { x, y }, 0);
}

// The screen's art, or dark brown over the whole screen while it is missing or the screen has
// none.
export function addScreenBackdrop(scene: Scene, key?: string): void {
  if (key !== undefined && scene.textures.exists(key)) {
    scene.add.image(0, 0, key).setOrigin(0);
  } else {
    fillRect(scene.add.graphics(), PALETTE.darkBrown, SCREEN_LAYOUT.screen);
  }
}

// Destroys everything the scene drew except keep, such as an overlay's ramp dim.
export function clearScene(scene: Scene, keep: readonly GameObjects.GameObject[] = []): void {
  for (const child of [...scene.children.list]) {
    if (!keep.includes(child)) {
      child.destroy();
    }
  }
}
