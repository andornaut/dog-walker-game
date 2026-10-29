import type { FontMetrics } from "@andornaut/game-kit/text/bitmapFont";

// A name set in a pill inside a line of text: a pale rounded box behind the name, laid into the
// line so that measuring, fitting and wrapping the text make room for it. The text carries the
// pill as characters the fonts draw as blank advances: an opener, which says which pill, before
// the name, a closer after it, and a pill space for each space inside the name, which never
// breaks. Sizes are in font pixels at 1x and scale with the text.
//
// height: the pill's rows, its top rise rows above its line's top. inset: the columns between
// the pill's edge and the name's ink, each side. gap: the columns between the pill and the next
// ink on its line.
export const PILL = { gap: 3, height: 11, inset: 3, rise: 1 } as const;

// Openers count up from here, one per kind of pill: the private use area, which no text uses.
const OPENER_BASE = 0xe010;
const OPENERS = 16;
export const PILL_CLOSE = "";
export const PILL_SPACE = "";

// The opener of the index-th kind of pill.
export function pillOpener(index: number): string {
  if (!Number.isInteger(index) || index < 0 || index >= OPENERS) {
    throw new Error(`No pill opener ${index}`);
  }
  return String.fromCodePoint(OPENER_BASE + index);
}

// The kind of pill char opens, or undefined for a character that opens none.
export function pillIndex(char: string): number | undefined {
  const index = (char.codePointAt(0) ?? 0) - OPENER_BASE;
  return char.length === 1 && index >= 0 && index < OPENERS ? index : undefined;
}

// The advance each pill character takes in a font whose space advances spaceAdvance, in font
// pixels: an opener the inset; a closer the inset, the gap, less the space after it and the
// blank column every glyph's advance holds after its ink; a pill space a space.
export function pillGlyphAdvances(spaceAdvance: number): Map<string, number> {
  const close = PILL.inset + PILL.gap - spaceAdvance - 1;
  return new Map([
    ...Array.from({ length: OPENERS }, (_, i): [string, number] => [pillOpener(i), PILL.inset]),
    [PILL_CLOSE, close],
    [PILL_SPACE, spaceAdvance],
  ]);
}

// The name text with its spaces made pill spaces, in a pill of the index-th kind.
export function inPill(index: number, name: string): string {
  return `${pillOpener(index)}${name.replaceAll(" ", PILL_SPACE)}${PILL_CLOSE}`;
}

// A character as laid out: its line, and the columns it inks (left to right, exclusive), none for
// a blank glyph.
export interface LaidChar {
  readonly char: string;
  readonly ink: { readonly left: number; readonly right: number } | null;
  readonly line: number;
}

// A pill as laid out: its kind, its line, its columns and the characters of its name.
interface LaidPill {
  readonly index: number;
  readonly left: number;
  readonly line: number;
  readonly name: readonly number[];
  readonly right: number;
}

// Each pill in chars, laid out at scale: from its name's ink less the inset to the ink plus the
// inset. A pill whose name inks nothing takes no room.
export function laidPills(scale: number, chars: readonly LaidChar[]): LaidPill[] {
  const pills: LaidPill[] = [];
  let open: { index: number; name: number[] } | undefined;
  chars.forEach((char, at) => {
    const index = pillIndex(char.char);
    if (index !== undefined) {
      open = { index, name: [] };
    } else if (char.char === PILL_CLOSE && open !== undefined) {
      const inked = open.name.flatMap((i) => chars[i]?.ink ?? []);
      if (inked.length > 0) {
        pills.push({
          index: open.index,
          left: Math.min(...inked.map((ink) => ink.left)) - PILL.inset * scale,
          line: char.line,
          name: open.name,
          right: Math.max(...inked.map((ink) => ink.right)) + PILL.inset * scale,
        });
      }
      open = undefined;
    } else if (open !== undefined) {
      open.name.push(at);
    }
  });
  return pills;
}

// The columns chars ink, their pills' included, or null for none.
export function inkWithPills(
  scale: number,
  chars: readonly LaidChar[],
): { left: number; right: number } | null {
  const spans = [...chars.flatMap((char) => char.ink ?? []), ...laidPills(scale, chars)];
  if (spans.length === 0) {
    return null;
  }
  return {
    left: Math.min(...spans.map((span) => span.left)),
    right: Math.max(...spans.map((span) => span.right)),
  };
}

// A pill's top below its line's top (negative: above it) and its height, at scale.
export function pillRows(scale: number): { height: number; top: number } {
  return { height: PILL.height * scale, top: -PILL.rise * scale };
}

// The rows a pill keeps clear of an image over or under it, in screen pixels at any scale.
export const PILL_IMAGE_GAP = 2;

// The rows a line's pills reach over its capitals, which start capTop rows under the line's top,
// at scale.
export function pillRiseOverCaps(metrics: Pick<FontMetrics, "capTop">, scale: number): number {
  return metrics.capTop * scale - pillRows(scale).top;
}

// The rows a line's pills reach under its lowest ink, inkBottom rows under the line's top, at
// scale.
export function pillDropUnderInk(metrics: Pick<FontMetrics, "inkBottom">, scale: number): number {
  const { height, top } = pillRows(scale);
  return top + height - metrics.inkBottom * scale;
}

// Whether text sets a name in a pill.
export function hasPill(text: string): boolean {
  return [...text].some((char) => pillIndex(char) !== undefined);
}
