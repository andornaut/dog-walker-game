import type { GameObjects, Scene } from "phaser";

import { itemAt } from "../../arrays";
import { project } from "../../layout/projection";
import { occupiedLanes } from "../../runner/laneMotion";
import { screenRoadGeometry } from "../../runner/screenGeometry";
import type { Walk } from "../../runner/walk";
import { PALETTE } from "../palette";
import { DEPTH, LANE_XS, PROJECTION } from "./stage";

// Over every road sprite and burst, under the popups and banners.
const HIT_BOX_DEPTH = DEPTH.fx + 1;
const LANE_WIDTH = itemAt(LANE_XS, 1) - itemAt(LANE_XS, 0);
// Rows behind the walker's feet are drawn no nearer than this, short of the projection's
// focal point.
const NEAREST_DISTANCE = -PROJECTION.focal / 2;

// The dev panel's hit boxes cheat: the outline of the pack's band in each lane it occupies and
// of every road item's hit box, drawn through the road's projection.
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
    const { packBand } = screenRoadGeometry(walk.run);
    graphics.lineStyle(1, PALETTE.green);
    for (const lane of occupiedLanes(walk.road.control.motion)) {
      this.box(lane, 1, packBand.top, packBand.bottom);
    }
    graphics.lineStyle(1, PALETTE.red);
    for (const item of walk.road.items) {
      this.box(item.lane, item.laneSpan, item.y, item.y + item.height);
    }
  }

  // A box across lanes from lane, between road rows top and bottom.
  private box(lane: number, laneSpan: number, top: number, bottom: number): void {
    const { footY, visibleDistance } = PROJECTION;
    const near = Math.max(NEAREST_DISTANCE, footY - bottom);
    const far = Math.min(visibleDistance, footY - top);
    if (near >= far) {
      return;
    }
    const left = itemAt(LANE_XS, lane) - LANE_WIDTH / 2;
    const right = itemAt(LANE_XS, lane + laneSpan - 1) + LANE_WIDTH / 2;
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
