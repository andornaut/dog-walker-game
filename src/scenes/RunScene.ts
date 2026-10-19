import { type GameObjects, Scene } from "phaser";

import { gameData } from "../data";
import { LANE_COUNT, SCREEN_CONFIG } from "../data/screen";
import { laneDirectionForKey } from "../input/keyBindings";
import { laneCenterXs, laneDividerXs, moveLane } from "../layout/lanes";
import { screenLayout } from "../layout/screenLayout";
import { read } from "../rules/units";
import type { CardSceneData } from "./CardScene";
import { addFilledRect } from "./draw";
import type { HelpSceneData } from "./HelpScene";
import { SCENE_KEYS } from "./sceneKeys";

const DASH_COLOR = 0xe0e0e0;
const DASH_LENGTH = 16;
const DASH_SPACING = 40;
const DASH_WIDTH = 2;
const PACK = { color: 0xc97c5d, height: 16, offsetFromBottom: 80, width: 32 };
const ROAD_COLOR = 0x8d8d8d;
const WALKER = { color: 0x3d5a80, height: 32, offsetFromBottom: 40, width: 24 };

interface LaneDash {
  rect: GameObjects.Rectangle;
  row: number;
}

// Paused while choice cards are up, which stops its scrolling and key input.
export class RunScene extends Scene {
  private dashes: LaneDash[] = [];
  private lane = 0;
  private laneXs: number[] = [];
  private pack?: GameObjects.Rectangle;
  private roadTop = 0;
  private scrollOffset = 0;
  private walker?: GameObjects.Rectangle;

  constructor() {
    super(SCENE_KEYS.run);
  }

  create(): void {
    const { road } = screenLayout(SCREEN_CONFIG);
    this.roadTop = road.y;
    this.laneXs = laneCenterXs(LANE_COUNT, road);
    addFilledRect(this, ROAD_COLOR, road);

    // Rows start one spacing above the road, where the top bar covers them.
    const rows = Math.ceil(road.height / DASH_SPACING) + 1;
    this.dashes = [];
    for (const x of laneDividerXs(LANE_COUNT, road)) {
      for (let row = 0; row < rows; row++) {
        const rect = this.add
          .rectangle(x, 0, DASH_WIDTH, DASH_LENGTH, DASH_COLOR)
          .setOrigin(0.5, 0);
        this.dashes.push({ rect, row });
      }
    }

    this.lane = Math.floor(LANE_COUNT / 2);
    const x = this.laneXs[this.lane];
    const addBody = ({ color, height, offsetFromBottom, width }: typeof WALKER) =>
      this.add.rectangle(x, SCREEN_CONFIG.height - offsetFromBottom, width, height, color);
    this.walker = addBody(WALKER);
    this.pack = addBody(PACK);

    // Holding a key repeats keydown, so the pack keeps moving lane to lane.
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      const direction = laneDirectionForKey(event.key);
      if (direction !== undefined) {
        this.moveToLane(moveLane(LANE_COUNT, direction, this.lane));
      }
    });

    this.scene.launch(SCENE_KEYS.hud);

    // Placeholder until collisions open cards (Milestone 3): E for three options, W for two.
    this.input.keyboard?.on("keydown-E", () => this.openCards(3));
    this.input.keyboard?.on("keydown-W", () => this.openCards(2));

    // Placeholder until the start screen and pause menu open help: ? opens it over the run.
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (event.key === "?") {
        this.openHelp();
      }
    });
  }

  private openHelp(): void {
    const data: HelpSceneData = { resume: SCENE_KEYS.run };
    this.scene.pause();
    this.scene.launch(SCENE_KEYS.help, data);
  }

  private moveToLane(lane: number): void {
    const x = this.laneXs[lane];
    this.lane = lane;
    this.walker?.setX(x);
    this.pack?.setX(x);
  }

  private openCards(count: number): void {
    const data: CardSceneData = { count };
    this.scene.pause();
    this.scene.launch(SCENE_KEYS.card, data);
  }

  override update(_time: number, delta: number): void {
    // Read every frame, so a live tuning edit takes effect at once.
    const speed = read(gameData.tuning, "pixels", "roadScrollSpeed");
    this.scrollOffset = (this.scrollOffset + (speed * delta) / 1000) % DASH_SPACING;
    for (const { rect, row } of this.dashes) {
      rect.setY(this.roadTop - DASH_SPACING + row * DASH_SPACING + this.scrollOffset);
    }
  }
}
