import type { GameObjects, Scene } from "phaser";

import {
  EMPTY_MESSAGE_STRIP,
  lineAlpha,
  MESSAGE_STRIP,
  MESSAGE_TIMING,
  type MessageIcon,
  messageIconKey,
  messagePanel,
  messageRows,
  messageStripLayout,
  type MessageStripState,
  sayLine,
  type ShownLine,
  stepMessageStrip,
} from "../hud/messageStrip";
import { PALETTE } from "./palette";
import { addPixelText, type PixelTextStyle, setPixelText } from "./pixelText";
import { addPanel } from "./uiKit";

// A line said from the run scene, as { icon, text }: the HUD shows it on its message strip.
export const MESSAGE_EVENT = "message";

// Says a line on the walk's message strip from the run scene.
export function sayMessage(runScene: Scene, icon: MessageIcon, text: string): void {
  runScene.events.emit(MESSAGE_EVENT, { icon, text });
}

const LAYOUT = messageStripLayout();
const TEXT_STYLE: PixelTextStyle = { color: PALETTE.plum, scale: MESSAGE_STRIP.scale };

type Faded = GameObjects.GameObject & { alpha: number };

interface Drawn {
  id: number;
  panel: Faded;
  parts: Faded[];
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
    const { shown } = this.state;
    const drawn = this.drawn;
    const stale =
      drawn === undefined ||
      drawn.id !== shown?.id ||
      drawn.scene !== scene ||
      drawn.panel.isDestroyed ||
      drawn.parts.some((part) => part.isDestroyed);
    if (stale) {
      this.clear();
      this.drawn = shown === null ? undefined : draw(scene, depth, shown);
    }
    if (this.drawn === undefined || shown === null) {
      return;
    }
    const alpha = lineAlpha(MESSAGE_TIMING, shown);
    for (const part of [this.drawn.panel, ...this.drawn.parts]) {
      part.alpha = alpha;
    }
  }

  private clear(): void {
    const drawn = this.drawn;
    drawn?.panel.destroy();
    drawn?.parts.forEach((part) => part.destroy());
    this.drawn = undefined;
  }
}

// The line's icon and its rows at 2x, on a panel as tall as they are.
function draw(scene: Scene, depth: number, line: ShownLine): Drawn {
  const { icon, rowTops, textX } = LAYOUT;
  const rows = wrappedRows(scene, line.text);
  const panel = addPanel(scene, messagePanel(Math.max(1, rows.length))).setDepth(depth);
  const parts: Faded[] = [];
  const iconKey = messageIconKey(line.icon);
  if (scene.textures.exists(iconKey)) {
    parts.push(scene.add.image(icon.x, icon.y, iconKey).setOrigin(0));
  }
  parts.push(addPixelText(scene, textX, rowTops[0] ?? 0, rows.join("\n"), TEXT_STYLE));
  parts.forEach((part) => (part as Faded & GameObjects.Components.Depth).setDepth(depth));
  return { id: line.id, panel, parts, scene };
}

// The line's rows, measured on the font they are drawn in.
function wrappedRows(scene: Scene, text: string): string[] {
  const probe = addPixelText(scene, 0, 0, "", TEXT_STYLE).setVisible(false);
  const rows = messageRows(
    (row) => {
      setPixelText(probe, row);
      return probe.width;
    },
    LAYOUT.room,
    text,
  );
  probe.destroy();
  return rows;
}
