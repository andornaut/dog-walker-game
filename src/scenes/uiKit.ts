import type { GameObjects, Scene } from "phaser";

import { animationKey } from "../assets/asepriteAnimations";
import { FEEDBACK, loopFrame } from "../home/feedback";
import { type RestFace, type SelectLook, selectLook } from "../home/selection";
import type { Rect } from "../layout/rect";
import { drawFramedRect, fillRect } from "./draw";
import { PALETTE } from "./palette";
import { addPixelText, setPixelText } from "./pixelText";
import { playEffect, playTag } from "./sprites";

// Text is drawn at 2x so it reads on a phone; 1x is for incidental marks only.
export const TEXT_SCALE = 2;

// The UI kit's nine-slice borders, in pixels from each edge.
const SLICES = {
  "ui-button": { bottom: 5, left: 3, right: 3, top: 3 },
  "ui-panel": { bottom: 4, left: 4, right: 4, top: 4 },
  "ui-select": { bottom: 8, left: 8, right: 8, top: 8 },
  // A three-slice: 4px caps and a middle that stretches.
  "ui-slider": { bottom: 0, left: 4, right: 4, top: 0 },
} as const;
type SliceKey = keyof typeof SLICES;

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

// A ui-panel, or a framed cream box while the art is missing.
export function addPanel(scene: Scene, rect: Rect): GameObjects.GameObject {
  const panel = addNineSlice(scene, "ui-panel", rect);
  if (panel !== undefined) {
    return panel;
  }
  const g = scene.add.graphics();
  drawFramedRect(g, { border: PALETTE.plum, fill: PALETTE.cream }, rect);
  return g;
}

export type ButtonState = "disabled" | "normal" | "pressed";

// A screen's one main action is primary (amber); its other actions are secondary (tan).
export type ButtonRole = "primary" | "secondary";

const BUTTON_TAGS: Readonly<Record<ButtonRole, Record<ButtonState, string>>> = {
  primary: { disabled: "disabled", normal: "normal", pressed: "pressed" },
  secondary: { disabled: "disabled", normal: "secondary", pressed: "secondary-pressed" },
};

// The faces drawn while the art is missing: the lip under the face, and the face.
const BUTTON_FALLBACK: Readonly<Record<ButtonRole, { face: number; lip: number }>> = {
  primary: { face: PALETTE.amber, lip: PALETTE.orange },
  secondary: { face: PALETTE.tan, lip: PALETTE.brown },
};

// The ui-button's face sinks this far into its lip when pressed, as the art draws it.
const BUTTON_PRESS_PX = 2;
const BUTTON_LIP_PX = 4;

export interface MenuButton {
  readonly rect: Rect;
  setState(state: ButtonState): void;
}

// A ui-button with a centred label. Pressed shows the sunk frame and moves the label with it.
export function addMenuButton(
  scene: Scene,
  rect: Rect,
  label: string,
  role: ButtonRole = "primary",
): MenuButton {
  const fallback = BUTTON_FALLBACK[role];
  const faces = (["normal", "pressed", "disabled"] as const).map((state) => {
    const slice = addNineSlice(scene, "ui-button", rect, BUTTON_TAGS[role][state]);
    if (slice !== undefined) {
      return slice;
    }
    const g = scene.add.graphics();
    const top = state === "pressed" ? BUTTON_PRESS_PX : 0;
    const face = { ...rect, height: rect.height - BUTTON_LIP_PX };
    if (state !== "pressed") {
      fillRect(g, state === "disabled" ? PALETTE.darkSlate : fallback.lip, rect);
    }
    fillRect(g, state === "disabled" ? PALETTE.slate : fallback.face, {
      ...face,
      y: face.y + top,
    });
    return g;
  });
  const title = addPixelText(scene, rect.x + rect.width / 2, 0, label, {
    color: PALETTE.plum,
    font: "title",
    originX: 0.5,
    originY: 0.5,
    scale: TEXT_SCALE,
  });
  const centerY = rect.y + (rect.height - BUTTON_LIP_PX) / 2;
  const button: MenuButton = {
    rect,
    setState(state) {
      const states: readonly ButtonState[] = ["normal", "pressed", "disabled"];
      faces.forEach((face, i) => {
        face.setVisible(states[i] === state);
      });
      title.setY(Math.round(centerY + (state === "pressed" ? BUTTON_PRESS_PX : 0)));
      title.setTint(state === "disabled" ? PALETTE.lightGrey : PALETTE.plum);
    },
  };
  button.setState("normal");
  return button;
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

// ui-select sits this far outside a selected item on each side; its inner ink line lies on
// the item's edge.
export const SELECT_OUTSET = 3;

// The ui-check badge overhangs the item's top-left corner by this much.
const BADGE_OFFSET = { x: -6, y: -7 } as const;

export function selectOuter(rect: Rect): Rect {
  return {
    height: rect.height + SELECT_OUTSET * 2,
    width: rect.width + SELECT_OUTSET * 2,
    x: rect.x - SELECT_OUTSET,
    y: rect.y - SELECT_OUTSET,
  };
}

// A ring of the given thickness just inside rect's edge.
function drawRing(g: GameObjects.Graphics, color: number, rect: Rect, thickness: number): void {
  const { height, width, x, y } = rect;
  fillRect(g, color, { height: thickness, width, x, y });
  fillRect(g, color, { height: thickness, width, x, y: y + height - thickness });
  fillRect(g, color, { height, width: thickness, x, y });
  fillRect(g, color, { height, width: thickness, x: x + width - thickness, y });
}

function inset(rect: Rect, by: number): Rect {
  return {
    height: rect.height - by * 2,
    width: rect.width - by * 2,
    x: rect.x + by,
    y: rect.y + by,
  };
}

// The ui-select frame around rect, playing its pulse tag, or holding its first frame with
// reduced motion. Each frame is its own nine-slice, shown one at a time from the scene's
// update. While the art is missing it is drawn as the art draws it, without the pulse: an
// ink line either side of a 2px amber band.
export function addSelectFrame(
  scene: Scene,
  parent: GameObjects.Container,
  rect: Rect,
  reducedMotion: boolean,
): void {
  const outer = selectOuter(rect);
  const frames = scene.anims.get(animationKey("ui-select", "pulse"))?.frames ?? [];
  const slices = frames.flatMap((_, i) => {
    const slice = addNineSlice(scene, "ui-select", outer, "pulse", i);
    return slice === undefined ? [] : [slice];
  });
  const first = slices[0];
  if (first === undefined) {
    const g = scene.add.graphics();
    drawRing(g, PALETTE.ink, outer, 1);
    drawRing(g, PALETTE.amber, inset(outer, 1), 2);
    drawRing(g, PALETTE.ink, rect, 1);
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

// The ui-check badge at rect's top-left corner: tag is the pick order or "tick". While the
// art is missing, a green square with the order or a plus.
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
  // The ui-check tag on a selected tile.
  badge: string;
  // Unselected, a slate edge marks the tile out from what it sits on; a row on a panel has
  // none.
  edge: boolean;
  full: boolean;
  reducedMotion: boolean;
  rest: RestFace;
  selected: boolean;
}

// A tappable item in the style guide's selected and active state. Selected, it has a yellow
// face, the ui-select frame and a ui-check badge, and it is lifted 2px onto a plum shadow.
// Unselected, its face rests cream or tan, a ramp step darker when the choice is full,
// inside a slate edge if edge is set. The shadow goes in parent so it stays put under the
// lift.
export function addSelectTile(
  scene: Scene,
  parent: GameObjects.Container,
  rect: Rect,
  options: SelectTileOptions,
): SelectTile {
  const { badge, edge, full, reducedMotion, rest, selected } = options;
  const look = selectLook(rest, selected, full);
  if (selected) {
    const outer = selectOuter(rect);
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
  const face = scene.add.graphics();
  const fill = PALETTE[look.face];
  const border = selected ? PALETTE.ink : edge ? PALETTE.slate : fill;
  drawFramedRect(face, { border, fill }, rect);
  const content = scene.add.container(0, 0);
  container.add([face, content]);
  const tile: SelectTile = { container, content, lift, look };
  if (selected) {
    addSelectFrame(scene, container, rect, reducedMotion);
    const image = addSelectBadge(scene, container, rect, badge);
    if (image !== undefined) {
      tile.badge = image;
    }
  }
  return tile;
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
