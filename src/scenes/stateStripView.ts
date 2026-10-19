import type { GameObjects, Scene } from "phaser";

import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import {
  stripIconKey,
  type StripItem,
  stripItemsKey,
  type StripLayout,
  stripLayout,
  stripText,
} from "../hud/stateStrip";
import { drawFramedRect, fillRect } from "./draw";
import { PALETTE } from "./palette";
import { addPixelText, placePixelText } from "./pixelText";
import { addTapBurst } from "./uiKit";

// The description bubble hangs under the strip, right-aligned with it: one row per item, its
// icon then its text, at 2x.
const BUBBLE = { corner: 8, gap: 4, holdMs: 6000, margin: 8, padding: 6, rowGap: 4 };
const DEPTH = 20;
const TAB_CORNER = 8;

// The top bar's state strip and the bubble a tap on it opens.
export class StateStripView {
  private bubble: GameObjects.GameObject[] = [];
  private hit: GameObjects.Zone | undefined;
  private icons: GameObjects.Image[] = [];
  private items: readonly StripItem[] = [];
  private itemsKey: string | undefined;
  private layout: StripLayout | undefined;
  private readonly scene: Scene;
  private tab: GameObjects.NineSlice | undefined;

  private readonly tappable: () => boolean;
  private readonly well: GameObjects.Graphics;

  // tappable says whether a press on the strip is the strip's, which it is unless a screen
  // covers the bar.
  constructor(scene: Scene, tappable: () => boolean) {
    this.scene = scene;
    this.tappable = tappable;
    this.well = scene.add.graphics().setDepth(DEPTH);
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
    this.hit?.destroy();
    this.hit = undefined;
    const layout = this.layout;
    if (layout === undefined) {
      this.icons = [];
      return;
    }
    const { tab } = layout;
    if (this.scene.textures.exists("ui-strip-well")) {
      const c = TAB_CORNER;
      this.tab = this.scene.add
        .nineslice(tab.x, tab.y, "ui-strip-well", undefined, tab.width, tab.height, c, c, c, c)
        .setOrigin(0)
        .setDepth(DEPTH);
    } else {
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
    const { hit } = layout;
    this.hit = this.scene.add
      .zone(hit.x, hit.y, hit.width, hit.height)
      .setOrigin(0)
      .setInteractive()
      .on("pointerdown", (pointer: { x: number; y: number }) => {
        if (this.tappable()) {
          addTapBurst(this.scene, pointer.x, pointer.y);
          this.toggleBubble();
        }
      });
  }

  private toggleBubble(): void {
    if (this.bubble.length > 0) {
      this.closeBubble();
    } else {
      this.openBubble();
    }
  }

  private closeBubble(): void {
    this.bubble.forEach((part) => part.destroy());
    this.bubble = [];
  }

  private openBubble(): void {
    const layout = this.layout;
    if (layout === undefined) {
      return;
    }
    const { corner, gap, margin, padding, rowGap } = BUBBLE;
    const icon = 16;
    const room = SCREEN_CONFIG.width - 2 * margin - 2 * padding - icon - gap;
    const texts = this.items.map((item) =>
      addPixelText(this.scene, 0, 0, stripText(gameData, item), {
        color: PALETTE.plum,
        maxWidth: room / 2,
        scale: 2,
      }),
    );
    const rows = texts.map((text) => Math.max(icon, Math.ceil(text.height)));
    const textWidth = Math.max(...texts.map((text) => Math.ceil(text.width)));
    const width = 2 * padding + icon + gap + textWidth;
    const height =
      2 * padding + rows.reduce((sum, row) => sum + row, 0) + (rows.length - 1) * rowGap;
    const right = layout.tab.x + layout.tab.width;
    const x = Math.max(margin, right - width);
    const y = layout.tab.y + layout.tab.height + 4;
    const parts: GameObjects.GameObject[] = [];
    if (this.scene.textures.exists("ui-hint")) {
      parts.push(
        this.scene.add
          .nineslice(x, y, "ui-hint", undefined, width, height, corner, corner, corner, corner)
          .setOrigin(0)
          .setDepth(DEPTH),
      );
    } else {
      const box = this.scene.add.graphics().setDepth(DEPTH);
      drawFramedRect(box, { border: PALETTE.plum, fill: PALETTE.cream }, { height, width, x, y });
      parts.push(box);
    }
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
    this.scene.time.delayedCall(BUBBLE.holdMs, () => {
      if (this.bubble === parts) {
        this.closeBubble();
      }
    });
  }
}
