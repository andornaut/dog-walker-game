import { type GameObjects, Scene } from "phaser";

import { HEIGHT, LANE_COUNT, SCREEN } from "../config";
import { laneCenters, moveLane } from "../lanes";
import { screenLayout } from "../layout";
import type { CardSceneData } from "./CardScene";
import { addBox } from "./shapes";

const DASH_COLOR = 0xe0e0e0;
const DASH_LENGTH = 16;
const DASH_SPACING = 40;
const DASH_WIDTH = 2;
const PACK_COLOR = 0xc97c5d;
const ROAD_COLOR = 0x8d8d8d;
// Pixels per second. Placeholder until the runner core sets the base speed.
const SCROLL_SPEED = 80;
const WALKER_COLOR = 0x3d5a80;

// Lane change keys, by KeyboardEvent.key lowercased: arrows, A/D and the vim
// keys H/L.
const MOVE_KEYS: Partial<Record<string, -1 | 1>> = {
  a: -1,
  arrowleft: -1,
  arrowright: 1,
  d: 1,
  h: -1,
  l: 1,
};

interface Dash {
  rect: GameObjects.Rectangle;
  row: number;
}

// The road, the walker and the pack. Paused while choice cards are up.
export class RunScene extends Scene {
  private dashes: Dash[] = [];
  private lane = 0;
  private pack?: GameObjects.Rectangle;
  private scroll = 0;
  private walker?: GameObjects.Rectangle;

  constructor() {
    super("run");
  }

  create(): void {
    const { road } = screenLayout(SCREEN);
    addBox(this, ROAD_COLOR, road);

    // Dashed lines between lanes, scrolled in update() so a pause is visible.
    // Rows start one spacing above the road, where the top bar covers them.
    const laneWidth = road.width / LANE_COUNT;
    const rows = Math.ceil(road.height / DASH_SPACING) + 1;
    this.dashes = [];
    for (let lane = 1; lane < LANE_COUNT; lane++) {
      for (let row = 0; row < rows; row++) {
        const x = road.x + lane * laneWidth;
        const rect = this.add
          .rectangle(x, 0, DASH_WIDTH, DASH_LENGTH, DASH_COLOR)
          .setOrigin(0.5, 0);
        this.dashes.push({ rect, row });
      }
    }

    this.lane = Math.floor(LANE_COUNT / 2);
    const x = laneCenters(LANE_COUNT, road)[this.lane];
    this.walker = this.add.rectangle(x, HEIGHT - 40, 24, 32, WALKER_COLOR);
    this.pack = this.add.rectangle(x, HEIGHT - 80, 32, 16, PACK_COLOR);

    // Key repeat from holding a key fires keydown again, so holding keeps
    // moving lane to lane. A paused scene gets no key events.
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      const direction = MOVE_KEYS[event.key.toLowerCase()];
      if (direction !== undefined) {
        this.moveTo(moveLane(LANE_COUNT, direction, this.lane));
      }
    });

    this.scene.launch("hud");

    // Open placeholder cards until collisions do (Milestone 3): E for three
    // options, W for two.
    this.input.keyboard?.on("keydown-E", () => this.openCards(3));
    this.input.keyboard?.on("keydown-W", () => this.openCards(2));
  }

  private moveTo(lane: number): void {
    const x = laneCenters(LANE_COUNT, screenLayout(SCREEN).road)[lane];
    this.lane = lane;
    this.walker?.setX(x);
    this.pack?.setX(x);
  }

  private openCards(count: number): void {
    const data: CardSceneData = { count };
    this.scene.pause();
    this.scene.launch("card", data);
  }

  update(_time: number, delta: number): void {
    const { road } = screenLayout(SCREEN);
    this.scroll = (this.scroll + (SCROLL_SPEED * delta) / 1000) % DASH_SPACING;
    for (const { rect, row } of this.dashes) {
      rect.setY(road.y - DASH_SPACING + row * DASH_SPACING + this.scroll);
    }
  }
}
