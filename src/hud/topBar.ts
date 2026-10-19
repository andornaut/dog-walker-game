import { containsPoint, type Point, type Rect } from "../layout/rect";

// A top-bar button: its 20x20 face, and a 44px-square hit area so a thumb finds it. Both hit
// areas reach 4px into the road and meet at x=168 without overlapping; a press in one is
// that button's and never a road gesture.
export interface TopBarButton {
  face: Point;
  hit: Rect;
}

export const SOUND_BUTTON: TopBarButton = {
  face: { x: 146, y: 10 },
  hit: { height: 44, width: 44, x: 124, y: 0 },
};

export const PAUSE_BUTTON: TopBarButton = {
  face: { x: 170, y: 10 },
  hit: { height: 44, width: 44, x: 168, y: 0 },
};

// The icon sits on the button's face, 2px lower while pressed.
export function buttonIcon(button: TopBarButton, pressed: boolean): Point {
  return { x: button.face.x + 2, y: button.face.y + (pressed ? 3 : 1) };
}

export type TopBarPress = "pause" | "sound";

// The button a press at (x, y) lands on, if any.
export function topBarButtonAt(x: number, y: number): TopBarPress | undefined {
  if (containsPoint(SOUND_BUTTON.hit, x, y)) {
    return "sound";
  }
  return containsPoint(PAUSE_BUTTON.hit, x, y) ? "pause" : undefined;
}

// The pause button shows play while the pause menu is up, since a press then resumes.
export function pauseButtonIcon(menuOpen: boolean): "icon-pause" | "icon-play" {
  return menuOpen ? "icon-play" : "icon-pause";
}
