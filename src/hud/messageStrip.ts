import type { Point, Rect } from "../layout/rect";
import { wrapWords } from "../text/lines";
import { STRIP_TAB_BOTTOM } from "./stateStrip";

// The message strip: what just happened, in a ui-panel across the top of the backdrop band,
// under the state strip's tab and clear of the cross street and the far road. It shows one
// line, body text at 2x led by its 16x16 icon, wrapped onto up to MESSAGE_STRIP.rows rows; the
// panel is as tall as the rows it holds. A line waits its turn, shows, and fades out at the
// end of its life. The strip shows while it has a line.

// What a line is about, and the icon that leads it.
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
export type MessageIcon = keyof typeof MESSAGE_ICONS;

export function messageIconKey(icon: MessageIcon): string {
  return MESSAGE_ICONS[icon];
}

// Screen pixels. The strip starts gap rows under the state strip's tab. From its top-left
// corner: the first row's capitals start capsTop down, each further row rowHeight lower (the
// body font's line at 2x), and the icon is centred on the first row's capitals. Text starts
// textX in and ends padRight short of the right edge; the panel ends padBottom under the last
// row's lowest ink.
export const MESSAGE_STRIP = {
  capsTop: 10,
  gap: 2,
  icon: { size: 16, x: 6 },
  padBottom: 6,
  padRight: 6,
  rowHeight: 20,
  rows: 2,
  scale: 2,
  textX: 26,
  width: 344,
  x: 8,
} as const;

// The body font's capitals are 5 rows tall at 1x, its lowest ink 2 rows under them.
const CAPS_ROWS = 5;
const INK_ROWS = 7;

export interface MessageStripLayout {
  icon: Point;
  // The panel at its tallest, holding MESSAGE_STRIP.rows rows.
  panel: Rect;
  // How wide a row's text may be, in screen pixels.
  room: number;
  // The top of each row's capitals.
  rowTops: number[];
  textX: number;
}

export function messageStripLayout(): MessageStripLayout {
  const { capsTop, gap, icon, padRight, rowHeight, rows, scale, textX, width, x } = MESSAGE_STRIP;
  const y = STRIP_TAB_BOTTOM + gap;
  const rowTops = Array.from({ length: rows }, (_, row) => y + capsTop + row * rowHeight);
  return {
    icon: { x: x + icon.x, y: y + capsTop + Math.floor((CAPS_ROWS * scale - icon.size) / 2) },
    panel: messagePanel(rows),
    room: width - textX - padRight,
    rowTops,
    textX: x + textX,
  };
}

// The panel holding rows rows of text.
export function messagePanel(rows: number): Rect {
  const { capsTop, gap, padBottom, rowHeight, scale, width, x } = MESSAGE_STRIP;
  const height = capsTop + (rows - 1) * rowHeight + INK_ROWS * scale + padBottom;
  return { height, width, x, y: STRIP_TAB_BOTTOM + gap };
}

// A line's text broken at spaces into rows no wider than room, as width measures them, at
// most MESSAGE_STRIP.rows of them: text past the last row is left out.
export function messageRows(width: (row: string) => number, room: number, text: string): string[] {
  return wrapWords(width, room, text).slice(0, MESSAGE_STRIP.rows);
}

export interface MessageLine {
  readonly icon: MessageIcon;
  readonly text: string;
}

// A line on the strip: id tells lines with the same text apart, and ageMs counts from when it
// showed.
export interface ShownLine extends MessageLine {
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
export interface MessageTiming {
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
