import { gameData } from "../data";
import { SCREEN_LAYOUT } from "../data/screen";
import { BADGE_NAME_STYLE, BADGE_STRIP, badgeStrip } from "../home/badgesView";
import {
  breakdownLabelRoom,
  END_LAYOUT,
  QUIP_LINES,
  QUIP_TEXT_ROOM,
  SIDE_LABEL_ROOM,
  sideTotalLabelRoom,
} from "../home/endLayout";
import {
  dollarAmountText,
  dollarText,
  shortDollarAmountText,
  signedShortDollarText,
} from "../home/home";
import {
  BANK_ROOM,
  bankAmountText,
  DOG_TILE_TEXT_ROOM,
  HOME_LAYOUT,
  UPDATE_PLATE_ROOM,
} from "../home/homeLayout";
import { messageLine } from "../home/homeLines";
import { MENU_TEXT_FIELDS } from "../home/menuText";
import { confirmLines } from "../home/purchaseConfirm";
import { PURCHASE_CONFIRM_LAYOUT } from "../home/purchaseConfirmLayout";
import { INSTALL_STEPS_FIT, noteRoom, SETTINGS_NOTE_STYLE } from "../home/settings";
import { dogRows, gearRows, type ShopRow, slotRows } from "../home/shop";
import { SHOP_LAYOUT, SHOP_MESSAGE_FIT, shopRowTextRoom } from "../home/shopLayout";
import { largeBodyText, smallCardText } from "../hud/cardText";
import { CELEBRATION_LAYOUT, GREETING_FIT } from "../hud/celebrationLayout";
import { faceTextWithNamePills } from "../hud/effectNames";
import { type FaceText, inlineFaceBox, styledFaceRows } from "../hud/faceText";
import { CHANGE_LABEL_STYLE, changeLabelRoom, hudLanes } from "../hud/hudLanes";
import { messageStripLayout, ownerLeadLayout, stripLeadSlot } from "../hud/messageStrip";
import { FIRED_LINE_FIT, LOW_CHIP_FIT, lowHeartsText } from "../hud/moments";
import { MONEY_LABEL } from "../hud/moneyLabels";
import { DOG_CARD, WALK_BAR } from "../hud/walkHud";
import {
  boxStyle,
  CARD_LAYOUT,
  FIRES_FIT,
  largeBodyBox,
  largeBodyStyle,
} from "../layout/cardLayout";
import { fillLine, fillNames } from "../lib/lines";
import { keysOf } from "../lib/records";
import { cents } from "../lib/units";
import { amountText } from "../rules/causes";
import { firesText } from "../rules/choices";
import { startingDogSlots } from "../rules/shop";
import type { Owned } from "../save/schema";
import { readBitmapFont } from "../tools/fontFile";
import { plainMarks } from "../ui/pixelFont";
import { TEXT_SCALE, TEXT_STYLE, type TextFitStyle, textOnLines } from "../ui/textFit";
import { bodyRunWidth } from "./bodyFont";
import { defined } from "./defined";
import { everyCardOption } from "./everyCardOption";
import { everyStripLine } from "./everyStripLine";
import { fitInFont, fontFileMetrics, inkWidth } from "./fontInk";
import { newPlayerSave } from "./saves";
import { TEST_TUNING } from "./tuning";

// Every string the data puts in each text role, set at the role's one size as the game sets it,
// filled with the widest names and the largest amounts its template takes. overflow says how it
// misses its room, or is "" where it fits.
export interface TextRoleCase {
  readonly overflow: string;
  readonly role: string;
  readonly text: string;
}

const BODY = fontFileMetrics("font-body");
const TITLE = fontFileMetrics("font-title");
const FACE_BOX = inlineFaceBox(BODY, TEXT_SCALE);

type Font = "font-body" | "font-display" | "font-title";

// How text set on lines lines with its widest line widest misses most lines no wider than room.
function overflowOf(most: number, room: number, lines: number, widest: number): string {
  return [
    lines > most ? `${lines} lines of ${most}` : "",
    widest > room ? `${widest}px wide in ${room}px` : "",
  ]
    .filter((part) => part !== "")
    .join(", ");
}

// Text as a font draws it: the title and display fonts in capitals, marks made plain.
const shownIn = (font: Font, text: string) =>
  font === "font-body" ? plainMarks(text) : plainMarks(text).toUpperCase();

// A role whose text is set in one font and style within room.
function plainRole(
  role: string,
  font: Font,
  fit: { room: number; style: TextFitStyle },
  texts: readonly string[],
): TextRoleCase[] {
  return [...new Set(texts)].map((text) => {
    const set = fitInFont(font, fit.style, fit.room, shownIn(font, text));
    const overflow = overflowOf(fit.style.lines ?? 1, fit.room, set.lines.length, set.widest);
    return { overflow, role, text };
  });
}

// A walk line with owners' faces inline, its effects' names in their pills, at 2x on up to lines
// rows within room, as the strip and the chips set it.
function faceOverflow(lines: number, room: number, line: FaceText): string {
  const pilled = faceTextWithNamePills(gameData, line);
  const said = { ...pilled, text: plainMarks(pilled.text) };
  const rows = styledFaceRows(textOnLines(lines), bodyRunWidth, FACE_BOX, room, said);
  return overflowOf(lines, room, rows.length, Math.max(0, ...rows.map((row) => row.width)));
}

function faceRole(
  role: string,
  lines: number,
  room: number,
  texts: readonly FaceText[],
): TextRoleCase[] {
  const unique = new Map(texts.map((line) => [line.text, line]));
  return [...unique.values()].map((line) => ({
    overflow: faceOverflow(lines, room, line),
    role,
    text: line.text,
  }));
}

// Each owner's walk quips beside their face and name leading the strip, on its rows: the strip
// keeps its room under the debuff bars.
function ownerQuipRoles(): TextRoleCase[] {
  return keysOf(gameData.dogs).flatMap((dog) => {
    const { name } = gameData.dogs[dog].owner;
    const ink = inkWidth("font-body", { scale: 1 }, name);
    const quips = [...gameData.quips[dog].happier, ...gameData.quips[dog].upset].map((text) => ({
      text,
    }));
    const room = ownerLeadLayout(BODY, stripLeadSlot(BODY), ink).room;
    return faceRole("owner's quip on the strip", 2, room, quips).map((one) => ({
      ...one,
      text: `${name}: ${one.text}`,
    }));
  });
}

// A change label says its amount alone: a heart change's, and a money change's.
function changeLabelRoles(): TextRoleCase[] {
  const lane = defined(hudLanes(SCREEN_LAYOUT).heartLabels[0]);
  const hearts = { room: changeLabelRoom(lane.width), style: CHANGE_LABEL_STYLE };
  const money = { room: MONEY_LABEL.room, style: TEXT_STYLE };
  return [
    ...plainRole(
      "heart change",
      "font-body",
      hearts,
      [-10, -1, 1, 10].map((amount) => amountText("hearts", amount)),
    ),
    ...plainRole(
      "money change",
      "font-body",
      money,
      [99_900, -99_900].map((amount) => amountText("money", amount)),
    ),
  ];
}

// Each card the data can deal: its small effect in the box its paws and warning leave it, its
// firing warning, and the enlarged card's warning and changes.
function cardRoles(): TextRoleCase[] {
  const { effect: area, large } = CARD_LAYOUT;
  const bodyWidth = (style: TextFitStyle, line: string) =>
    inkWidth("font-body", style, plainMarks(line));
  const forgiven = keysOf(gameData.dogs).map((dog) =>
    fillNames(gameData.runText.card.heartForgiven, { dog: gameData.dogs[dog].name, hearts: "1" }),
  );
  return [
    ...everyCardOption().flatMap(([name, option]) => {
      const { effect } = smallCardText(gameData, BODY, bodyWidth, option);
      const widest = Math.max(0, ...effect.lines.map((line) => bodyWidth(effect.style, line)));
      const most = effect.style.lines ?? 1;
      const small = {
        overflow: overflowOf(most, area.width, effect.lines.length, widest),
        role: "card effect",
        text: name,
      };
      const fires = option === undefined || option.fires.length === 0 ? null : option.fires;
      const warning = fires === null ? null : firesText(gameData, fires);
      const shownWarning = warning === null ? null : shownIn("font-title", warning);
      const warningLines =
        shownWarning === null
          ? 0
          : fitInFont("font-title", FIRES_FIT.large.style, FIRES_FIT.large.room, shownWarning).lines
              .length;
      const box = largeBodyBox(TITLE, warningLines);
      const style = largeBodyStyle(BODY, box.height, SCREEN_LAYOUT.walkView);
      const changes = { room: large.body.width, style };
      const enlarged = plainRole("enlarged card's changes", "font-body", changes, [
        largeBodyText(gameData, option),
      ]).map((one) => ({ ...one, text: name }));
      return [
        small,
        ...enlarged,
        ...(warning === null
          ? []
          : [
              ...plainRole("card's firing warning", "font-body", FIRES_FIT.small, [warning]),
              ...plainRole("enlarged card's firing warning", "font-title", FIRES_FIT.large, [
                warning,
              ]),
            ]),
      ];
    }),
    ...plainRole(
      "card effect",
      "font-body",
      { room: area.width, style: boxStyle(BODY, area.height) },
      forgiven,
    ),
  ];
}

// The end screen's labels beside the widest amount in its short form, its owners' fired headers
// and their closing lines.
function endRoles(): TextRoleCase[] {
  const words = gameData.menuText.end;
  const amountWidth = (amount: number) =>
    inkWidth("font-body", TEXT_STYLE, plainMarks(signedShortDollarText(amount)));
  const widest = Math.max(
    ...[999, 9_999, 99_999, 999_999].flatMap((dollars) => [
      amountWidth(dollars * 100),
      amountWidth(-dollars * 100),
    ]),
  );
  const owners = Object.values(gameData.dogs).map(({ owner }) => owner.name);
  const quips = Object.values(gameData.quips).flatMap((moments) => Object.values(moments).flat());
  return [
    ...plainRole(
      "end screen's breakdown label",
      "font-body",
      { room: breakdownLabelRoom(widest), style: TEXT_STYLE },
      Object.values(words.earnings),
    ),
    ...plainRole(
      "end screen's TOTAL",
      "font-title",
      { room: sideTotalLabelRoom(widest), style: TEXT_STYLE },
      [words.total],
    ),
    ...plainRole(
      "end screen's side label",
      "font-body",
      { room: SIDE_LABEL_ROOM, style: TEXT_STYLE },
      [words.zonesWalked],
    ),
    ...plainRole(
      "end screen's fired header",
      "font-title",
      { room: QUIP_TEXT_ROOM, style: TEXT_STYLE },
      owners.map((owner) => fillLine(MENU_TEXT_FIELDS.end, words, "firedYou", { owner })),
    ),
    ...plainRole(
      "owner's closing line",
      "font-body",
      { room: QUIP_TEXT_ROOM, style: textOnLines(QUIP_LINES) },
      quips,
    ),
  ];
}

// The shop's rows, with nothing bought and with everything owned, beside their price or OWNED in
// a row beside a scrollbar; its messages; and the purchase confirm's lines.
function shopRoles(): TextRoleCase[] {
  const data = { ...gameData, tuning: TEST_TUNING };
  // A label's width as Phaser gives it: its glyphs' advances at 2x.
  const advances = (font: Font, text: string) => {
    const { glyphs } = readBitmapFont(font);
    return 2 * [...text].reduce((sum, char) => sum + (glyphs.get(char)?.advance ?? 0), 0);
  };
  const rightWidth = (row: ShopRow) =>
    row.price === null
      ? SHOP_LAYOUT.row.ownedDx + advances("font-title", gameData.homeText.shop.owned.toUpperCase())
      : advances("font-body", dollarText(row.price)) + 6;
  const starting: Owned = {
    dogSlots: startingDogSlots(data),
    dogs: keysOf(data.dogs).filter((dog) => data.dogs[dog].unlock === "start"),
    gear: [],
    walkers: [],
  };
  const everything: Owned = {
    dogSlots: data.dogSlots.map((_, i) => i + 1),
    dogs: keysOf(data.dogs),
    gear: keysOf(data.shopGear),
    walkers: [],
  };
  const rowsOf = (have: Owned) => [
    ...gearRows(data, have),
    ...slotRows(data, have),
    ...dogRows(data, have),
  ];
  const rows = [starting, everything].flatMap(rowsOf);
  const rowRole = (role: string, text: (row: ShopRow) => string) =>
    rows
      .filter((row) => text(row) !== "")
      .flatMap((row) =>
        plainRole(
          role,
          "font-body",
          {
            room: shopRowTextRoom(SHOP_LAYOUT.row.scrollWidth, rightWidth(row)),
            style: TEXT_STYLE,
          },
          [text(row)],
        ),
      );
  const forSale = rowsOf({ ...newPlayerSave.owned, dogs: [], gear: [] }).flatMap(
    ({ name, price, purchase }) => (price === null ? [] : [{ name, price, purchase }]),
  );
  const messages = rowsOf(starting).flatMap((row) => [
    ...(row.price === null
      ? []
      : [messageLine(data.homeText, { amount: row.price, kind: "cantAfford", name: row.name })]),
    messageLine(data.homeText, { kind: "bought", name: row.name, purchase: row.purchase }),
  ]);
  const bankAfter = cents(forSale.reduce((sum, row) => sum + row.price, 0));
  const confirm = forSale.map((row) => confirmLines(data, { bankAfter, ...row }));
  const { left, price, title } = PURCHASE_CONFIRM_LAYOUT;
  return [
    ...rowRole("shop row's name", (row) => row.name),
    ...rowRole("shop row's line", (row) => row.line),
    ...plainRole(
      "shop message",
      "font-body",
      SHOP_MESSAGE_FIT,
      messages.flatMap((text) => (text === null ? [] : [text])),
    ),
    ...plainRole(
      "purchase confirm's title",
      "font-title",
      { room: title.room, style: TEXT_STYLE },
      confirm.map((lines) => lines.title),
    ),
    ...plainRole(
      "purchase confirm's price",
      "font-title",
      { room: price.room, style: TEXT_STYLE },
      confirm.map((lines) => lines.price),
    ),
    ...plainRole(
      "purchase confirm's bank after",
      "font-body",
      { room: left.room, style: TEXT_STYLE },
      confirm.map((lines) => lines.left),
    ),
  ];
}

// The cash on the walk bar, which stays under $1,000; and the bank on the home screen's top
// bar, every amount from nothing to the most a save holds, in full where it fits and else in
// its short form.
function cashRole(): TextRoleCase[] {
  const cash = [0, 111, 888, 999].map((dollars) => `$${dollarAmountText(cents(dollars * 100))}`);
  const width = (text: string) => inkWidth("font-title", { scale: 1 }, text);
  const bank = [
    0, 5, 88, 888, 999, 1_000, 1_234, 12_345, 99_999, 123_456, 1_000_000, 123_456_789,
    90_071_992_547_409,
  ].map((dollars) => {
    const amount = cents(dollars * 100);
    const texts = { full: dollarAmountText(amount), short: shortDollarAmountText(amount) };
    return `$${bankAmountText(width, texts)}`;
  });
  const { room, scale } = WALK_BAR.cash;
  return [
    ...plainRole("walk bar's cash", "font-title", { room, style: { scale } }, cash),
    ...plainRole(
      "home screen's bank",
      "font-title",
      { room: BANK_ROOM, style: { scale: HOME_LAYOUT.topBar.bank.scale } },
      bank,
    ),
  ];
}

// Every text role, each string the data puts in it.
export function textRoleCases(): TextRoleCase[] {
  const strip = everyStripLine();
  const dogNames = Object.values(gameData.dogs).map(({ name }) => name);
  const badgeLayout = {
    maxNamed: BADGE_STRIP.maxNamed,
    width: END_LAYOUT.badges.width - 8,
    x: END_LAYOUT.badges.x + 4,
  };
  const badgeSlot = defined(badgeStrip(badgeLayout, BADGE_STRIP.maxNamed).slots[0]).width;
  const { newWalker, zoneDone } = gameData.runText;
  const { settings } = gameData.menuText;
  return [
    ...faceRole("strip", 2, messageStripLayout(BODY).room, strip),
    ...ownerQuipRoles(),
    ...faceRole(
      "low-hearts chip",
      1,
      LOW_CHIP_FIT.room,
      keysOf(gameData.dogs).map((dog) => lowHeartsText(gameData, dog)),
    ),
    ...plainRole(
      "fired line",
      "font-body",
      FIRED_LINE_FIT,
      Object.values(gameData.quips).flatMap(({ fired }) => fired),
    ),
    ...changeLabelRoles(),
    ...cashRole(),
    ...plainRole(
      "walk card's dog name",
      "font-title",
      { room: DOG_CARD.name.room, style: { scale: DOG_CARD.name.scale } },
      dogNames,
    ),
    ...cardRoles(),
    ...plainRole(
      "celebration title",
      "font-display",
      { room: CELEBRATION_LAYOUT.titleRoom, style: { scale: CELEBRATION_LAYOUT.titleScale } },
      [newWalker.title, zoneDone.title],
    ),
    ...plainRole(
      "walker's greeting",
      "font-body",
      GREETING_FIT,
      Object.values(gameData.walkers).map(({ greeting }) => greeting),
    ),
    ...plainRole(
      "badge name",
      "font-body",
      { room: badgeSlot - 4, style: BADGE_NAME_STYLE },
      gameData.achievements.map(({ name }) => name),
    ),
    ...plainRole(
      "start screen's dog name",
      "font-body",
      { room: DOG_TILE_TEXT_ROOM, style: TEXT_STYLE },
      dogNames,
    ),
    ...plainRole(
      "Start walk's label",
      "font-title",
      { room: HOME_LAYOUT.startLoading.room, style: { scale: HOME_LAYOUT.startLabel.scale } },
      [gameData.homeText.startWalk, gameData.homeText.startLoading],
    ),
    ...plainRole(
      "update plate's title",
      "font-title",
      { room: UPDATE_PLATE_ROOM.title, style: TEXT_STYLE },
      [gameData.homeText.update.title],
    ),
    ...plainRole(
      "update plate's button",
      "font-title",
      { room: UPDATE_PLATE_ROOM.label, style: TEXT_STYLE },
      [gameData.homeText.update.button],
    ),
    ...endRoles(),
    ...shopRoles(),
    ...plainRole(
      "settings switch note",
      "font-body",
      { room: noteRoom("switch"), style: SETTINGS_NOTE_STYLE },
      [settings.motionNote, settings.soundNote],
    ),
    ...plainRole(
      "settings button note",
      "font-body",
      { room: noteRoom("button"), style: SETTINGS_NOTE_STYLE },
      [settings.installNote],
    ),
    ...plainRole(
      "install steps",
      "font-body",
      INSTALL_STEPS_FIT,
      Object.values(settings.installSteps).map(({ steps }) => steps),
    ),
  ];
}
