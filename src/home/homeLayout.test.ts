import { readFileSync } from "node:fs";

import { decodePng } from "@andornaut/game-kit/art/png";
import { wrapWords } from "@andornaut/game-kit/lines";
import { keysOf } from "@andornaut/game-kit/records";
import { insetRect, type Rect, rectsOverlap } from "@andornaut/game-kit/rect";
import { inkRowsFromCapTop, inkRowsOfLines } from "@andornaut/game-kit/text/bitmapFont";
import { describe, expect, it } from "vitest";

import { ownerFaceKey } from "../assets/spriteKeys";
import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import type { WalkerId } from "../data/types";
import { ownerPhotoRect, WALK_BAR } from "../hud/walkHud";
import { MIN_TAP_SIZE } from "../layout/screenLayout";
import { unlockPrice } from "../rules/shop";
import type { Owned } from "../save/schema";
import { bodyTextWidth } from "../testing/bodyFont";
import { fontFileMetrics, fontInk, fontInkRows, inkWidth } from "../testing/fontInk";
import { inside } from "../testing/rects";
import { closeControl } from "../ui/closeControl";
import { gridRects } from "../ui/grid";
import { MARK_OFFSET } from "../ui/mark";
import { plainMarks } from "../ui/pixelFont";
import { AFFORD_OUTSET } from "../ui/selection";
import { TEXT_SCALE } from "../ui/textFit";
import { cents } from "../units";
import {
  type DetailCard,
  type DetailPart,
  detailParts,
  dogDetail,
  gearDetail,
  walkerDetail,
} from "./detail";
import { FEEDBACK } from "./feedback";
import { dollarAmountText, dollarText, shortDollarAmountText } from "./home";
import {
  BANK_ROOM,
  bankAmountText,
  bankWell,
  CARD_TEXT_ROOM,
  cardTitleRow,
  detailCardLayout,
  detailOwner,
  detailOwnerHeight,
  type DetailRow,
  dogTileNameY,
  dogTilePlateY,
  HOME_BAR_LAST_FACE,
  HOME_LAYOUT,
  homeBarButtons,
  sectionFill,
  slotSignText,
  updateModalText,
} from "./homeLayout";

const { dogOrigin, dogTiles, sectionFrame, sections, startButton, walkerOrigin, walkerTiles } =
  HOME_LAYOUT;
const { pocket } = HOME_LAYOUT;
const BODY = fontFileMetrics("font-body");

const rows = [
  ["walker", sections.walker, gridRects(walkerTiles, walkerTiles.columns, walkerOrigin)],
  [
    "pocket",
    sections.pocket,
    gridRects(pocket.cells, pocket.cells.columns, pocket.origin).map((cell) =>
      insetRect(pocket.tileInset, cell),
    ),
  ],
  ["dogs", sections.dogs, gridRects(dogTiles, Object.keys(gameData.dogs).length, dogOrigin)],
] as const;

describe("home layout", () => {
  it("spaces the sections evenly and leaves the inset start button clear of them and the screen edge", () => {
    const { gateBar, sectionGap, startGap } = HOME_LAYOUT;
    const stack = [gateBar, sections.walker, sections.dogs, sections.pocket];
    for (let i = 1; i < stack.length; i += 1) {
      const above = stack[i - 1];
      const below = stack[i];
      expect((below?.y ?? 0) - ((above?.y ?? 0) + (above?.height ?? 0))).toBe(sectionGap);
    }
    expect(startButton.y - sections.pocket.y - sections.pocket.height).toBe(startGap);
    expect(SCREEN_CONFIG.height - startButton.y - startButton.height).toBeGreaterThan(startGap);
  });

  it("centres card edges with balanced padding and keeps badge overhang clear of the frame", () => {
    const opaque = (key: string, frame = 0): Rect => {
      const sprite = key.startsWith("ui-");
      const png = decodePng(readFileSync(`public/art/${sprite ? "sprites" : "images"}/${key}.png`));
      const side = key === "ui-check" ? 16 : sprite ? 24 : png.height;
      const pixels = [];
      for (let y = 0; y < side; y += 1) {
        for (let x = 0; x < side; x += 1) {
          if (png.data[(y * png.width + frame * side + x) * 4 + 3] !== 0) {
            pixels.push({ x, y });
          }
        }
      }
      const x = Math.min(...pixels.map((pixel) => pixel.x));
      const y = Math.min(...pixels.map((pixel) => pixel.y));
      return {
        height: Math.max(...pixels.map((pixel) => pixel.y)) + 1 - y,
        width: Math.max(...pixels.map((pixel) => pixel.x)) + 1 - x,
        x,
        y,
      };
    };
    const tick = opaque("ui-check", 3);
    const badges = [opaque("icon-lock"), opaque("icon-bill")];
    // Both tile states reach their nine-slice frame edges. ui-select is the missing-tile fallback.
    for (const key of ["ui-tile", "ui-select"]) {
      const ink = opaque(key, 1);
      expect(ink).toEqual({ height: 24, width: 24, x: 0, y: 0 });
    }
    for (const [id, section, hits] of rows) {
      const fill = sectionFill(section);
      const safe = insetRect(HOME_LAYOUT.sectionContentPadding, fill);
      const gutter = insetRect(HOME_LAYOUT.sectionBadgeGutter, fill);
      const cards = hits.map((hit) =>
        id === "dogs" ? { ...hit, height: hit.height - 2, y: hit.y + 1 } : hit,
      );
      const left = Math.min(...cards.map((tile) => tile.x)) - fill.x;
      const right = fill.x + fill.width - Math.max(...cards.map((tile) => tile.x + tile.width));
      expect(Math.abs(left - right), id).toBeLessThanOrEqual(1);
      for (const hit of hits) {
        const tile = id === "dogs" ? { ...hit, height: hit.height - 2, y: hit.y + 1 } : hit;
        const at = (offset: Rect, dx: number, dy: number) => ({
          ...offset,
          x: tile.x + offset.x + dx,
          y: tile.y + offset.y + dy,
        });
        const visible = [
          at({ ...tile, x: 0, y: 0 }, -FEEDBACK.shakePx, FEEDBACK.pressDipPx),
          at({ ...tile, x: 0, y: 0 }, FEEDBACK.shakePx, FEEDBACK.pressDipPx),
          insetRect(-HOME_LAYOUT.tileSelectOutset, { ...tile, y: tile.y - FEEDBACK.liftPx }),
        ];
        for (const ink of visible) {
          expect(inside(ink, safe), `${id}: ${JSON.stringify(ink)}`).toBe(true);
        }
        const overhang = [
          at(tick, MARK_OFFSET.x, MARK_OFFSET.y - FEEDBACK.liftPx - FEEDBACK.badgePopPx),
          ...badges.map((badge) => at(badge, -2 - FEEDBACK.shakePx, -3)),
        ];
        for (const ink of overhang) {
          expect(inside(ink, gutter), `${id}: ${JSON.stringify(ink)}`).toBe(true);
        }
      }
    }
  });

  it.each(Object.entries(sections))(
    "section %s contains the centred inset Start walk span",
    (_, rect) => {
      expect(rect.x).toBeLessThan(startButton.x);
      expect(rect.x + rect.width).toBeGreaterThan(startButton.x + startButton.width);
      expect(rect.x + rect.width / 2).toBe(startButton.x + startButton.width / 2);
    },
  );

  describe.each(rows)("%s tiles", (_, section, tiles) => {
    const inner = {
      left: section.x + sectionFrame.edge,
      right: section.x + section.width - sectionFrame.edge,
    };
    it("keep the selected mark inside the section's frame", () => {
      expect(Math.min(...tiles.map((tile) => tile.x)) + MARK_OFFSET.x).toBeGreaterThanOrEqual(
        inner.left,
      );
    });
    it("keep the selected mark below the band's heading", () => {
      const { capHeight } = fontFileMetrics("font-title");
      const headingBottom = section.y + HOME_LAYOUT.bandText.y + capHeight * TEXT_SCALE;
      expect(Math.min(...tiles.map((tile) => tile.y)) + MARK_OFFSET.y).toBeGreaterThanOrEqual(
        headingBottom,
      );
    });
    it("end inside the frame", () => {
      expect(Math.max(...tiles.map((tile) => tile.x + tile.width))).toBeLessThanOrEqual(
        inner.right,
      );
    });
    it("are spaced evenly along a row", () => {
      const row = tiles.filter((tile) => tile.y === tiles[0]?.y);
      const gaps = row
        .slice(1)
        .map((tile, i) => tile.x - ((row[i]?.x ?? 0) + (row[i]?.width ?? 0)));
      expect(new Set(gaps).size).toBe(1);
    });
  });
});

describe("the Pocket's tiles", () => {
  const { box, cells, icon, origin, tileInset } = pocket;
  const gear = Object.keys(gameData.shopGear).length;
  const tiles = gridRects(cells, gear, origin).map((cell) => insetRect(tileInset, cell));

  it("span the walker tiles' row", () => {
    const span = (rects: readonly Rect[]) => [
      rects[0]?.x,
      (rects.at(-1)?.x ?? 0) + (rects.at(-1)?.width ?? 0),
    ];
    const walkers = gridRects(walkerTiles, walkerTiles.columns, walkerOrigin);
    expect(span(gridRects(cells, cells.columns, origin))).toEqual(span(walkers));
  });

  it("hold every gear on one row inside the flat backing", () => {
    const fill = sectionFill(sections.pocket);
    expect(gear).toBeLessThanOrEqual(cells.columns);
    for (const tile of tiles) {
      expect(inside(tile, fill)).toBe(true);
    }
  });

  it("centre the icon box across the tile, the icon inside it", () => {
    const [tile] = tiles;
    const width = tile?.width ?? 0;
    expect(Math.abs(width - box.size - 2 * box.dx)).toBeLessThanOrEqual(1);
    expect(icon.dx).toBeGreaterThan(box.dx);
    expect(icon.dy).toBeGreaterThan(box.dy);
  });
});

describe("Pet shop", () => {
  const { board, ...shop } = HOME_LAYOUT.petShop;

  it("holds its board inside its frame, at the top", () => {
    expect(board.y).toBe(shop.y);
    expect(board.x).toBeGreaterThanOrEqual(shop.x);
    expect(board.x + board.width).toBeLessThanOrEqual(shop.x + shop.width);
  });

  it("leaves room under the street sign for the bob", () => {
    const { streetSign } = HOME_LAYOUT;
    expect(shop.y - FEEDBACK.shopBobSteps.length).toBeGreaterThan(0);
    expect(Math.min(...FEEDBACK.shopBobSteps)).toBeGreaterThanOrEqual(-2);
    expect(streetSign.y).toBeLessThan(shop.y);
  });
});

describe("section fills", () => {
  it.each(Object.entries(sections))("%s fill covers its tile area under the band", (_, rect) => {
    const fill = sectionFill(rect);
    const { band, edge } = sectionFrame;
    expect(fill.x).toBe(rect.x + edge);
    expect(fill.x + fill.width).toBe(rect.x + rect.width - edge);
    expect(fill.y).toBeGreaterThan(rect.y + edge + band);
    expect(fill.y + fill.height).toBe(rect.y + rect.height - edge);
  });

  it("gives each section its own image", () => {
    const keys = Object.values(HOME_LAYOUT.sectionFillKeys);
    expect(new Set(keys).size).toBe(Object.keys(sections).length);
    expect(Object.keys(HOME_LAYOUT.sectionFillKeys).sort()).toEqual(Object.keys(sections).sort());
  });
});

// The top bar's buttons with Exit shown and hidden: each walk bar column they share holds the
// same button's place, Exit's in the last, and without it the four move a column right.
describe.each([
  [true, ["logbook", "help", "mute", "settings", "exit"], ["help", "sound", "settings", "pause"]],
  [false, ["logbook", "help", "mute", "settings"], ["help", "sound", "settings", "pause"]],
] as const)("top bar buttons with Exit shown %s", (exit, order, walkColumns) => {
  const { faceSize, height, mid } = HOME_LAYOUT.topBar;
  const buttons = homeBarButtons(exit);
  const hits = buttons.map(([, button]) => button.hit);

  it("runs left to right in order", () => {
    expect(buttons.map(([id]) => id)).toEqual(order);
  });

  // The last four buttons, right to left, each under the walk bar's button in the same column.
  const under = buttons.slice(-walkColumns.length).map(([id, button], i) => {
    const walkId = walkColumns[i] ?? "pause";
    return [id, walkId, button] as const;
  });
  it.each(under)(
    "puts %s's hit in the walk bar's %s column from the bar's top, its face centred in it on the middle row",
    (_, walkId, button) => {
      const { hitWidth, hitX } = WALK_BAR.buttons[walkId];
      expect(button.hit).toMatchObject({ width: hitWidth, x: hitX, y: 0 });
      expect(button.hit.height).toBeGreaterThanOrEqual(height);
      expect(2 * (button.face.x - button.hit.x) + faceSize).toBe(button.hit.width);
      expect(button.face.y + faceSize / 2).toBe(mid);
    },
  );

  it("runs the hit areas side by side, none over another, to the screen's right edge", () => {
    const ends = hits.map((hit) => hit.x + hit.width);
    expect(hits.slice(1).map((hit) => hit.x)).toEqual(ends.slice(0, -1));
    expect(ends.at(-1)).toBe(SCREEN_CONFIG.width);
  });

  it("ends on the face Help's close control takes", () => {
    expect(buttons.at(-1)?.[1].face).toEqual(HOME_BAR_LAST_FACE);
  });

  it("keeps the bank's widest well before the first face", () => {
    const { well } = HOME_LAYOUT.topBar;
    expect(well.x + well.maxWidth).toBeLessThan(buttons[0]?.[1].face.x ?? 0);
  });
});

describe("top bar", () => {
  const { topBar } = HOME_LAYOUT;
  const { bank, well } = topBar;
  const wellInk = { bottom: well.y + well.height - well.lip - 1 };

  // The bank's well is as clear of the bar's top and bottom as the walk bar's cash well is of its
  // bar's, as tall as its art, and its widest ends before the first face.
  const walkWell = WALK_BAR.cash.well;
  it("sets the bank's well clear of the trim as the walk bar's cash well", () => {
    expect(well.y).toBe(walkWell.y);
    expect(topBar.height - (well.y + well.height)).toBe(
      SCREEN_CONFIG.topBarHeight - (walkWell.y + walkWell.height),
    );
    expect(decodePng(readFileSync(`public/art/images/${topBar.wellKeys.mid}.png`)).height).toBe(
      well.height,
    );
  });

  // The title font's capitals, centred on the well's ink rows, a half pixel at most lower when
  // their parities differ.
  const capHeight = fontFileMetrics("font-title").capHeight;
  it("centres the bank's capitals on the well's ink rows", () => {
    const { capsY: top, scale } = bank;
    const bottom = top + capHeight * scale - 1;
    expect(top).toBeGreaterThan(well.y);
    expect(bottom).toBeLessThan(wellInk.bottom);
    const offCentre = (top + bottom) / 2 - (well.y + wellInk.bottom) / 2;
    expect(offCentre).toBeGreaterThanOrEqual(0);
    expect(offCentre).toBeLessThanOrEqual(0.5);
  });
});

// The bank as the game writes it, in full where it fits and else in its short form, measured on
// the title font at 1x (each amount's fit in the room: ui/textRoles.test.ts).
describe("the top bar's bank", () => {
  const { bank } = HOME_LAYOUT.topBar;
  const width = (text: string) => inkWidth("font-title", { scale: 1 }, text);
  const shown = (dollars: number) => {
    const amount = cents(dollars * 100);
    const texts = { full: dollarAmountText(amount), short: shortDollarAmountText(amount) };
    return `$${bankAmountText(width, texts)}`;
  };
  // From nothing to the most a save can hold.
  const amounts = [
    0, 5, 88, 888, 999, 1_000, 1_234, 12_345, 99_999, 1_000_000, 123_456_789, 999_999_999,
    90_071_992_547_409,
  ].map(shown);

  it.each<[string, number, string]>([
    ["in full where it fits", BANK_ROOM / bank.scale, "full"],
    [
      "in its short form where the full amount is a pixel too wide",
      BANK_ROOM / bank.scale + 1,
      "short",
    ],
  ])("sets the bank %s", (_case, fullWidth, expected) => {
    const measure = (text: string) => (text === "$full" ? fullWidth : 0);
    expect(bankAmountText(measure, { full: "full", short: "short" })).toBe(expected);
  });

  // The well is the ink, pad columns either side and the lip, no wider than its widest.
  const { lip, maxWidth } = HOME_LAYOUT.topBar.well;
  it.each<[number, number]>([
    [0, 2 * bank.pad + lip],
    [1, 1 + 2 * bank.pad + lip],
    [BANK_ROOM - 1, maxWidth - 1],
    [BANK_ROOM, maxWidth],
    [BANK_ROOM + 1, maxWidth],
  ])("sets the well for %ipx of ink %ipx wide", (ink, wellWidth) => {
    const { height, x, y } = HOME_LAYOUT.topBar.well;
    expect(bankWell(ink)).toEqual({ height, width: wellWidth, x, y });
  });

  // Each of the well's pieces, a column each, as the colour of each row, or null where clear.
  const { well: wellSpec, wellKeys } = HOME_LAYOUT.topBar;
  const pieceColours = (key: string) => {
    const png = decodePng(readFileSync(`public/art/images/${key}.png`));
    return Array.from({ length: png.height }, (_, row) => {
      const [r = 0, g = 0, b = 0, a = 0] = png.data.subarray(row * png.width * 4);
      return a === 0 ? null : (r << 16) | (g << 8) | b;
    });
  };
  const colours = {
    left: pieceColours(wellKeys.left),
    mid: pieceColours(wellKeys.mid),
    right: pieceColours(wellKeys.right),
  };
  // The well's ink, the middle piece's colour on its middle row, not its lip's.
  const fill = colours.mid[Math.floor(wellSpec.height / 2)];
  const pieces = {
    left: (row: number) => colours.left[row] === fill,
    mid: (row: number) => colours.mid[row] === fill,
    right: (row: number) => colours.right[row] === fill,
  };
  // The first ink cell of flags from start and the one past its last.
  const inkEdges = (start: number, flags: readonly boolean[]) => ({
    end: start + flags.lastIndexOf(true) + 1,
    start: start + flags.indexOf(true),
  });

  // Each amount's ink as the font inks it, from bank.pad columns into its well and its capitals'
  // top on bank.capsY, as clear of the well's ink edges on the right as on the left, along the
  // well's middle row, and below as above, down its middle column, an odd row left over going
  // above.
  it.each(amounts)(
    "sets %s as clear of its well's ink edges right as left and below as above",
    (text) => {
      const style = { scale: bank.scale };
      const columns = fontInk("font-title", style, text);
      const well = bankWell(columns.right - columns.left);
      const middleRow = Math.floor(well.height / 2);
      const across = inkEdges(well.x, [
        pieces.left(middleRow),
        ...Array.from({ length: well.width - 2 }, () => pieces.mid(middleRow)),
        pieces.right(middleRow),
      ]);
      const down = inkEdges(
        well.y,
        Array.from({ length: well.height }, (_, row) => pieces.mid(row)),
      );
      const left = well.x + bank.pad;
      const rows = fontInkRows("font-title", style, text);
      const clear = {
        above: bank.capsY + rows.top - down.start,
        below: down.end - (bank.capsY + rows.bottom),
        left: left - across.start,
        right: across.end - (left + columns.right - columns.left),
      };
      expect(clear.left).toBeGreaterThan(0);
      expect(clear.right).toBe(clear.left);
      expect(clear.above).toBeGreaterThan(0);
      expect(clear.above - clear.below).toBe((clear.above + clear.below) % 2);
    },
  );
});

// An owned dog's name sits centred on its face, a locked dog's over its price plate, and each
// fits the tile's text column, measured on the body font.
describe("a dog tile's text", () => {
  const body = fontFileMetrics("font-body");
  const ink = inkRowsFromCapTop(body) * 2;
  const { dogTile, dogTileInset, dogTiles } = HOME_LAYOUT;
  const tileHeight = dogTiles.cellHeight - 2 * dogTileInset;

  it("centres an owned dog's capitals on the face's middle row, its ink inside the tile", () => {
    const nameY = dogTileNameY(body);
    expect(nameY + body.capHeight).toBe(dogTile.face.dy + dogTile.face.size / 2);
    expect(nameY + ink).toBeLessThanOrEqual(tileHeight);
  });

  it("keeps a locked dog's name over its plate and the plate inside the tile", () => {
    const plateY = dogTilePlateY(body);
    expect(plateY + ink).toBe(tileHeight - dogTile.plateFoot);
    expect(dogTile.lockedNameY + ink).toBeLessThan(plateY);
  });
});

// A row's lines at 2x as the card wraps them on the body font.
const cardLines = (room: number, text: string) => {
  const width = (line: string) => bodyTextWidth(2, plainMarks(line));
  const lines = wrapWords(width, room, text);
  expect(Math.max(...lines.map(width))).toBeLessThanOrEqual(room);
  return lines.length;
};
const fitsScreen = (height: number) =>
  expect(height).toBeLessThanOrEqual(SCREEN_CONFIG.height - 2 * HOME_LAYOUT.gap);

// Every dog's, gear item's and walker's detail card, owned or not, wraps its rows on the body font
// and stays on screen. A dog's card sets its owner's photo and name between its breed and status,
// inside the card's padding, clear of the title row, the well, each other and every row of text.
describe("a detail card", () => {
  const dogs = keysOf(gameData.dogs);
  const gear = keysOf(gameData.shopGear);
  const walkers = keysOf(gameData.walkers);
  const none: Owned = { dogSlots: [], dogs: [], gear: [], walkers: [] };
  const all: Owned = { dogSlots: gameData.dogSlots.map((_, i) => i + 1), dogs, gear, walkers };
  const loadout = { dogs: [], gear: gear[0] ?? null };
  const cards = [none, all].flatMap((owned) => [
    ...dogs.map((dog) => ["dog", dogDetail(gameData, owned, cents(0), dog)] as const),
    ...gear.map((item) => ["gear", gearDetail(gameData, owned, cents(0), loadout, item)] as const),
    ...walkers.map((walker) => ["walker", walkerDetail(gameData, owned, walker)] as const),
  ]);
  const { besideX, pad, well, width } = HOME_LAYOUT.card;
  // An owner's role's lines at 2x as the card wraps them on the body font, within the name's room.
  const roleLines = (role: string) => {
    const lineWidth = (line: string) => bodyTextWidth(2, plainMarks(line));
    const lines = wrapWords(lineWidth, CARD_TEXT_ROOM.ownerName, role);
    expect(Math.max(...lines.map(lineWidth))).toBeLessThanOrEqual(CARD_TEXT_ROOM.ownerName);
    return lines;
  };
  // The card's rows as the panel lays them out: each row of text's line count, the owner's row
  // on a dog's card.
  const rowsOf = (kind: "dog" | "gear" | "walker", card: DetailCard) => {
    const counts = (parts: readonly DetailPart[], room: number): DetailRow[] =>
      parts.map((part) =>
        "owner" in part
          ? { roleLines: roleLines(part.owner.role).length }
          : cardLines(room, part.text),
      );
    const parts = detailParts(kind, card);
    return {
      below: counts(parts.below, CARD_TEXT_ROOM.full),
      beside: counts(parts.beside, CARD_TEXT_ROOM.beside),
    };
  };

  it.each(cards.map(([kind, card]) => [card.title, kind, card] as const))(
    "holds %s's card",
    (_, kind, card) => {
      fitsScreen(detailCardLayout(BODY, rowsOf(kind, card)).height);
    },
  );

  // Every card's status or price is its last row, under the well at the text margin: the well's
  // left edge.
  it("sets the status at the text margin, the well's left edge", () => {
    expect(pad).toBe(well.x);
  });

  // A dog's or walker's status sits a paragraph's 28 rows under its last line's capitals.
  it.each(
    cards.flatMap(([kind, card]) => (kind === "gear" ? [] : [[card.title, kind, card] as const])),
  )("sets %s's %s card's status 28 rows under its last line", (_, kind, card) => {
    const rows = rowsOf(kind, card);
    const { below } = detailCardLayout(BODY, rows);
    const last = below.length - 1;
    const lines = rows.below[last - 1];
    const lastLineTop = (below[last - 1] ?? 0) + ((lines as number) - 1) * BODY.lineHeight * 2;
    expect((below[last] ?? 0) - lastLineTop).toBe(28);
  });

  // An owned card is as tall as the same item's card for sale.
  it.each([
    ...dogs.map(
      (dog) =>
        [
          dog,
          dogDetail(gameData, all, cents(0), dog),
          dogDetail(gameData, none, cents(0), dog),
          "dog",
        ] as const,
    ),
    ...gear.map(
      (item) =>
        [
          item,
          gearDetail(gameData, all, cents(0), loadout, item),
          gearDetail(gameData, none, cents(0), loadout, item),
          "gear",
        ] as const,
    ),
  ])("makes %s's owned card as tall as its card for sale", (_, ownedCard, saleCard, kind) => {
    const height = (card: DetailCard) => detailCardLayout(BODY, rowsOf(kind, card)).height;
    expect(height(ownedCard)).toBe(height(saleCard));
  });

  // The columns a line inks in the body font at scale.
  const inkRight = (scale: number, line: string) =>
    fontInk("font-body", { scale }, plainMarks(line)).right;
  const dogCards = cards.flatMap(([kind, card]) =>
    kind === "dog" && card.owner !== undefined
      ? [[card.title, card.owner.name, card.owner.role, card] as const]
      : [],
  );

  it.each(dogCards)(
    "sets the photo, name and role of %s's owner, %s, %s, inside the card, clear of its other parts",
    (_title, name, role, card) => {
      const rows = rowsOf("dog", card);
      const layout = detailCardLayout(BODY, rows);
      const ownerIndex = rows.beside.findIndex((row) => typeof row !== "number");
      const lines = roleLines(role);
      const at = { x: besideX, y: layout.beside[ownerIndex] ?? 0 };
      const spot = detailOwner(BODY, at, lines.length);
      const nameRect = {
        height: inkRowsFromCapTop(BODY) * 2,
        width: inkRight(2, name),
        x: spot.name.x,
        y: spot.name.y,
      };
      const roleRects = lines.map((line, i) => ({
        height: inkRowsFromCapTop(BODY) * 2,
        width: inkRight(2, line),
        x: spot.role.x,
        y: spot.role.y + i * spot.role.pitch,
      }));
      const titleRow = cardTitleRow({ height: layout.height, width, x: 0, y: 0 });
      const room = {
        height: layout.height - pad - (titleRow.y + titleRow.height),
        width: width - 2 * pad,
        x: pad,
        y: titleRow.y + titleRow.height,
      };
      // Each row of text's ink, across its room.
      const textRows = (x: number, roomWidth: number, counts: DetailRow[], tops: number[]) =>
        counts.flatMap((row, i) =>
          typeof row === "number"
            ? [{ height: inkRowsOfLines(BODY, row) * 2, width: roomWidth, x, y: tops[i] ?? 0 }]
            : [],
        );
      const others: Rect[] = [
        titleRow,
        { height: well.size, width: well.size, x: well.x, y: layout.wellY },
        ...textRows(besideX, CARD_TEXT_ROOM.beside, rows.beside, layout.beside),
        ...textRows(pad, CARD_TEXT_ROOM.full, rows.below, layout.below),
      ];
      const texts = [nameRect, ...roleRects];
      const parts = [spot.photo, ...texts];
      expect(nameRect.width).toBeLessThanOrEqual(CARD_TEXT_ROOM.ownerName);
      expect(parts.filter((part) => !inside(part, room))).toEqual([]);
      expect(parts.filter((part) => others.some((other) => rectsOverlap(part, other)))).toEqual([]);
      expect(texts.filter((part) => rectsOverlap(part, spot.photo))).toEqual([]);
      expect(texts.flatMap((a, i) => texts.slice(i + 1).filter((b) => rectsOverlap(a, b)))).toEqual(
        [],
      );
    },
  );

  it.each(dogCards)(
    "sets the well's bottom row level with %s's owner's photo's",
    (_title, _name, role, card) => {
      const rows = rowsOf("dog", card);
      const layout = detailCardLayout(BODY, rows);
      const ownerIndex = rows.beside.findIndex((row) => typeof row !== "number");
      const at = { x: besideX, y: layout.beside[ownerIndex] ?? 0 };
      const { photo } = detailOwner(BODY, at, roleLines(role).length);
      expect(layout.wellY + well.size).toBe(photo.y + photo.height);
    },
  );

  it.each(
    cards.flatMap(([kind, card]) =>
      card.owner === undefined ? [[card.title, kind, card] as const] : [],
    ),
  )("sets %s's well at well.y, with no owner to line up with", (_, kind, card) => {
    expect(detailCardLayout(BODY, rowsOf(kind, card)).wellY).toBe(well.y);
  });

  const { face } = HOME_LAYOUT.card.owner;
  it.each(dogs)("has a %s owner face the photo's size", (dog) => {
    const sheet = JSON.parse(
      readFileSync(
        new URL(`../../public/art/sprites/${ownerFaceKey(gameData, dog)}.json`, import.meta.url),
        "utf8",
      ),
    ) as { frames: Record<string, { sourceSize: { h: number; w: number } }> };
    const size = Object.values(sheet.frames)[0]?.sourceSize;
    expect(size).toEqual({ h: face, w: face });
  });

  it("frames the face as the walk's dog card does", () => {
    const spot = detailOwner(BODY, { x: besideX, y: 40 }, 1);
    expect(spot.photo).toEqual(ownerPhotoRect(face, spot.face));
  });

  // The rows a part leaves above and below it inside its row.
  const margins = (row: { height: number; y: number }, top: number, bottom: number) => ({
    above: top - row.y,
    below: row.y + row.height - bottom,
  });
  it.each([1, 2, 3])(
    "centres the photo and the name over a role on %i lines down the row, the taller filling it",
    (lines) => {
      const row = { height: detailOwnerHeight(BODY, lines), y: 40 };
      const spot = detailOwner(BODY, { x: besideX, y: row.y }, lines);
      const textBottom = spot.role.y + inkRowsOfLines(BODY, lines) * 2;
      const parts = [
        margins(row, spot.photo.y, spot.photo.y + spot.photo.height),
        margins(row, spot.name.y, textBottom),
      ];
      expect(
        parts.filter(({ above, below }) => above < 0 || below - above < 0 || below - above > 1),
      ).toEqual([]);
      expect(Math.min(...parts.map(({ above }) => above))).toBe(0);
      expect(spot.role.y).toBeGreaterThan(spot.name.y + inkRowsFromCapTop(BODY) * 2);
    },
  );
});

// Start walk's labels keep inside the button (each fits the room: ui/textRoles.test.ts).
describe("Start walk's loading label", () => {
  it("leaves a margin inside the button", () => {
    expect(HOME_LAYOUT.startLoading.room).toBeLessThan(startButton.width);
  });
});

// The dog slot sign hangs on the Pet shop's front, its board inside its art and its outline
// inside the shop's, clear of the walker and the yard sign, with both its lines on its board
// for every slot's price, pressed or not.
describe("the dog slot sign", () => {
  const { art, board, hit, key, scale } = HOME_LAYOUT.slotSign;
  const { gate, petShop, walkerAtGate, yardSign } = HOME_LAYOUT;
  const outline = insetRect(-AFFORD_OUTSET, board);
  const file = (path: string) => readFileSync(new URL(`../../public/art/${path}`, import.meta.url));
  // A sprite's frame size, from its sheet's data.
  const frameSize = (key: string) => {
    const sheet = JSON.parse(file(`sprites/${key}.json`).toString("utf8")) as {
      frames: Record<string, { sourceSize: { h: number; w: number } }>;
    };
    const { h, w } = Object.values(sheet.frames)[0]?.sourceSize ?? { h: 0, w: 0 };
    return { height: h, width: w };
  };
  // A walker's whole frame, centred over its feet at the gate.
  const walkerBox = (walker: WalkerId): Rect => {
    const { height, width } = frameSize(gameData.walkers[walker].spriteKey);
    return { height, width, x: walkerAtGate.x - width / 2, y: walkerAtGate.footY - height };
  };
  const clear: readonly [string, Rect][] = [
    ["the yard sign", yardSign],
    ...keysOf(gameData.walkers).map((walker): [string, Rect] => [
      `walker ${walker}`,
      walkerBox(walker),
    ]),
  ];

  it.each(clear)("keeps its outline and hit area clear of %s", (_, rect) => {
    expect(rectsOverlap(outline, rect)).toBe(false);
    expect(rectsOverlap(hit, rect)).toBe(false);
  });

  it("draws its board inside its art, in the gate scene", () => {
    expect(inside(board, { ...frameSize(key), ...art })).toBe(true);
    expect(
      inside(outline, { height: gate.height, width: SCREEN_CONFIG.width, x: 0, y: gate.y }),
    ).toBe(true);
  });

  it("keeps its outline inside the Pet shop's and its hit area on the shop", () => {
    expect(inside(outline, insetRect(-AFFORD_OUTSET, petShop))).toBe(true);
    expect(inside(hit, petShop)).toBe(true);
  });

  it("covers the board with a hit area at least 44 a side", () => {
    expect(Math.min(hit.height, hit.width)).toBeGreaterThanOrEqual(44);
    expect(inside(board, hit)).toBe(true);
  });

  // Each price once: slots at one price set the same line.
  const prices = [
    ...new Set(
      gameData.dogSlots.flatMap((slot) =>
        slot.unlock === "shop" ? [dollarText(unlockPrice(gameData.tuning, slot))] : [],
      ),
    ),
  ];
  const { cream, headCapY, priceCapY, x } = slotSignText(BODY);
  const inkRows = inkRowsFromCapTop(BODY) * scale;
  const lines = [
    { capY: headCapY, text: gameData.homeText.slotSign },
    ...prices.map((text) => ({ capY: priceCapY, text })),
  ];

  it("finds its cream inside the board", () => {
    expect(inside(cream, board)).toBe(true);
  });

  it.each(lines)("sets $text on the cream", ({ capY, text }) => {
    const width = inkWidth("font-body", { scale }, text);
    expect(Math.floor(x - width / 2)).toBeGreaterThanOrEqual(cream.x);
    expect(Math.ceil(x + width / 2)).toBeLessThanOrEqual(cream.x + cream.width);
    expect(capY).toBeGreaterThanOrEqual(cream.y);
    expect(capY + inkRows).toBeLessThanOrEqual(cream.y + cream.height);
  });

  it("centres its two lines down the cream, the price under the call's lowest ink", () => {
    const above = headCapY - cream.y;
    const below = cream.y + cream.height - (priceCapY + inkRows);
    expect(below - above).toBeGreaterThanOrEqual(0);
    expect(below - above).toBeLessThanOrEqual(1);
    expect(headCapY + inkRows).toBeLessThan(priceCapY);
  });
});

describe("the update modal", () => {
  const { button, hit, panel } = HOME_LAYOUT.updateModal;
  const TITLE = fontFileMetrics("font-title");
  const { capY } = updateModalText(TITLE);

  it("keeps its card below the live top bar and inside the screen", () => {
    expect(
      inside(panel, { height: SCREEN_CONFIG.height, width: SCREEN_CONFIG.width, x: 0, y: 0 }),
    ).toBe(true);
    expect(panel.y).toBeGreaterThan(HOME_LAYOUT.topBar.height);
  });

  it("centres the button inside the modal, clear of its title and close control", () => {
    expect(inside(button, panel)).toBe(true);
    expect(button.x + button.width / 2).toBe(panel.x + panel.width / 2);
    const close = closeControl(panel).hit;
    expect(rectsOverlap(hit, close)).toBe(false);
    expect(button.y).toBeGreaterThan(cardTitleRow(panel).y + cardTitleRow(panel).height);
  });

  it("covers the standard button with its full tap target", () => {
    expect(hit.height).toBeGreaterThanOrEqual(MIN_TAP_SIZE);
    expect(inside(button, hit)).toBe(true);
  });

  it("keeps the fixed-size button label inside its face", () => {
    expect(capY).toBeGreaterThanOrEqual(button.y);
    expect(capY + TITLE.capHeight * TEXT_SCALE).toBeLessThanOrEqual(button.y + button.height);
  });
});
