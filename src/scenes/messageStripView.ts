import type { GameObjects, Scene } from "phaser";

import type { ExplainLine } from "../hud/explain";
import {
  EMPTY_MESSAGE_STRIP,
  lineAlpha,
  MESSAGE_STRIP,
  MESSAGE_TIMING,
  type MessageIcon,
  messageIconKey,
  messageLinePanel,
  messageLineTop,
  messagePanel,
  messageRows,
  messageStripLayout,
  type MessageStripState,
  sayLine,
  sayLineAhead,
  stepMessageStrip,
} from "../hud/messageStrip";
import { PALETTE } from "../ui/phaser/palette";
import {
  addPixelText,
  fitPixelText,
  pixelFontMetrics,
  type PixelTextStyle,
  placePixelText,
  setPixelText,
} from "../ui/phaser/pixelText";
import { TEXT_FIT_STYLES } from "../ui/textFit";
import { addPanel } from "./uiKit";

// A line said from the run scene, as { icon, text }: the HUD shows it on its message strip.
export const MESSAGE_EVENT = "message";

// Says a line on the walk's message strip from the run scene.
export function sayMessage(runScene: Scene, icon: MessageIcon, text: string): void {
  runScene.events.emit(MESSAGE_EVENT, { icon, text });
}

const TEXT_STYLE: PixelTextStyle = { color: PALETTE.plum, scale: MESSAGE_STRIP.scale };

type Faded = GameObjects.GameObject & { alpha: number };

// What is drawn: id names the line (an explanation's are negative), and bars the debuff bars
// it was placed under.
interface Drawn {
  bars: number;
  id: number;
  panel: Faded;
  parts: Faded[];
  scene: Scene;
}

// A held explanation's lines take turns this often.
const EXPLAIN_TURN_MS = MESSAGE_TIMING.dwellMs;
// Each explanation numbers its lines apart from the last one's, past any turn it reaches.
const EXPLAIN_ID_SPAN = 1000;

// The message strip (see hud/messageStrip.ts) as drawn. It draws in whichever scene it is
// given each frame: the HUD while the walk shows, or the card or pause menu over its dim.
// depth puts it under the HUD's other parts there, or over the overlay's. While a press holds
// an element up, its explanation takes the strip, whole, and the walk's lines wait.
export class MessageStrip {
  private drawn: Drawn | undefined;
  private explainId = 0;
  private explainMs = 0;
  private explaining: readonly ExplainLine[] = [];
  private state: MessageStripState = EMPTY_MESSAGE_STRIP;

  // ahead: the line waits ahead of the waiting lines with its icon.
  say(icon: MessageIcon, text: string, ahead = false): void {
    const add = ahead ? sayLineAhead : sayLine;
    this.state = add(MESSAGE_TIMING, { icon, text }, this.state);
  }

  // The lines a held press explains, from their first, or none once it lifts.
  explain(lines: readonly ExplainLine[]): void {
    this.explainId += 1;
    this.explainMs = 0;
    this.explaining = lines;
  }

  update(dtMs: number, scene: Scene, depth: number, bars: number): void {
    const shown = this.current(dtMs);
    const drawn = this.drawn;
    const stale =
      drawn === undefined ||
      drawn.id !== shown?.id ||
      drawn.bars !== bars ||
      drawn.scene !== scene ||
      drawn.panel.isDestroyed ||
      drawn.parts.some((part) => part.isDestroyed);
    if (stale) {
      this.clear();
      this.drawn = shown === undefined ? undefined : draw(scene, depth, bars, shown);
    }
    if (this.drawn === undefined || shown === undefined) {
      return;
    }
    for (const part of [this.drawn.panel, ...this.drawn.parts]) {
      part.alpha = shown.alpha;
    }
  }

  // The explanation's line due now, else the walk's shown line, aged dtMs.
  private current(dtMs: number): (ExplainLine & { alpha: number; id: number }) | undefined {
    if (this.explaining.length > 0) {
      this.explainMs += dtMs;
      const turn = Math.floor(this.explainMs / EXPLAIN_TURN_MS) % this.explaining.length;
      const line = this.explaining[turn];
      const id = -(this.explainId * EXPLAIN_ID_SPAN + turn) - 1;
      return line === undefined ? undefined : { ...line, alpha: 1, id };
    }
    this.state = stepMessageStrip(MESSAGE_TIMING, dtMs, this.state);
    const { shown } = this.state;
    if (shown === null) {
      return undefined;
    }
    return {
      alpha: lineAlpha(MESSAGE_TIMING, shown),
      iconKey: messageIconKey(shown.icon),
      id: shown.id,
      text: shown.text,
    };
  }

  private clear(): void {
    const drawn = this.drawn;
    drawn?.panel.destroy();
    drawn?.parts.forEach((part) => part.destroy());
    this.drawn = undefined;
  }
}

// The line's icon and text: with no debuff bar up, its rows at 2x on a panel as tall as they
// are; under bars, one row fitted by TEXT_FIT_STYLES on the one-row panel.
function draw(
  scene: Scene,
  depth: number,
  bars: number,
  line: ExplainLine & { id: number },
): Drawn {
  const parts: Faded[] = [];
  const body = pixelFontMetrics(scene, "body");
  const layout = messageStripLayout(body);
  let panel: Faded;
  let icon = layout.icon;
  if (bars === 0) {
    const rows = wrappedRows(scene, layout.room, line.text);
    panel = addPanel(scene, messagePanel(body, Math.max(1, rows.length)));
    parts.push(
      addPixelText(scene, layout.textX, layout.rowTops[0] ?? 0, rows.join("\n"), TEXT_STYLE),
    );
  } else {
    const one = messageLinePanel(bars);
    panel = addPanel(scene, one.panel);
    icon = one.icon;
    const text = addPixelText(scene, one.textX, 0, line.text, TEXT_STYLE);
    const { style } = fitPixelText(text, { room: one.room, styles: TEXT_FIT_STYLES }, one.textX, 0);
    placePixelText(text, one.textX, messageLineTop(body, one, style.scale));
    parts.push(text);
  }
  if (scene.textures.exists(line.iconKey)) {
    parts.unshift(scene.add.image(icon.x, icon.y, line.iconKey).setOrigin(0));
  }
  (panel as Faded & GameObjects.Components.Depth).setDepth(depth);
  parts.forEach((part) => (part as Faded & GameObjects.Components.Depth).setDepth(depth));
  return { bars, id: line.id, panel, parts, scene };
}

// The line's rows, measured on the font they are drawn in.
function wrappedRows(scene: Scene, room: number, text: string): string[] {
  const probe = addPixelText(scene, 0, 0, "", TEXT_STYLE).setVisible(false);
  const rows = messageRows(
    (row) => {
      setPixelText(probe, row);
      return probe.width;
    },
    room,
    text,
  );
  probe.destroy();
  return rows;
}
