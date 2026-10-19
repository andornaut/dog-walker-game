import { Scene } from "phaser";

import { HEIGHT, LANE_COUNT, WIDTH } from "../config";
import { laneCenters } from "../lanes";

const LANE_COLORS = [0x8d8d8d, 0x9e9e9e];
const PACK_COLOR = 0xc97c5d;
const WALKER_COLOR = 0x3d5a80;

// Milestone 1 placeholder: coloured boxes for the lanes, the walker and the pack.
export class RunScene extends Scene {
  constructor() {
    super("run");
  }

  create(): void {
    const centers = laneCenters(LANE_COUNT, WIDTH);
    const laneWidth = WIDTH / LANE_COUNT;
    centers.forEach((x, i) => {
      this.add.rectangle(x, HEIGHT / 2, laneWidth, HEIGHT, LANE_COLORS[i % LANE_COLORS.length]);
    });

    const middle = centers[Math.floor(LANE_COUNT / 2)];
    this.add.rectangle(middle, HEIGHT - 24, 16, 24, WALKER_COLOR);
    this.add.rectangle(middle, HEIGHT - 52, 14, 12, PACK_COLOR);
  }
}
