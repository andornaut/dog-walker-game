import type { GameObjects, Scene } from "phaser";

import { project } from "../../layout/projection";
import { type Box, itemBox } from "../../runner/collision";
import { screenRoadGeometry } from "../../runner/screenGeometry";
import { packBoxes, type Walk } from "../../runner/walk";
import { PALETTE } from "../palette";
import { DEPTH, LAYOUT, PROJECTION } from "./stage";

// Over every road sprite and burst, under the popups and banners.
const HIT_BOX_DEPTH = DEPTH.fx + 1;
// Rows behind the walker's feet are drawn no nearer than this, short of the projection's
// focal point.
const NEAREST_DISTANCE = -PROJECTION.focal / 2;

// The dev panel's hit boxes cheat, drawn through the road's projection: the pack's outline,
// which pickups touch, in green; its parts' hit rectangles, which obstacles hit, in yellow; and
// every road item's hit box in red.
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
    this.box(pack.outline);
    graphics.lineStyle(1, PALETTE.yellow);
    for (const part of [pack.walker, ...pack.dogs]) {
      this.box(part);
    }
    graphics.lineStyle(1, PALETTE.red);
    for (const item of walk.road.items) {
      this.box(itemBox(geometry.cell, item));
    }
  }

  // A box on the road, from its left edge across and down its rows.
  private box({ bottom, left: boxLeft, right: boxRight, top }: Box): void {
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
}
