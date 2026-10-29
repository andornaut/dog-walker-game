import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import type { DogId, GearId, WalkerId } from "../data/types";
import { HELP_LAYOUT } from "../help/helpLayout";
import { GREETING_FIT, greetingLineTops, newWalkerRows } from "../hud/celebrationLayout";
import { celebrationText } from "../hud/zoneCelebration";
import { fillLine, wrapWords } from "../lib/lines";
import { keysOf } from "../lib/records";
import { cents } from "../lib/units";
import type { Owned } from "../save/schema";
import { fontFileMetrics, gameGlyphs, inkWidth } from "../testing/fontInk";
import { veteranSave } from "../testing/saves";
import { inkRowsFromCapTop } from "../ui/fontMetrics";
import { plainMarks } from "../ui/pixelFont";
import { fittingText, TEXT_SCALE, type TextFitStyle } from "../ui/textFit";
import { badgeProgress, badgeWall, wallCell } from "./badgesView";
import { type DetailCard, dogDetail, gearDetail, walkerDetail } from "./detail";
import { END_LAYOUT, quipRowHeight, quipTextY } from "./endLayout";
import { dollarText } from "./home";
import { CARD_TEXT_ROOM, detailCardLayout, detailOwner, type DetailRow } from "./homeLayout";
import { MENU_TEXT_FIELDS } from "./menuText";
import { confirmLeftCapTop, PURCHASE_CONFIRM_LAYOUT } from "./purchaseConfirmLayout";
import { SETTINGS_ROW, settingsLayout } from "./settings";
import { dogRows, gearRows, slotRows } from "./shop";
import { shopRowTextTops } from "./shopLayout";
import { detailTextTops, STATS_LAYOUT, wallLineTops } from "./statsLayout";

type Font = "font-body" | "font-title";

const BODY = fontFileMetrics("font-body");
const FONTS = { body: BODY, title: fontFileMetrics("font-title") };
const NONE: Owned = { dogSlots: [], dogs: [], gear: [], walkers: [] };

// The rows under a line's capitals' top that text's glyphs ink at scale, down to its lowest:
// font-title draws capitals.
function lowestInk(font: Font, scale: number, text: string): number {
  const shown = font === "font-title" ? plainMarks(text).toUpperCase() : plainMarks(text);
  const bottoms = [...shown].map((char) => {
    const glyph = gameGlyphs(font).get(char);
    return glyph === undefined || glyph.height === 0 ? 0 : glyph.yOffset + glyph.height;
  });
  return (Math.max(...bottoms) - fontFileMetrics(font).capTop) * scale;
}

// A label over its help text: the label's text, font and capitals' top at 2x, and the help
// text's capitals' top. held is how the rule holds the clear rows between the font's lowest ink
// and the help text: exactly 10 for a pair laid out by helpCapDy, and at least 10 for a pair
// that already left more.
interface Pair {
  readonly font: Font;
  readonly held: "at least" | "exactly";
  readonly help: number;
  readonly label: string;
  readonly labelTop: number;
  readonly where: string;
}

// The clear rows over the help text's capitals under the label's own ink, and under the lowest
// row its font inks, its deepest descender's.
const clearRows = (pair: Pair) =>
  pair.help - (pair.labelTop + lowestInk(pair.font, TEXT_SCALE, pair.label));
const fontClearRows = (pair: Pair) =>
  pair.help - (pair.labelTop + inkRowsFromCapTop(fontFileMetrics(pair.font)) * TEXT_SCALE);

// A settings row's title over its note.
const SETTINGS_WORDS = gameData.menuText.settings;
const settingsPairs: Pair[] = (["sound", "motion", "install"] as const).map((key) => {
  const label = SETTINGS_WORDS[key];
  const shape = { kind: "switch", noteLines: 1 } as const;
  const [row] = settingsLayout(FONTS, SCREEN_CONFIG, [shape]).rows;
  const top = row?.rect.y ?? 0;
  return {
    font: "font-title",
    held: "exactly",
    help: row?.noteY ?? 0,
    label,
    labelTop: top + SETTINGS_ROW.label.dy,
    where: "settings row",
  };
});

// A detail card's rows: each row of text's last line over the row under it (a row's top, or
// the owner's name's capitals), and a dog's owner's name over their role.
const cardLinesOf = (room: number, text: string) =>
  wrapWords((line) => inkWidth("font-body", { scale: TEXT_SCALE }, plainMarks(line)), room, text);
type CardRow = { lines: string[] } | { owner: { name: string; role: string } };
const ownerOf = (row: { owner: { name: string; role: string } }) => ({
  roleLines: cardLinesOf(CARD_TEXT_ROOM.ownerName, row.owner.role).length,
});
function cardRows(rows: readonly CardRow[], tops: readonly number[], where: string): Pair[] {
  const at = (row: CardRow, top: number) =>
    "owner" in row ? detailOwner(BODY, { x: 0, y: top }, ownerOf(row).roleLines) : undefined;
  return rows.flatMap((row, i): Pair[] => {
    const top = tops[i] ?? 0;
    const owner = at(row, top);
    const own: Pair[] =
      "owner" in row && owner !== undefined
        ? [
            {
              font: "font-body",
              held: "exactly",
              help: owner.role.y,
              label: row.owner.name,
              labelTop: owner.name.y,
              where: `${where}: owner`,
            },
          ]
        : [];
    const next = rows[i + 1];
    if (!("lines" in row) || next === undefined) {
      return own;
    }
    const nextTop = tops[i + 1] ?? 0;
    const help = "owner" in next ? (at(next, nextTop)?.name.y ?? 0) : nextTop;
    const last = row.lines.at(-1) ?? "";
    const labelTop = top + (row.lines.length - 1) * BODY.lineHeight * TEXT_SCALE;
    return [...own, { font: "font-body", held: "at least", help, label: last, labelTop, where }];
  });
}
function detailPairs(kind: "dog" | "gear" | "walker", card: DetailCard): Pair[] {
  const text = (room: number) => (value: string) => ({ lines: cardLinesOf(room, value) });
  const beside: CardRow[] =
    kind === "gear"
      ? [...card.lines, card.status].map(text(CARD_TEXT_ROOM.beside))
      : [
          text(CARD_TEXT_ROOM.beside)(card.subtitle),
          ...(card.owner === undefined ? [] : [{ owner: card.owner }]),
          text(CARD_TEXT_ROOM.beside)(card.status),
        ];
  const below: CardRow[] = kind === "gear" ? [] : card.lines.map(text(CARD_TEXT_ROOM.full));
  const counts = (rows: readonly CardRow[]): DetailRow[] =>
    rows.map((row) => ("owner" in row ? ownerOf(row) : row.lines.length));
  const layout = detailCardLayout(BODY, { below: counts(below), beside: counts(beside) });
  const where = `${card.title}'s detail card`;
  return [...cardRows(beside, layout.beside, where), ...cardRows(below, layout.below, where)];
}
const detailCardPairs: Pair[] = [
  ...keysOf(gameData.dogs).flatMap((dog: DogId) =>
    detailPairs("dog", dogDetail(gameData, NONE, cents(0), dog)),
  ),
  ...keysOf(gameData.shopGear).flatMap((gear: GearId) =>
    detailPairs("gear", gearDetail(gameData, NONE, cents(0), { gear: null }, gear)),
  ),
  ...keysOf(gameData.walkers).flatMap((walker: WalkerId) =>
    detailPairs("walker", walkerDetail(gameData, NONE, walker)),
  ),
];

// A shop row's name over its line.
const SHOP_ROWS = [
  ...slotRows(gameData, NONE),
  ...dogRows(gameData, NONE),
  ...gearRows(gameData, NONE),
];
const shopPairs: Pair[] = SHOP_ROWS.filter(({ line }) => line !== "").map(({ name }) => {
  const tops = shopRowTextTops(BODY);
  return {
    font: "font-body",
    held: "exactly",
    help: tops.line,
    label: name,
    labelTop: tops.name,
    where: "shop row",
  };
});

// The purchase confirm's price over the bank it would leave.
const confirmPairs: Pair[] = SHOP_ROWS.flatMap(({ price }) => {
  if (price === null) {
    return [];
  }
  const label = dollarText(price);
  const { capTop } = PURCHASE_CONFIRM_LAYOUT.price;
  const help = confirmLeftCapTop(FONTS.title);
  return [{ font: "font-title", held: "exactly", help, label, labelTop: capTop, where: "confirm" }];
});

// A badge's wall row's name over its goal, and its open card's name over its status.
const SAVE = veteranSave();
const BADGES = badgeWall(gameData, SAVE);
const wallPairs: Pair[] = BADGES.flatMap((badge) => {
  const width = (line: string) => inkWidth("font-body", { scale: TEXT_SCALE }, line);
  const cell = wallCell(STATS_LAYOUT.wallText, width, badge, badgeProgress(gameData, SAVE, badge));
  const name = cell.name.at(-1) ?? "";
  const tops = wallLineTops(BODY, cell);
  const nameTop = tops[cell.name.length - 1] ?? 0;
  const goalTop = tops[cell.name.length];
  return goalTop === undefined
    ? []
    : [
        {
          font: "font-body",
          held: "exactly",
          help: goalTop,
          label: name,
          labelTop: nameTop,
          where: "badge wall",
        },
      ];
});
const badgeCardPairs: Pair[] = BADGES.map(({ name }) => ({
  font: "font-title",
  held: "exactly",
  help: detailTextTops(FONTS, 1).status,
  label: name,
  labelTop: STATS_LAYOUT.detailText.nameY,
  where: "open badge",
}));

// The end screen's "{owner} fired you" over the closing line.
const endPairs: Pair[] = Object.values(gameData.dogs).map(({ owner }) => {
  const words = gameData.menuText.end;
  const label = fillLine(MENU_TEXT_FIELDS.end, words, "firedYou", { owner: owner.name });
  const row = { fired: true, lines: 1 };
  const help = quipTextY(FONTS, row, quipRowHeight(FONTS, row));
  const labelTop = END_LAYOUT.quips.headerY;
  return { font: "font-title", held: "exactly", help, label, labelTop, where: "end screen" };
});

// A new walker's greeting's last line over their first info line. Both are placed by their
// font line's top.
const walkerPairs: Pair[] = keysOf(gameData.walkers).flatMap((walker) => {
  const shown = celebrationText(gameData, { kind: "newWalker", walker });
  if (shown.kind !== "newWalker") {
    return [];
  }
  const width = (style: TextFitStyle, line: string) => inkWidth("font-body", style, line);
  const greeting = plainMarks(shown.greeting);
  const fitted = fittingText(GREETING_FIT.style, width, GREETING_FIT.room, greeting);
  const rows = newWalkerRows(BODY, shown.info.length, fitted);
  const lines = greetingLineTops(BODY, fitted.style.scale, fitted.lines.length);
  const capTop = BODY.capTop * TEXT_SCALE;
  return [
    {
      font: "font-body",
      held: "at least",
      help: (rows.info[0]?.y ?? 0) + capTop,
      label: fitted.lines.at(-1) ?? "",
      labelTop: (lines.at(-1) ?? 0) + capTop,
      where: "new walker's bubble",
    },
  ];
});

// A help page's title over its body.
const helpPairs: Pair[] = gameData.help.map(({ title }) => ({
  font: "font-title",
  held: "at least",
  help: HELP_LAYOUT.body.y,
  label: title,
  labelTop: HELP_LAYOUT.title.y,
  where: "help page",
}));

const PAIRS: readonly Pair[] = [
  ...badgeCardPairs,
  ...confirmPairs,
  ...detailCardPairs,
  ...endPairs,
  ...helpPairs,
  ...settingsPairs,
  ...shopPairs,
  ...wallPairs,
  ...walkerPairs,
];

// A label over its help text sits one offset per font above it: 10 clear rows under the lowest
// row the font inks, so every label, its own ink however deep, leaves at least 10.
describe("a label over its help text", () => {
  it.each(PAIRS.map((pair) => [pair.where, pair.label, pair.held, pair] as const))(
    "leaves the %s's %s %s 10 clear rows under its font's lowest ink",
    (_where, _label, held, pair) => {
      if (held === "exactly") {
        expect(fontClearRows(pair)).toBe(10);
      } else {
        expect(fontClearRows(pair)).toBeGreaterThanOrEqual(10);
      }
      expect(clearRows(pair)).toBeGreaterThanOrEqual(10);
    },
  );
});
