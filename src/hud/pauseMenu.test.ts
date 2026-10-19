import { describe, expect, it } from "vitest";

import { itemAt } from "../arrays";
import { SCREEN_CONFIG } from "../data/screen";
import { screenLayout } from "../layout/screenLayout";
import { pauseMenuLayout, pauseMenuTargetAt } from "./pauseMenu";
import { PAUSE_BUTTON, SOUND_BUTTON } from "./topBar";

const { road } = screenLayout(SCREEN_CONFIG);

describe("pauseMenuLayout", () => {
  it("places the panel, title, buttons and note plate as the menus mock does", () => {
    const layout = pauseMenuLayout(road, 4);
    expect(layout.panel).toEqual({ height: 260, width: 232, x: 104, y: 285 });
    expect(layout.titleY).toBe(301);
    expect(layout.buttons.map((button) => button.y)).toEqual([325, 373, 421, 469]);
    for (const button of layout.buttons) {
      expect(button).toMatchObject({ height: 40, width: 200, x: 120 });
    }
    expect(layout.notePlate).toEqual({ height: 18, width: 200, x: 120, y: 513 });
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

describe("pauseMenuTargetAt", () => {
  const { hits } = pauseMenuLayout(road, 4);

  it("resumes from anywhere on the top bar's pause button", () => {
    const { hit } = PAUSE_BUTTON;
    expect(pauseMenuTargetAt(hits, hit.x, hit.y)).toBe("resume");
    expect(pauseMenuTargetAt(hits, hit.x + hit.width - 1, hit.y + hit.height - 1)).toBe("resume");
  });

  it("finds a menu button by its hit area", () => {
    expect(pauseMenuTargetAt(hits, 120, 323)).toBe(0);
    expect(pauseMenuTargetAt(hits, 319, 510)).toBe(3);
  });

  it("finds nothing on the sound button or the panel around the buttons", () => {
    expect(pauseMenuTargetAt(hits, SOUND_BUTTON.hit.x, SOUND_BUTTON.hit.y)).toBeUndefined();
    expect(pauseMenuTargetAt(hits, 110, 400)).toBeUndefined();
    expect(pauseMenuTargetAt(hits, 220, 520)).toBeUndefined();
  });
});
