import type { GameObjects, Scene } from "phaser";

import {
  EMPTY_MESSAGE_STRIP,
  lineAlpha,
  MESSAGE_TIMING,
  type MessageIcon,
  messageIconKey,
  messageStripLayout,
  type MessageStripState,
  newestCapsTop,
  sayLine,
  stepMessageStrip,
} from "../hud/messageStrip";
import { TEXT_FIT_STYLES } from "../layout/textFit";
import { PALETTE } from "./palette";
import { addPixelText, fitPixelText, inkSpan, placePixelText } from "./pixelText";
import { addPanel } from "./uiKit";

// A line said from the run scene, as { icon, text }: the HUD shows it on its message strip.
export const MESSAGE_EVENT = "message";

// Says a line on the walk's message strip from the run scene.
export function sayMessage(runScene: Scene, icon: MessageIcon, text: string): void {
  runScene.events.emit(MESSAGE_EVENT, { icon, text });
}

const LAYOUT = messageStripLayout();

type Faded = GameObjects.GameObject & { alpha: number };

interface Drawn {
  key: string;
  lines: Faded[][];
  panel: Faded;
  scene: Scene;
}

// The message strip (see hud/messageStrip.ts) as drawn. It draws in whichever scene it is
// given each frame: the HUD while the walk shows, or the card or pause menu over its dim.
// depth puts it under the HUD's other parts there, or over the overlay's.
export class MessageStrip {
  private drawn: Drawn | undefined;
  private state: MessageStripState = EMPTY_MESSAGE_STRIP;

  say(icon: MessageIcon, text: string): void {
    this.state = sayLine(MESSAGE_TIMING, { icon, text }, this.state);
  }

  update(dtMs: number, scene: Scene, depth: number): void {
    this.state = stepMessageStrip(MESSAGE_TIMING, dtMs, this.state);
    const { lines } = this.state;
    const key = lines.map(({ id }) => id).join();
    const drawn = this.drawn;
    const stale =
      drawn === undefined ||
      drawn.key !== key ||
      drawn.scene !== scene ||
      drawn.panel.isDestroyed ||
      drawn.lines.some((parts) => parts.some((part) => part.isDestroyed));
    if (stale) {
      this.clear();
      this.drawn = lines.length === 0 ? undefined : this.draw(scene, depth, key);
    }
    const shown = this.drawn;
    if (shown === undefined) {
      return;
    }
    const alphas = lines.map((line, i) => lineAlpha(MESSAGE_TIMING, i, line));
    shown.panel.alpha = Math.max(0, ...alphas);
    shown.lines.forEach((parts, i) => {
      for (const part of parts) {
        part.alpha = alphas[i] ?? 0;
      }
    });
  }

  private clear(): void {
    const drawn = this.drawn;
    drawn?.panel.destroy();
    drawn?.lines.flat().forEach((part) => part.destroy());
    this.drawn = undefined;
  }

  // The panel, then the newest line's icon and text and the older lines above it.
  private draw(scene: Scene, depth: number, key: string): Drawn {
    const { icon, olderTops, panel, room, textX } = LAYOUT;
    const [newest, ...older] = this.state.lines;
    const drawnPanel = addPanel(scene, panel).setDepth(depth);
    const lines: Faded[][] = [];
    if (newest !== undefined) {
      const parts: Faded[] = [];
      const iconKey = messageIconKey(newest.icon);
      if (scene.textures.exists(iconKey)) {
        parts.push(scene.add.image(icon.x, icon.y, iconKey).setOrigin(0));
      }
      parts.push(newestText(scene, newest.text, textX, room));
      lines.push(parts);
    }
    older.forEach((line, i) => {
      const top = olderTops[i] ?? olderTops.at(-1) ?? 0;
      lines.push([addPixelText(scene, textX, top, line.text, { color: PALETTE.darkBrown })]);
    });
    lines.flat().forEach((part) => (part as Faded & GameObjects.Components.Depth).setDepth(depth));
    return { key, lines, panel: drawnPanel, scene };
  }
}

// The newest line at 2x, else closer or at 1x, centred on the icon's rows; still too wide at
// 1x, it wraps onto two lines from the icon's top.
function newestText(scene: Scene, text: string, x: number, room: number): GameObjects.BitmapText {
  const label = addPixelText(scene, x, 0, text, { color: PALETTE.plum, scale: 2 });
  const style = fitPixelText(label, { room, styles: TEXT_FIT_STYLES }, x, 0);
  placePixelText(label, x, newestCapsTop(LAYOUT, style.scale));
  const ink = inkSpan(label);
  if (ink.right - ink.left > room) {
    label.setMaxWidth(room);
    placePixelText(label, x, LAYOUT.icon.y);
  }
  return label;
}
