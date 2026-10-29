import {
  clientPoint,
  listenPagePresses as listenKitPagePresses,
  onBarePage,
  type PagePointerEvent,
  type PagePress,
} from "@andornaut/game-kit/input/pagePresses";
import type { Point } from "@andornaut/game-kit/rect";
import { pageToGame } from "@andornaut/game-kit/view/pagePoint";
import type { Scene } from "phaser";

import type { Press } from "../input/pointerTracking";

// What a press on the bare page does, at points in game pixels, unclamped. onBare: whether the
// release came on the bare page.
export interface PagePressHandlers {
  cancel?: (press: Press, point: Point) => void;
  down: (press: Press, point: Point) => void;
  move?: (press: Press, point: Point) => void;
  up: (press: Press, point: Point, onBare: boolean) => void;
}

// Follows each press that lands on the bare page beside the game's canvas (onBarePage: the
// page's root, its body and #game, never the canvas or page UI such as the nav bar or the dev
// panel) while scene is running and takes input, wherever it then travels, until it lifts or the
// browser cancels it (the kit's listenPagePresses). Phaser hears these only as presses outside
// the canvas, with no moves. A press's id is negative, so it is never taken for a Phaser
// pointer's, which count from 0. The page's listeners go when the scene shuts down.
export function listenPagePresses(scene: Scene, handlers: PagePressHandlers): void {
  const { canvas } = scene.game;
  const bare = [document.documentElement, document.body, canvas.parentElement];
  // The game is drawn upright: its frame has no turn.
  const toGame = (event: PagePointerEvent) =>
    pageToGame(0, canvas.getBoundingClientRect(), scene.scale.gameSize, clientPoint(event));
  const press = ({ downTime, pointerId }: PagePress): Press => ({ downTime, id: -1 - pointerId });
  const remove = listenKitPagePresses(
    (event) => scene.sys.isActive() && scene.input.enabled && onBarePage(bare, event.target),
    {
      cancel: (pressed, event) => handlers.cancel?.(press(pressed), toGame(event)),
      down: (pressed, event) => handlers.down(press(pressed), toGame(event)),
      move: (pressed, event) => handlers.move?.(press(pressed), toGame(event)),
      up: (pressed, event) =>
        handlers.up(press(pressed), toGame(event), onBarePage(bare, event.target)),
    },
    document,
  );
  scene.events.once("shutdown", remove);
}
