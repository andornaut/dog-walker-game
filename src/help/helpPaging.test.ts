import { describe, expect, it } from "vitest";

import { applyHelpAction, helpButtons } from "./helpPaging";

const PAGES = 6;
const LAST = PAGES - 1;

describe("applyHelpAction", () => {
  it("turns one page with next and previous", () => {
    expect(applyHelpAction(PAGES, { kind: "next" }, 2)).toEqual({ kind: "show", page: 3 });
    expect(applyHelpAction(PAGES, { kind: "previous" }, 2)).toEqual({ kind: "show", page: 1 });
  });

  it("holds next at the last page and previous at the first, never closing", () => {
    expect(applyHelpAction(PAGES, { kind: "next" }, LAST)).toEqual({ kind: "show", page: LAST });
    expect(applyHelpAction(PAGES, { kind: "previous" }, 0)).toEqual({ kind: "show", page: 0 });
  });

  it("advances like next until the last page, where it closes", () => {
    expect(applyHelpAction(PAGES, { kind: "advance" }, 0)).toEqual({ kind: "show", page: 1 });
    expect(applyHelpAction(PAGES, { kind: "advance" }, LAST)).toEqual({ kind: "close" });
  });

  it("jumps to a page, held in range", () => {
    expect(applyHelpAction(PAGES, { kind: "goTo", page: 4 }, 0)).toEqual({ kind: "show", page: 4 });
    expect(applyHelpAction(PAGES, { kind: "goTo", page: 9 }, 0)).toEqual({
      kind: "show",
      page: LAST,
    });
  });

  it("closes from any page", () => {
    expect(applyHelpAction(PAGES, { kind: "close" }, 3)).toEqual({ kind: "close" });
  });

  it("treats a page past a shrunken page count as the new last page", () => {
    expect(applyHelpAction(3, { kind: "advance" }, 5)).toEqual({ kind: "close" });
    expect(applyHelpAction(3, { kind: "previous" }, 5)).toEqual({ kind: "show", page: 1 });
  });
});

describe("helpButtons", () => {
  it("disables Back on the first page only", () => {
    expect(helpButtons(PAGES, 0).backEnabled).toBe(false);
    expect(helpButtons(PAGES, 1).backEnabled).toBe(true);
  });

  it("labels Next GOT IT on the last page only", () => {
    expect(helpButtons(PAGES, LAST - 1).nextLabel).toBe("NEXT");
    expect(helpButtons(PAGES, LAST).nextLabel).toBe("GOT IT");
  });

  it("shows GOT IT and no Back for a single page", () => {
    expect(helpButtons(1, 0)).toEqual({ backEnabled: false, nextLabel: "GOT IT" });
  });
});
