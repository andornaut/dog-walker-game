import type { GameObjects, Scene } from "phaser";

import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import {
  onStrip,
  stripIconKey,
  type StripItem,
  stripItemsKey,
  type StripLayout,
  stripLayout,
  stripText,
} from "../hud/stateStrip";
import type { Point, Rect } from "../layout/rect";
import { fillRect } from "./draw";
import { PALETTE } from "./palette";
import { addPixelText, placePixelText } from "./pixelText";
import { addNineSlice, addPanel, addTapBurst } from "./uiKit";

// The description bubble sits in its lane, right-aligned with the strip and growing down as far
// as its rows need: one row per item, its icon then its text, at 2x.
const BUBBLE = { gap: 4, holdMs: 6000, padding: 6, rowGap: 4 };
const DEPTH = 20;

// The top bar's state strip and the bubble a tap on it opens.
export class StateStripView {
  private bubble: GameObjects.GameObject[] = [];
  private icons: GameObjects.Image[] = [];
  private items: readonly StripItem[] = [];
  private itemsKey: string | undefined;
  private layout: StripLayout | undefined;
  private tab: GameObjects.NineSlice | undefined;
  private readonly well: GameObjects.Graphics;

  // lane is where the bubble opens. tappable says whether a press on the strip is the strip's,
  // which it is unless a screen covers the bar; onOpen runs as the bubble opens.
  constructor(
    private readonly scene: Scene,
    private readonly lane: Rect,
    private readonly hooks: { onOpen: () => void; tappable: () => boolean },
  ) {
    this.well = scene.add.graphics().setDepth(DEPTH);
  }

  isOpen(): boolean {
    return this.bubble.length > 0;
  }

  // Draws the items when they change, closing the bubble, whose text would no longer match.
  show(items: readonly StripItem[]): void {
    const key = stripItemsKey(items);
    if (key === this.itemsKey) {
      return;
    }
    this.itemsKey = key;
    this.closeBubble();
    this.items = items;
    this.layout = stripLayout(SCREEN_CONFIG.width, items.length);
    this.well.clear();
    this.icons.forEach((icon) => icon.destroy());
    this.tab?.destroy();
    this.tab = undefined;
    const layout = this.layout;
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
      const key = stripIconKey(item);
      const at = layout.icons[i];
      if (at === undefined || !this.scene.textures.exists(key)) {
        return [];
      }
      return [this.scene.add.image(at.x, at.y, key).setOrigin(0).setDepth(DEPTH)];
    });
  }

  // Whether a press at point lands on the strip. The HUD reads presses at the scene, not
  // through an interactive zone, which would keep them from the walk below.
  contains(point: Point): boolean {
    return onStrip(SCREEN_CONFIG.width, this.items.length, point);
  }

  // A tap on the strip, at point, opens or closes the bubble.
  tap(point: Point): void {
    if (this.hooks.tappable()) {
      addTapBurst(this.scene, point.x, point.y);
      this.toggleBubble();
    }
  }

  private toggleBubble(): void {
    if (this.bubble.length > 0) {
      this.closeBubble();
    } else {
      this.openBubble();
    }
  }

  closeBubble(): void {
    this.bubble.forEach((part) => part.destroy());
    this.bubble = [];
  }

  private openBubble(): void {
    const layout = this.layout;
    if (layout === undefined) {
      return;
    }
    const { gap, padding, rowGap } = BUBBLE;
    const { lane } = this;
    const icon = 16;
    const room = lane.width - 2 * padding - icon - gap;
    const texts = this.items.map((item) =>
      addPixelText(this.scene, 0, 0, stripText(gameData, item), {
        color: PALETTE.plum,
        maxWidth: room,
        scale: 2,
      }),
    );
    const rows = texts.map((text) => Math.max(icon, Math.ceil(text.height)));
    const textWidth = Math.max(...texts.map((text) => Math.ceil(text.width)));
    const width = 2 * padding + icon + gap + textWidth;
    const height =
      2 * padding + rows.reduce((sum, row) => sum + row, 0) + (rows.length - 1) * rowGap;
    const right = Math.min(lane.x + lane.width, layout.tab.x + layout.tab.width);
    const x = Math.max(lane.x, right - width);
    const y = lane.y;
    const parts: GameObjects.GameObject[] = [
      addPanel(this.scene, { height, width, x, y }, "ui-hint").setDepth(DEPTH),
    ];
    let rowY = y + padding;
    texts.forEach((text, i) => {
      const item = this.items[i];
      const key = item === undefined ? "" : stripIconKey(item);
      if (this.scene.textures.exists(key)) {
        parts.push(
          this.scene.add
            .image(x + padding, rowY, key)
            .setOrigin(0)
            .setDepth(DEPTH + 1),
        );
      }
      placePixelText(text, x + padding + icon + gap, rowY + 2);
      text.setDepth(DEPTH + 1);
      parts.push(text);
      rowY += (rows[i] ?? icon) + rowGap;
    });
    this.bubble = parts;
    this.hooks.onOpen();
    this.scene.time.delayedCall(BUBBLE.holdMs, () => {
      if (this.bubble === parts) {
        this.closeBubble();
      }
    });
  }
}
