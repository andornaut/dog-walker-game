import { Scene } from "phaser";

import { SCREEN_CONFIG } from "../data/screen";
import { screenLayout } from "../layout/screenLayout";
import { addCenteredLabel, addFilledRect, LABEL_TEXT_STYLE } from "./draw";
import { SCENE_KEYS } from "./sceneKeys";

const DOG_COLUMN_COLOR = 0x5a6b4f;
const DOG_SLOT_COLOR = 0xd9cfae;
const TOP_BAR_COLOR = 0xf2e8cf;
const TOP_BAR_TEXT_INSET = 12;

// Stays running and visible while choice cards are up.
export class HudScene extends Scene {
  constructor() {
    super(SCENE_KEYS.hud);
  }

  create(): void {
    const { dogColumn, dogSlots, topBar } = screenLayout(SCREEN_CONFIG);

    addFilledRect(this, TOP_BAR_COLOR, topBar);
    const textY = topBar.y + topBar.height / 2;
    const leftX = topBar.x + TOP_BAR_TEXT_INSET;
    const rightX = topBar.x + topBar.width - TOP_BAR_TEXT_INSET;
    this.add.text(leftX, textY, "$0", LABEL_TEXT_STYLE).setOrigin(0, 0.5);
    this.add.text(rightX, textY, "Zone 1/4", LABEL_TEXT_STYLE).setOrigin(1, 0.5);

    addFilledRect(this, DOG_COLUMN_COLOR, dogColumn);
    dogSlots.forEach((slot, i) => {
      addFilledRect(this, DOG_SLOT_COLOR, slot);
      addCenteredLabel(this, `Dog ${i + 1}`, slot);
    });
  }
}
