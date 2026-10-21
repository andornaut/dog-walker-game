import type { GameObjects, Scene } from "phaser";

import { gameData } from "../data";
import {
  STRIP,
  stripIconFallback,
  stripIconKey,
  type StripItem,
  stripItemsKey,
  stripLayout,
} from "../hud/stateStrip";
import type { Point } from "../layout/rect";
import { fillRect } from "./draw";
import { PALETTE } from "./palette";
import { addPixelText } from "./pixelText";
import { addNineSlice } from "./uiKit";

const DEPTH = 20;

// The effect icons beside the zone's progress in the top bar. They take no taps.
export class StateStripView {
  private icons: (GameObjects.BitmapText | GameObjects.Image)[] = [];
  private itemsKey: string | undefined;
  private tab: GameObjects.NineSlice | undefined;
  private readonly well: GameObjects.Graphics;

  constructor(private readonly scene: Scene) {
    this.well = scene.add.graphics().setDepth(DEPTH);
  }

  // Draws the items when they change.
  show(items: readonly StripItem[]): void {
    const key = stripItemsKey(items);
    if (key === this.itemsKey) {
      return;
    }
    this.itemsKey = key;
    this.well.clear();
    this.icons.forEach((icon) => icon.destroy());
    this.tab?.destroy();
    this.tab = undefined;
    const layout = stripLayout(items.length);
    if (layout === undefined) {
      this.icons = [];
      return;
    }
    const { tab } = layout;
    this.tab = addNineSlice(this.scene, "ui-strip-well", tab)?.setDepth(DEPTH);
    if (this.tab === undefined) {
      fillRect(this.well, PALETTE.plum, tab);
      fillRect(this.well, PALETTE.ink, layout.well);
    }
    this.icons = items.flatMap((item, i) => {
      const at = layout.icons[i];
      return at === undefined ? [] : [this.addIcon(item, at)];
    });
  }

  // The item's icon at its top-left corner, or its fallback letter while the art is missing.
  private addIcon(item: StripItem, at: Point): GameObjects.BitmapText | GameObjects.Image {
    const key = stripIconKey(item);
    if (this.scene.textures.exists(key)) {
      return this.scene.add.image(at.x, at.y, key).setOrigin(0).setDepth(DEPTH);
    }
    const half = STRIP.icon / 2;
    return addPixelText(this.scene, at.x + half, at.y + half, stripIconFallback(gameData, item), {
      color: PALETTE.cream,
      originX: 0.5,
      originY: 0.5,
    }).setDepth(DEPTH);
  }
}
