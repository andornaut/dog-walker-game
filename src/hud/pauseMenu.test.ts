import { describe, expect, it } from "vitest";

import { itemAt } from "../arrays";
import { SCREEN_CONFIG } from "../data/screen";
import { screenLayout } from "../layout/screenLayout";
import { homeQuestionLayout, pauseMenuLayout } from "./pauseMenu";
import { TOP_BAR_BUTTONS } from "./topBar";

const { road } = screenLayout(SCREEN_CONFIG);

describe("pauseMenuLayout", () => {
  it("places the panel, title, buttons and a two-line note plate", () => {
    const layout = pauseMenuLayout(road, { buttonCount: 4, noteLines: 2 });
    expect(layout.panel).toEqual({ height: 284, width: 232, x: 64, y: 168 });
    expect(layout.titleY).toBe(184);
    expect(layout.buttons.map((button) => button.y)).toEqual([208, 256, 304, 352]);
    for (const button of layout.buttons) {
      expect(button).toMatchObject({ height: 40, width: 200, x: 80 });
    }
    expect(layout.notePlate).toEqual({ height: 42, width: 200, x: 80, y: 396 });
  });

  it("puts the Home question's three-line note under its title, over its two answers", () => {
    const layout = homeQuestionLayout(road, { buttonCount: 2, noteLines: 3 });
    expect(layout.panel).toEqual({ height: 208, width: 232, x: 64, y: 206 });
    expect(layout.titleY).toBe(222);
    expect(layout.notePlate).toEqual({ height: 62, width: 200, x: 80, y: 242 });
    expect(layout.buttons.map((button) => button.y)).toEqual([312, 360]);
  });

  it("reaches each hit area 2px above and below its button without overlapping the next", () => {
    const { buttons, hits } = pauseMenuLayout(road, { buttonCount: 4, noteLines: 2 });
    hits.forEach((hit, i) => {
      const button = itemAt(buttons, i);
      expect(hit).toEqual({ ...button, height: 44, y: button.y - 2 });
    });
    for (let i = 1; i < hits.length; i += 1) {
      const above = itemAt(hits, i - 1);
      expect(above.y + above.height).toBeLessThanOrEqual(itemAt(hits, i).y);
    }
  });
});

describe("pauseMenuLayout hits", () => {
  const hits = [
    ...pauseMenuLayout(road, { buttonCount: 4, noteLines: 2 }).hits,
    ...homeQuestionLayout(road, { buttonCount: 2, noteLines: 3 }).hits,
  ];

  // The top bar's buttons stay live while the menu is up, so no menu button may reach them.
  it("keeps every menu button's hit area clear of the top bar's buttons", () => {
    for (const hit of hits) {
      for (const button of Object.values(TOP_BAR_BUTTONS)) {
        expect(hit.y).toBeGreaterThanOrEqual(button.hit.y + button.hit.height);
      }
    }
  });
});
