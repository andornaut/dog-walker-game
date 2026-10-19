import { describe, expect, it } from "vitest";

import {
  applyHelpAction,
  clampPage,
  type HelpAction,
  helpButtons,
  type HelpOutcome,
} from "./helpPaging";

const PAGES = 6;
const LAST = PAGES - 1;
const show = (page: number): HelpOutcome => ({ kind: "show", page });
const close: HelpOutcome = { kind: "close" };

describe("applyHelpAction", () => {
  it.each<[string, number, HelpAction, number, HelpOutcome]>([
    ["turns one page with next", PAGES, { kind: "next" }, 2, show(3)],
    ["turns one page with previous", PAGES, { kind: "previous" }, 2, show(1)],
    ["holds next at the last page, never closing", PAGES, { kind: "next" }, LAST, show(LAST)],
    ["holds previous at the first page", PAGES, { kind: "previous" }, 0, show(0)],
    ["advances like next until the last page", PAGES, { kind: "advance" }, 0, show(1)],
    ["closes on advance from the last page", PAGES, { kind: "advance" }, LAST, close],
    ["jumps to a page", PAGES, { kind: "goTo", page: 4 }, 0, show(4)],
    ["jumps to a page held in range", PAGES, { kind: "goTo", page: 9 }, 0, show(LAST)],
    ["closes from any page", PAGES, { kind: "close" }, 3, close],
    ["closes on advance past a shrunken page count", 3, { kind: "advance" }, 5, close],
    [
      "turns back from the new last page past a shrunken page count",
      3,
      { kind: "previous" },
      5,
      show(1),
    ],
  ])("%s", (_name, pages, action, page, expected) => {
    expect(applyHelpAction(pages, action, page)).toEqual(expected);
  });
});

describe("helpButtons", () => {
  it.each<[string, number, number, ReturnType<typeof helpButtons>]>([
    ["disables Back on the first page", PAGES, 0, { backEnabled: false, nextLabel: "NEXT" }],
    ["enables Back past the first page", PAGES, 1, { backEnabled: true, nextLabel: "NEXT" }],
    [
      "labels Next NEXT before the last page",
      PAGES,
      LAST - 1,
      { backEnabled: true, nextLabel: "NEXT" },
    ],
    [
      "labels Next GOT IT on the last page",
      PAGES,
      LAST,
      { backEnabled: true, nextLabel: "GOT IT" },
    ],
    [
      "treats a page past a shrunken page count as the new last page",
      3,
      5,
      { backEnabled: true, nextLabel: "GOT IT" },
    ],
  ])("%s", (_name, pages, page, expected) => {
    expect(helpButtons(pages, page)).toEqual(expected);
  });
});

describe("clampPage", () => {
  it("throws without a page to show", () => {
    expect(() => clampPage(0, 0)).toThrow(RangeError);
    expect(() => applyHelpAction(0, { kind: "next" }, 0)).toThrow("at least one page");
    expect(() => helpButtons(-1, 0)).toThrow("at least one page");
  });
});
