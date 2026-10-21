import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { DogId, GearId, WalkerId } from "../data/types";
import type { Rect } from "../layout/rect";
import { cents } from "../rules/units";
import type { Owned } from "../save/schema";
import { bodyTextWidth } from "../testing/bodyFont";
import { fontFileMetrics } from "../testing/fontInk";
import { wrapWords } from "../text/lines";
import { plainMarks } from "../ui/pixelFont";
import { bubbleRect, speechLines } from "./bubbleRect";
import { dogInfo, gearInfo, type Purchase } from "./home";
import { HOME_LAYOUT, SPEECH_ROOM, speechBubbleHeight } from "./homeLayout";
import { messageLine } from "./homeLines";
import { homeLine } from "./homeText";
import { tapWalker } from "./walkers";

const { board } = HOME_LAYOUT.petShop;
const { gap, gate, walkerAtGate } = HOME_LAYOUT;
const sizes = { clearance: 2, margin: gap / 2 };
const top = gate.y + HOME_LAYOUT.speech.top;
const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe("bubbleRect", () => {
  it("keeps a bubble of any size clear of the Pet shop's board", () => {
    for (const lines of [1, 2, 3, 4, 5, 8]) {
      for (const width of [60, 120, 200]) {
        const height = lines * 12 + 6;
        const rect = bubbleRect(board, sizes, { x: walkerAtGate.x, y: top }, { height, width });
        expect(overlaps(rect, board), `${lines} lines, ${width} wide`).toBe(false);
        expect(rect.x).toBeGreaterThanOrEqual(sizes.margin);
      }
    }
  });

  it("leaves a bubble that stops above the board where it is centred", () => {
    const rect = bubbleRect(board, sizes, { x: 180, y: top }, { height: 10, width: 100 });
    expect(rect.x).toBe(130);
  });
});

// Every speech the walker's bubble can say, with and without each storage warning first, wraps
// at 2x in the body font onto the bubble's lines, and the bubble keeps clear of the Pet shop's
// board inside the screen.
describe("the walker's speech", () => {
  const text = gameData.homeText;
  const body = fontFileMetrics("font-body");
  const dogs = Object.keys(gameData.dogs) as DogId[];
  const gear = Object.keys(gameData.shopGear) as GearId[];
  const walkers = Object.keys(gameData.walkers) as WalkerId[];
  const none: Owned = { dogSlots: 0, dogs: [], gear: [], walkers: [] };
  const all: Owned = { dogSlots: gameData.dogSlots.length, dogs, gear, walkers };
  const parting = dogs.flatMap((dog) => gameData.quips[dog].parting);
  const bought = (purchase: Purchase, name: string) =>
    messageLine(text, { kind: "bought", name, purchase }) ?? "";
  const messages = [
    ...Object.values(text.bubble),
    ...parting,
    text.noticePackFull,
    text.noticeSoundOff,
    text.noticeSoundOn,
    ...[none, all].flatMap((owned) => [
      ...dogs.map((dog) => dogInfo(gameData, owned, cents(0), dog)),
      ...gear.map((item) => gearInfo(gameData, owned, cents(0), item)),
      ...walkers.flatMap((walker) => {
        const tap = tapWalker(gameData, owned, null, walker);
        return tap.kind === "drop" ? [] : [tap.text];
      }),
    ]),
    ...dogs.map(
      (dog) =>
        messageLine(text, {
          amount: cents(9_999_900),
          kind: "cantAfford",
          name: gameData.dogs[dog].name,
        }) ?? "",
    ),
    ...gear.map((item) => bought({ gear: item, kind: "gear" }, gameData.shopGear[item].name)),
    bought(
      { kind: "dogSlot" },
      homeLine(text, "dogSlotName", { slot: String(gameData.dogSlots.length) }),
    ),
  ].map((message) => [message]);
  const joined = dogs.flatMap((dog) =>
    gameData.quips[dog].parting.map((quip) => [
      bought({ dog, kind: "dog" }, gameData.dogs[dog].name),
      quip,
    ]),
  );
  const speeches = [...messages, ...joined].flatMap((parts) => [
    parts,
    [text.newerSave, ...parts],
    [text.unsaved, ...parts],
  ]);
  const width = (line: string) => bodyTextWidth(2, plainMarks(line));

  it("says every speech inside its bubble, clear of the board", () => {
    const offenders = speeches.filter((parts) => {
      const lines = speechLines(width, SPEECH_ROOM, HOME_LAYOUT.speech.lines, parts);
      // Only a bought dog's parting line may be left out, after the warning and its message.
      const kept = parts.length === 3 ? parts.slice(0, 2) : parts;
      const whole = kept.flatMap((part) => wrapWords(width, SPEECH_ROOM, part));
      const widest = Math.ceil(Math.max(...lines.map(width)));
      const size = {
        height: speechBubbleHeight(body, lines.length),
        width: widest + 2 * HOME_LAYOUT.speech.padX,
      };
      const rect = bubbleRect(board, HOME_LAYOUT.speech, { x: walkerAtGate.x, y: top }, size);
      return (
        lines.slice(0, whole.length).join("\n") !== whole.join("\n") ||
        widest > SPEECH_ROOM ||
        overlaps(rect, board) ||
        rect.x < HOME_LAYOUT.speech.margin
      );
    });
    expect(offenders.map((parts) => parts.join(" / "))).toEqual([]);
  });
});

describe("speechLines", () => {
  it("starts each paragraph on a new line, wraps at spaces and leaves out one past the last line", () => {
    const chars = (line: string) => line.length;
    expect(speechLines(chars, 3, 3, ["ab", "cd"])).toEqual(["ab", "cd"]);
    expect(speechLines(chars, 3, 3, ["ab cd ef"])).toEqual(["ab", "cd", "ef"]);
    expect(speechLines(chars, 3, 3, ["ab cd", "ef gh"])).toEqual(["ab", "cd"]);
  });
});
