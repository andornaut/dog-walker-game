import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { placeholders } from "../lib/lines";
import { keysOf } from "../lib/records";
import { HOME_TEXT_FIELDS } from "./homeText";

describe("the home text", () => {
  const { bubble } = gameData.homeText;
  const named: Readonly<Record<string, readonly string[]>> = HOME_TEXT_FIELDS.bubble;

  it.each(keysOf(bubble))("puts only the names it lists in the walker's %s line", (key) => {
    expect(placeholders(bubble[key]).sort()).toEqual([...(named[key] ?? [])].sort());
  });
});
