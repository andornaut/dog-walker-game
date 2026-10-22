import { SCREEN_CONFIG } from "../data/screen";
import type { DogId } from "../data/types";
import { screenLayout } from "../layout/screenLayout";
import type { Point, Rect } from "../lib/rect";
import { type FontMetrics, inkRowsFromCapTop } from "../ui/fontMetrics";
import { effectIconKey, type EffectItem } from "./effectIcons";
import { type FaceBox, type FaceRow, faceRows, type FaceText } from "./faceText";
import { DEBUFF_BAR } from "./walkHud";

// The message strip: what just happened, in a ui-panel across the top of the backdrop band's
// flat sky, under the walk bar and clear of the cross street and the far road. It shows one
// line, body text at 2x led by its 16x16 icon, or an owner's quip led by their face and name
// (OWNER_LEAD), wrapped onto up to MESSAGE_STRIP.rows rows; an owner the text names has their
// face inline before their name (faceText.ts); the panel is as tall as the rows it
// holds, and as the owner's lead. While debuff bars are up it moves under them and shows
// the line on one row (messageLinePanel). A line waits its turn, shows, and fades out at the end
// of its life. The strip shows while it has a line.

// What a line is about, and the icon that leads it; or a walk effect, such as a gear, a perk or
// an upgrade, led by its 16x16 icon.
export const MESSAGE_ICONS = {
  achievement: "icon-lucky",
  bump: "icon-bump",
  fired: "icon-fired",
  hint: "icon-hint",
  lastHeart: "icon-last-heart",
  lucky: "icon-lucky",
  muddy: "icon-muddy",
  pull: "icon-trait-chaser",
  stinky: "icon-stinky",
  treat: "icon-treat",
  zoomies: "icon-zoomies",
} as const;
export type MessageIcon = EffectItem | keyof typeof MESSAGE_ICONS;

// An owner's quip leads with the owner's face, in mood, and their name, in place of an icon.
export interface OwnerLead {
  readonly dog: DogId;
  readonly kind: "owner";
  readonly mood: string;
}

// What leads a line: its icon, or an owner's face and name.
export type MessageLead = MessageIcon | OwnerLead;

export function isOwnerLead(lead: MessageLead): lead is OwnerLead {
  return typeof lead === "object" && lead.kind === "owner";
}

export function messageIconKey(icon: MessageIcon): string {
  return typeof icon === "string" ? MESSAGE_ICONS[icon] : effectIconKey(icon);
}

// Screen pixels. The strip starts gap rows under the walk bar. From its top-left
// corner: the first row's capitals start capsTop down, each further row a line of the body
// font at scale lower, and the icon is centred on the first row's capitals. Text starts
// textX in and ends padRight short of the right edge; the panel ends padBottom under the last
// row's lowest ink. The capitals' and the ink's rows and the line come from the body font's
// metrics.
export const MESSAGE_STRIP = {
  capsTop: 10,
  gap: 6,
  icon: { size: 16, x: 6 },
  padBottom: 8,
  padRight: 6,
  rows: 2,
  scale: 2,
  textX: 26,
  width: 344,
  x: 8,
} as const;

interface MessageStripLayout {
  icon: Point;
  // The panel at its tallest, holding MESSAGE_STRIP.rows rows.
  panel: Rect;
  // How wide a row's text may be, in screen pixels.
  room: number;
  // The top of each row's capitals.
  rowTops: number[];
  textX: number;
}

// The walk bar the strip hangs under.
const WALK_BAR_RECT = screenLayout(SCREEN_CONFIG).topBar;

function stripTop(bar: Rect): number {
  return bar.y + bar.height + MESSAGE_STRIP.gap;
}

export function messageStripLayout(
  body: FontMetrics,
  bar: Rect = WALK_BAR_RECT,
): MessageStripLayout {
  const { capsTop, icon, padRight, rows, scale, textX, width, x } = MESSAGE_STRIP;
  const y = stripTop(bar);
  const rowHeight = body.lineHeight * scale;
  const rowTops = Array.from({ length: rows }, (_, row) => y + capsTop + row * rowHeight);
  const iconTop = Math.floor((body.capHeight * scale - icon.size) / 2);
  return {
    icon: { x: x + icon.x, y: y + capsTop + iconTop },
    panel: messagePanel(body, rows, bar),
    room: width - textX - padRight,
    rowTops,
    textX: x + textX,
  };
}

// The panel holding rows rows of text.
export function messagePanel(body: FontMetrics, rows: number, bar: Rect = WALK_BAR_RECT): Rect {
  const { capsTop, padBottom, scale, width, x } = MESSAGE_STRIP;
  const rowHeight = body.lineHeight * scale;
  const ink = inkRowsFromCapTop(body) * scale;
  const height = capsTop + (rows - 1) * rowHeight + ink + padBottom;
  return { height, width, x, y: stripTop(bar) };
}

// The one-row strip under bars debuff bars: a panel height tall, its top gap rows under the
// last bar's top, the icon at icon and the text from textX, in the first of TEXT_FIT_STYLES
// whose ink fits room, its capitals centred on the icon's rows.
export const MESSAGE_LINE = {
  gap: 2,
  height: 26,
  icon: { x: 6, y: 5 },
  room: 312,
  textX: 26,
} as const;

interface MessageLinePanel {
  icon: Point;
  panel: Rect;
  room: number;
  textX: number;
}

export function messageLinePanel(bars: number, bar: Rect = WALK_BAR_RECT): MessageLinePanel {
  const { gap, height, icon, room, textX } = MESSAGE_LINE;
  const { width, x } = MESSAGE_STRIP;
  const y = bar.y + bar.height + gap + bars * DEBUFF_BAR.height;
  return {
    icon: { x: x + icon.x, y: y + icon.y },
    panel: { height, width, x, y },
    room,
    textX: x + textX,
  };
}

// The top of a one-row line's capitals at scale, centred on its icon's rows.
export function messageLineTop(body: FontMetrics, line: MessageLinePanel, scale: number): number {
  return line.icon.y + Math.floor((MESSAGE_STRIP.icon.size - body.capHeight * scale) / 2);
}

// An owner's quip line leads with the owner's face-owner-<art>-20 (face square) in a 1px ink
// frame over tan, at the icon's column, the frame's top rise rows above the top of the first
// row's capitals at 2x; and the owner's name in the body font at 1x centred under it, its
// capitals nameGap rows under the frame. The lead's column is as wide as the frame, or as the
// name's ink where that is wider, the frame centred in it; the text starts as far right of the
// column as it starts right of an icon, its room narrowed to match.
export const OWNER_LEAD = { face: 20, nameGap: 2, rise: 4 } as const;

// Where a line's lead and text go: the icon's column and the text's start and room, and the top
// of the first row's capitals at 2x.
export interface LeadSlot {
  capsTop: number;
  iconX: number;
  room: number;
  textX: number;
}

export interface OwnerLeadLayout {
  // The row under the name's lowest ink.
  bottom: number;
  frame: Rect;
  // The left of the name's ink and the top of its capitals.
  name: Point;
  room: number;
  textX: number;
}

// The strip's lead slot, with no debuff bar up.
export function stripLeadSlot(body: FontMetrics, bar: Rect = WALK_BAR_RECT): LeadSlot {
  const { icon, room, rowTops, textX } = messageStripLayout(body, bar);
  return { capsTop: rowTops[0] ?? 0, iconX: icon.x, room, textX };
}

// The one-row strip's lead slot, under bars debuff bars.
export function lineLeadSlot(body: FontMetrics, bars: number, bar: Rect = WALK_BAR_RECT): LeadSlot {
  const one = messageLinePanel(bars, bar);
  const capsTop = messageLineTop(body, one, MESSAGE_STRIP.scale);
  return { capsTop, iconX: one.icon.x, room: one.room, textX: one.textX };
}

// An owner's lead in slot, for a name whose ink is nameInk wide.
export function ownerLeadLayout(
  body: FontMetrics,
  slot: LeadSlot,
  nameInk: number,
): OwnerLeadLayout {
  const { face, nameGap, rise } = OWNER_LEAD;
  const framed = face + 2;
  const column = Math.max(framed, nameInk);
  const shift = column - MESSAGE_STRIP.icon.size;
  const frame = {
    height: framed,
    width: framed,
    x: slot.iconX + Math.floor((column - framed) / 2),
    y: slot.capsTop - rise,
  };
  const nameTop = frame.y + frame.height + nameGap;
  return {
    bottom: nameTop + inkRowsFromCapTop(body),
    frame,
    name: { x: slot.iconX + Math.floor((column - nameInk) / 2), y: nameTop },
    room: slot.room - shift,
    textX: slot.textX + shift,
  };
}

// A panel grown, where it is shorter, to end MESSAGE_STRIP.padBottom under an owner's lead.
export function ownerLeadPanel(panel: Rect, lead: OwnerLeadLayout): Rect {
  const height = lead.bottom + MESSAGE_STRIP.padBottom - panel.y;
  return { ...panel, height: Math.max(panel.height, height) };
}

// Every panel a line can take under bars debuff bars: with none, the strip on each count of
// its rows; under bars, the one-row strip; and each of those grown to an owner's lead.
export function linePanels(body: FontMetrics, bars: number, bar: Rect = WALK_BAR_RECT): Rect[] {
  const plain =
    bars === 0
      ? Array.from({ length: MESSAGE_STRIP.rows }, (_, row) => messagePanel(body, row + 1, bar))
      : [messageLinePanel(bars, bar).panel];
  const slot = bars === 0 ? stripLeadSlot(body, bar) : lineLeadSlot(body, bars, bar);
  const lead = ownerLeadLayout(body, slot, 0);
  return [...plain, ...plain.map((panel) => ownerLeadPanel(panel, lead))];
}

// A line broken at spaces outside its owners' names into rows no wider than room, as width
// measures a run of text, each name led by its face in box, at most MESSAGE_STRIP.rows of them:
// text past the last row is left out.
export function messageRows(
  width: (text: string) => number,
  box: FaceBox | undefined,
  room: number,
  line: FaceText,
): FaceRow[] {
  return faceRows(width, box, room, line).slice(0, MESSAGE_STRIP.rows);
}

// icon: what leads the line, an icon or an owner's face and name. Each owner its text names
// (marks) is drawn led by their face, but for an owner whose face and name lead the line.
export interface MessageLine extends FaceText {
  readonly icon: MessageLead;
}

// A line on the strip: id tells lines with the same text apart, and ageMs counts from when it
// showed.
interface ShownLine extends MessageLine {
  readonly ageMs: number;
  readonly id: number;
}

// shown: the line on the strip, if any. waiting: lines said but not yet shown, oldest first.
export interface MessageStripState {
  readonly nextId: number;
  readonly shown: ShownLine | null;
  readonly waiting: readonly MessageLine[];
}

export const EMPTY_MESSAGE_STRIP: MessageStripState = { nextId: 0, shown: null, waiting: [] };

// dwellMs: the least a line shows before a waiting line takes its place. lifeMs: how long a
// line lives from when it showed, its last fadeMs fading out. maxWaiting: lines said faster
// than they can show beyond this many drop the oldest waiting one.
interface MessageTiming {
  readonly dwellMs: number;
  readonly fadeMs: number;
  readonly lifeMs: number;
  readonly maxWaiting: number;
}

export const MESSAGE_TIMING: MessageTiming = {
  dwellMs: 1500,
  fadeMs: 400,
  lifeMs: 6000,
  maxWaiting: 6,
};

// Adds a line to wait its turn, unless the same text is already shown or waiting.
export function sayLine(
  timing: MessageTiming,
  line: MessageLine,
  state: MessageStripState,
): MessageStripState {
  const repeated =
    state.shown?.text === line.text || state.waiting.some(({ text }) => text === line.text);
  if (repeated) {
    return state;
  }
  return { ...state, waiting: [...state.waiting, line].slice(-timing.maxWaiting) };
}

// Adds a line ahead of every waiting line with its icon, as an urgent hint jumps the hints
// waiting their turn, unless the same text is already shown or waiting. Past maxWaiting it
// drops the oldest other waiting line.
export function sayLineAhead(
  timing: MessageTiming,
  line: MessageLine,
  state: MessageStripState,
): MessageStripState {
  const said = sayLine(timing, line, state);
  if (said === state) {
    return state;
  }
  const others = state.waiting;
  const at = others.findIndex(({ icon }) => icon === line.icon);
  const waiting = at < 0 ? [...others, line] : [...others.slice(0, at), line, ...others.slice(at)];
  if (waiting.length <= timing.maxWaiting) {
    return { ...state, waiting };
  }
  const oldest = waiting[0] === line ? 1 : 0;
  return { ...state, waiting: waiting.filter((_, i) => i !== oldest) };
}

// Ages the shown line dtMs, drops it past its life, and shows the next waiting line once the
// shown one has dwelt.
export function stepMessageStrip(
  timing: MessageTiming,
  dtMs: number,
  state: MessageStripState,
): MessageStripState {
  const aged = state.shown === null ? null : { ...state.shown, ageMs: state.shown.ageMs + dtMs };
  const shown = aged !== null && aged.ageMs < timing.lifeMs ? aged : null;
  const [next, ...waiting] = state.waiting;
  if (next === undefined || (shown !== null && shown.ageMs < timing.dwellMs)) {
    return { ...state, shown };
  }
  return { nextId: state.nextId + 1, shown: { ...next, ageMs: 0, id: state.nextId }, waiting };
}

// How opaque the shown line is: whole, fading out over the last fadeMs of its life.
export function lineAlpha(timing: MessageTiming, line: ShownLine): number {
  const left = (timing.lifeMs - line.ageMs) / timing.fadeMs;
  return Math.min(1, Math.max(0, left));
}
