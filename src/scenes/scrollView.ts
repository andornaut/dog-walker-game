import type { GameObjects, Input, Scene } from "phaser";

import { SCREEN_CONFIG } from "../data/screen";
import {
  dragScroll,
  isDragging,
  type ListScroll,
  pressScroll,
  releaseScroll,
  type ScrollRule,
  wheelScroll,
} from "../input/listScroll";
import { containsPoint, type Rect } from "../lib/rect";
import { fillRect } from "../ui/phaser/draw";
import { PALETTE } from "../ui/phaser/palette";
import { listenOnePress } from "./onePress";
import { currentSettings } from "./profileStore";
import { paintRectMask } from "./rectMask";
import { addNineSlice } from "./uiKit";

// A scrollbar as drawn: the art's thumb, or the fallback's graphics.
export type ScrollbarView =
  | { readonly kind: "art"; readonly thumb: GameObjects.NineSlice }
  | { readonly graphics: GameObjects.Graphics; readonly kind: "fallback" };

interface ScrollbarRects {
  readonly thumb: Rect;
  readonly track: Rect;
}

// Beside a list longer than its view: ui-scroll-track with ui-scroll-thumb in it, or a navy
// track and a yellow thumb while the art is missing. undefined for a list that fits (bar null).
// placeScrollbar moves the thumb.
export function addScrollbar(
  scene: Scene,
  root: GameObjects.Container,
  bar: ScrollbarRects | null,
): ScrollbarView | undefined {
  if (bar === null) {
    return undefined;
  }
  const track = addNineSlice(scene, "ui-scroll-track", bar.track);
  const thumb = addNineSlice(scene, "ui-scroll-thumb", bar.thumb);
  if (track !== undefined && thumb !== undefined) {
    root.add([track, thumb]);
    return { kind: "art", thumb };
  }
  track?.destroy();
  thumb?.destroy();
  const graphics = scene.add.graphics();
  root.add(graphics);
  const view: ScrollbarView = { graphics, kind: "fallback" };
  placeScrollbar(bar, view);
  return view;
}

// The scrollbar's thumb at bar.
export function placeScrollbar(bar: ScrollbarRects | null, view: ScrollbarView | undefined): void {
  if (view === undefined || bar === null) {
    return;
  }
  if (view.kind === "art") {
    view.thumb.setPosition(bar.thumb.x, bar.thumb.y).setSize(bar.thumb.width, bar.thumb.height);
    return;
  }
  view.graphics.clear();
  fillRect(view.graphics, PALETTE.navy, bar.track);
  fillRect(view.graphics, PALETTE.yellow, bar.thumb);
}

// Clips list to rect, through a screen-sized texture named key, white over rect and repainted
// when rect changes (paintRectMask). Without WebGL there are no filters and the list is not
// clipped.
export function maskToRect(
  scene: Scene,
  key: string,
  rect: Rect,
  list: GameObjects.Container,
): void {
  if (paintRectMask(scene.textures, SCREEN_CONFIG, key, rect) === undefined) {
    return;
  }
  list.enableFilters().filters?.internal.addMask(key);
}

interface ListScrollHandlers {
  // Whether the list takes presses and the wheel now, with nothing over it.
  readonly active: () => boolean;
  // A press past the drag distance: the press under way taps nothing.
  readonly onDragStart: () => void;
  // Draws the list and its scrollbar at the scroll.
  readonly place: () => void;
  readonly rule: ScrollRule;
  readonly scroll: () => ListScroll;
  readonly setScroll: (scroll: ListScroll) => void;
  // Where a press drags the list.
  readonly view: Rect;
}

// A finger or mouse that lands on the view drags the list once it passes the drag distance,
// and the wheel moves it.
export function listenListScroll(scene: Scene, handlers: ListScrollHandlers): void {
  const { rule } = handlers;
  listenOnePress(scene, {
    down: (pointer) => {
      if (handlers.active() && containsPoint(handlers.view, pointer.x, pointer.y)) {
        handlers.setScroll(pressScroll(pointer.y, scene.time.now, handlers.scroll()));
      }
    },
    move: (pointer) => {
      const was = isDragging(handlers.scroll());
      handlers.setScroll(dragScroll(rule, pointer.y, scene.time.now, handlers.scroll()));
      if (!isDragging(handlers.scroll())) {
        return;
      }
      if (!was) {
        handlers.onDragStart();
      }
      handlers.place();
    },
    up: () => {
      const { reducedMotion } = currentSettings(scene);
      handlers.setScroll(releaseScroll(rule, reducedMotion, scene.time.now, handlers.scroll()));
    },
  });
  scene.input.on(
    "wheel",
    (_pointer: Input.Pointer, _over: unknown, _dx: number, deltaY: number) => {
      if (handlers.active()) {
        handlers.setScroll(wheelScroll(rule, deltaY, handlers.scroll()));
        handlers.place();
      }
    },
  );
}
