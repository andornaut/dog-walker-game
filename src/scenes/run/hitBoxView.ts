import type { GameObjects, Scene } from "phaser";

import { gameData } from "../../data";
import { project, screenXAt, screenYAt } from "../../layout/projection";
import type { Box, ScaledBox } from "../../runner/collision";
import { screenRoadGeometry } from "../../runner/screenGeometry";
import { isObstacle, obstacleHitBox, packBoxes, type Walk, walkItemBox } from "../../runner/walk";
import { PALETTE } from "../../ui/phaser/palette";
import { DEPTH, LAYOUT, PROJECTION } from "./stage";

// Over every road sprite and burst, under the popups and banners.
const HIT_BOX_DEPTH = DEPTH.fx + 1;
// Rows behind the walker's feet are drawn no nearer than this, short of the projection's
// focal point.
const NEAREST_DISTANCE = -PROJECTION.focal / 2;

// The dev panel's hit boxes cheat: the pack's outline, which pickups touch, in green, laid on the
// road through its projection; its parts' hit rectangles, which obstacles hit, in yellow; and
// every road item's hit box in red, an obstacle's as drawn and anything else's laid on the road.
export class HitBoxView {
  private readonly graphics: GameObjects.Graphics;

  constructor(scene: Scene) {
    this.graphics = scene.add.graphics().setDepth(HIT_BOX_DEPTH);
  }

  draw(walk: Walk, shown: boolean): void {
    const { graphics } = this;
    graphics.clear();
    if (!shown) {
      return;
    }
    const geometry = screenRoadGeometry(walk.run);
    const pack = packBoxes(geometry, walk.road.control.motion, walk.run);
    graphics.lineStyle(1, PALETTE.green);
    this.onRoad(pack.outline);
    graphics.lineStyle(1, PALETTE.yellow);
    for (const part of [pack.walker, ...pack.dogs]) {
      this.asDrawn(part);
    }
    graphics.lineStyle(1, PALETTE.red);
    for (const item of walk.road.items) {
      if (!isObstacle(gameData, item.kind)) {
        this.onRoad(walkItemBox(geometry, item));
      } else {
        this.asDrawn(obstacleHitBox(gameData, geometry, item));
      }
    }
  }

  // A box on the road, from its left edge across and down its rows.
  private onRoad(box: Box): void {
    const span = distancesInView(box);
    if (span === null) {
      return;
    }
    const { far, near } = span;
    const left = LAYOUT.road.x + box.left;
    const right = LAYOUT.road.x + box.right;
    const start = project(PROJECTION, { distance: near, x: left });
    const { graphics } = this;
    graphics.beginPath();
    graphics.moveTo(start.x, start.y);
    for (const corner of [
      project(PROJECTION, { distance: near, x: right }),
      project(PROJECTION, { distance: far, x: right }),
      project(PROJECTION, { distance: far, x: left }),
    ]) {
      graphics.lineTo(corner.x, corner.y);
    }
    graphics.closePath();
    graphics.strokePath();
  }

  // A box as it is drawn: the screen rectangle over its rows, its columns at its scale.
  private asDrawn(box: ScaledBox): void {
    const span = distancesInView(box);
    if (span === null) {
      return;
    }
    const { far, near } = span;
    const across = (x: number) => screenXAt(PROJECTION, box.scale, LAYOUT.road.x + x);
    const top = screenYAt(PROJECTION, far);
    const left = across(box.left);
    this.graphics.strokeRect(
      left,
      top,
      across(box.right) - left,
      screenYAt(PROJECTION, near) - top,
    );
  }
}

// The road distances a box's rows cover within the projection's view, nearest and farthest, or
// null with none in view.
function distancesInView(box: Pick<Box, "bottom" | "top">): { far: number; near: number } | null {
  const { footY, visibleDistance } = PROJECTION;
  const near = Math.max(NEAREST_DISTANCE, footY - box.bottom);
  const far = Math.min(visibleDistance, footY - box.top);
  return near >= far ? null : { far, near };
}
