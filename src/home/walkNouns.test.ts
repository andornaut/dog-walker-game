import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { MENU_TEXT } from "../data/menuText";
import { veteranSave } from "../save/fixtures";
import { STATS_TABS } from "./statsLayout";
import { overallRows } from "./statsView";

const words = MENU_TEXT.stats;

describe("the Stats page's words", () => {
  const { outcomes, overall } = overallRows(gameData, veteranSave().stats);

  it.each([
    ...STATS_TABS.map((tab) => ({ label: words.tabs[tab], where: "tab" })),
    ...Object.values(words.sections).map((label) => ({ label, where: "heading" })),
    ...[...overall, ...outcomes].map(({ label }) => ({ label, where: "row" })),
  ])("say walk, never run: $where $label", ({ label }) => {
    expect(label).not.toMatch(/\brun/i);
  });

  it.each([
    { label: words.overall.bestRun, text: "Best walk" },
    { label: words.overall.runsPlayed, text: "Walks played" },
    { label: words.sections.runs, text: "Walks" },
    { label: words.tabs.runs, text: "Walks" },
  ])("reads $text", ({ label, text }) => {
    expect(label).toBe(text);
  });
});
