// A bitmap font's glyph, in font pixels: its inked box from the pen position and the line's
// top, and how far it moves the pen.
interface BitmapGlyph {
  readonly advance: number;
  readonly height: number;
  readonly width: number;
  readonly xOffset: number;
  readonly yOffset: number;
}

// A bitmap font as an XML BMFont file describes it: its glyphs by character, the pen shift
// between a pair of characters (keyed first then second), and its line height.
export interface BitmapFontFile {
  readonly glyphs: ReadonlyMap<string, BitmapGlyph>;
  readonly kernings: ReadonlyMap<string, number>;
  readonly lineHeight: number;
}

function attributes(tag: string): Map<string, number> {
  return new Map(
    [...tag.matchAll(/(\w+)="(-?\d+)"/g)].map(([, name, value]) => [name ?? "", Number(value)]),
  );
}

function char(code: number | undefined): string {
  return String.fromCodePoint(code ?? 0);
}

export function parseBitmapFont(fnt: string): BitmapFontFile {
  const common = attributes(/<common\b[^>]*>/.exec(fnt)?.[0] ?? "");
  const glyphs = new Map(
    [...fnt.matchAll(/<char\b[^>]*>/g)].map(([tag]) => {
      const field = attributes(tag);
      const glyph: BitmapGlyph = {
        advance: field.get("xadvance") ?? 0,
        height: field.get("height") ?? 0,
        width: field.get("width") ?? 0,
        xOffset: field.get("xoffset") ?? 0,
        yOffset: field.get("yoffset") ?? 0,
      };
      return [char(field.get("id")), glyph] as const;
    }),
  );
  const kernings = new Map(
    [...fnt.matchAll(/<kerning\b[^>]*>/g)].map(([tag]) => {
      const field = attributes(tag);
      return [char(field.get("first")) + char(field.get("second")), field.get("amount") ?? 0];
    }),
  );
  return { glyphs, kernings, lineHeight: common.get("lineHeight") ?? 0 };
}

// A font's rows, in font pixels down from a line's top: where its capitals start (capTop) and
// how many rows they take, from its H; the row under its lowest ink, descenders included; and
// the distance from one line's top to the next.
export interface FontMetrics {
  readonly capHeight: number;
  readonly capTop: number;
  readonly inkBottom: number;
  readonly lineHeight: number;
}

export function fontMetrics(font: {
  readonly glyphs: ReadonlyMap<string, Pick<BitmapGlyph, "height" | "yOffset">>;
  readonly lineHeight: number;
}): FontMetrics {
  const capital = font.glyphs.get("H");
  const inked = [...font.glyphs.values()].filter((glyph) => glyph.height > 0);
  return {
    capHeight: capital?.height ?? 0,
    capTop: capital?.yOffset ?? 0,
    inkBottom: Math.max(0, ...inked.map((glyph) => glyph.yOffset + glyph.height)),
    lineHeight: font.lineHeight,
  };
}

// The columns from the pen to the first column text's first glyph inks, in font pixels: its left
// side bearing, or 0 for text with no glyph.
export function leftBearing(
  glyph: (char: string) => Pick<BitmapGlyph, "xOffset"> | undefined,
  text: string,
): number {
  const first = [...text].find((char) => char.trim() !== "");
  return first === undefined ? 0 : Math.max(0, glyph(first)?.xOffset ?? 0);
}

// The rows of ink from the top of the capitals to the lowest ink.
export function inkRowsFromCapTop(metrics: FontMetrics): number {
  return metrics.inkBottom - metrics.capTop;
}

// The rows from the first line's capitals to the last line's lowest ink, for lines lines a
// line height apart (at least one).
export function inkRowsOfLines(metrics: FontMetrics, lines: number): number {
  return (Math.max(1, lines) - 1) * metrics.lineHeight + inkRowsFromCapTop(metrics);
}

// A label over its help text leaves LABEL_HELP_GAP clear rows between the lowest row the
// label's font inks, its deepest descender's, and the help text's capitals: one offset per
// font, so labels in a list line up, and a label with no descender leaves a few more.
export const LABEL_HELP_GAP = 10;

// How far the help text's capitals' top sits under its label's, in screen pixels, for a label in
// the font label at scale.
export function helpCapDy(label: FontMetrics, scale: number): number {
  return inkRowsFromCapTop(label) * scale + LABEL_HELP_GAP;
}
