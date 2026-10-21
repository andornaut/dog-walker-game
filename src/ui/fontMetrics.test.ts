import { describe, expect, it } from "vitest";

import { fontMetrics, inkRowsFromCapTop, inkRowsOfLines, parseBitmapFont } from "./fontMetrics";

// A font with a capital H on rows 2 to 7, a g reaching row 9 and a kerned pair.
const FNT = `<?xml version="1.0"?>
<font>
  <common lineHeight="11" base="8" scaleW="64" scaleH="16" pages="1" packed="0"/>
  <chars count="3">
    <char id="32" x="0" y="0" width="0" height="0" xoffset="0" yoffset="0" xadvance="2" page="0"/>
    <char id="72" x="1" y="0" width="4" height="6" xoffset="0" yoffset="2" xadvance="5" page="0"/>
    <char id="103" x="6" y="0" width="3" height="6" xoffset="-1" yoffset="4" xadvance="4" page="0"/>
  </chars>
  <kernings count="1">
    <kerning first="72" second="103" amount="-1"/>
  </kernings>
</font>`;

describe("parseBitmapFont", () => {
  const font = parseBitmapFont(FNT);

  it("reads each glyph's box and advance", () => {
    for (const [char, glyph] of [
      [" ", { advance: 2, height: 0, width: 0, xOffset: 0, yOffset: 0 }],
      ["H", { advance: 5, height: 6, width: 4, xOffset: 0, yOffset: 2 }],
      ["g", { advance: 4, height: 6, width: 3, xOffset: -1, yOffset: 4 }],
    ] as const) {
      expect(font.glyphs.get(char)).toEqual(glyph);
    }
  });

  it("reads the line height and the kerned pairs", () => {
    expect(font.lineHeight).toBe(11);
    expect([...font.kernings]).toEqual([["Hg", -1]]);
  });
});

describe("fontMetrics", () => {
  it("takes the capitals from H and the lowest ink from any glyph", () => {
    const metrics = fontMetrics(parseBitmapFont(FNT));
    expect(metrics).toEqual({ capHeight: 6, capTop: 2, inkBottom: 10, lineHeight: 11 });
    expect(inkRowsFromCapTop(metrics)).toBe(8);
  });
});

describe("inkRowsOfLines", () => {
  const metrics = fontMetrics(parseBitmapFont(FNT));
  it("spans lines' capitals to their lowest ink", () => {
    for (const [lines, rows] of [
      [0, 8],
      [1, 8],
      [3, 2 * 11 + 8],
    ] as const) {
      expect(inkRowsOfLines(metrics, lines)).toBe(rows);
    }
  });
});
