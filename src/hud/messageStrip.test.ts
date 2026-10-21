import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import type { GearId, UpgradeId, WalkerPerkId } from "../data/types";
import { screenLayout } from "../layout/screenLayout";
import { fillLine, fillNames } from "../lib/lines";
import { type Rect } from "../lib/rect";
import { capitalize, SIZE_NAMES } from "../rules/effectText";
import { bumpHearts } from "../rules/run";
import { bodyTextWidth } from "../testing/bodyFont";
import { fitInFont, fontFileMetrics } from "../testing/fontInk";
import { testState } from "../testing/runState";
import { inkRowsFromCapTop } from "../ui/fontMetrics";
import { plainMarks } from "../ui/pixelFont";
import { TEXT_FIT_STYLES } from "../ui/textFit";
import { type EffectItem, effectLine, effectName } from "./effectIcons";
import {
  EMPTY_MESSAGE_STRIP,
  lineAlpha,
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
  sayLine,
  sayLineAhead,
  stepMessageStrip,
} from "./messageStrip";
import { RUN_TEXT_FIELDS, STRIP_LINE_FIELDS } from "./runText";
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
    const wrong = (Object.keys(MESSAGE_ICONS) as MessageIcon[]).filter((icon) => {
      const { height, width } = pngSize(messageIconKey(icon));
      return height !== 16 || width !== 16;
    });
    expect(wrong).toEqual([]);
  });
});

const inside = (inner: Rect, outer: Rect) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;

describe("messageStripLayout", () => {
  it("keeps the strip in the backdrop band under the walk bar, with its icon and rows inside", () => {
    const strip = messageStripLayout(BODY);
    const { backdrop, topBar } = screenLayout(SCREEN_CONFIG);
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

// With debuff bars up, the strip's one row sits under the last bar, in the band.
describe("messageLinePanel", () => {
  it("puts the one-row strip under the debuff bars, in the band", () => {
    const { backdrop, topBar } = screenLayout(SCREEN_CONFIG);
    for (const bars of [1, 2]) {
      const one = messageLinePanel(bars);
      const last = debuffBarRects(topBar, bars).at(-1);
      expect(one.panel.y).toBeGreaterThanOrEqual((last?.y ?? 0) + (last?.height ?? 0));
      expect(inside(one.panel, backdrop)).toBe(true);
      expect(inside({ ...one.icon, height: 16, width: 16 }, one.panel)).toBe(true);
      expect(one.textX + one.room).toBeLessThanOrEqual(one.panel.x + one.panel.width);
    }
  });
});

// Every line the strip can say: each hint and badge, each explanation a held press shows, and
// each of the walk's lines for every dog, owner and obstacle as each neighborhood names it, with
// two-digit counts and the largest amounts.
function everyStripLine(): string[] {
  const { explain, strip } = gameData.runText;
  const line = (key: keyof typeof STRIP_LINE_FIELDS, fields: Record<string, string>) =>
    fillLine(STRIP_LINE_FIELDS, strip, key, fields as never);
  const dogs = Object.values(gameData.dogs).map((dog) => ({
    dog: dog.name,
    owner: dog.owner.name,
  }));
  const obstacles = [
    ...new Set(Object.values(gameData.minorObstacles).map(({ name }) => name.toLowerCase())),
  ];
  const amount = "$9,999";
  const muddyCost = bumpHearts(
    gameData,
    testState({ koda: 5 }, { debuffs: [{ debuff: "muddy", secondsLeft: 20 }] }),
  );
  const items: EffectItem[] = [
    ...(Object.keys(gameData.shopGear) as GearId[]).map(
      (gear) => ({ gear, kind: "gear" }) as const,
    ),
    ...(Object.keys(gameData.walkerPerks) as WalkerPerkId[]).map(
      (perk) => ({ kind: "perk", perk }) as const,
    ),
    ...(Object.keys(gameData.upgrades) as UpgradeId[]).map(
      (upgrade) => ({ kind: "upgrade", upgrade }) as const,
    ),
  ];
  const fields = RUN_TEXT_FIELDS.explain;
  return [
    ...Object.values(gameData.hints).map(({ text }) => text),
    ...gameData.achievements.map(({ name }) => line("achievement", { name })),
    ...items.map((item) =>
      fillLine(fields, explain, "effect", {
        effect: effectLine(gameData, item),
        name: effectName(gameData, item),
      }),
    ),
    ...Object.values(gameData.debuffs).map(({ name, stake }) =>
      fillLine(fields, explain, "debuff", { name, stake: fillNames(stake, { seconds: "99" }) }),
    ),
    ...Object.values(gameData.dogs).map((dog) =>
      fillLine(fields, explain, "dog", {
        dog: dog.name,
        hearts: "10",
        max: "10",
        owner: dog.owner.name,
        size: capitalize(SIZE_NAMES[dog.size]),
      }),
    ),
    ...Object.values(strip.debuffStart).map((start) => fillNames(start, { seconds: "99" })),
    ...Object.values(strip.debuffEnd),
    strip.luckyNeighbor,
    line("fullPackHome", { amount }),
    line("luckyWallet", { amount }),
    ...dogs.flatMap(({ dog, owner }) => [
      line("fired", { dog, owner }),
      line("kindWords", { owner }),
      line("lowHearts", { owner }),
      line("muddyHearts", { cost: String(muddyCost), hearts: String(muddyCost), owner }),
      line("pull", { dog }),
      line("treat", { dog, hearts: "10", owner }),
      ...obstacles.flatMap((obstacle) => [
        line("dodge", { dog, obstacle }),
        line("plainHit", { dog, hearts: "10", obstacle, owner }),
      ]),
    ]),
  ];
}

// Every line wraps at 2x onto the strip's rows, each no wider than its room, none left out;
// under the debuff bars, it fits the one-row strip in TEXT_FIT_STYLES.
describe("the strip's lines", () => {
  const { room } = messageStripLayout(BODY);
  const width = (row: string) => bodyTextWidth(MESSAGE_STRIP.scale, row);

  it("fits every line on the strip's rows, and on the one-row strip", () => {
    const misfits = [...new Set(everyStripLine())].filter((said) => {
      const text = plainMarks(said);
      const rows = messageRows(width, room, text);
      const one = fitInFont("font-body", TEXT_FIT_STYLES, MESSAGE_LINE.room, text);
      return (
        rows.join(" ") !== text.split(/\s+/).join(" ") ||
        rows.length > MESSAGE_STRIP.rows ||
        rows.some((row) => width(row) > room) ||
        one.widest > MESSAGE_LINE.room
      );
    });
    expect(misfits).toEqual([]);
  });

  it("leaves out text past the last row", () => {
    const many = Array.from({ length: 200 }, () => "Woof").join(" ");
    expect(messageRows(width, room, many)).toHaveLength(MESSAGE_STRIP.rows);
  });
});
