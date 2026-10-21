import type { GameObjects, Scene } from "phaser";

import { ownerCardFaceKey } from "../assets/spriteKeys";
import { gameData } from "../data";
import {
  EMPTY_MESSAGE_STRIP,
  isOwnerLead,
  lineAlpha,
  lineLeadSlot,
  MESSAGE_STRIP,
  MESSAGE_TIMING,
  messageIconKey,
  type MessageLead,
  messageLinePanel,
  messageLineTop,
  messagePanel,
  messageRows,
  messageStripLayout,
  type MessageStripState,
  type OwnerLead,
  type OwnerLeadLayout,
  ownerLeadLayout,
  ownerLeadPanel,
  sayLine,
  sayLineAhead,
  stepMessageStrip,
  stripLeadSlot,
} from "../hud/messageStrip";
import { drawFramedRect } from "../ui/phaser/draw";
import { PALETTE } from "../ui/phaser/palette";
import {
  addPixelText,
  fitPixelText,
  inkSpan,
  pixelFontMetrics,
  type PixelTextStyle,
  placePixelText,
  setPixelText,
} from "../ui/phaser/pixelText";
import { TEXT_FIT_STYLES } from "../ui/textFit";
import { firstTag, playTag } from "./sprites";
import { addPanel } from "./uiKit";

// A line said from the run scene, as { icon, text }: the HUD shows it on its message strip.
export const MESSAGE_EVENT = "message";

// Says a line on the walk's message strip from the run scene.
export function sayMessage(runScene: Scene, icon: MessageLead, text: string): void {
  runScene.events.emit(MESSAGE_EVENT, { icon, text });
}

const TEXT_STYLE: PixelTextStyle = { color: PALETTE.plum, scale: MESSAGE_STRIP.scale };
// An owner's name under their face, leading their quip.
const NAME_STYLE: PixelTextStyle = { color: PALETTE.rust };

type Faded = GameObjects.GameObject & { alpha: number };

// What is drawn: id names the line, and bars the debuff bars it was placed under.
interface Drawn {
  bars: number;
  id: number;
  panel: Faded;
  parts: Faded[];
  scene: Scene;
}

// A line as drawn, led by its icon's key or an owner's face and name. id names the line.
interface StripLine {
  readonly id: number;
  readonly lead: OwnerLead | string;
  readonly text: string;
}

// The message strip (see hud/messageStrip.ts) as drawn. It draws in whichever scene it is
// given each frame: the HUD while the walk shows, or the card or pause menu over its dim.
// depth puts it under the HUD's other parts there, or over the overlay's.
export class MessageStrip {
  private drawn: Drawn | undefined;
  private state: MessageStripState = EMPTY_MESSAGE_STRIP;

  // icon: what leads the line, an icon or an owner's face and name. ahead: the line waits ahead
  // of the waiting lines with its icon.
  say(icon: MessageLead, text: string, ahead = false): void {
    const add = ahead ? sayLineAhead : sayLine;
    this.state = add(MESSAGE_TIMING, { icon, text }, this.state);
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

  // The walk's shown line, aged dtMs.
  private current(dtMs: number): (StripLine & { alpha: number }) | undefined {
    this.state = stepMessageStrip(MESSAGE_TIMING, dtMs, this.state);
    const { shown } = this.state;
    if (shown === null) {
      return undefined;
    }
    return {
      alpha: lineAlpha(MESSAGE_TIMING, shown),
      id: shown.id,
      lead: isOwnerLead(shown.icon) ? shown.icon : messageIconKey(shown.icon),
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

// The line's lead and text: with no debuff bar up, its rows at 2x on a panel as tall as they
// are; under bars, one row fitted by TEXT_FIT_STYLES on the one-row panel. An owner's lead
// moves the text right, and grows a panel shorter than the lead.
function draw(scene: Scene, depth: number, bars: number, line: StripLine): Drawn {
  const body = pixelFontMetrics(scene, "body");
  const owner = typeof line.lead === "string" ? undefined : line.lead;
  const name = owner === undefined ? "" : gameData.dogs[owner.dog].owner.name;
  const strip = messageStripLayout(body);
  const one = messageLinePanel(bars);
  const slot = bars === 0 ? stripLeadSlot(body) : lineLeadSlot(body, bars);
  const lead =
    owner === undefined
      ? undefined
      : ownerLeadLayout(body, slot, inkWidth(scene, name, NAME_STYLE));
  const textX = lead?.textX ?? slot.textX;
  const room = lead?.room ?? slot.room;
  const rows = bars === 0 ? wrappedRows(scene, room, line.text) : [line.text];
  const fits = bars === 0 ? messagePanel(body, Math.max(1, rows.length)) : one.panel;
  const panel: Faded = addPanel(scene, lead === undefined ? fits : ownerLeadPanel(fits, lead));
  const text = addPixelText(scene, textX, strip.rowTops[0] ?? 0, rows.join("\n"), TEXT_STYLE);
  if (bars > 0) {
    const { style } = fitPixelText(text, { room, styles: TEXT_FIT_STYLES }, textX, 0);
    placePixelText(text, textX, messageLineTop(body, one, style.scale));
  }
  const parts: Faded[] = [text];
  if (owner !== undefined && lead !== undefined) {
    parts.unshift(...ownerLead(scene, owner, name, lead));
  } else if (typeof line.lead === "string" && scene.textures.exists(line.lead)) {
    const icon = bars === 0 ? strip.icon : one.icon;
    parts.unshift(scene.add.image(icon.x, icon.y, line.lead).setOrigin(0));
  }
  (panel as Faded & GameObjects.Components.Depth).setDepth(depth);
  parts.forEach((part) => (part as Faded & GameObjects.Components.Depth).setDepth(depth));
  return { bars, id: line.id, panel, parts, scene };
}

// The owner's 20x20 face in its mood, else neutral, in a 1px ink frame over tan, and their name
// under it.
function ownerLead(scene: Scene, owner: OwnerLead, name: string, lead: OwnerLeadLayout): Faded[] {
  const { frame } = lead;
  const g = scene.add.graphics();
  drawFramedRect(g, { border: PALETTE.ink, fill: PALETTE.tan }, frame);
  const parts: Faded[] = [g];
  const key = ownerCardFaceKey(gameData, owner.dog);
  if (scene.textures.exists(key)) {
    const face = scene.add.sprite(frame.x + 1, frame.y + 1, key).setOrigin(0);
    const tag = firstTag(scene, key, [owner.mood, "neutral"]);
    if (tag !== undefined) {
      playTag(face, key, tag);
    }
    parts.push(face);
  }
  const label = addPixelText(scene, 0, 0, name, NAME_STYLE);
  placePixelText(label, lead.name.x - inkSpan(label).left, lead.name.y);
  return [...parts, label];
}

// The width of the columns text inks in style, measured on the font it is drawn in.
function inkWidth(scene: Scene, text: string, style: PixelTextStyle): number {
  const probe = addPixelText(scene, 0, 0, text, style).setVisible(false);
  const ink = inkSpan(probe);
  probe.destroy();
  return ink.right - ink.left;
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
