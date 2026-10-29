import { placeholders } from "@andornaut/game-kit/lines";
import { keysOf } from "@andornaut/game-kit/records";
import { inkRowsFromCapTop } from "@andornaut/game-kit/text/bitmapFont";
import type { TextFitStyle } from "@andornaut/game-kit/text/textFit";
import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { DogId } from "../data/types";
import type { HeartChange } from "../rules/causes";
import type { FaceMood } from "../rules/treats";
import { bodyRunWidth } from "../testing/bodyFont";
import { defined } from "../testing/defined";
import { fontFileMetrics } from "../testing/fontInk";
import { clampHearts } from "../units";
import {
  faceRows,
  type FaceText,
  fillFaceText,
  INLINE_FACE,
  inlineFaceBox,
  ownerFaceText,
  styledFaceRows,
  withoutFace,
} from "./faceText";
import { MESSAGE_STRIP, messageStripLayout } from "./messageStrip";
import { lowHeartsText } from "./moments";
import { bumpLines, firedLine, forgivenLines, spareTreatUsedLine, treatLine } from "./stripLines";

const BODY = fontFileMetrics("font-body");
const AT_2X = { scale: MESSAGE_STRIP.scale };
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
  ["strip.secondChance", forgivenLines(gameData, [forgiven])[0], "none"],
  [
    "strip.plainHit",
    bumpLines(gameData, { cash: null, change: hearts(4, 2), dodged: false, dog: DOG }, "Cone")[0],
    "loss",
  ],
  ["strip.spareTreatUsed", spareTreatUsedLine(gameData, hearts(0, 1)), "gain"],
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

  // A line leading with the name and one naming the owner after other text: the face's place
  // reads only where the name starts.
  const leads = (line: FaceText | null | undefined) => (line?.marks?.[0]?.at ?? 0) === 0;
  const placedBy = [
    PLACES.find(([, line]) => leads(line)),
    PLACES.find(([, line]) => !leads(line)),
  ];
  it.each(placedBy.filter((place) => place !== undefined))(
    "%s draws the face left of the name, the name gap past it",
    (_path, line) => {
      const said = line ?? { text: "" };
      const at = said.marks?.[0]?.at ?? 0;
      const [row] = faceRows(width2x, BOX_2X, Infinity, said);
      const [face] = row?.faces ?? [];
      const name = row?.texts.find(({ text }) => text.startsWith(NAME));
      expect(face?.x).toBe(width2x(said.text.slice(0, at)));
      expect(name?.x).toBe((face?.x ?? 0) + BOX_2X.framed + BOX_2X.gap);
    },
  );

  // A row just too narrow for the name: it wraps onto the next row with its face.
  it.each(PLACES.filter(([, line]) => (line?.marks?.[0]?.at ?? 0) > 0))(
    "%s takes the face onto the next row with a name that wraps there",
    (_path, line) => {
      const said = line ?? { text: "" };
      const before = said.text.slice(0, said.marks?.[0]?.at).trimEnd();
      const rows = faceRows(width2x, BOX_2X, width2x(before), said);
      const [face] = rows[1]?.faces ?? [];
      const name = rows[1]?.texts.find(({ text }) => text.startsWith(NAME));
      expect(rows[0]?.faces).toEqual([]);
      expect(rows[1]?.faces.map(({ dog }) => dog)).toEqual([DOG]);
      expect(name?.x).toBe((face?.x ?? 0) + BOX_2X.framed + BOX_2X.gap);
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
  const home = gameData.hints.homeButton.text;
  const spaced = keysOf(gameData.dogs).filter((dog) => gameData.dogs[dog].owner.name.includes(" "));

  it.each(spaced)("keeps %s's owner's name whole on its row, however narrow", (dog) => {
    const line = fillFaceText("Hi {owner} again", { owner: ownerFaceText(gameData, "happy", dog) });
    const rows = faceRows(width2x, BOX_2X, 1, line);
    const texts = rows.map((row) => row.texts.map(({ text }) => text).join(""));
    expect(texts).toEqual(["Hi", gameData.dogs[dog].owner.name, "again"]);
    expect(rows.map((row) => row.faces.length)).toEqual([0, 1, 0]);
  });

  it.each<[string, string, number, string[]]>([
    [
      "leaves a lone last word alone",
      "Good dog sits here",
      width2x("Good dog sits"),
      ["Good dog sits", "here"],
    ],
    [
      "fills the strip's first row, leaving the last word alone",
      home,
      messageStripLayout(BODY).room,
      [home.slice(0, home.lastIndexOf(" ")), home.slice(home.lastIndexOf(" ") + 1)],
    ],
  ])("wraps greedily: %s", (_name, text, room, rows) => {
    const set = faceRows(width2x, BOX_2X, room, { text });
    expect(set.map((row) => row.texts.map((run) => run.text).join(""))).toEqual(rows);
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
// its own.
describe("an inline face", () => {
  const scale = INLINE_FACE.textScale;

  it("keeps clear of the rows over and under it", () => {
    const pitch = BODY.lineHeight * scale;
    expect(BOX_2X.framed).toBe(INLINE_FACE.face + 2);
    expect(-BOX_2X.rise).toBeGreaterThanOrEqual(inkRowsFromCapTop(BODY) * scale - pitch);
    expect(BOX_2X.framed - BOX_2X.rise).toBeLessThanOrEqual(pitch);
  });

  // A style of one line keeps the line whole on one row, however narrow its room; a style of
  // more lines breaks it within the room. Either keeps the owner's face.
  const said = defined(PLACES.find(([path]) => path === "strip.plainHit")?.[1] ?? undefined);
  it.each<[string, TextFitStyle, number]>([
    ["keeps a line of one line whole", { scale: 2 }, 1],
    ["breaks a line of two lines", { lines: 2, scale: 2 }, 2],
  ])("%s", (_name, style, count) => {
    const room = bodyRunWidth(style, said.text) - 1;
    const rows = styledFaceRows(style, bodyRunWidth, BOX_2X, room, said);
    expect(rows).toHaveLength(count);
    expect(rows.flatMap((row) => row.faces)).toHaveLength(1);
  });
});
