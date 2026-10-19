import { type Input, Scene } from "phaser";

import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import type { WalkResult } from "../home/home";
import { wholeDollars } from "../hud/hudView";
import { isConfirmKey } from "../input/keyBindings";
import { containsPoint, type Rect } from "../layout/rect";
import type { EndReason } from "../state/runState";
import { drawFramedRect, fillRect } from "./draw";
import { PALETTE } from "./palette";
import { addPixelText } from "./pixelText";
import { homeProfile } from "./profileStore";
import { SCENE_KEYS } from "./sceneKeys";

export interface EndSceneData {
  result: WalkResult;
}

const TITLES: Readonly<Record<EndReason, string>> = {
  finished: "Walk done!",
  noDogs: "Out of dogs",
  wentHome: "Headed home",
};
const PANEL: Rect = { height: 300, width: 312, x: 24, y: 140 };
const BUTTON: Rect = { height: 40, width: 264, x: 48, y: 384 };

// The walk's result, already banked; Back home returns to the start screen.
export class EndScene extends Scene {
  constructor() {
    super(SCENE_KEYS.end);
  }

  create({ result }: EndSceneData): void {
    const g = this.add.graphics();
    fillRect(g, PALETTE.darkBrown, {
      height: SCREEN_CONFIG.height,
      width: SCREEN_CONFIG.width,
      x: 0,
      y: 0,
    });
    drawFramedRect(g, { border: PALETTE.plum, fill: PALETTE.cream }, PANEL);
    const center = SCREEN_CONFIG.width / 2;
    const line = (y: number, text: string, color: number, scale = 0) =>
      addPixelText(this, center, y, text, {
        color,
        font: scale > 0 ? "title" : "body",
        originX: 0.5,
        scale: Math.max(1, scale),
      });

    line(PANEL.y + 20, TITLES[result.reason], PALETTE.plum, 2);
    line(PANEL.y + 52, `+${wholeDollars(result.earned)}`, PALETTE.darkGreen, 3);
    line(
      PANEL.y + 84,
      `Zones walked ${result.zonesFinished}/${gameData.world.zones.length}`,
      PALETTE.darkBrown,
    );
    result.firings.forEach(({ dog }, i) => {
      line(PANEL.y + 100 + i * 10, `${gameData.dogs[dog].owner.name} fired you`, PALETTE.darkRed);
    });
    line(PANEL.y + 150, `Bank ${wholeDollars(homeProfile(this).bank)}`, PALETTE.plum);

    fillRect(g, PALETTE.orange, { ...BUTTON, height: BUTTON.height - 4, y: BUTTON.y + 4 });
    fillRect(g, PALETTE.amber, { ...BUTTON, height: BUTTON.height - 4 });
    line(BUTTON.y + 11, "Back home", PALETTE.plum, 2);

    const goHome = () => this.scene.start(SCENE_KEYS.start);
    this.input.on("pointerup", (pointer: Input.Pointer) => {
      if (containsPoint(BUTTON, pointer.x, pointer.y)) {
        goHome();
      }
    });
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (isConfirmKey(event.key)) {
        goHome();
      }
    });
  }
}
