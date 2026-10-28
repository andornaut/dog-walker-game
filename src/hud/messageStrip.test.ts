import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { SCREEN_LAYOUT } from "../data/screen";
import type { QuipMoment } from "../data/types";
import { fillNames } from "../lib/lines";
import { keysOf } from "../lib/records";
import { type Rect } from "../lib/rect";
import { bodyRunWidth } from "../testing/bodyFont";
import { defined } from "../testing/defined";
import { fontFileMetrics, inkWidth } from "../testing/fontInk";
import { inside } from "../testing/rects";
import { inkRowsFromCapTop } from "../ui/fontMetrics";
import { plainMarks } from "../ui/pixelFont";
import { TEXT_FIT_STYLES, type TextFitStyle } from "../ui/textFit";
import { effectLine } from "./effectIcons";
import { faceTextWithNamePills } from "./effectNames";
import {
  type FaceRow,
  type FaceText,
  fillFaceText,
  fittingFaceRows,
  inlineFaceBox,
  ownerFaceText,
} from "./faceText";
import {
  EMPTY_MESSAGE_STRIP,
  type LeadSlot,
  lineAlpha,
  lineLeadSlot,
  linePlace,
  MESSAGE_ICONS,
  MESSAGE_LINE,
  MESSAGE_STRIP,
  MESSAGE_TIMING,
  type MessageIcon,
  messageIconKey,
  type MessageLine,
  messageLinePanel,
  messagePanel,
  messageRows,
  messageStripLayout,
  type MessageStripState,
  OWNER_LEAD,
  ownerLeadLayout,
  ownerLeadPanel,
  sayLine,
  sayLineAhead,
  stepMessageStrip,
  stripLeadSlot,
} from "./messageStrip";
import { STRIP_LINE_FIELDS } from "./runText";
import { debuffLines } from "./stripLines";
import { debuffBarRects } from "./walkHud";

const { dwellMs, fadeMs, lifeMs, maxWaiting } = MESSAGE_TIMING;
const line = (text: string, icon: MessageIcon = "hint"): MessageLine => ({ icon, text });

// A strip after saying each text and stepping dtMs after each.
function after(steps: readonly (readonly [string | null, number])[]): MessageStripState {
  return steps.reduce<MessageStripState>((state, [text, dtMs]) => {
    const said = text === null ? state : sayLine(MESSAGE_TIMING, line(text), state);
    return stepMessageStrip(MESSAGE_TIMING, dtMs, said);
  }, EMPTY_MESSAGE_STRIP);
}
const waitingTexts = (state: MessageStripState) => state.waiting.map(({ text }) => text);

const BODY = fontFileMetrics("font-body");

describe("sayLine", () => {
  it("waits a new line and drops a repeat of the shown or a waiting line", () => {
    const showing = after([["a", 0]]);
    const waitingB = sayLine(MESSAGE_TIMING, line("b"), showing);
    expect(waitingTexts(waitingB)).toEqual(["b"]);
    expect(waitingTexts(sayLine(MESSAGE_TIMING, line("a"), showing))).toEqual([]);
    expect(waitingTexts(sayLine(MESSAGE_TIMING, line("b"), waitingB))).toEqual(["b"]);
  });

  it("keeps the newest waiting lines, dropping the oldest", () => {
    const said = Array.from({ length: maxWaiting + 2 }, (_, i) => String(i));
    const state = said.reduce(
      (strip, text) => sayLine(MESSAGE_TIMING, line(text), strip),
      EMPTY_MESSAGE_STRIP,
    );
    expect(waitingTexts(state)).toEqual(said.slice(-maxWaiting));
  });
});

describe("sayLineAhead", () => {
  it("jumps the waiting lines with its icon, stays behind others, and drops the oldest past the most", () => {
    const ahead = (waiting: readonly MessageLine[]) =>
      waitingTexts(
        sayLineAhead(
          MESSAGE_TIMING,
          line("x"),
          waiting.reduce((strip, said) => sayLine(MESSAGE_TIMING, said, strip), after([["s", 0]])),
        ),
      );
    expect(ahead([line("a"), line("b", "bump"), line("c")])).toEqual(["x", "a", "b", "c"]);
    expect(ahead([line("b", "bump"), line("a")])).toEqual(["b", "x", "a"]);
    expect(ahead([line("a"), line("x")])).toEqual(["a", "x"]);
    expect(ahead(Array.from({ length: maxWaiting }, (_, i) => line(String(i))))).toEqual([
      "x",
      ...Array.from({ length: maxWaiting - 1 }, (_, i) => String(i + 1)),
    ]);
  });
});

describe("stepMessageStrip", () => {
  it("shows a line at once, holds the next until it has dwelt, and drops it at the end of its life", () => {
    const shown = (steps: readonly (readonly [string | null, number])[]) =>
      after(steps).shown?.text;
    expect(shown([["a", 0]])).toBe("a");
    expect(
      shown([
        ["a", 0],
        ["b", dwellMs - 1],
      ]),
    ).toBe("a");
    expect(
      shown([
        ["a", 0],
        [null, dwellMs],
        ["b", 0],
      ]),
    ).toBe("b");
    expect(
      shown([
        ["a", 0],
        [null, lifeMs - 1],
      ]),
    ).toBe("a");
    expect(
      shown([
        ["a", 0],
        [null, lifeMs],
      ]),
    ).toBeUndefined();
  });

  it("tells two lines with the same text apart", () => {
    const first = after([["a", 0]]);
    const again = after([
      ["a", 0],
      [null, dwellMs],
      ["b", 0],
      [null, dwellMs],
      ["a", 0],
    ]);
    expect(again.shown?.text).toBe("a");
    expect(again.shown?.id).not.toBe(first.shown?.id);
  });
});

describe("lineAlpha", () => {
  it("fades a line out over the end of its life", () => {
    const alpha = (ageMs: number) => lineAlpha(MESSAGE_TIMING, { ...line("a"), ageMs, id: 0 });
    expect(alpha(0)).toBe(1);
    expect(alpha(lifeMs - fadeMs / 2)).toBeCloseTo(0.5);
    expect(alpha(lifeMs)).toBeCloseTo(0);
  });
});

// An image's size, from its PNG header.
function pngSize(key: string): { height: number; width: number } {
  const png = readFileSync(new URL(`../../public/art/images/${key}.png`, import.meta.url));
  return { height: png.readUInt32BE(20), width: png.readUInt32BE(16) };
}

describe("messageIconKey", () => {
  it("leads every kind of line with a 16x16 icon", () => {
    const wrong = keysOf(MESSAGE_ICONS).filter((icon) => {
      const { height, width } = pngSize(messageIconKey(icon));
      return height !== 16 || width !== 16;
    });
    expect(wrong).toEqual([]);
  });
});

describe("messageStripLayout", () => {
  it("keeps the strip in the backdrop band under the walk bar, with its icon and rows inside", () => {
    const strip = messageStripLayout(BODY);
    const { backdrop, topBar } = SCREEN_LAYOUT;
    const rowRect = (top: number): Rect => ({
      height: inkRowsFromCapTop(BODY) * MESSAGE_STRIP.scale,
      width: strip.room,
      x: strip.textX,
      y: top,
    });
    expect(inside(strip.panel, backdrop)).toBe(true);
    expect(strip.panel.y).toBeGreaterThan(topBar.y + topBar.height);
    expect(inside({ ...strip.icon, height: 16, width: 16 }, messagePanel(BODY, 1))).toBe(true);
    strip.rowTops.forEach((top, row) => {
      expect(inside(rowRect(top), messagePanel(BODY, row + 1)), `row ${row + 1}`).toBe(true);
    });
  });
});

// With debuff bars up, the strip's one row sits under the last bar, in the band, with a face
// or without.
describe("messageLinePanel", () => {
  it.each([1, 2].flatMap((bars) => [false, true].map((faced) => [bars, faced] as const)))(
    "puts the one-row strip under %i debuff bars, in the band (faced: %s)",
    (bars, faced) => {
      const { backdrop, topBar } = SCREEN_LAYOUT;
      const one = messageLinePanel(BODY, bars, faced);
      const last = debuffBarRects(topBar, bars).at(-1);
      expect(one.panel.y).toBeGreaterThanOrEqual((last?.y ?? 0) + (last?.height ?? 0));
      expect(inside(one.panel, backdrop)).toBe(true);
      expect(inside({ ...one.icon, height: 16, width: 16 }, one.panel)).toBe(true);
      expect(one.textX + one.room).toBeLessThanOrEqual(one.panel.x + one.panel.width);
    },
  );
});

// Every line the strip can say: each hint and badge, and each of the walk's lines for every dog,
// owner and obstacle as each neighbourhood names it, with two-digit counts and the largest
// amounts.
function everyStripLine(): (FaceText & Pick<MessageLine, "names">)[] {
  const { strip } = gameData.runText;
  const line = (key: keyof typeof STRIP_LINE_FIELDS, fields: Record<string, FaceText | string>) =>
    fillFaceText(strip[key], fields);
  const dogs = keysOf(gameData.dogs).map((id) => ({
    dog: gameData.dogs[id].name,
    owner: ownerFaceText(gameData, "neutral", id),
  }));
  const obstacles = [
    ...new Set(Object.values(gameData.minorObstacles).map(({ name }) => name.toLowerCase())),
  ];
  const amount = "$9,999";
  return [
    ...Object.values(gameData.hints).map(({ text }) => ({ text })),
    ...gameData.achievements.map(({ name }) => line("achievement", { name })),
    // Each debuff's start line at the largest amounts, its lead in its pill as debuffLines marks it.
    ...keysOf(gameData.debuffs).map((debuff) => {
      const started = [{ debuff, secondsLeft: 99, untilZone: 0 }];
      const [said] = debuffLines(gameData, { ended: [], started });
      const fields = { cash: amount, seconds: "99", slower: "100%" };
      return { names: said?.names ?? [], text: fillNames(strip.debuffStart[debuff], fields) };
    }),
    ...keysOf(gameData.shopGear).map((gear) =>
      line("effectStart", {
        effect: effectLine(gameData, { gear, kind: "gear" }),
        name: gameData.shopGear[gear].name,
      }),
    ),
    ...Object.values(strip.debuffEnd).map((text) => ({ text })),
    line("luckyNeighbour", { hearts: "10" }),
    line("fullPackHome", { amount }),
    line("luckyWallet", { amount }),
    line("spareTreatSaved", {}),
    ...dogs.flatMap(({ dog, owner }) => [
      line("fired", { dog, owner }),
      line("secondChance", { owner }),
      line("spareTreatUsed", { owner }),
      line("pull", { dog }),
      line("treat", { dog, hearts: "10", owner }),
      ...obstacles.flatMap((obstacle) => [
        line("dodge", { dog, obstacle }),
        line("plainHit", { dog, hearts: "10", obstacle, owner }),
      ]),
    ]),
  ];
}

// A line with its typographic marks made plain, as the font draws it; each mark is one
// character either way, so its owners' names keep their places.
const plain = (line: FaceText): FaceText => ({ ...line, text: plainMarks(line.text) });
// A row's text, its runs joined: a face sits between a run's trailing space and its name.
const rowText = (row: FaceRow) => row.texts.map(({ text }) => text).join("");
const AT_2X = { letterSpacing: 0, scale: MESSAGE_STRIP.scale };
const width2x = (run: string) => bodyRunWidth(AT_2X, run);
const BOX_2X = defined(inlineFaceBox(BODY, MESSAGE_STRIP.scale));
// Whether the line fits room on one row in a style of TEXT_FIT_STYLES, as the one-row strip
// sets it.
function fitsOneRow(room: number, line: FaceText): boolean {
  const boxAt = (style: TextFitStyle) => inlineFaceBox(BODY, style.scale);
  const { rows } = fittingFaceRows(TEXT_FIT_STYLES, bodyRunWidth, boxAt, room, line);
  return rows.length === 1 && rows.every((row) => row.width <= room);
}

// Every line wraps at 2x onto the strip's rows, each no wider than its room with each owner's
// face inline, none left out; under the debuff bars, it fits the one-row strip in
// TEXT_FIT_STYLES.
describe("the strip's lines", () => {
  const { room } = messageStripLayout(BODY);

  it("fits every line on the strip's rows, and on the one-row strip", () => {
    const misfits = everyStripLine()
      .map((line) => plain(faceTextWithNamePills(gameData, line)))
      .filter((said) => {
        const rows = messageRows(width2x, BOX_2X, room, said);
        return (
          rows.map(rowText).join(" ") !== said.text.split(/\s+/).join(" ") ||
          rows.some((row) => row.width > room) ||
          !fitsOneRow(MESSAGE_LINE.room, said)
        );
      })
      .map(({ text }) => text);
    expect(misfits).toEqual([]);
  });

  it("leaves out text past the last row", () => {
    const many = Array.from({ length: 200 }, () => "Woof").join(" ");
    expect(messageRows(width2x, BOX_2X, room, { text: many })).toHaveLength(MESSAGE_STRIP.rows);
  });
});

// Owners' quips on the strip: every owner's name's ink at 1x, and each place a line can be,
// with the panel a line of its own text would have: the strip on one row and on two, and the
// one-row strip under the debuff bars.
const OWNER_NAMES = keysOf(gameData.dogs).map((dog) => {
  const { name } = gameData.dogs[dog].owner;
  return [dog, name, inkWidth("font-body", { letterSpacing: 0, scale: 1 }, name)] as const;
});
const LEAD_PLACES: readonly (readonly [string, LeadSlot, Rect])[] = [
  ["the strip's one row", stripLeadSlot(BODY), messagePanel(BODY, 1)],
  ["the strip's two rows", stripLeadSlot(BODY), messagePanel(BODY, 2)],
  ...[1, 2].map(
    (bars) =>
      [
        `the one-row strip under ${bars} bars`,
        lineLeadSlot(BODY, bars),
        messageLinePanel(BODY, bars, true).panel,
      ] as const,
  ),
];
// The moments a walk's owners quip on the strip; a firing's quip shows in its own moment.
const WALK_QUIP_MOMENTS = ["happier", "upset"] as const satisfies readonly QuipMoment[];
// A lead's layout reads only its name's ink: the narrowest and the widest, and a name of the
// other parity when those two share one, as an odd ink centres differently under the face.
const BY_INK = [...OWNER_NAMES].sort((a, b) => a[2] - b[2]);
const NARROWEST = defined(BY_INK[0]);
const WIDEST = defined(BY_INK.at(-1));
const LEAD_NAMES = [
  NARROWEST,
  WIDEST,
  ...(NARROWEST[2] % 2 === WIDEST[2] % 2
    ? BY_INK.filter(([, , ink]) => ink % 2 !== NARROWEST[2] % 2).slice(0, 1)
    : []),
];

describe("an owner's lead", () => {
  const right = (rect: Rect) => rect.x + rect.width;
  const iconGap = MESSAGE_STRIP.textX - MESSAGE_STRIP.icon.x - MESSAGE_STRIP.icon.size;

  it.each(
    LEAD_PLACES.flatMap(([place, slot, panel]) =>
      LEAD_NAMES.map(([, name, ink]) => [place, name, slot, panel, ink] as const),
    ),
  )(
    "keeps the face and name of %s's owner %s inside the panel, the text clear of them",
    (_place, _name, slot, base, ink) => {
      const lead = ownerLeadLayout(BODY, slot, ink);
      const panel = ownerLeadPanel(base, lead);
      const name = { height: inkRowsFromCapTop(BODY), width: ink, x: lead.name.x, y: lead.name.y };
      const column = Math.max(right(lead.frame), right(name));
      const problems: [string, boolean][] = [
        ["frame not 1px around the face", lead.frame.width !== OWNER_LEAD.face + 2],
        ["frame outside the panel", !inside(lead.frame, panel)],
        ["name outside the panel", !inside(name, panel)],
        [
          "name not under the frame",
          name.y !== lead.frame.y + lead.frame.height + OWNER_LEAD.nameGap,
        ],
        [
          "name off the frame's centre",
          Math.abs(name.x + ink / 2 - (lead.frame.x + lead.frame.width / 2)) > 0.5,
        ],
        ["text not an icon's gap past the lead", lead.textX !== column + iconGap],
        [
          "text past the panel's right",
          lead.textX + lead.room > right(panel) - MESSAGE_STRIP.padRight,
        ],
        ["panel outside the band", !inside(panel, SCREEN_LAYOUT.backdrop)],
      ];
      expect(problems.filter(([, hit]) => hit).map(([problem]) => problem)).toEqual([]);
    },
  );

  it.each<[string, LeadSlot, Rect, boolean]>([
    ["grows the strip's one-row panel", stripLeadSlot(BODY), messagePanel(BODY, 1), true],
    ["keeps the strip's two-row panel", stripLeadSlot(BODY), messagePanel(BODY, 2), false],
    [
      "grows the one-row strip under a bar",
      lineLeadSlot(BODY, 1),
      messageLinePanel(BODY, 1, true).panel,
      true,
    ],
    [
      "grows the one-row strip under two bars",
      lineLeadSlot(BODY, 2),
      messageLinePanel(BODY, 2, true).panel,
      true,
    ],
  ])("%s to end padBottom under the lead's name", (_name, slot, panel, grows) => {
    const lead = ownerLeadLayout(BODY, slot, 0);
    const grown = ownerLeadPanel(panel, lead);
    const under = lead.bottom + MESSAGE_STRIP.padBottom - panel.y;
    expect(grown.height > panel.height).toBe(grows);
    expect(grown.height).toBe(Math.max(panel.height, under));
    expect({ ...grown, height: 0 }).toEqual({ ...panel, height: 0 });
  });

  // Every walk quip of every owner wraps at 2x onto the strip's rows beside their lead, none
  // left out, and fits the one-row strip beside it under the bars in TEXT_FIT_STYLES.
  it.each(OWNER_NAMES)(
    "fits every walk quip of %s's owner, %s, beside their lead",
    (dog, _name, ink) => {
      const strip = ownerLeadLayout(BODY, stripLeadSlot(BODY), ink);
      const lines = [1, 2].map((bars) => ownerLeadLayout(BODY, lineLeadSlot(BODY, bars), ink));
      const misfits = WALK_QUIP_MOMENTS.flatMap((moment) => gameData.quips[dog][moment]).filter(
        (said) => {
          const text = plainMarks(said);
          const rows = messageRows(width2x, BOX_2X, strip.room, { text });
          return (
            rows.map(rowText).join(" ") !== text.split(/\s+/).join(" ") ||
            rows.some((row) => row.width > strip.room) ||
            lines.some(({ room }) => !fitsOneRow(room, { text }))
          );
        },
      );
      expect(misfits).toEqual([]);
    },
  );
});

// The rows the strip's one row, with no bar up, gives an inline face over and under its frame.
const STRIP_FACE_PAD = (() => {
  const panel = messagePanel(BODY, 1);
  const top = (messageStripLayout(BODY).rowTops[0] ?? 0) - BOX_2X.rise;
  return { bottom: panel.y + panel.height - (top + BOX_2X.framed), top: top - panel.y };
})();
const BAR_COUNTS = [0, 1, 2] as const;

// What a line shows under bars debuff bars, as the strip draws it: its panel, grown to its
// owner's lead, and each face's frame.
interface Shown {
  faces: Rect[];
  panel: Rect;
}

// A line with no lead, its rows wrapped at 2x on the strip, or fitted on the one-row strip.
function shownLine(bars: number, said: FaceText): Shown {
  const boxAt = (style: TextFitStyle) => inlineFaceBox(BODY, style.scale);
  const set =
    bars === 0
      ? { rows: messageRows(width2x, BOX_2X, messageStripLayout(BODY).room, said), style: AT_2X }
      : fittingFaceRows(TEXT_FIT_STYLES, bodyRunWidth, boxAt, MESSAGE_LINE.room, said);
  const { scale } = set.style;
  const box = boxAt(set.style);
  const faced = set.rows.some((row) => row.faces.length > 0);
  const place = linePlace(BODY, bars, { faced, rows: set.rows.length, scale });
  const faces = set.rows.flatMap((row, i) =>
    row.faces.map(() => {
      const framed = box?.framed ?? 0;
      const y = place.capsTop + i * BODY.lineHeight * scale - (box?.rise ?? 0);
      return { height: framed, width: framed, x: 0, y };
    }),
  );
  return { faces, panel: place.panel };
}

// An owner's quip, led by their face and name, its text wrapped or fitted beside the lead.
function shownQuip(bars: number, ink: number, text: string): Shown {
  const slot = bars === 0 ? stripLeadSlot(BODY) : lineLeadSlot(BODY, bars);
  const lead = ownerLeadLayout(BODY, slot, ink);
  const boxAt = (style: TextFitStyle) => inlineFaceBox(BODY, style.scale);
  const set =
    bars === 0
      ? { rows: messageRows(width2x, BOX_2X, lead.room, { text }), style: AT_2X }
      : fittingFaceRows(TEXT_FIT_STYLES, bodyRunWidth, boxAt, lead.room, { text });
  const lineSet = { faced: true, rows: set.rows.length, scale: set.style.scale };
  const panel = ownerLeadPanel(linePlace(BODY, bars, lineSet).panel, lead);
  return { faces: [lead.frame], panel };
}

// Each face kept at least the strip's rows inside its panel, over and under, and the panel in
// the band.
function cramped({ faces, panel }: Shown): boolean {
  const bottom = panel.y + panel.height;
  return (
    !inside(panel, SCREEN_LAYOUT.backdrop) ||
    faces.some(
      (face) =>
        face.y - panel.y < STRIP_FACE_PAD.top ||
        bottom - (face.y + face.height) < STRIP_FACE_PAD.bottom,
    )
  );
}

// Every line that names an owner or a dog, and every owner's walk quip led by their face, under
// no, one and two debuff bars: a face it shows, inline or leading, keeps the rows round it the
// strip's one row gives; a line showing none keeps the one-row strip's own panel under the bars.
describe("a line's faces", () => {
  const lines = everyStripLine().map((said) => plain(faceTextWithNamePills(gameData, said)));
  const named = lines.filter(
    ({ marks, text }) =>
      (marks ?? []).length > 0 ||
      Object.values(gameData.dogs).some(({ name }) => text.includes(name)),
  );

  it.each(BAR_COUNTS)("keeps the strip's rows round each inline face under %i bars", (bars) => {
    const shown = named.map((said) => [said.text, shownLine(bars, said)] as const);
    expect(shown.some(([, { faces }]) => faces.length > 0)).toBe(true);
    expect(shown.filter(([, line]) => cramped(line)).map(([text]) => text)).toEqual([]);
  });

  it.each(BAR_COUNTS)("keeps the strip's rows round each owner's lead under %i bars", (bars) => {
    const misfits = OWNER_NAMES.flatMap(([dog, name, ink]) =>
      WALK_QUIP_MOMENTS.flatMap((moment) => gameData.quips[dog][moment])
        .filter((said) => cramped(shownQuip(bars, ink, plainMarks(said))))
        .map((said) => `${name}: ${said}`),
    );
    expect(misfits).toEqual([]);
  });

  it.each([1, 2])("keeps a faceless line on the one-row strip's panel under %i bars", (bars) => {
    const faceless = named
      .map((said) => shownLine(bars, said))
      .filter(({ faces }) => faces.length === 0);
    expect(faceless.length).toBeGreaterThan(0);
    expect(faceless.map(({ panel }) => panel.height)).toEqual(
      faceless.map(() => MESSAGE_LINE.height),
    );
  });
});
