import { type GameObjects, type Input, Scene } from "phaser";

import { temperamentIconKey, traitIconKey } from "../assets/iconKeys";
import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import { type BadgeView, badgeWall, earnedText, wallRects } from "../home/badgesView";
import { FEEDBACK, settleDelay } from "../home/feedback";
import { focusDirectionForKey } from "../home/focus";
import { logbookOf, wrapWords } from "../home/home";
import { choiceFull } from "../home/selection";
import { dogRows, overallRows, type StatsRow } from "../home/statsView";
import { isConfirmKey, isPauseKey } from "../input/keyBindings";
import { rectIndexAt } from "../layout/grid";
import { containsPoint, type Rect } from "../layout/rect";
import { PHONE_EVENTS } from "../pwa";
import { addBadge, addConfetti, BADGE_SIZE } from "./badges";
import { fillRect } from "./draw";
import { PALETTE } from "./palette";
import { addPixelText, type FontRole, wrapPixelText } from "./pixelText";
import { currentSettings, profileSave } from "./profileStore";
import { SCENE_KEYS, type SceneKey } from "./sceneKeys";
import {
  addIconButton,
  addPanel,
  addSelectTile,
  addTapBurst,
  clearScene,
  imageIcon,
  TEXT_SCALE,
} from "./uiKit";

export interface StatsSceneData {
  resume?: SceneKey;
}

type Tab = "badges" | "dogs" | "runs";
type Target = "close" | { badge: number } | { tab: number };

const TABS: readonly { label: string; tab: Tab }[] = [
  { label: "Runs", tab: "runs" },
  { label: "Dogs", tab: "dogs" },
  { label: "Badges", tab: "badges" },
];
// Tabs are 44 game pixels tall (48 CSS pixels on a phone) with 8 between them.
const TAB_RECTS: readonly Rect[] = TABS.map((_, i) => ({
  height: 44,
  width: 112,
  x: 4 + i * 120,
  y: 56,
}));
// The menus mock's close button, with its 44x44 hit area in the corner.
const CLOSE = { hit: { height: 44, width: 44, x: 316, y: 0 }, x: 332, y: 10 };
const PANEL: Rect = { height: 444, width: 344, x: 8, y: 108 };
const LEFT = 16;
const RIGHT = 344;
const PITCH = 17;
const DOG_ROW = { iconX: 14, nameX: 54, pitch: 34, top: PANEL.y + 32 };
const DOG_COLUMNS = { fired: 344, walks: 236, zones: 290 };
const LOG_CHARS = 46;
// The badge wall: two columns filled down, each row the badge then a 132-wide text column of
// three lines at 2x (the name, then the goal).
const WALL = { columnGap: 8, columnWidth: 168, rowHeight: 52, rows: 8, x: 8, y: PANEL.y + 24 };
const WALL_TEXT = { lineHeight: 16, lines: 3, width: 132, x: 36, y: 4 };
const WALL_RECTS = wallRects(WALL, gameData.achievements.length);
// The badge tapped open, over the wall.
const DETAIL: Rect = { height: 268, width: 312, x: 24, y: PANEL.y + 32 };
const DETAIL_TEXT_WIDTH = DETAIL.width - 32;
// The badge and its confetti are drawn at 2x, so the burst shows around the bigger badge.
const DETAIL_BADGE_SCALE = 2;
const DIM_ALPHA = 0.6;

// The Stats page behind the logbook, in three tabs: overall figures, runs by outcome and the
// logbook; each dog's walks, zones and firings; and the badge wall, where tapping a badge
// opens its name, goal and line.
export class StatsScene extends Scene {
  private burst = false;
  private detail: number | undefined;
  private pressed: Target | undefined;
  private pressedAt = 0;
  private resumeKey: SceneKey | undefined;
  private tab: Tab = "runs";

  constructor() {
    super(SCENE_KEYS.stats);
  }

  create(data?: StatsSceneData): void {
    this.resumeKey = data?.resume;
    this.pressed = undefined;
    this.detail = undefined;
    this.tab = "runs";
    this.render();

    this.input.on("pointerdown", (pointer: Input.Pointer) => {
      this.pressed = this.detail === undefined ? this.targetAt(pointer.x, pointer.y) : undefined;
      this.pressedAt = this.time.now;
      this.render();
      addTapBurst(this, pointer.x, pointer.y);
    });
    this.input.on("pointerup", (pointer: Input.Pointer) => {
      const target = this.targetAt(pointer.x, pointer.y);
      const pressed = this.pressed;
      if (this.detail !== undefined) {
        this.detail = undefined;
      } else if (target !== undefined && sameTarget(target, pressed)) {
        if (target === "close") {
          this.close();
          return;
        }
        if ("tab" in target) {
          this.openTab(target.tab, settleDelay(this.time.now, this.pressedAt));
          return;
        }
        this.detail = target.badge;
        this.burst = true;
      }
      this.pressed = undefined;
      this.render();
    });
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (this.detail !== undefined) {
        if (isPauseKey(event.key) || isConfirmKey(event.key)) {
          this.detail = undefined;
          this.render();
        }
        return;
      }
      const direction = focusDirectionForKey(event.key);
      if (direction === "left" || direction === "right") {
        const index = TABS.findIndex(({ tab }) => tab === this.tab);
        const next = Math.min(
          TABS.length - 1,
          Math.max(0, index + (direction === "left" ? -1 : 1)),
        );
        if (next !== index) {
          this.pressed = { tab: next };
          this.render();
          this.openTab(next, FEEDBACK.pressDipMs);
        }
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

  private targetAt(x: number, y: number): Target | undefined {
    if (containsPoint(CLOSE.hit, x, y)) {
      return "close";
    }
    const tab = rectIndexAt(TAB_RECTS, x, y);
    if (tab !== undefined) {
      return { tab };
    }
    const badge = this.tab === "badges" ? rectIndexAt(WALL_RECTS, x, y) : undefined;
    return badge === undefined ? undefined : { badge };
  }

  // A pressed tab stays dipped for delayMs, then opens.
  private openTab(index: number, delayMs: number): void {
    this.time.delayedCall(delayMs, () => {
      this.pressed = undefined;
      this.tab = TABS[index]?.tab ?? this.tab;
      this.render();
    });
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
    options: { color?: number; font?: FontRole; originX?: number } = {},
  ): GameObjects.BitmapText {
    return addPixelText(this, x, y, value, {
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
    clearScene(this);
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
    this.text(12, 12, "Stats", { color: PALETTE.cream, font: "title" });
    const close = addIconButton(this, this.add.container(0, 0), CLOSE.x, CLOSE.y, (x, y) =>
      imageIcon(this, "icon-close", x, y),
    );
    close.setPressed(this.pressed === "close");
    // The open tab is selected, so the others always take the full choice's darker step.
    const tabs = this.add.container(0, 0);
    const { reducedMotion } = currentSettings(this);
    TABS.forEach(({ label, tab }, i) => {
      const rect = TAB_RECTS[i];
      if (rect === undefined) {
        return;
      }
      const tile = addSelectTile(this, tabs, rect, {
        badge: "tick",
        edge: true,
        full: choiceFull(1, 1),
        reducedMotion,
        rest: "cream",
        selected: tab === this.tab,
      });
      if (sameTarget({ tab: i }, this.pressed)) {
        tile.container.y += FEEDBACK.pressDipPx;
      }
      tile.content.add(
        addPixelText(this, rect.x + rect.width / 2, rect.y + rect.height / 2, label, {
          color: PALETTE[tile.look.text],
          font: "title",
          originX: 0.5,
          originY: 0.5,
          scale: TEXT_SCALE,
        }),
      );
    });
    switch (this.tab) {
      case "runs":
        addPanel(this, PANEL);
        this.drawRuns();
        break;
      case "dogs":
        addPanel(this, PANEL);
        this.drawDogs();
        break;
      case "badges":
        this.drawBadges();
        break;
      default:
        this.tab satisfies never;
    }
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

  // Earned badges in colour with an amber name, locked ones greyed with a cream name; each
  // with its goal, or its short goal where the full one does not fit under the name.
  private drawBadges(): void {
    const badges = badgeWall(gameData, profileSave(this));
    this.text(12, PANEL.y + 4, "Badges", { color: PALETTE.cream, font: "title" });
    this.text(SCREEN_CONFIG.width - 12, PANEL.y + 4, earnedText(badges), {
      color: PALETTE.cream,
      originX: 1,
    });
    badges.forEach((badge, i) => {
      const rect = WALL_RECTS[i];
      if (rect !== undefined) {
        this.drawWallBadge(badge, rect);
      }
    });
    const open = this.detail === undefined ? undefined : badges[this.detail];
    if (open !== undefined) {
      this.drawDetail(open);
    }
  }

  private drawWallBadge(badge: BadgeView, rect: Rect): void {
    const half = BADGE_SIZE / 2;
    addBadge(this, badge.art, badge.earned, rect.x + half, rect.y + 2 + half);
    const x = rect.x + WALL_TEXT.x;
    const name = this.wrap(badge.name, WALL_TEXT.width);
    const fullGoal = this.wrap(badge.goal, WALL_TEXT.width);
    const goal =
      name.length + fullGoal.length <= WALL_TEXT.lines
        ? fullGoal
        : this.wrap(badge.shortGoal, WALL_TEXT.width);
    const y = rect.y + WALL_TEXT.y;
    this.lines(x, y, name, { color: badge.earned ? PALETTE.amber : PALETTE.cream });
    const goalY = y + name.length * WALL_TEXT.lineHeight;
    this.lines(x, goalY, goal.slice(0, WALL_TEXT.lines - name.length), {
      color: PALETTE.lightGrey,
    });
  }

  // The tapped badge at 2x over a panel, with its name, goal and line; an earned one bursts
  // with confetti. Any tap closes it.
  private drawDetail(badge: BadgeView): void {
    const reduced = currentSettings(this).reducedMotion;
    fillRect(this.add.graphics().setAlpha(DIM_ALPHA), PALETTE.ink, {
      height: SCREEN_CONFIG.height,
      width: SCREEN_CONFIG.width,
      x: 0,
      y: 0,
    });
    addPanel(this, DETAIL);
    const center = DETAIL.x + DETAIL.width / 2;
    const badgeY = DETAIL.y + 48;
    if (badge.earned && (this.burst || reduced)) {
      addConfetti(this, reduced, DETAIL_BADGE_SCALE, center, badgeY);
    }
    this.burst = false;
    addBadge(this, badge.art, badge.earned, center, badgeY)
      .setScale(DETAIL_BADGE_SCALE)
      .setDepth(1);
    let y = badgeY + BADGE_SIZE + 12;
    this.text(center, y, badge.name, { font: "title", originX: 0.5 });
    y += 20;
    this.text(center, y, badge.earned ? "Earned" : "Locked", {
      color: badge.earned ? PALETTE.forest : PALETTE.darkBrown,
      originX: 0.5,
    });
    y += 24;
    const goal = this.wrap(badge.goal, DETAIL_TEXT_WIDTH);
    this.lines(DETAIL.x + 16, y, goal, {});
    y += goal.length * WALL_TEXT.lineHeight + 8;
    this.lines(DETAIL.x + 16, y, this.wrap(`"${badge.badgeLine}"`, DETAIL_TEXT_WIDTH), {
      color: PALETTE.darkBrown,
    });
  }

  // Body text at 2x broken into lines no wider than maxWidth.
  private wrap(text: string, maxWidth: number): string[] {
    return wrapPixelText(this, { color: PALETTE.plum, scale: TEXT_SCALE }, maxWidth, text);
  }

  private lines(x: number, y: number, lines: readonly string[], options: { color?: number }): void {
    lines.forEach((line, i) => this.text(x, y + i * WALL_TEXT.lineHeight, line, options));
  }
}

function sameTarget(a: Target, b: Target | undefined): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
