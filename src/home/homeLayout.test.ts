import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import type { DogId, GearId, WalkerId } from "../data/types";
import { EFFECT_ICON_SIZE } from "../hud/effectIcons";
import { BADGE_OFFSET } from "../layout/badge";
import { gridRects } from "../layout/grid";
import { insetRect } from "../layout/rect";
import { TEXT_FIT_STYLES } from "../layout/textFit";
import { cents } from "../rules/units";
import type { Owned } from "../save/schema";
import { bodyTextWidth } from "../testing/bodyFont";
import { fitInFont, fontFileMetrics } from "../testing/fontInk";
import { fillNames, wrapWords } from "../text/lines";
import { inkRowsFromCapTop } from "../ui/fontMetrics";
import { plainMarks } from "../ui/pixelFont";
import { dogDetail, gearDetail, walkerDetail } from "./detail";
import { FEEDBACK } from "./feedback";
import { dogFeeText, dogNames, dollarText } from "./home";
import {
  CARD_TEXT_ROOM,
  cardTextRows,
  detailCardLayout,
  DOG_TILE_TEXT_ROOM,
  dogTileFeeY,
  HOME_LAYOUT,
  LOGBOOK_TEXT_FIT,
  logbookTextTops,
  pocketLining,
  sectionFill,
} from "./homeLayout";
import { homeLine } from "./homeText";

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
  it("spaces the bar, the sections, Start walk and the screen's bottom by the same gap", () => {
    const { gateBar, sectionGap } = HOME_LAYOUT;
    const stack = [
      { bottom: gateBar.y + gateBar.height, top: gateBar.y },
      ...[sections.walker, sections.dogs, sections.pocket, startButton].map((rect) => ({
        bottom: rect.y + rect.height,
        top: rect.y,
      })),
      { bottom: SCREEN_CONFIG.height, top: SCREEN_CONFIG.height },
    ];
    const gaps = stack.slice(1).map((item, i) => item.top - (stack[i]?.bottom ?? 0));
    expect(gaps).toEqual(gaps.map(() => sectionGap));
    expect(sectionGap).toBeGreaterThan(0);
  });

  it("puts the tiles directly under each band, at the same offset in every section", () => {
    const { tileOffset } = HOME_LAYOUT;
    const [pocketCell] = gridRects(pocket.cells, 1, pocket.origin);
    const lining = pocketLining(sections.pocket);
    expect(walkerOrigin.y - sections.walker.y).toBe(tileOffset);
    expect(dogOrigin.y - sections.dogs.y).toBe(tileOffset);
    expect(sectionFill(sections.walker).y).toBe(walkerOrigin.y);
    expect(sectionFill(sections.dogs).y).toBe(dogOrigin.y);
    // The Pocket's denim starts at the same offset; its cells sit under the top stitch.
    expect(lining.denim.y - sections.pocket.y).toBe(tileOffset);
    expect(pocketCell?.y).toBe(lining.stitchTop.y + lining.stitchTop.height);
  });

  it.each(Object.entries(sections))(
    "section %s shares the Start walk button's edges",
    (_, rect) => {
      expect({ width: rect.width, x: rect.x }).toEqual({
        width: startButton.width,
        x: startButton.x,
      });
    },
  );

  describe.each(rows)("%s tiles", (_, section, tiles) => {
    const inner = {
      left: section.x + sectionFrame.edge,
      right: section.x + section.width - sectionFrame.edge,
    };
    it("keep the selected badge inside the section's frame", () => {
      expect(Math.min(...tiles.map((tile) => tile.x)) + BADGE_OFFSET.x).toBeGreaterThanOrEqual(
        inner.left,
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

describe("pocket lining", () => {
  const { pocketLining: lining, sections: all } = HOME_LAYOUT;
  const frame = all.pocket;
  const { band, edge } = sectionFrame;
  const inner = {
    bottom: frame.y + frame.height - edge,
    left: frame.x + edge,
    right: frame.x + frame.width - edge,
    top: frame.y + edge + band + 1,
  };

  it("is derived from the Pocket's section", () => {
    expect(lining).toEqual(pocketLining(frame));
  });

  it.each(Object.entries(lining))("%s lies inside the frame, under the band", (_, rect) => {
    expect(rect.x).toBeGreaterThanOrEqual(inner.left);
    expect(rect.x + rect.width).toBeLessThanOrEqual(inner.right);
    expect(rect.y).toBeGreaterThanOrEqual(inner.top);
    expect(rect.y + rect.height).toBeLessThanOrEqual(inner.bottom);
  });

  it.each(Object.entries(lining).filter(([name]) => name !== "denim"))(
    "%s lies within the denim",
    (_, rect) => {
      const { denim } = lining;
      expect(rect.x).toBeGreaterThanOrEqual(denim.x);
      expect(rect.x + rect.width).toBeLessThanOrEqual(denim.x + denim.width);
      expect(rect.y).toBeGreaterThanOrEqual(denim.y);
      expect(rect.y + rect.height).toBeLessThanOrEqual(denim.y + denim.height);
    },
  );

  it("keeps the tiles clear of the stitch", () => {
    const { cells, origin, tileInset } = pocket;
    const tiles = gridRects(cells, cells.columns, origin).map((cell) => insetRect(tileInset, cell));
    const { stitchLeft, stitchRight } = lining;
    for (const tile of tiles) {
      expect(tile.x).toBeGreaterThanOrEqual(stitchLeft.x + stitchLeft.width);
      expect(tile.x + tile.width).toBeLessThanOrEqual(stitchRight.x);
    }
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

describe("top bar", () => {
  const { help, logbook, mute, settings, topBar } = HOME_LAYOUT;
  const { caps, iconSize, mid, textY } = topBar;
  const iconCentre = (icon: { y: number }) => icon.y + iconSize / 2;
  const capsCentre = (y: number) => y + caps / 2;
  const body = fontFileMetrics("font-body");
  const logbookCaps = body.capHeight * 2;
  const logbookLines = logbookTextTops(body, 2);

  it("puts the middle row at the middle of the area above its rule", () => {
    expect(mid).toBe((topBar.height - topBar.rule) / 2);
  });

  it.each([
    ["the coin", iconCentre(topBar.coin)],
    ["the bank text", capsCentre(textY.bank)],
    ["the logbook icon", iconCentre(logbook.icon)],
    ["the logbook's two text lines", (logbookLines.first + logbookLines.second + logbookCaps) / 2],
    ["the logbook's single line", logbookLines.one + logbookCaps / 2],
    ["the help button", iconCentre(help.icon)],
    ["the sound button", iconCentre(mute.icon)],
    ["the settings button", iconCentre(settings.icon)],
  ])("centres %s on the bar's middle row", (_, centre) => {
    expect(centre).toBe(mid);
  });
});

// The Logbook's lines, at the largest best walk and walk count, fit its hit area at 2x in the
// body font, the second line's lowest ink above the bar's rule.
describe("the top bar's Logbook text", () => {
  const body = fontFileMetrics("font-body");
  const { topBar } = HOME_LAYOUT;
  const words = gameData.homeText.topBar;
  const most = dollarText(cents(9_999_900));
  it.each([
    words.noWalks,
    fillNames(words.best, { amount: most }),
    fillNames(words.walkMany, { count: "9999" }),
    fillNames(words.walkOne, { count: "1" }),
  ])("sets %j at 2x", (text) => {
    const { room, styles } = LOGBOOK_TEXT_FIT;
    const fitted = fitInFont("font-body", styles, room, plainMarks(text));
    expect(fitted.widest).toBeLessThanOrEqual(room);
    expect(fitted.style.scale).toBe(2);
  });

  it("keeps the second line's lowest ink above the rule", () => {
    const { second } = logbookTextTops(body, 2);
    expect(second + inkRowsFromCapTop(body) * 2).toBeLessThanOrEqual(topBar.height - topBar.rule);
  });
});

// Each dog's name and the fee line fit a dog tile's text column, measured on the body font.
describe("a dog tile's text", () => {
  const body = fontFileMetrics("font-body");
  const ink = inkRowsFromCapTop(body) * 2;

  it("keeps the name over the fee and the fee inside the tile, in the body font's rows", () => {
    const { dogTile, dogTileInset, dogTiles } = HOME_LAYOUT;
    const feeY = dogTileFeeY(body);
    expect(feeY + ink).toBe(dogTiles.cellHeight - 2 * dogTileInset - dogTile.feeFoot);
    expect(dogTile.nameY + ink).toBeLessThan(feeY);
  });

  const fee = homeLine(gameData.homeText, "zoneFee", { fee: dogFeeText(gameData) });
  it.each([...Object.values(gameData.dogs).map((dog) => dog.name), fee])("sets %j", (text) => {
    const fitted = fitInFont("font-body", TEXT_FIT_STYLES, DOG_TILE_TEXT_ROOM, plainMarks(text));
    expect(fitted.widest).toBeLessThanOrEqual(DOG_TILE_TEXT_ROOM);
  });
});

// An owned walker's name fits its tile's column under the perk icon, measured on the body font.
describe("a walker tile's name", () => {
  const { box, icons, name } = HOME_LAYOUT.walkerTile;
  const style = { letterSpacing: 0, scale: 1 };

  it("centres its room in the column right of the portrait box", () => {
    expect(name.x - name.room / 2).toBeGreaterThanOrEqual(box.dx + box.size);
    expect(name.x + name.room / 2).toBeLessThanOrEqual(walkerTiles.cellWidth - 1);
  });

  it("puts its caps under the perk icon and its ink inside the tile", () => {
    const [perkY = 0] = icons.dy;
    expect(name.capY).toBeGreaterThanOrEqual(perkY + EFFECT_ICON_SIZE);
    const ink = inkRowsFromCapTop(fontFileMetrics("font-body"));
    expect(name.capY + ink).toBeLessThan(walkerTiles.cellHeight);
  });

  it.each(Object.values(gameData.walkers).map((walker) => walker.name))("sets %j", (text) => {
    const fitted = fitInFont("font-body", [style], name.room, plainMarks(text));
    expect(fitted.widest).toBeLessThanOrEqual(name.room);
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

// Every dog's, gear item's and walker's detail card, owned or not and with the largest counts,
// wraps its rows on the body font and stays on screen.
describe("a detail card", () => {
  const dogs = Object.keys(gameData.dogs) as DogId[];
  const gear = Object.keys(gameData.shopGear) as GearId[];
  const walkers = Object.keys(gameData.walkers) as WalkerId[];
  const none: Owned = { dogSlots: 0, dogs: [], gear: [], walkers: [] };
  const all: Owned = { dogSlots: gameData.dogSlots.length, dogs, gear, walkers };
  const most = { timesFired: 9999, walks: 9999, zonesFinished: 9999 };
  const stats = { dogs: Object.fromEntries(dogs.map((dog) => [dog, most])) };
  const loadout = { dogs: [], gear: gear[0] ?? null };
  const cards = [none, all].flatMap((owned) => [
    ...dogs.map((dog) => ["dog", dogDetail(gameData, owned, cents(0), stats, dog)] as const),
    ...gear.map((item) => ["gear", gearDetail(gameData, owned, cents(0), loadout, item)] as const),
    ...walkers.map((walker) => ["walker", walkerDetail(gameData, owned, walker)] as const),
  ]);
  it.each(cards.map(([kind, card]) => [card.title, kind, card] as const))(
    "holds %s's card",
    (_, kind, card) => {
      const gearCard = kind === "gear";
      const beside = gearCard ? [...card.lines, card.status] : [card.subtitle, card.status];
      const below = gearCard ? [] : card.lines;
      const layout = detailCardLayout(BODY, {
        below: below.map((row) => cardLines(CARD_TEXT_ROOM.full, row)),
        beside: beside.map((row) => cardLines(CARD_TEXT_ROOM.beside, row)),
      });
      fitsScreen(layout.height);
    },
  );
});

// The logbook with its longest best walk, totals and last walk stays on screen above its
// buttons.
describe("the logbook", () => {
  const words = gameData.homeText.logbook;
  const longest = (Object.keys(gameData.dogs) as DogId[]).sort(
    (a, b) => gameData.dogs[b].name.length - gameData.dogs[a].name.length,
  );
  const dogs = dogNames(gameData, longest.slice(0, 3));
  const zones = fillNames(words.zoneMany, { count: "4" });
  const longestZone = gameData.world.zones
    .map(({ name }) => name)
    .sort((a, b) => b.length - a.length)[0];
  const owner = Object.values(gameData.dogs)
    .map(({ owner: { name } }) => name)
    .sort((a, b) => b.length - a.length)[0];
  it.each([
    [words.empty, words.emptyNote],
    [
      fillNames(words.best, { best: "$99,999", note: fillNames(words.bestNote, { dogs, zones }) }),
      fillNames(words.totals, { dogs: "9", fired: "9999", walks: "9999" }),
      fillNames(words.last, {
        last: fillNames(words.lastFired, {
          earned: "+$99,999.",
          owner: owner ?? "",
          zone: longestZone ?? "",
        }),
      }),
    ],
  ])("holds %j", (...rows) => {
    const { next } = cardTextRows(
      BODY,
      HOME_LAYOUT.card.well.y + HOME_LAYOUT.card.besideDy,
      rows.map((row) => cardLines(CARD_TEXT_ROOM.full, row)),
    );
    const { height } = HOME_LAYOUT.logbookButton;
    fitsScreen(next + HOME_LAYOUT.card.rowGap + height + HOME_LAYOUT.card.pad);
  });
});
