import type { GameObjects, Scene } from "phaser";

import { gameData } from "../data";
import { type FaceRow, type FaceText, inlineFaceBox, withoutFace } from "../hud/faceText";
import {
  EMPTY_MESSAGE_STRIP,
  isOwnerLead,
  lineAlpha,
  lineLeadSlot,
  MESSAGE_STRIP,
  MESSAGE_TIMING,
  messageIconKey,
  type MessageLine,
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
import { PALETTE } from "../ui/phaser/palette";
import {
  addPixelText,
  inkSpan,
  pixelFontMetrics,
  type PixelTextStyle,
  placePixelText,
} from "../ui/phaser/pixelText";
import { TEXT_FIT_STYLES, type TextFitStyle } from "../ui/textFit";
import { addFaceRows, addFramedOwnerFace, fitFaceRows, measureRuns } from "./faceTextView";
import { addPanel } from "./uiKit";

// A line said from the run scene, as a MessageLine: the HUD shows it on its message strip.
export const MESSAGE_EVENT = "message";

// Says a line on the walk's message strip from the run scene.
export function sayMessage(runScene: Scene, line: MessageLine): void {
  runScene.events.emit(MESSAGE_EVENT, line);
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
interface StripLine extends FaceText {
  readonly id: number;
  readonly lead: OwnerLead | string;
}

// The message strip (see hud/messageStrip.ts) as drawn. It draws in whichever scene it is
// given each frame: the HUD while the walk shows, or the card or pause menu over its dim.
// depth puts it under the HUD's other parts there, or over the overlay's.
export class MessageStrip {
  private drawn: Drawn | undefined;
  private state: MessageStripState = EMPTY_MESSAGE_STRIP;

  // ahead: the line waits ahead of the waiting lines with its icon.
  say(line: MessageLine, ahead = false): void {
    const add = ahead ? sayLineAhead : sayLine;
    this.state = add(MESSAGE_TIMING, line, this.state);
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
      ...(shown.marks === undefined ? {} : { marks: shown.marks }),
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
// moves the text right, and grows a panel shorter than the lead. Each owner the text names has
// their face inline before their name, but the owner whose face and name lead the line.
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
  const said = withoutFace(owner?.dog, line);
  const set =
    bars === 0
      ? { ...wrappedRows(scene, room, said), capsTop: strip.rowTops[0] ?? 0 }
      : oneRow(scene, room, said, (scale) => messageLineTop(body, one, scale));
  const fits = bars === 0 ? messagePanel(body, Math.max(1, set.rows.length)) : one.panel;
  const panel: Faded = addPanel(scene, lead === undefined ? fits : ownerLeadPanel(fits, lead));
  const text = { box: inlineFaceBox(body, set.fit.scale), fit: set.fit, style: TEXT_STYLE };
  const parts: Faded[] = addFaceRows(scene, { capsTop: set.capsTop, x: textX }, text, set.rows);
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

// The owner's framed face in its mood, and their name under it.
function ownerLead(scene: Scene, owner: OwnerLead, name: string, lead: OwnerLeadLayout): Faded[] {
  const parts: Faded[] = addFramedOwnerFace(scene, lead.frame, owner);
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

// The line's rows at 2x, measured on the font they are drawn in.
function wrappedRows(
  scene: Scene,
  room: number,
  line: FaceText,
): { fit: TextFitStyle; rows: FaceRow[] } {
  const fit = { letterSpacing: 0, scale: MESSAGE_STRIP.scale };
  const box = inlineFaceBox(pixelFontMetrics(scene, "body"), fit.scale);
  const rows = measureRuns(scene, TEXT_STYLE, (width) =>
    messageRows((run) => width(fit, run), box, room, line),
  );
  return { fit, rows };
}

// The line on one row in the first of TEXT_FIT_STYLES that fits room, its capitals' top as
// capsTop gives it for the style's scale.
function oneRow(
  scene: Scene,
  room: number,
  line: FaceText,
  capsTop: (scale: number) => number,
): { capsTop: number; fit: TextFitStyle; rows: FaceRow[] } {
  const fitted = fitFaceRows(scene, TEXT_STYLE, { room, styles: TEXT_FIT_STYLES }, line);
  return { capsTop: capsTop(fitted.style.scale), fit: fitted.style, rows: fitted.rows };
}
