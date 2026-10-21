import { type GameObjects, Scene } from "phaser";

import { dogFaceKey } from "../assets/spriteKeys";
import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import {
  badgeProgress,
  type BadgeView,
  badgeWall,
  earnedText,
  wallCell,
  wallRects,
} from "../home/badgesView";
import { FEEDBACK } from "../home/feedback";
import { focusDirectionForKey } from "../home/focus";
import { PLAIN_ITEM, tileState } from "../home/interaction";
import { MENU_TEXT_FIELDS } from "../home/menuText";
import {
  DETAIL_TEXT_WIDTH,
  detailLineY,
  DOG_COLUMNS,
  type DogColumn,
  dogColumnRights,
  STATS_LAYOUT,
  STATS_TABS,
  type StatsTab,
  statsTabRects,
} from "../home/statsLayout";
import { dogRows, overallRows, type StatsRow } from "../home/statsView";
import { isConfirmKey, isPauseKey, menuKeyActs } from "../input/keyBindings";
import { closeControl } from "../layout/closeControl";
import { rectIndexAt } from "../layout/grid";
import { containsPoint, type Rect } from "../layout/rect";
import type { TextFitStyle } from "../layout/textFit";
import { fillLine } from "../text/lines";
import { addBadge, addConfetti, BADGE_SIZE } from "./badges";
import { addDim, fillRect } from "./draw";
import { closeOverlay, listenDismiss } from "./overlay";
import { PALETTE } from "./palette";
import {
  addPixelText,
  type FontRole,
  inkSpan,
  pixelFontMetrics,
  scalePixelText,
  setPixelText,
  wrapPixelText,
} from "./pixelText";
import { currentSettings, profileSave } from "./profileStore";
import { SCENE_KEYS, type SceneKey } from "./sceneKeys";
import { listenTargetPress } from "./targetPress";
import {
  addCloseButton,
  addPanel,
  addSelectTile,
  addTapBurst,
  clearScene,
  tagFrame,
  TEXT_SCALE,
} from "./uiKit";

// tab is the tab to open on, the first by default.
export interface StatsSceneData {
  resume?: SceneKey;
  tab?: StatsTab;
}

type Tab = StatsTab;
type Target = "close" | { badge: number } | { tab: number };
// A press while a badge's detail is open dismisses it, wherever it lands.
type Press = Target | "dismiss";

const TABS = STATS_TABS;
const TAB_RECTS: readonly Rect[] = statsTabRects();
const CLOSE = STATS_LAYOUT.close;
const PANEL: Rect = STATS_LAYOUT.panel;
const LEFT = STATS_LAYOUT.rows.left;
const RIGHT = STATS_LAYOUT.rows.right;
const PITCH = STATS_LAYOUT.rows.pitch;
const DOG_ROW = STATS_LAYOUT.dogRow;
const WALL = STATS_LAYOUT.wall;
const WALL_TEXT = STATS_LAYOUT.wallText;
const WALL_RECTS = wallRects(WALL, gameData.achievements.length);
const DETAIL: Rect = STATS_LAYOUT.detail;
const SCREEN: Rect = { height: SCREEN_CONFIG.height, width: SCREEN_CONFIG.width, x: 0, y: 0 };
const DETAIL_TEXT = STATS_LAYOUT.detailText;
// The badge and its confetti are drawn at 2x, so the burst shows around the bigger badge.
const DETAIL_BADGE_SCALE = 2;
const FIELDS = MENU_TEXT_FIELDS.stats;

// The Stats page behind the logbook, in three tabs: overall figures and walks by outcome;
// each dog's walks, zones and firings; and the badge wall, where tapping a badge opens its
// name, goal and line.
export class StatsScene extends Scene {
  private burst = false;
  private detail: number | undefined;
  private pressed: Target | undefined;
  private resumeKey: SceneKey | undefined;
  private tab: Tab = "runs";

  constructor() {
    super(SCENE_KEYS.stats);
  }

  create(data?: StatsSceneData): void {
    this.resumeKey = data?.resume;
    this.pressed = undefined;
    this.detail = undefined;
    this.tab = data?.tab ?? "runs";
    this.render();

    // A pressed tab dips, then opens. With a badge's detail open, a tap anywhere closes it.
    listenTargetPress<Press>(this, {
      dipMs: (target) => (typeof target === "object" && "tab" in target ? FEEDBACK.pressDipMs : 0),
      onDown: (pointer) => addTapBurst(this, pointer.x, pointer.y),
      onPressed: (target) => {
        this.pressed = target === "dismiss" ? undefined : target;
        this.render();
      },
      onTap: (target) => {
        if (target === "dismiss") {
          this.detail = undefined;
        } else if (target === "close") {
          this.close();
          return;
        } else if ("tab" in target) {
          this.tab = TABS[target.tab] ?? this.tab;
        } else {
          this.detail = target.badge;
          this.burst = true;
        }
        this.render();
      },
      same: sameTarget,
      targetAt: (x, y) => (this.detail === undefined ? this.targetAt(x, y) : "dismiss"),
    });
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (!menuKeyActs(event.repeat, event.key)) {
        return;
      }
      if (isPauseKey(event.key) || isConfirmKey(event.key)) {
        this.back();
        return;
      }
      const direction = focusDirectionForKey(event.key);
      if (this.detail === undefined && (direction === "left" || direction === "right")) {
        const index = TABS.indexOf(this.tab);
        const next = Math.min(
          TABS.length - 1,
          Math.max(0, index + (direction === "left" ? -1 : 1)),
        );
        if (next !== index) {
          this.openTabAfterDip(next);
        }
      }
    });
    // Back closes an open badge first, as Escape does.
    listenDismiss(
      this,
      [SCREEN],
      () => this.close(),
      () => this.back(),
    );
  }

  // An open badge closes, else the page.
  private back(): void {
    if (this.detail === undefined) {
      this.close();
      return;
    }
    this.detail = undefined;
    this.render();
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

  // A key presses the tab: it dips, then opens.
  private openTabAfterDip(index: number): void {
    this.pressed = { tab: index };
    this.render();
    this.time.delayedCall(FEEDBACK.pressDipMs, () => {
      this.pressed = undefined;
      this.tab = TABS[index] ?? this.tab;
      this.render();
    });
  }

  private close(): void {
    closeOverlay(this.resumeKey, this);
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
    this.text(12, 14, words.title, { color: PALETTE.cream, font: "title" });
    addCloseButton(this, this.add.container(0, 0), CLOSE, this.pressed === "close");
    // The open tab is selected and the others normal.
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
        reducedMotion,
        state: tileState({ ...PLAIN_ITEM, picked: tab === this.tab }),
        tile: false,
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
    this.rows(y + 20, outcomes);
  }

  // Each dog's face and name, then its numbers right-aligned under their headings, each column
  // as wide as its heading's or its widest number's ink (dogColumnRights).
  private drawDogs(): void {
    const save = profileSave(this);
    const top = PANEL.y + 10;
    const headings = gameData.menuText.stats.dogColumns;
    this.text(LEFT, top, headings.dog, { font: "title" });
    const columns = DOG_COLUMNS.map((column) => ({
      column,
      labels: [this.text(0, top, headings[column], { originX: 1 })],
    }));
    const lines = this.add.graphics();
    dogRows(gameData, save.owned, save.stats).forEach((row, i) => {
      const y = DOG_ROW.top + 8 + i * DOG_ROW.pitch;
      const face = dogFaceKey(gameData, row.dog);
      this.add
        .image(DOG_ROW.faceX, y + 3 - DOG_ROW.faceTop, face, tagFrame(this, face, "happy"))
        .setOrigin(0);
      this.text(DOG_ROW.nameX, y + 3, row.name);
      const values: Record<DogColumn, number> = {
        fired: row.timesFired,
        walks: row.walks,
        zones: row.zonesFinished,
      };
      for (const { column, labels } of columns) {
        labels.push(this.text(0, y + 3, String(values[column]), { font: "title", originX: 1 }));
      }
      fillRect(lines, PALETTE.tan, { height: 1, width: RIGHT - LEFT + 4, x: LEFT - 4, y: y + 24 });
    });
    const widths = new Map(
      columns.map(({ column, labels }) => [
        column,
        Math.max(
          ...labels.map((label) => {
            const ink = inkSpan(label);
            return Math.ceil(ink.right - ink.left);
          }),
        ),
      ]),
    );
    const rights = dogColumnRights((column) => widths.get(column) ?? 0);
    for (const { column, labels } of columns) {
      labels.forEach((label) => label.setX(rights[column]));
    }
  }

  // Earned badges in colour with an amber name, locked ones greyed with a cream name; each
  // with its goal, or its short goal where the full one does not fit under the name, and a
  // locked one that counts across walks with its progress.
  private drawBadges(): void {
    const save = profileSave(this);
    const badges = badgeWall(gameData, save);
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
        this.drawWallBadge(badge, badgeProgress(gameData, save, badge), rect);
      }
    });
    const open = this.detail === undefined ? undefined : badges[this.detail];
    if (open !== undefined) {
      this.drawDetail(open);
    }
  }

  private drawWallBadge(badge: BadgeView, progress: string | undefined, rect: Rect): void {
    const half = BADGE_SIZE / 2;
    addBadge(this, badge.art, badge.earned, rect.x + half, rect.y + 2 + half);
    const x = rect.x + WALL_TEXT.x;
    const probe = this.text(0, 0, "").setVisible(false);
    const inkWidth = (style: TextFitStyle, line: string) => {
      setPixelText(probe, line);
      probe.setLetterSpacing(style.letterSpacing);
      scalePixelText(probe, style.scale, 0, 0);
      const ink = inkSpan(probe);
      return ink.right - ink.left;
    };
    const cell = wallCell(WALL_TEXT, inkWidth, badge, progress);
    probe.destroy();
    const { style } = cell;
    const lineHeight = (WALL_TEXT.lineHeight * style.scale) / WALL_TEXT.scale;
    let y = rect.y + WALL_TEXT.y;
    const draw = (lines: readonly string[], color: number) => {
      for (const line of lines) {
        addPixelText(this, x, y, line, { color, scale: style.scale }).setLetterSpacing(
          style.letterSpacing,
        );
        y += lineHeight;
      }
    };
    draw(cell.name, badge.earned ? PALETTE.amber : PALETTE.cream);
    draw(cell.goal, PALETTE.lightGrey);
    draw(cell.progress, PALETTE.cream);
  }

  // The tapped badge at 2x over a panel, with its name, goal and line; an earned one bursts
  // with confetti, and the close control in its corner. Any tap closes it.
  private drawDetail(badge: BadgeView): void {
    const reduced = currentSettings(this).reducedMotion;
    addDim(this, SCREEN);
    addPanel(this, DETAIL);
    addCloseButton(this, this.add.container(0, 0), closeControl(DETAIL), false);
    const center = DETAIL.x + DETAIL.width / 2;
    const badgeY = DETAIL.y + DETAIL_TEXT.badgeY;
    if (badge.earned && (this.burst || reduced)) {
      addConfetti(this, reduced, DETAIL_BADGE_SCALE, center, badgeY);
    }
    this.burst = false;
    addBadge(this, badge.art, badge.earned, center, badgeY)
      .setScale(DETAIL_BADGE_SCALE)
      .setDepth(1);
    this.text(center, DETAIL.y + DETAIL_TEXT.nameY, badge.name, { font: "title", originX: 0.5 });
    const words = gameData.menuText.stats;
    const status = badge.earned ? words.badgeEarned : words.badgeLocked;
    this.text(center, DETAIL.y + DETAIL_TEXT.statusY, status, {
      color: badge.earned ? PALETTE.forest : PALETTE.darkBrown,
      originX: 0.5,
    });
    const x = DETAIL.x + DETAIL_TEXT.x;
    const goal = this.wrap(badge.goal);
    this.text(x, DETAIL.y + DETAIL_TEXT.goalY, goal.join("\n"));
    const line = fillLine(FIELDS, words, "badgeLine", { line: badge.badgeLine });
    const lineY = DETAIL.y + detailLineY(pixelFontMetrics(this, "body"), goal.length);
    this.text(x, lineY, this.wrap(line).join("\n"), { color: PALETTE.darkBrown });
  }

  // Body text at 2x broken into lines no wider than the open badge's text.
  private wrap(text: string): string[] {
    const style = { color: PALETTE.plum, scale: TEXT_SCALE };
    return wrapPixelText(this, style, DETAIL_TEXT_WIDTH, text);
  }
}

function sameTarget(a: Press, b: Press | undefined): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
