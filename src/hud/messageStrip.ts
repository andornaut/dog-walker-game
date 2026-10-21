import type { Point, Rect } from "../layout/rect";

// The message strip: what just happened, in a ui-panel over the flat sky at the top of the
// backdrop band, clear of the cross street and the far road. The newest line is body text at
// 2x led by its 16x16 icon; up to OLDER_LINES lines before it sit above it at 1x, without
// icons, fainter the older they are. A line arrives as newest, steps up as newer ones arrive,
// and fades out at the end of its life. The strip shows while it has a line.

// What a line is about, and the icon that leads it.
export const MESSAGE_ICONS = {
  achievement: "icon-lucky",
  bump: "icon-bump",
  fired: "icon-fired",
  hint: "icon-hint",
  lastHeart: "icon-last-heart",
  lucky: "icon-lucky",
  pull: "icon-trait-chaser",
  treat: "icon-treat",
} as const;
export type MessageIcon = keyof typeof MESSAGE_ICONS;

export function messageIconKey(icon: MessageIcon): string {
  return MESSAGE_ICONS[icon];
}

// Screen pixels. The icon, the newest line's capitals and the older lines' capitals are
// placed from the strip's top-left corner; text starts textX in and ends padRight short of the
// strip's right edge. Older lines share the newest line's text column.
export const MESSAGE_STRIP = {
  height: 44,
  icon: { size: 16, x: 6, y: 22 },
  olderCapsTops: [14, 6],
  padRight: 6,
  textX: 26,
  width: 344,
  x: 8,
  y: 46,
} as const;

export const OLDER_LINES = MESSAGE_STRIP.olderCapsTops.length;

// The body font's capitals are 5 rows tall at 1x.
const CAPS_ROWS = 5;

export interface MessageStripLayout {
  icon: Point;
  // The top of each older line's capitals, the line just before the newest first.
  olderTops: number[];
  panel: Rect;
  // How wide a line's text may be, in screen pixels.
  room: number;
  textX: number;
}

export function messageStripLayout(): MessageStripLayout {
  const { height, icon, olderCapsTops, padRight, textX, width, x, y } = MESSAGE_STRIP;
  return {
    icon: { x: x + icon.x, y: y + icon.y },
    olderTops: olderCapsTops.map((top) => y + top),
    panel: { height, width, x, y },
    room: width - textX - padRight,
    textX: x + textX,
  };
}

// The top of the newest line's capitals at scale, centred on the icon's rows.
export function newestCapsTop(layout: MessageStripLayout, scale: number): number {
  const { size } = MESSAGE_STRIP.icon;
  return layout.icon.y + Math.floor((size - CAPS_ROWS * scale) / 2);
}

export interface MessageLine {
  readonly icon: MessageIcon;
  readonly text: string;
}

// A line on the strip: id tells lines with the same text apart, and ageMs counts from when it
// became the newest.
export interface ShownLine extends MessageLine {
  readonly ageMs: number;
  readonly id: number;
}

// lines: newest first. waiting: lines said but not yet shown, oldest first.
export interface MessageStripState {
  readonly lines: readonly ShownLine[];
  readonly nextId: number;
  readonly waiting: readonly MessageLine[];
}

export const EMPTY_MESSAGE_STRIP: MessageStripState = { lines: [], nextId: 0, waiting: [] };

// dwellMs: the least a line stays newest before a waiting line takes its place. lifeMs: how
// long a line lives from when it became newest, its last fadeMs fading out. maxWaiting: lines
// said faster than they can show beyond this many drop the oldest waiting one.
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

// How opaque each older line is at its fullest, the line just before the newest first.
export const OLDER_ALPHAS: readonly number[] = [0.7, 0.4];

// Adds a line to wait its turn, unless the same text is already newest or waiting.
export function sayLine(
  timing: MessageTiming,
  line: MessageLine,
  state: MessageStripState,
): MessageStripState {
  const repeated =
    state.lines[0]?.text === line.text || state.waiting.some(({ text }) => text === line.text);
  if (repeated) {
    return state;
  }
  return { ...state, waiting: [...state.waiting, line].slice(-timing.maxWaiting) };
}

// Ages the lines dtMs, drops those past their life, and makes the next waiting line the newest
// once the newest has dwelt, keeping the newest and OLDER_LINES older ones.
export function stepMessageStrip(
  timing: MessageTiming,
  dtMs: number,
  state: MessageStripState,
): MessageStripState {
  let lines = state.lines
    .map((line) => ({ ...line, ageMs: line.ageMs + dtMs }))
    .filter((line) => line.ageMs < timing.lifeMs);
  const [next, ...waiting] = state.waiting;
  const newest = lines[0];
  if (next === undefined || (newest !== undefined && newest.ageMs < timing.dwellMs)) {
    return { ...state, lines };
  }
  lines = [{ ...next, ageMs: 0, id: state.nextId }, ...lines].slice(0, OLDER_LINES + 1);
  return { lines, nextId: state.nextId + 1, waiting };
}

// How opaque the line at index (0 the newest) is: its place's alpha, fading out over the last
// fadeMs of its life.
export function lineAlpha(timing: MessageTiming, index: number, line: ShownLine): number {
  const place = index === 0 ? 1 : (OLDER_ALPHAS[index - 1] ?? 0);
  const left = (timing.lifeMs - line.ageMs) / timing.fadeMs;
  return place * Math.min(1, Math.max(0, left));
}
