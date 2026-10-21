import type { GameObjects, Scene } from "phaser";

import { gameData } from "../../data";
import { project, screenYAt } from "../../layout/projection";
import { type Box, itemBox, type ScaledBox } from "../../runner/collision";
import { screenRoadGeometry } from "../../runner/screenGeometry";
import { blocksLane, obstacleHitBox, packBoxes, type Walk } from "../../runner/walk";
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
      if (!blocksLane(gameData, item.kind)) {
        this.onRoad(itemBox(geometry.cell, item));
      } else {
        this.asDrawn(obstacleHitBox(gameData, geometry, item));
      }
    }
  }

  // A box on the road, from its left edge across and down its rows.
  private onRoad({ bottom, left: boxLeft, right: boxRight, top }: Box): void {
    const { footY, visibleDistance } = PROJECTION;
    const near = Math.max(NEAREST_DISTANCE, footY - bottom);
    const far = Math.min(visibleDistance, footY - top);
    if (near >= far) {
      return;
    }
    const left = LAYOUT.road.x + boxLeft;
    const right = LAYOUT.road.x + boxRight;
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
    const { footY, visibleDistance } = PROJECTION;
    const near = Math.max(NEAREST_DISTANCE, footY - box.bottom);
    const far = Math.min(visibleDistance, footY - box.top);
    if (near >= far) {
      return;
    }
    const centerX = LAYOUT.road.x + LAYOUT.road.width / 2;
    const across = (x: number) => centerX + (LAYOUT.road.x + x - centerX) * box.scale;
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
