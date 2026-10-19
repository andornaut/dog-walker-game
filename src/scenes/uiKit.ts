import type { GameObjects, Scene } from "phaser";

import { animationKey } from "../assets/asepriteAnimations";
import type { Rect } from "../layout/rect";
import { drawFramedRect, fillRect } from "./draw";
import { PALETTE } from "./palette";
import { addPixelText, setPixelText } from "./pixelText";
import { playTag } from "./sprites";

// Text is drawn at 2x so it reads on a phone; 1x is for incidental marks only.
export const TEXT_SCALE = 2;

// The UI kit's nine-slice borders, in pixels from each edge.
const SLICES = {
  "ui-button": { bottom: 5, left: 3, right: 3, top: 3 },
  "ui-panel": { bottom: 4, left: 4, right: 4, top: 4 },
  "ui-select": { bottom: 8, left: 8, right: 8, top: 8 },
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

// The ui-button's face sinks this far into its lip when pressed, as the art draws it.
const BUTTON_PRESS_PX = 2;
const BUTTON_LIP_PX = 4;

export interface MenuButton {
  readonly rect: Rect;
  setState(state: ButtonState): void;
}

// A ui-button with a centred label. Pressed shows the sunk frame and moves the label with it.
export function addMenuButton(scene: Scene, rect: Rect, label: string): MenuButton {
  const faces = (["normal", "pressed", "disabled"] as const).map((state) => {
    const slice = addNineSlice(scene, "ui-button", rect, state);
    if (slice !== undefined) {
      return slice;
    }
    const g = scene.add.graphics();
    const top = state === "pressed" ? BUTTON_PRESS_PX : 0;
    const face = { ...rect, height: rect.height - BUTTON_LIP_PX };
    if (state !== "pressed") {
      fillRect(g, state === "disabled" ? PALETTE.darkSlate : PALETTE.orange, rect);
    }
    fillRect(g, state === "disabled" ? PALETTE.slate : PALETTE.amber, { ...face, y: face.y + top });
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
