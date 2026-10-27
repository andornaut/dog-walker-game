import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { DogId } from "../data/types";
import { placeholders } from "../lib/lines";
import type { Rect } from "../lib/rect";
import type { HeartChange } from "../rules/causes";
import { bumpHearts } from "../rules/run";
import type { FaceMood } from "../rules/treats";
import { clampHearts } from "../rules/units";
import { bodyRunWidth } from "../testing/bodyFont";
import { defined } from "../testing/defined";
import { fontFileMetrics } from "../testing/fontInk";
import { inside } from "../testing/rects";
import { testState } from "../testing/runState";
import { inkRowsFromCapTop } from "../ui/fontMetrics";
import { TEXT_FIT_STYLES, type TextFitStyle } from "../ui/textFit";
import {
  faceRows,
  type FaceText,
  fillFaceText,
  fittingFaceRows,
  INLINE_FACE,
  inlineFaceBox,
  ownerFaceText,
  withoutFace,
} from "./faceText";
import {
  MESSAGE_LINE,
  MESSAGE_STRIP,
  messageLinePanel,
  messageLineTop,
  messagePanel,
  messageStripLayout,
} from "./messageStrip";
import { lowHeartsText } from "./moments";
import {
  bumpLine,
  firedLine,
  forgivenLines,
  lowHeartsLines,
  muddyHeartsLines,
  treatLine,
} from "./stripLines";

const BODY = fontFileMetrics("font-body");
const AT_2X = { letterSpacing: 0, scale: MESSAGE_STRIP.scale };
const width2x = (run: string) => bodyRunWidth(AT_2X, run);
const BOX_2X = defined(inlineFaceBox(BODY, MESSAGE_STRIP.scale));

const DOG: DogId = "kilo";
const NAME = gameData.dogs[DOG].owner.name;
const hearts = (
  before: number,
  after: number,
  causes: HeartChange["causes"] = [],
): HeartChange => ({
  after: clampHearts(9, after),
  before: clampHearts(9, before),
  causes,
  dog: DOG,
  kind: "hearts",
});
const forgiven = hearts(4, 4, [
  { amount: -1, kind: "bump" },
  { amount: 1, forgives: true, kind: "modifier", source: { kind: "walker", walker: "casey" } },
]);
const muddy = testState({ kilo: 5 }, { debuffs: [{ debuff: "muddy", secondsLeft: 20 }] });
const muddyCost = bumpHearts(gameData, muddy);

// An owner's face shows upset on a heart loss, happy on a gain, and neutral otherwise.
const MOOD = { gain: "happy", loss: "upset", none: "neutral" } as const satisfies Record<
  string,
  FaceMood
>;

// Each walk text line that names an owner in the game area, by its path in the walk's text, as
// the walk says it of kilo's owner, and the heart change it tells of.
const PLACES: readonly (readonly [string, FaceText | null | undefined, keyof typeof MOOD])[] = [
  ["lowHearts", lowHeartsText(gameData, DOG), "loss"],
  ["strip.fired", firedLine(gameData, DOG), "loss"],
  ["strip.kindWords", forgivenLines(gameData, [forgiven])[0], "none"],
  ["strip.lowHearts", lowHeartsLines(gameData, [hearts(2, 1)])[0], "loss"],
  [
    "strip.muddyHearts",
    muddyHeartsLines(gameData, muddy, [hearts(muddyCost + 1, muddyCost)])[0],
    "loss",
  ],
  [
    "strip.plainHit",
    bumpLine(gameData, { change: hearts(4, 2), dodged: false, dog: DOG }, "Cone"),
    "loss",
  ],
  ["strip.treat", treatLine(gameData, hearts(2, 3)), "gain"],
];

// Walk text lines that name an owner but draw the name as plain text: the held dog card's detail
// (explain.extraHearts), whose card already shows the dog; and the firing line in a card's
// breakdown and a heart change's label on the owner's own card (firedBy), and an option's
// firing warning (card.fires), which set text at 1x in boxes too short for a face.
const PLAIN_OWNER_LINES = ["card.fires", "explain.extraHearts", "firedBy"];

// The path of every walk text line that names an owner.
function ownerLinePaths(text: object, path = ""): string[] {
  return Object.entries(text).flatMap(([key, value]: [string, unknown]) => {
    const at = path === "" ? key : `${path}.${key}`;
    if (typeof value === "string") {
      return placeholders(value).some((name) => name === "owner" || name === "owners") ? [at] : [];
    }
    return typeof value === "object" && value !== null ? ownerLinePaths(value, at) : [];
  });
}

describe("the walk's lines that name an owner", () => {
  it("each lead the name with the owner's face, or are listed as plain", () => {
    const placed = [...PLACES.map(([path]) => path), ...PLAIN_OWNER_LINES].sort();
    expect(ownerLinePaths(gameData.runText).sort()).toEqual(placed);
  });

  it.each(PLACES)("%s marks the owner's name, in the mood of its change", (_path, line, change) => {
    const marks = line?.marks ?? [];
    expect(marks.map(({ dog, mood }) => ({ dog, mood }))).toEqual([
      { dog: DOG, mood: MOOD[change] },
    ]);
    const [mark] = marks;
    expect(line?.text.slice(mark?.at, (mark?.at ?? 0) + (mark?.length ?? 0))).toBe(NAME);
  });

  it.each(PLACES)("%s draws the face left of the name, the name gap past it", (_path, line) => {
    const said = line ?? { text: "" };
    const at = said.marks?.[0]?.at ?? 0;
    const [row] = faceRows(width2x, BOX_2X, Infinity, said);
    const [face] = row?.faces ?? [];
    const name = row?.texts.find(({ text }) => text.startsWith(NAME));
    expect(face?.x).toBe(width2x(said.text.slice(0, at)));
    expect(name?.x).toBe((face?.x ?? 0) + BOX_2X.framed + BOX_2X.gap);
  });

  // A row just too narrow for the name: it wraps onto the next row with its face.
  it.each(PLACES.filter(([, line]) => (line?.marks?.[0]?.at ?? 0) > 0))(
    "%s takes the face onto the next row with a name that wraps there",
    (_path, line) => {
      const said = line ?? { text: "" };
      const before = said.text.slice(0, said.marks?.[0]?.at).trimEnd();
      const rows = faceRows(width2x, BOX_2X, width2x(before), said);
      expect(rows[0]?.faces).toEqual([]);
      expect(rows[1]?.faces.map(({ dog, x }) => ({ dog, x }))).toEqual([{ dog: DOG, x: 0 }]);
      expect(rows[1]?.texts[0]?.x).toBe(BOX_2X.framed + BOX_2X.gap);
      expect(rows[1]?.texts[0]?.text.startsWith(NAME)).toBe(true);
    },
  );

  // A row just too narrow for the whole line: the heart change after the name wraps with it.
  const CHANGED = ["strip.plainHit", "strip.treat"];
  it.each(PLACES.filter(([path]) => CHANGED.includes(path)))(
    "%s keeps the heart change after the name on the row with its face and name",
    (_path, line) => {
      const said = line ?? { text: "" };
      const whole = faceRows(width2x, BOX_2X, Infinity, said)[0]?.width ?? 0;
      const rows = faceRows(width2x, BOX_2X, whole - 1, said);
      const named = said.text.slice(said.marks?.[0]?.at);
      expect(named).toMatch(new RegExp(`^${NAME} [+−]\\d+♥$`, "u"));
      expect(rows).toHaveLength(2);
      expect(rows[1]?.faces.map(({ dog }) => dog)).toEqual([DOG]);
      expect(rows[1]?.texts.map(({ text }) => text)).toEqual([named]);
    },
  );
});

describe("faceRows", () => {
  const spaced = (Object.keys(gameData.dogs) as DogId[]).filter((dog) =>
    gameData.dogs[dog].owner.name.includes(" "),
  );

  it.each(spaced)("keeps %s's owner's name whole on its row, however narrow", (dog) => {
    const line = fillFaceText("Hi {owner} again", { owner: ownerFaceText(gameData, "happy", dog) });
    const rows = faceRows(width2x, BOX_2X, 1, line);
    const texts = rows.map((row) => row.texts.map(({ text }) => text).join(""));
    expect(texts).toEqual(["Hi", gameData.dogs[dog].owner.name, "again"]);
    expect(rows.map((row) => row.faces.length)).toEqual([0, 1, 0]);
  });

  it.each<[string, number, string[]]>([
    ["a word a row with no room", 0, ["Good", "dog"]],
    ["one row in the strip's room", messageStripLayout(BODY).room, ["Good dog"]],
  ])("wraps plain text %s", (_name, room, rows) => {
    const set = faceRows(width2x, BOX_2X, room, { text: "Good dog" });
    expect(set.map((row) => ({ faces: row.faces, texts: row.texts }))).toEqual(
      rows.map((text) => ({ faces: [], texts: [{ text, x: 0 }] })),
    );
  });
});

describe("withoutFace", () => {
  const two = fillFaceText("{a} and {b}", {
    a: ownerFaceText(gameData, "happy", "kilo"),
    b: ownerFaceText(gameData, "upset", "buddy"),
  });

  it.each<[string, DogId | undefined, DogId[]]>([
    ["keeps every face with no lead", undefined, ["kilo", "buddy"]],
    ["drops the leading owner's face", "kilo", ["buddy"]],
  ])("%s", (_name, lead, kept) => {
    const line = withoutFace(lead, two);
    expect(line.text).toBe(two.text);
    expect((line.marks ?? []).map(({ dog }) => dog)).toEqual(kept);
  });
});

// The face draws at 1x, framed, beside 2x text only; it keeps clear of the rows over and under
// its own, and inside each panel the strip draws a 2x line on.
describe("an inline face", () => {
  const scale = INLINE_FACE.textScale;

  it("keeps clear of the rows over and under it", () => {
    const pitch = BODY.lineHeight * scale;
    expect(BOX_2X.framed).toBe(INLINE_FACE.face + 2);
    expect(-BOX_2X.rise).toBeGreaterThanOrEqual(inkRowsFromCapTop(BODY) * scale - pitch);
    expect(BOX_2X.framed - BOX_2X.rise).toBeLessThanOrEqual(pitch);
  });

  const { rowTops } = messageStripLayout(BODY);
  it.each<[string, number, Rect]>([
    ["the strip's first row", rowTops[0] ?? 0, messagePanel(BODY, 1)],
    ["the strip's second row", rowTops[1] ?? 0, messagePanel(BODY, 2)],
    ...[1, 2].map((bars): [string, number, Rect] => [
      `the one-row strip under ${bars} bars`,
      messageLineTop(BODY, messageLinePanel(bars), scale),
      messageLinePanel(bars).panel,
    ]),
  ])("sits inside the panel on %s", (_place, capsTop, panel) => {
    const frame = {
      height: BOX_2X.framed,
      width: BOX_2X.framed,
      x: panel.x,
      y: capsTop - BOX_2X.rise,
    };
    expect(inside(frame, panel)).toBe(true);
  });

  // The one-row strip under the debuff bars: a line that fits its room at 2x keeps its face,
  // and one set at 1x, the last of TEXT_FIT_STYLES, shows the owner's name alone.
  const said = defined(PLACES.find(([path]) => path === "strip.plainHit")?.[1] ?? undefined);
  const at1x = { letterSpacing: 0, scale: 1 };
  it.each<[string, number, number, number]>([
    ["keeps the face at 2x", MESSAGE_LINE.room, 2, 1],
    ["shows the name alone at 1x", bodyRunWidth(at1x, said.text), 1, 0],
  ])("%s", (_name, room, textScale, faces) => {
    const boxAt = (style: TextFitStyle) => inlineFaceBox(BODY, style.scale);
    const set = fittingFaceRows(TEXT_FIT_STYLES, bodyRunWidth, boxAt, room, said);
    const [row] = set.rows;
    expect(set.style.scale).toBe(textScale);
    expect(row?.faces).toHaveLength(faces);
    expect(row?.texts.map(({ text }) => text).join("")).toBe(said.text);
    expect(row?.width).toBeLessThanOrEqual(room);
  });
});
