import { type GameObjects, Scene } from "phaser";

import { temperamentIconKey, traitIconKey } from "../assets/iconKeys";
import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import { type BadgeView, badgeWall, earnedText, wallRects } from "../home/badgesView";
import { FEEDBACK, settleDelay } from "../home/feedback";
import { focusDirectionForKey } from "../home/focus";
import { logbookOf, wrapWords } from "../home/home";
import { MENU_TEXT_FIELDS } from "../home/menuText";
import { choiceFull } from "../home/selection";
import { STATS_LAYOUT, STATS_TABS, type StatsTab, statsTabRects } from "../home/statsLayout";
import { dogRows, overallRows, type StatsRow } from "../home/statsView";
import { isConfirmKey, isPauseKey } from "../input/keyBindings";
import { rectIndexAt } from "../layout/grid";
import { containsPoint, type Rect } from "../layout/rect";
import { PHONE_EVENTS } from "../pwa";
import { fillLine } from "../text/lines";
import { addBadge, addConfetti, BADGE_SIZE } from "./badges";
import { fillRect } from "./draw";
import { listenOnePress } from "./onePress";
import { PALETTE } from "./palette";
import { addPixelText, type FontRole, wrapPixelText } from "./pixelText";
import { currentSettings, profileSave } from "./profileStore";
import { SCENE_KEYS, type SceneKey } from "./sceneKeys";
import {
  addCloseButton,
  addPanel,
  addSelectTile,
  addTapBurst,
  clearScene,
  TEXT_SCALE,
} from "./uiKit";

export interface StatsSceneData {
  resume?: SceneKey;
}

type Tab = StatsTab;
type Target = "close" | { badge: number } | { tab: number };

const TABS = STATS_TABS;
const TAB_RECTS: readonly Rect[] = statsTabRects();
const CLOSE = STATS_LAYOUT.close;
const PANEL: Rect = STATS_LAYOUT.panel;
const LEFT = STATS_LAYOUT.rows.left;
const RIGHT = STATS_LAYOUT.rows.right;
const PITCH = STATS_LAYOUT.rows.pitch;
const DOG_ROW = STATS_LAYOUT.dogRow;
const DOG_COLUMNS = STATS_LAYOUT.dogColumns;
const LOG_CHARS = 46;
const WALL = STATS_LAYOUT.wall;
const WALL_TEXT = STATS_LAYOUT.wallText;
const WALL_RECTS = wallRects(WALL, gameData.achievements.length);
const DETAIL: Rect = STATS_LAYOUT.detail;
const SCREEN: Rect = { height: SCREEN_CONFIG.height, width: SCREEN_CONFIG.width, x: 0, y: 0 };
const DETAIL_TEXT_WIDTH = DETAIL.width - 32;
// The badge and its confetti are drawn at 2x, so the burst shows around the bigger badge.
const DETAIL_BADGE_SCALE = 2;
const DIM_ALPHA = 0.6;
const FIELDS = MENU_TEXT_FIELDS.stats;

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

    listenOnePress(this, {
      down: (pointer) => {
        this.pressed = this.detail === undefined ? this.targetAt(pointer.x, pointer.y) : undefined;
        this.pressedAt = this.time.now;
        this.render();
        addTapBurst(this, pointer.x, pointer.y);
      },
      up: (pointer, cancelled) => {
        if (cancelled) {
          this.pressed = undefined;
          this.render();
          return;
        }
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
      },
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
        const index = TABS.indexOf(this.tab);
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
      this.tab = TABS[index] ?? this.tab;
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
    const words = gameData.menuText.stats;
    this.text(12, 12, words.title, { color: PALETTE.cream, font: "title" });
    addCloseButton(this, this.add.container(0, 0), SCREEN, this.pressed === "close");
    // The open tab is selected, so the others always take the full choice's darker step.
    const tabs = this.add.container(0, 0);
    const { reducedMotion } = currentSettings(this);
    TABS.forEach((tab, i) => {
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
        addPixelText(this, rect.x + rect.width / 2, rect.y + rect.height / 2, words.tabs[tab], {
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
    const words = gameData.menuText.stats;
    let y = PANEL.y + 10;
    this.text(LEFT, y, words.sections.overall, { font: "title" });
    y = this.rows(y + 20, overall) + 6;
    this.text(LEFT, y, words.sections.runs, { font: "title" });
    y = this.rows(y + 20, outcomes) + 6;
    this.text(LEFT, y, words.sections.logbook, { font: "title" });
    y += 20;
    const log = logbookOf(gameData, stats);
    const lines =
      log === null
        ? [words.logEmpty]
        : [
            ...wrapWords(
              LOG_CHARS,
              fillLine(FIELDS, words, "logBest", { best: log.best, note: log.bestNote }),
            ),
            ...wrapWords(LOG_CHARS, fillLine(FIELDS, words, "logLast", { last: log.last })),
            log.totals,
          ];
    lines.forEach((line, i) => this.text(LEFT, y + i * 16, line, { color: PALETTE.darkBrown }));
  }

  private drawDogs(): void {
    const save = profileSave(this);
    const top = PANEL.y + 10;
    const headings = gameData.menuText.stats.dogColumns;
    this.text(LEFT, top, headings.dog, { font: "title" });
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
    this.text(12, PANEL.y + 4, gameData.menuText.stats.badges, {
      color: PALETTE.cream,
      font: "title",
    });
    this.text(SCREEN_CONFIG.width - 12, PANEL.y + 4, earnedText(gameData, badges), {
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
  // with confetti, and the close control in its corner. Any tap closes it.
  private drawDetail(badge: BadgeView): void {
    const reduced = currentSettings(this).reducedMotion;
    fillRect(this.add.graphics().setAlpha(DIM_ALPHA), PALETTE.ink, {
      height: SCREEN_CONFIG.height,
      width: SCREEN_CONFIG.width,
      x: 0,
      y: 0,
    });
    addPanel(this, DETAIL);
    addCloseButton(this, this.add.container(0, 0), DETAIL, false);
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
    const words = gameData.menuText.stats;
    this.text(center, y, badge.earned ? words.badgeEarned : words.badgeLocked, {
      color: badge.earned ? PALETTE.forest : PALETTE.darkBrown,
      originX: 0.5,
    });
    y += 24;
    const goal = this.wrap(badge.goal, DETAIL_TEXT_WIDTH);
    this.lines(DETAIL.x + 16, y, goal, {});
    y += goal.length * WALL_TEXT.lineHeight + 8;
    const line = fillLine(FIELDS, words, "badgeLine", { line: badge.badgeLine });
    this.lines(DETAIL.x + 16, y, this.wrap(line, DETAIL_TEXT_WIDTH), {
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
