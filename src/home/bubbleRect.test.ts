import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { DogId, GearId, WalkerId } from "../data/types";
import { wrapWords } from "../lib/lines";
import { insetRect, rectsOverlap } from "../lib/rect";
import { cents } from "../rules/units";
import type { Owned } from "../save/schema";
import { bodyTextWidth } from "../testing/bodyFont";
import { fontFileMetrics, inkWidth } from "../testing/fontInk";
import { inkRowsFromCapTop, inkRowsOfLines } from "../ui/fontMetrics";
import { plainMarks } from "../ui/pixelFont";
import {
  bubbleLines,
  bubbleRect,
  bubbleSize,
  ownerColumn,
  ownerPlace,
  speechLines,
} from "./bubbleRect";
import { dogInfo, gearInfo, type Purchase } from "./home";
import { HOME_LAYOUT, SPEECH_ROOM } from "./homeLayout";
import { messageLine } from "./homeLines";
import { homeLine } from "./homeText";
import { tapWalker } from "./walkers";

const { board } = HOME_LAYOUT.petShop;
const { gap, gate, walkerAtGate } = HOME_LAYOUT;
const sizes = { clearance: 2, margin: gap / 2 };
const top = gate.y + HOME_LAYOUT.speech.top;

describe("bubbleRect", () => {
  it("keeps a bubble of any size clear of the Pet shop's board", () => {
    for (const lines of [1, 2, 3, 4, 5, 8]) {
      for (const width of [60, 120, 200]) {
        const height = lines * 12 + 6;
        const rect = bubbleRect(board, sizes, { x: walkerAtGate.x, y: top }, { height, width });
        expect(rectsOverlap(rect, board), `${lines} lines, ${width} wide`).toBe(false);
        expect(rect.x).toBeGreaterThanOrEqual(sizes.margin);
      }
    }
  });

  // Short, and ending on the row over the board's top.
  it.each([10, board.y - top])(
    "leaves a bubble %i tall, stopping above the board, where it is centred",
    (height) => {
      const rect = bubbleRect(board, sizes, { x: 180, y: top }, { height, width: 100 });
      expect(rect.x).toBe(130);
    },
  );
});

// Every speech the walker's bubble can say, with and without each storage warning first, wraps
// at 2x in the body font onto the bubble's lines, and the bubble keeps clear of the Pet shop's
// board inside the screen. A parting line wraps beside its owner's face and name, which stay
// inside the bubble and clear of the text.
describe("the walker's speech", () => {
  const text = gameData.homeText;
  const body = fontFileMetrics("font-body");
  const dogs = Object.keys(gameData.dogs) as DogId[];
  const gear = Object.keys(gameData.shopGear) as GearId[];
  const walkers = Object.keys(gameData.walkers) as WalkerId[];
  const none: Owned = { dogSlots: 0, dogs: [], gear: [], walkers: [] };
  const all: Owned = { dogSlots: gameData.dogSlots.length, dogs, gear, walkers };
  const bought = (purchase: Purchase, name: string) =>
    messageLine(text, { kind: "bought", name, purchase }) ?? "";
  const said = (parts: string[], owner: DogId | null = null) => ({ owner, parts });
  const messages = [
    ...Object.values(text.bubble),
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
  ].map((message) => said([message]));
  const parting = dogs.flatMap((dog) =>
    gameData.quips[dog].parting.flatMap((quip) => [
      said([quip], dog),
      said([bought({ dog, kind: "dog" }, gameData.dogs[dog].name), quip], dog),
    ]),
  );
  const speeches = [...messages, ...parting].flatMap(({ owner, parts }) => [
    said(parts, owner),
    said([text.newerSave, ...parts], owner),
    said([text.unsaved, ...parts], owner),
  ]);
  const width = (line: string) => bodyTextWidth(2, plainMarks(line));
  const nameInk = (dog: DogId) =>
    inkWidth(
      "font-body",
      { letterSpacing: 0, scale: 1 },
      plainMarks(gameData.dogs[dog].owner.name),
    );
  const { padX } = HOME_LAYOUT.speech;
  const { gap } = HOME_LAYOUT.speech.owner;
  // The quip art's rim, which the owner's face and name stay inside.
  const rim = 2;

  it("says every speech inside its bubble, beside its owner, clear of the board", () => {
    const offenders = speeches.filter(({ owner, parts }) => {
      const column = owner === null ? null : ownerColumn(nameInk(owner));
      const { faced, lines } = bubbleLines(width, HOME_LAYOUT.speech.lines, column, parts);
      // Only a bought dog's parting line may be left out, after the warning and its message.
      const dropped = parts.length === 3 && !faced;
      const kept = dropped ? parts.slice(0, 2) : parts;
      const room = faced && column !== null ? SPEECH_ROOM - column - 4 : SPEECH_ROOM;
      const whole = kept.flatMap((part) => wrapWords(width, room, part));
      const widest = Math.ceil(Math.max(...lines.map(width)));
      const size = bubbleSize(body, lines.length, widest, faced ? column : null);
      const rect = bubbleRect(board, HOME_LAYOUT.speech, { x: walkerAtGate.x, y: top }, size);
      const bubbleFits =
        lines.join("\n") === whole.join("\n") &&
        (owner === null || faced || dropped) &&
        widest <= room &&
        !rectsOverlap(rect, board) &&
        rect.x >= HOME_LAYOUT.speech.margin;
      if (!faced || column === null || owner === null) {
        return !bubbleFits;
      }
      const { face, name } = ownerPlace(rect, column);
      const ink = nameInk(owner);
      const nameLeft = Math.round(name.x - ink / 2);
      const inner = insetRect(rim, rect);
      const textRight = rect.x + padX + widest;
      return !(
        bubbleFits &&
        face.x >= textRight + gap &&
        face.x + face.width <= inner.x + inner.width &&
        face.y >= inner.y &&
        nameLeft >= textRight + gap &&
        nameLeft + ink <= inner.x + inner.width &&
        name.capY + inkRowsFromCapTop(body) <= inner.y + inner.height
      );
    });
    expect(offenders.map(({ parts }) => parts.join(" / "))).toEqual([]);
  });

  it.each(dogs)(
    "centres %s's owner's face over their name, the text centred down the bubble",
    (dog) => {
      const column = ownerColumn(nameInk(dog));
      const lines = bubbleLines(width, HOME_LAYOUT.speech.lines, column, [
        gameData.quips[dog].parting[0] ?? "",
      ]);
      const size = bubbleSize(body, lines.lines.length, 100, column);
      const rect = { ...size, x: 0, y: 0 };
      const { face, name } = ownerPlace(rect, column);
      const ink = inkRowsOfLines(body, lines.lines.length) * 2;
      expect(Math.abs(face.x + face.width / 2 - name.x)).toBeLessThanOrEqual(0.5);
      expect(size.height).toBeGreaterThanOrEqual(face.height + HOME_LAYOUT.speech.owner.foot);
      expect(Math.abs(size.textTop - (size.height - ink - size.textTop))).toBeLessThanOrEqual(2);
    },
  );
});

describe("speechLines", () => {
  it("starts each paragraph on a new line, wraps at spaces and leaves out one past the last line", () => {
    const chars = (line: string) => line.length;
    expect(speechLines(chars, 3, 3, ["ab", "cd"])).toEqual(["ab", "cd"]);
    expect(speechLines(chars, 3, 3, ["ab cd ef"])).toEqual(["ab", "cd", "ef"]);
    expect(speechLines(chars, 3, 3, ["ab cd", "ef gh"])).toEqual(["ab", "cd"]);
  });
});
