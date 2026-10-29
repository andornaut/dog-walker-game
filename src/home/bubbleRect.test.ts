import { wrapWords } from "@andornaut/game-kit/lines";
import { keysOf } from "@andornaut/game-kit/records";
import { insetRect, rectsOverlap } from "@andornaut/game-kit/rect";
import { inkRowsFromCapTop, inkRowsOfLines } from "@andornaut/game-kit/text/bitmapFont";
import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { DogId } from "../data/types";
import { withNamePills } from "../hud/effectNames";
import type { Owned } from "../save/schema";
import { bodyTextWidth } from "../testing/bodyFont";
import { fontFileMetrics, inkWidth } from "../testing/fontInk";
import { plainMarks } from "../ui/pixelFont";
import { cents } from "../units";
import {
  bubbleLines,
  bubbleRect,
  bubbleSize,
  ownerColumn,
  ownerPlace,
  speechLines,
} from "./bubbleRect";
import { dogInfo, gearInfo } from "./home";
import { HOME_LAYOUT, SPEECH_ROOM } from "./homeLayout";
import { walkerSays } from "./homeLines";
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
  const dogs = keysOf(gameData.dogs);
  const gear = keysOf(gameData.shopGear);
  const walkers = keysOf(gameData.walkers);
  const none: Owned = { dogSlots: [], dogs: [], gear: [], walkers: [] };
  const all: Owned = { dogSlots: gameData.dogSlots.map((_, i) => i + 1), dogs, gear, walkers };
  // As the bubble says them, each effect's name in its pill.
  const said = (parts: string[], owner: DogId | null = null) => ({
    owner,
    parts: parts.map((part) => withNamePills(gameData, part)),
  });
  const messages = [
    ...keysOf(text.bubble).flatMap((line) =>
      walkers.map((walker) => walkerSays(gameData, line, walker)),
    ),
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
  ].map((message) => said([message]));
  const parting = dogs.flatMap((dog) =>
    gameData.quips[dog].parting.map((quip) => said([quip], dog)),
  );
  const speeches = [...messages, ...parting].flatMap(({ owner, parts }) => [
    said(parts, owner),
    said([text.unsaved, ...parts], owner),
  ]);
  const width = (line: string) => bodyTextWidth(2, plainMarks(line));
  const nameInk = (dog: DogId) =>
    inkWidth("font-body", { scale: 1 }, plainMarks(gameData.dogs[dog].owner.name));
  const { padX } = HOME_LAYOUT.speech;
  const { gap } = HOME_LAYOUT.speech.owner;
  // The quip art's rim, which the owner's face and name stay inside.
  const rim = 2;

  it("says every speech inside its bubble, beside its owner, clear of the board", () => {
    const offenders = speeches.filter(({ owner, parts }) => {
      const column = owner === null ? null : ownerColumn(nameInk(owner));
      const { faced, lines } = bubbleLines(width, column, parts);
      const room = faced && column !== null ? SPEECH_ROOM - column - 4 : SPEECH_ROOM;
      const whole = parts.flatMap((part) => wrapWords(width, room, part));
      const widest = Math.ceil(Math.max(...lines.map(width)));
      const size = bubbleSize(body, lines.length, widest, faced ? column : null);
      const rect = bubbleRect(board, HOME_LAYOUT.speech, { x: walkerAtGate.x, y: top }, size);
      const bubbleFits =
        lines.join("\n") === whole.join("\n") &&
        (owner === null || faced) &&
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
      const lines = bubbleLines(width, column, [gameData.quips[dog].parting[0] ?? ""]);
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
  const chars = (line: string) => line.length;
  it.each([
    [
      ["ab", "cd"],
      ["ab", "cd"],
    ],
    [["ab cd ef"], ["ab", "cd", "ef"]],
    [
      ["ab cd", "ef gh", "ij kl"],
      ["ab", "cd", "ef", "gh", "ij", "kl"],
    ],
  ])(
    "starts each paragraph of %j on a new line and wraps at spaces, leaving none out",
    (paragraphs, lines) => {
      expect(speechLines(chars, 3, paragraphs)).toEqual(lines);
    },
  );
});
