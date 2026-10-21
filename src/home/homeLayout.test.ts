import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import type { DogId, GearId, WalkerId } from "../data/types";
import { EFFECT_ICON_SIZE } from "../hud/effectIcons";
import { WALK_BAR, WALK_BAR_BUTTONS } from "../hud/walkHud";
import { fillNames, wrapWords } from "../lib/lines";
import { insetRect } from "../lib/rect";
import { cents } from "../rules/units";
import type { Owned } from "../save/schema";
import { bodyTextWidth } from "../testing/bodyFont";
import { fitInFont, fontFileMetrics, inkWidth } from "../testing/fontInk";
import { BADGE_OFFSET } from "../ui/badge";
import { inkRowsFromCapTop } from "../ui/fontMetrics";
import { gridRects } from "../ui/grid";
import { plainMarks } from "../ui/pixelFont";
import { TEXT_FIT_STYLES } from "../ui/textFit";
import { dogDetail, gearDetail, walkerDetail } from "./detail";
import { FEEDBACK } from "./feedback";
import { dogNames, dollarAmountText, shortDollarAmountText } from "./home";
import {
  BANK_ROOM,
  bankFit,
  bankLeft,
  CARD_TEXT_ROOM,
  cardTextRows,
  detailCardLayout,
  DOG_TILE_TEXT_ROOM,
  dogTileNameY,
  dogTilePlateY,
  HOME_LAYOUT,
  pocketLining,
  sectionFill,
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

describe("the Pocket's tiles", () => {
  const { box, cells, icon, origin, tileInset } = pocket;
  const gear = Object.keys(gameData.shopGear).length;
  const tiles = gridRects(cells, gear, origin).map((cell) => insetRect(tileInset, cell));

  it("line up with the walker tiles' columns", () => {
    const walkers = gridRects(walkerTiles, walkerTiles.columns, walkerOrigin);
    const columns = gridRects(cells, cells.columns, origin);
    expect(columns.map((cell) => [cell.x, cell.width])).toEqual(
      walkers.map((cell) => [cell.x, cell.width]),
    );
  });

  it("hold every gear on one row inside the stitch", () => {
    const { stitchBottom } = HOME_LAYOUT.pocketLining;
    expect(gear).toBeLessThanOrEqual(cells.columns);
    for (const tile of tiles) {
      expect(tile.y + tile.height).toBeLessThanOrEqual(stitchBottom.y);
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

describe("top bar", () => {
  const { help, logbook, mute, settings, topBar } = HOME_LAYOUT;
  const { bank, faceSize, mid, well } = topBar;
  const buttons = [
    ["Logbook", logbook],
    ["Help", help],
    ["Sound", mute],
    ["Settings", settings],
  ] as const;
  const hits = buttons.map(([, button]) => button.hit);
  const wellInk = {
    bottom: well.y + well.height - well.lip - 1,
    right: well.x + well.width - well.lip - 1,
  };

  it("puts the middle row at the middle of the area above its rule", () => {
    expect(mid).toBe((topBar.height - topBar.rule) / 2);
  });

  // Each button under the walk bar's button in the same place among its last four.
  const under = buttons.map(([name, button], i) => {
    const walkId = WALK_BAR_BUTTONS[WALK_BAR_BUTTONS.length - buttons.length + i] ?? "pause";
    return [name, walkId, button] as const;
  });
  it.each(under)(
    "puts %s's hit in the walk bar's %s column from the bar's top, its face centred in it on the middle row",
    (_, walkId, button) => {
      const { hitWidth, hitX } = WALK_BAR.buttons[walkId];
      expect(button.hit).toMatchObject({ width: hitWidth, x: hitX, y: 0 });
      expect(button.hit.height).toBeGreaterThanOrEqual(topBar.height);
      expect(2 * (button.face.x - button.hit.x) + faceSize).toBe(button.hit.width);
      expect(button.face.y + faceSize / 2).toBe(mid);
    },
  );

  it("runs the hit areas side by side, none over another, to the screen's right edge", () => {
    const ends = hits.map((hit) => hit.x + hit.width);
    expect(hits.slice(1).map((hit) => hit.x)).toEqual(ends.slice(0, -1));
    expect(ends.at(-1)).toBe(SCREEN_CONFIG.width);
  });

  it("centres the bank's well on the bar's middle row and ends it before the first hit area", () => {
    expect(well.y + well.height / 2).toBe(mid);
    expect(well.x + well.width).toBeLessThan(logbook.hit.x);
  });

  it("sets the bank across the well's ink columns", () => {
    expect(bank.ink).toEqual({ left: well.x, right: wellInk.right });
  });

  // The title font's capitals at each scale, centred on the well's ink rows, a half pixel at most
  // lower when their parities differ.
  const capHeight = fontFileMetrics("font-title").capHeight;
  it.each(bank.scales.map((scale) => [scale] as const))(
    "centres the bank's capitals at %ix on the well's ink rows",
    (scale) => {
      const top = bank.capsY[scale];
      const bottom = top + capHeight * scale - 1;
      expect(top).toBeGreaterThan(well.y);
      expect(bottom).toBeLessThan(wellInk.bottom);
      const offCentre = (top + bottom) / 2 - (well.y + wellInk.bottom) / 2;
      expect(offCentre).toBeGreaterThanOrEqual(0);
      expect(offCentre).toBeLessThanOrEqual(0.5);
    },
  );
});

// The bank as the game writes it, measured on the title font at 1x.
describe("the top bar's bank", () => {
  const { bank } = HOME_LAYOUT.topBar;
  const smallest = bank.scales.at(-1);
  const width = (text: string) => inkWidth("font-title", { letterSpacing: 0, scale: 1 }, text);
  const texts = (dollars: number) => {
    const amount = cents(dollars * 100);
    return [`$${dollarAmountText(amount)}`, `$${shortDollarAmountText(amount)}`];
  };
  // From nothing to the most a save can hold; every scale and both forms are covered.
  const amounts = [
    0, 5, 88, 888, 1_234, 12_345, 99_999, 1_000_000, 123_456_789, 90_071_992_547_409,
  ];

  it("covers every scale and both forms with the amounts", () => {
    const fits = amounts.map((dollars) => bankFit(width, texts(dollars)));
    const taken = new Set(fits.map((fit) => fit.scale));
    expect([...taken].sort()).toEqual([...bank.scales].sort());
    const forms = new Set(amounts.map((dollars, i) => texts(dollars).indexOf(fits[i]?.text ?? "")));
    expect([...forms].sort()).toEqual([0, 1]);
  });

  it.each(amounts)(
    "sets $%i in full whenever it fits, at the largest scale whose ink fits the bank's room",
    (dollars) => {
      const [full = "", short = ""] = texts(dollars);
      const { scale, text } = bankFit(width, texts(dollars));
      const fullFits = bank.scales.some((each) => width(full) * each <= BANK_ROOM);
      expect(text).toBe(fullFits ? full : short);
      expect(scale).toBe(bank.scales.find((each) => width(text) * each <= BANK_ROOM));
      expect(width(text) * scale).toBeLessThanOrEqual(BANK_ROOM);
    },
  );

  it.each(amounts)("centres $%i across the bank's ink columns at the scale it takes", (dollars) => {
    const { scale, text } = bankFit(width, texts(dollars));
    const ink = width(text) * scale;
    const left = bankLeft(ink);
    const right = left + ink - 1;
    expect(left).toBeGreaterThanOrEqual(bank.ink.left);
    expect(right).toBeLessThanOrEqual(bank.ink.right);
    // Centred, a half pixel at most to the left when the widths' parities differ.
    const offCentre = (bank.ink.left + bank.ink.right) / 2 - (left + right) / 2;
    expect(offCentre).toBeGreaterThanOrEqual(0);
    expect(offCentre).toBeLessThanOrEqual(0.5);
  });

  // A full amount too wide at every scale gives way to its short form, at the largest scale
  // that fits it, or the smallest past every one.
  it.each([
    ["the short form at the largest scale", 10, { scale: bank.scales[0], text: "short" }],
    ["the short form at the smallest scale", BANK_ROOM + 1, { scale: smallest, text: "short" }],
  ])("sets an amount too wide at every scale in %s", (_, shortWidth, expected) => {
    const measure = (text: string) => (text === "full" ? BANK_ROOM + 1 : shortWidth);
    expect(bankFit(measure, ["full", "short"])).toEqual(expected);
  });
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

  it.each(Object.values(gameData.dogs).map((dog) => dog.name))("sets %j", (text) => {
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

// Every dog's, gear item's and walker's detail card, owned or not, with the largest counts, wraps
// its rows on the body font and stays on screen.
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

// Start walk's loading label fits the pressed face's room on one line in the title font, at
// the largest of its sizes that does.
describe("Start walk's loading label", () => {
  const { room, styles } = HOME_LAYOUT.startLoading;

  it("leaves a margin inside the button", () => {
    expect(room).toBeLessThan(startButton.width);
  });

  it("sets its text", () => {
    const fitted = fitInFont(
      "font-title",
      styles,
      room,
      plainMarks(gameData.homeText.startLoading),
    );
    expect(fitted.lines).toHaveLength(1);
    expect(fitted.widest).toBeLessThanOrEqual(room);
  });
});
