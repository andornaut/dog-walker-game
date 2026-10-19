import { type Input, Scene } from "phaser";

import { temperamentIconKey, traitIconKey } from "../assets/iconKeys";
import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import { focusDirectionForKey } from "../home/focus";
import { logbookOf, wrapWords } from "../home/home";
import { dogRows, overallRows, type StatsRow } from "../home/statsView";
import { isConfirmKey, isPauseKey } from "../input/keyBindings";
import { rectIndexAt } from "../layout/grid";
import { containsPoint, type Rect } from "../layout/rect";
import { PHONE_EVENTS } from "../pwa";
import { drawDashedRect, fillRect } from "./draw";
import { PALETTE } from "./palette";
import { addPixelText } from "./pixelText";
import { profileSave } from "./profileStore";
import { SCENE_KEYS, type SceneKey } from "./sceneKeys";
import { addMenuButton, addPanel, TEXT_SCALE } from "./uiKit";

export interface StatsSceneData {
  resume?: SceneKey;
}

type Tab = "badges" | "dogs" | "runs";

const TABS: readonly { label: string; tab: Tab }[] = [
  { label: "Runs", tab: "runs" },
  { label: "Dogs", tab: "dogs" },
  { label: "Badges", tab: "badges" },
];
// Tabs and Done are 44 game pixels tall (48 CSS pixels on a phone) with 8 between them.
const TAB_RECTS: readonly Rect[] = TABS.map((_, i) => ({
  height: 44,
  width: 112,
  x: 4 + i * 120,
  y: 136,
}));
const PANEL: Rect = { height: 388, width: 352, x: 4, y: 188 };
const DONE_BUTTON: Rect = { height: 44, width: 200, x: 80, y: 588 };
const LEFT = 16;
const RIGHT = 344;
const PITCH = 17;
const DOG_ROW = { iconX: 14, nameX: 54, pitch: 34, top: 220 };
const DOG_COLUMNS = { fired: 344, walks: 236, zones: 290 };
const BADGE_WALL: Rect = { height: 330, width: 328, x: 16, y: 222 };
const LOG_CHARS = 46;

// The Stats page behind the logbook, in three tabs: overall figures, runs by outcome and the
// logbook; each dog's walks, zones and firings; and the achievements badge wall, which comes
// in a later build and is an empty section for now.
export class StatsScene extends Scene {
  private pressed: "done" | number | undefined;
  private resumeKey: SceneKey | undefined;
  private tab: Tab = "runs";

  constructor() {
    super(SCENE_KEYS.stats);
  }

  create(data?: StatsSceneData): void {
    this.resumeKey = data?.resume;
    this.pressed = undefined;
    this.tab = "runs";
    this.render();

    const targetAt = (x: number, y: number) =>
      containsPoint(DONE_BUTTON, x, y) ? "done" : rectIndexAt(TAB_RECTS, x, y);
    this.input.on("pointerdown", (pointer: Input.Pointer) => {
      this.pressed = targetAt(pointer.x, pointer.y);
      this.render();
    });
    this.input.on("pointerup", (pointer: Input.Pointer) => {
      const target = targetAt(pointer.x, pointer.y);
      const pressed = this.pressed;
      this.pressed = undefined;
      if (target === "done" && pressed === "done") {
        this.close();
        return;
      }
      if (typeof target === "number" && target === pressed) {
        this.tab = TABS[target]?.tab ?? this.tab;
      }
      this.render();
    });
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      const direction = focusDirectionForKey(event.key);
      if (direction === "left" || direction === "right") {
        const index = TABS.findIndex(({ tab }) => tab === this.tab);
        const next = Math.min(
          TABS.length - 1,
          Math.max(0, index + (direction === "left" ? -1 : 1)),
        );
        this.tab = TABS[next]?.tab ?? this.tab;
        this.render();
      } else if (isPauseKey(event.key) || isConfirmKey(event.key)) {
        this.close();
      }
    });
    const onBack = () => this.close();
    window.addEventListener(PHONE_EVENTS.backPressed, onBack);
    this.events.once("shutdown", () =>
      window.removeEventListener(PHONE_EVENTS.backPressed, onBack),
    );
  }

  private close(): void {
    if (this.resumeKey !== undefined) {
      this.scene.resume(this.resumeKey);
    }
    this.scene.stop();
  }

  private text(
    x: number,
    y: number,
    value: string,
    options: { color?: number; font?: "body" | "title"; originX?: number } = {},
  ): void {
    addPixelText(this, x, y, value, {
      color: options.color ?? PALETTE.plum,
      font: options.font ?? "body",
      originX: options.originX ?? 0,
      scale: TEXT_SCALE,
    });
  }

  private rows(y: number, rows: readonly StatsRow[]): number {
    rows.forEach(({ label, value }, i) => {
      this.text(LEFT, y + i * PITCH, label, { color: PALETTE.darkBrown });
      this.text(RIGHT, y + i * PITCH, value, { originX: 1 });
    });
    return y + rows.length * PITCH;
  }

  private render(): void {
    this.children.removeAll(true);
    if (this.textures.exists("screen-stats")) {
      this.add.image(0, 0, "screen-stats").setOrigin(0);
    } else {
      fillRect(this.add.graphics(), PALETTE.darkBrown, {
        height: SCREEN_CONFIG.height,
        width: SCREEN_CONFIG.width,
        x: 0,
        y: 0,
      });
    }
    // The open tab is sunk and underlined, so it never relies on colour.
    TABS.forEach(({ label, tab }, i) => {
      const rect = TAB_RECTS[i];
      if (rect === undefined) {
        return;
      }
      const open = tab === this.tab;
      addMenuButton(this, rect, label).setState(open || this.pressed === i ? "pressed" : "normal");
      if (open) {
        fillRect(this.add.graphics(), PALETTE.cream, {
          height: 3,
          width: rect.width - 16,
          x: rect.x + 8,
          y: rect.y + rect.height + 2,
        });
      }
    });
    addPanel(this, PANEL);
    switch (this.tab) {
      case "runs":
        this.drawRuns();
        break;
      case "dogs":
        this.drawDogs();
        break;
      case "badges":
        this.text(LEFT, PANEL.y + 12, "Achievements", { font: "title" });
        drawDashedRect(this.add.graphics(), PALETTE.darkBrown, BADGE_WALL);
        break;
      default:
        this.tab satisfies never;
    }
    addMenuButton(this, DONE_BUTTON, "Done").setState(
      this.pressed === "done" ? "pressed" : "normal",
    );
  }

  private drawRuns(): void {
    const { stats } = profileSave(this);
    const { outcomes, overall } = overallRows(gameData, stats);
    let y = PANEL.y + 10;
    this.text(LEFT, y, "Overall", { font: "title" });
    y = this.rows(y + 20, overall) + 6;
    this.text(LEFT, y, "Runs", { font: "title" });
    y = this.rows(y + 20, outcomes) + 6;
    this.text(LEFT, y, "Logbook", { font: "title" });
    y += 20;
    const log = logbookOf(gameData, stats);
    const lines =
      log === null
        ? ["No walks yet."]
        : [
            ...wrapWords(LOG_CHARS, `Best ${log.best}, ${log.bestNote}.`),
            ...wrapWords(LOG_CHARS, `Last ${log.last}`),
            log.totals,
          ];
    lines.forEach((line, i) => this.text(LEFT, y + i * 16, line, { color: PALETTE.darkBrown }));
  }

  private drawDogs(): void {
    const save = profileSave(this);
    const top = PANEL.y + 10;
    this.text(LEFT, top, "Dog", { font: "title" });
    const headings = { fired: "Fired", walks: "Walks", zones: "Zones" } as const;
    for (const key of ["walks", "zones", "fired"] as const) {
      this.text(DOG_COLUMNS[key], top, headings[key], { originX: 1 });
    }
    const lines = this.add.graphics();
    dogRows(gameData, save.owned, save.stats).forEach((row, i) => {
      const y = DOG_ROW.top + 8 + i * DOG_ROW.pitch;
      const dog = gameData.dogs[row.dog];
      [traitIconKey(dog.trait), temperamentIconKey(dog.owner.temperament)].forEach((key, n) => {
        if (this.textures.exists(key)) {
          this.add.image(DOG_ROW.iconX + n * 18, y, key).setOrigin(0);
        }
      });
      this.text(DOG_ROW.nameX, y + 3, row.name);
      const values = { fired: row.timesFired, walks: row.walks, zones: row.zonesFinished };
      for (const key of ["walks", "zones", "fired"] as const) {
        this.text(DOG_COLUMNS[key], y + 3, String(values[key]), { font: "title", originX: 1 });
      }
      fillRect(lines, PALETTE.tan, { height: 1, width: RIGHT - LEFT + 4, x: LEFT - 4, y: y + 24 });
    });
  }
}
