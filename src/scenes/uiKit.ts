import type { GameObjects, Scene } from "phaser";

import { animationKey } from "../assets/asepriteAnimations";
import { FEEDBACK, loopFrame } from "../home/feedback";
import { buttonState, type InteractionInput, type TileState } from "../home/interaction";
import {
  BUTTON_COLORS,
  type ButtonLook,
  DISABLED_COLORS,
  type SelectLook,
  selectLook,
} from "../home/selection";
import { BADGE_OFFSET } from "../layout/badge";
import { type CloseControl, closeControl } from "../layout/closeControl";
import { containsPoint, insetRect, type Rect } from "../layout/rect";
import { TEXT_SCALE } from "../layout/textFit";
import { drawFramedRect, drawRing, fillRect } from "./draw";
import { disabledTextureKey } from "./greyTextures";
import { PALETTE } from "./palette";
import { addPixelText, setPixelText } from "./pixelText";
import { playEffect, playTag } from "./sprites";
import { listenTargetPress } from "./targetPress";

// Text is drawn at 2x so it reads on a phone; 1x is for incidental marks only.
// Whether key's art is loaded with frames of this size, so art drawn for another layout is
// left for the drawn stand-in.
export function artFits(scene: Scene, key: string, size: { height: number; width: number }) {
  if (!scene.textures.exists(key)) {
    return false;
  }
  const texture = scene.textures.get(key);
  const frame = texture.get(texture.getFrameNames()[0]);
  return frame.width === size.width && frame.height === size.height;
}

export { TEXT_SCALE };

// The UI kit's nine-slice borders, in pixels from each edge.
const SLICES = {
  // The gold outline on anything the player can afford.
  "ui-afford": { bottom: 8, left: 8, right: 8, top: 8 },
  "ui-button": { bottom: 5, left: 3, right: 3, top: 3 },
  // The detail card a held dog or gear tile opens, and the three-slice title band across it.
  "ui-detail-band": { bottom: 0, left: 8, right: 8, top: 0 },
  "ui-detail-card": { bottom: 8, left: 8, right: 8, top: 8 },
  // The plate over a hit.
  "ui-hint": { bottom: 8, left: 8, right: 8, top: 8 },
  "ui-hit-label": { bottom: 8, left: 8, right: 8, top: 8 },
  "ui-panel": { bottom: 4, left: 4, right: 4, top: 4 },
  // The owners' speech bubble.
  "ui-quip": { bottom: 8, left: 8, right: 8, top: 8 },
  // The home screen's section frames: the top slice holds the frame and the heading band.
  "ui-section": { bottom: 3, left: 3, right: 3, top: 24 },
  "ui-select": { bottom: 8, left: 8, right: 8, top: 8 },
  // A three-slice: 4px caps and a middle that stretches.
  "ui-slider": { bottom: 0, left: 4, right: 4, top: 0 },
  // The band behind a choice card row's subtitle.
  "ui-strip-well": { bottom: 8, left: 8, right: 8, top: 8 },
  // A walker, dog or gear tile's face, tagged by its interaction state.
  "ui-tile": { bottom: 4, left: 4, right: 4, top: 4 },
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
  drawFramedRect(g, { border: PALETTE.plum, fill: PALETTE.cream }, rect);
  return g;
}

// A ui-panel in a 1px tan rim that keeps its edge clear of whatever is behind it. The rim
// leaves out its corner pixels, following the panel's rounded corners.
export function addRimmedPanel(scene: Scene, rect: Rect): void {
  const rim = scene.add.graphics();
  fillRect(rim, PALETTE.tan, { ...rect, height: rect.height + 2, y: rect.y - 1 });
  fillRect(rim, PALETTE.tan, { ...rect, width: rect.width + 2, x: rect.x - 1 });
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
const BUTTON_PRESS_PX = 2;
const BUTTON_LIP_PX = 4;

// A disabled button drawn in code: a flat grey face in an ink line, pressPx down with no
// lip, so it never looks raised.
export function drawDisabledButton(
  g: GameObjects.Graphics,
  lipPx: number,
  pressPx: number,
  rect: Rect,
): void {
  drawFramedRect(
    g,
    { border: PALETTE.ink, fill: PALETTE[DISABLED_COLORS.face] },
    { ...rect, height: rect.height - lipPx, y: rect.y + pressPx },
  );
}

export interface MenuButton {
  readonly rect: Rect;
  setPressed(pressed: boolean): void;
}

// The button's faces, raised then pressed, or the one flat face when disabled.
function buttonFaces(
  scene: Scene,
  primary: boolean,
  rect: Rect,
  look: ButtonLook,
): (GameObjects.Graphics | GameObjects.NineSlice)[] {
  const { face: faceColor, lip } = BUTTON_COLORS[look];
  return BUTTON_TAGS[look].map((tag, i) => {
    const artTag = look === "disabled" && primary ? "go-disabled" : tag;
    const slice = addNineSlice(scene, "ui-button", rect, artTag);
    if (slice !== undefined) {
      return slice;
    }
    const g = scene.add.graphics();
    if (lip === null) {
      drawDisabledButton(g, BUTTON_LIP_PX, BUTTON_PRESS_PX, rect);
      return g;
    }
    const pressed = i === 1;
    const face = { ...rect, height: rect.height - BUTTON_LIP_PX };
    if (!pressed) {
      fillRect(g, PALETTE[lip], rect);
    }
    fillRect(g, PALETTE[faceColor], { ...face, y: face.y + (pressed ? BUTTON_PRESS_PX : 0) });
    return g;
  });
}

export interface MenuButtonInput extends Pick<InteractionInput, "available" | "primary"> {
  // An available button that is not primary wears the secondary look, as a card's own
  // controls do, in place of normal.
  readonly secondary?: boolean;
}

// A ui-button with a centred label in its interaction state, drawn in parent when given.
// Pressed shows the sunk frame and moves the label with it; disabled sits at the pressed depth
// and never moves.
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
  const title = addPixelText(scene, rect.x + rect.width / 2, 0, label, {
    color: PALETTE[BUTTON_COLORS[look].label],
    font: "title",
    originX: 0.5,
    originY: 0.5,
    scale: TEXT_SCALE,
  });
  parent?.add([...faces, title]);
  const centerY = rect.y + (rect.height - BUTTON_LIP_PX) / 2;
  const button: MenuButton = {
    rect,
    setPressed(pressed) {
      const [up, down] = faces;
      if (down !== undefined) {
        up?.setVisible(!pressed);
        down.setVisible(pressed);
      }
      title.setY(Math.round(centerY + (disabled || pressed ? BUTTON_PRESS_PX : 0)));
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
const ICON_BUTTON = { iconX: 2, iconY: 1, pressPx: 2, size: 20 } as const;

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
    drawFramedRect(
      g,
      { border: PALETTE.plum, fill: PALETTE.cream },
      { height: size - top, width: size, x, y: y + top },
    );
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
    addPixelText(scene, x + 8, y + 4, on ? "On" : "X", { color: PALETTE.plum, originX: 0.5 }),
  ];
}

// The close control in frame's top-right corner: icon-close on a ui-icon-button, or an X
// while the icon is missing. Returns where it sits, so the caller can hit-test its target.
export function addCloseButton(
  scene: Scene,
  parent: GameObjects.Container,
  frame: Rect,
  pressed: boolean,
): CloseControl {
  const control = closeControl(frame);
  const button = addIconButton(scene, parent, control.x, control.y, (x, y) => {
    const icon = imageIcon(scene, "icon-close", x, y);
    return icon.length > 0
      ? icon
      : [addPixelText(scene, x + 8, y + 4, "X", { color: PALETTE.plum, originX: 0.5 })];
  });
  button.setPressed(pressed);
  return control;
}

// An image icon by key, or nothing while the art is missing.
export function imageIcon(scene: Scene, key: string, x: number, y: number): Placed[] {
  return scene.textures.exists(key) ? [scene.add.image(x, y, key).setOrigin(0)] : [];
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

export function cogIcon(scene: Scene, x: number, y: number): Placed[] {
  const g = scene.add.graphics({ x, y });
  g.fillStyle(PALETTE.amber);
  COG_ROWS.forEach((row, dy) => {
    [...row].forEach((cell, dx) => {
      if (cell === "#") {
        g.fillRect(dx * 2, dy * 2, 2, 2);
      }
    });
  });
  return [g];
}

// ui-select sits this far outside a selected item on each side by default; its inner ink
// line then lies on the item's edge.
export const SELECT_OUTSET = 3;

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

// The ui-check badge at rect's top-left corner: tag is its art's tag, such as "tick". While the
// art is missing, a green square with the tag, or a plus for a tick.
export function addSelectBadge(
  scene: Scene,
  parent: GameObjects.Container,
  rect: Rect,
  tag: string,
): GameObjects.Image | undefined {
  const x = rect.x + BADGE_OFFSET.x;
  const y = rect.y + BADGE_OFFSET.y;
  const image = addTagImage(scene, "ui-check", tag, x, y);
  if (image !== undefined) {
    parent.add(image);
    return image;
  }
  const g = scene.add.graphics();
  fillRect(g, PALETTE.green, { height: 12, width: 12, x: x + 2, y: y + 2 });
  const label = addPixelText(scene, x + 8, y + 4, tag === "tick" ? "+" : tag, {
    color: PALETTE.white,
    font: "title",
    originX: 0.5,
  });
  parent.add([g, label]);
  return undefined;
}

export interface SelectTile {
  badge?: GameObjects.Image;
  // Moves for the lift and any dip or shake; holds the face, content, frame and badge.
  container: GameObjects.Container;
  // Where the caller adds the item's text and pictures: above the face, under the frame.
  content: GameObjects.Container;
  // The container's resting y: lifted when selected.
  lift: number;
  look: SelectLook;
}

export interface SelectTileOptions {
  // The ui-check tag on a selected tile; none without one.
  badge?: string;
  // Drawn in code, a slate edge marks the face out from what it sits on; a row on a panel
  // has none.
  edge: boolean;
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
  const border =
    look.state === "selected" ? PALETTE.ink : edge ? PALETTE[DISABLED_COLORS.edge] : fill;
  drawFramedRect(g, { border, fill }, rect);
  return g;
}

// A tappable item in its interaction state. Selected, it has the gold face and any ui-check
// badge and is lifted 2px onto a plum shadow; a face drawn in code adds the ui-select frame.
// Normal, its face is cream. Disabled, it is flat grey and never lifts, and the caller draws
// its pictures through tileTextureKey or addTileSprite. The shadow goes in parent so it
// stays put under the lift.
export function addSelectTile(
  scene: Scene,
  parent: GameObjects.Container,
  rect: Rect,
  options: SelectTileOptions,
): SelectTile {
  const { badge, edge, outset, reducedMotion, state, tile: isTile } = options;
  const look = selectLook(state);
  const selected = state === "selected";
  const art = isTile ? addNineSlice(scene, "ui-tile", rect, state) : undefined;
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
    const image = badge === undefined ? undefined : addSelectBadge(scene, container, rect, badge);
    if (image !== undefined) {
      tile.badge = image;
    }
  }
  return tile;
}

// A picture's texture on a tile in state: a disabled tile's is its grey copy a ramp step
// darker.
export function tileTextureKey(scene: Scene, state: TileState, key: string): string {
  return state === "disabled" ? disabledTextureKey(scene, key) : key;
}

// A sprite on a tile, placed by its top-left corner, playing tag, or holding its first frame
// with reduced motion. A disabled tile's holds the first frame in its disabled copy.
export function addTileSprite(
  scene: Scene,
  state: TileState,
  reducedMotion: boolean,
  key: string,
  tag: string,
  at: { x: number; y: number },
): GameObjects.Sprite {
  if (state === "disabled") {
    return scene.add
      .sprite(at.x, at.y, tileTextureKey(scene, state, key), tagFrame(scene, key, tag))
      .setOrigin(0);
  }
  const sprite = scene.add.sprite(at.x, at.y, key).setOrigin(0);
  showTag(reducedMotion, sprite, key, tag);
  return sprite;
}

// A bubble that has said its piece fades out over this long, as owners' quips do.
export const BUBBLE_FADE_MS = 400;

// Fades parts out over ms after delayMs, easing in, rising rise pixels as they go (0 fades
// them in place, as reduced motion does), then destroys them and calls done.
export function fadeAway(
  scene: Scene,
  parts: readonly GameObjects.GameObject[],
  timing: { delayMs?: number; ms: number; rise: number },
  done: () => void = () => undefined,
): void {
  scene.tweens.add({
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

// Kept by clearScene, so a tap's sparkle plays on while the screen is drawn again under it.
const KEEP_ON_REDRAW = "keep-on-redraw";
const TAP_BURST_DEPTH = 100;

// fx-tap bursts where the finger lands, over everything else.
export function addTapBurst(scene: Scene, x: number, y: number): void {
  playEffect(scene, "fx-tap", "play", { x, y }, TAP_BURST_DEPTH)?.setName(KEEP_ON_REDRAW);
}

// Destroys everything the scene drew except tap bursts still playing.
export function clearScene(scene: Scene): void {
  for (const child of [...scene.children.list]) {
    if (child.name !== KEEP_ON_REDRAW) {
      child.destroy();
    }
  }
}

// Plays a looping tag, or with reduced motion holds its first frame.
export function showTag(
  reducedMotion: boolean,
  sprite: GameObjects.Sprite,
  key: string,
  tag: string,
): void {
  if (!reducedMotion) {
    playTag(sprite, key, tag);
    return;
  }
  const frame = tagFrame(sprite.scene, key, tag);
  if (frame !== undefined) {
    sprite.stop();
    sprite.setFrame(frame);
  }
}

// Sets the first candidate that fits maxWidth at the label's font and scale, else the last.
export function fitText(
  label: GameObjects.BitmapText,
  maxWidth: number,
  candidates: readonly string[],
): void {
  for (const candidate of candidates) {
    setPixelText(label, candidate);
    if (label.width <= maxWidth) {
      return;
    }
  }
}
