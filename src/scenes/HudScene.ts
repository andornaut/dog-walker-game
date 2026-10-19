import { Scene } from "phaser";

import { SCREEN } from "../config";
import { screenLayout } from "../layout";
import { addBox, addLabel, TEXT_STYLE } from "./shapes";

const COLUMN_COLOR = 0x5a6b4f;
const SLOT_COLOR = 0xd9cfae;
const TOP_BAR_COLOR = 0xf2e8cf;

// The top status bar and the dog column, on top of the road for the whole run.
// Stays visible while choice cards are up.
export class HudScene extends Scene {
  constructor() {
    super("hud");
  }

  create(): void {
    const { dogColumn, dogSlots, topBar } = screenLayout(SCREEN);

    addBox(this, TOP_BAR_COLOR, topBar);
    const textY = topBar.y + topBar.height / 2;
    this.add.text(topBar.x + 12, textY, "$0", TEXT_STYLE).setOrigin(0, 0.5);
    this.add.text(topBar.x + topBar.width - 12, textY, "Zone 1/4", TEXT_STYLE).setOrigin(1, 0.5);

    addBox(this, COLUMN_COLOR, dogColumn);
    dogSlots.forEach((slot, i) => {
      addBox(this, SLOT_COLOR, slot);
      addLabel(this, `Dog ${i + 1}`, slot);
    });
  }
}
