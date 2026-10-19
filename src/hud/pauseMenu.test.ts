import { describe, expect, it } from "vitest";

import { itemAt } from "../arrays";
import { SCREEN_CONFIG } from "../data/screen";
import { screenLayout } from "../layout/screenLayout";
import { homeQuestionLayout, pauseMenuLayout } from "./pauseMenu";
import { HOME_BUTTON, PAUSE_BUTTON } from "./topBar";

const { road } = screenLayout(SCREEN_CONFIG);

describe("pauseMenuLayout", () => {
  it("places the panel, title, buttons and note plate as the menus mock does", () => {
    const layout = pauseMenuLayout(road, 4);
    expect(layout.panel).toEqual({ height: 260, width: 232, x: 64, y: 180 });
    expect(layout.titleY).toBe(196);
    expect(layout.buttons.map((button) => button.y)).toEqual([220, 268, 316, 364]);
    for (const button of layout.buttons) {
      expect(button).toMatchObject({ height: 40, width: 200, x: 80 });
    }
    expect(layout.notePlate).toEqual({ height: 18, width: 200, x: 80, y: 408 });
  });

  it("puts the Home question's note under its title, over its two answers", () => {
    const layout = homeQuestionLayout(road, 2);
    expect(layout.panel).toEqual({ height: 164, width: 232, x: 64, y: 228 });
    expect(layout.titleY).toBe(244);
    expect(layout.notePlate).toEqual({ height: 18, width: 200, x: 80, y: 264 });
    expect(layout.buttons.map((button) => button.y)).toEqual([290, 338]);
  });

  it("reaches each hit area 2px above and below its button without overlapping the next", () => {
    const { buttons, hits } = pauseMenuLayout(road, 4);
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
  const hits = [...pauseMenuLayout(road, 4).hits, ...homeQuestionLayout(road, 2).hits];

  // The top bar's buttons stay live while the menu is up, so no menu button may reach them.
  it("keeps every menu button's hit area clear of the top bar's buttons", () => {
    for (const hit of hits) {
      for (const button of [HOME_BUTTON, PAUSE_BUTTON]) {
        expect(hit.y).toBeGreaterThanOrEqual(button.hit.y + button.hit.height);
      }
    }
  });
});
