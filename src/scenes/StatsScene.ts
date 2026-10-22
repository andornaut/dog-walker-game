import { type GameObjects, Scene } from "phaser";

import { dogFaceKey } from "../assets/spriteKeys";
import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import {
  BADGE_TEXT_COLORS,
  badgeProgress,
  type BadgeView,
  badgeWall,
  earnedText,
  wallCell,
  wallCellLineCount,
  type WallCellLines,
  wallRects,
} from "../home/badgesView";
import { FEEDBACK } from "../home/feedback";
import { focusDirectionForKey } from "../home/focus";
import { MENU_TEXT_FIELDS } from "../home/menuText";
import {
  badgesBottom,
  DETAIL_TEXT_WIDTH,
  detailLineY,
  DOG_STATS,
  dogBlockTop,
  dogsBottom,
  type DogStat,
  STATS_LAYOUT,
  STATS_TABS,
  statsScrollbar,
  type StatsTab,
  statsTabRects,
  walksBottom,
  wallRowHeight,
} from "../home/statsLayout";
import { dogRows, overallRows, type StatsRow } from "../home/statsView";
import { isConfirmKey, isPauseKey, menuKeyActs } from "../input/keyBindings";
import {
  LIST_FLING,
  type ListScroll,
  listScroll,
  pageKeyScroll,
  resizeScroll,
  scrollBy,
  scrollMax,
  type ScrollRule,
  stepScroll,
} from "../input/listScroll";
import { screenLayout } from "../layout/screenLayout";
import { fillLine } from "../lib/lines";
import { containsPoint, type Rect } from "../lib/rect";
import { read } from "../rules/units";
import { closeControl } from "../ui/closeControl";
import { rectIndexAt } from "../ui/grid";
import { addDim, fillRect } from "../ui/phaser/draw";
import { PALETTE } from "../ui/phaser/palette";
import {
  addPixelText,
  type FontRole,
  inkSpan,
  pixelFontMetrics,
  setPixelText,
  wrapPixelText,
} from "../ui/phaser/pixelText";
import { addBadge, addConfetti, BADGE_SIZE } from "./badges";
import { closeOverlay, listenDismiss, type OverlayData } from "./overlay";
import { currentSettings, profileSave } from "./profileStore";
import { SCENE_KEYS, type SceneKey } from "./sceneKeys";
import {
  addScrollbar,
  listenListScroll,
  maskToRect,
  placeScrollbar,
  type ScrollbarView,
} from "./scrollView";
import { listenTargetPress, type TargetPressListener } from "./targetPress";
import {
  addCloseButton,
  addPanel,
  addTab,
  addTapBurst,
  clearScene,
  tagFrame,
  TEXT_SCALE,
} from "./uiKit";

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
const DOGS = STATS_LAYOUT.dogs;
const WALL = STATS_LAYOUT.wall;
const WALL_TEXT = STATS_LAYOUT.wallText;
const VIEW: Rect = STATS_LAYOUT.view;
const SCROLL = STATS_LAYOUT.scroll;
// A press that travels past the tap distance drags the open tab.
const SCROLL_RULE: ScrollRule = {
  ...LIST_FLING,
  dragSlopPx: read(gameData.tuning, "pixels", "tapMaxDistance"),
};
// A screen-sized texture, white over the view: the mask that clips each tab's content to it.
const VIEW_MASK_KEY = "stats-view-mask";
const DETAIL: Rect = STATS_LAYOUT.detail;
const SCREEN = screenLayout(SCREEN_CONFIG).screen;
const DETAIL_TEXT = STATS_LAYOUT.detailText;
// The badge and its confetti are drawn at 2x, so the burst shows around the bigger badge.
const DETAIL_BADGE_SCALE = 2;
const FIELDS = MENU_TEXT_FIELDS.stats;

// The Stats page, which the home screen's Logbook button opens, in three tabs on the cream
// panel: overall figures and walks by outcome; a block per dog with its walks, zones and
// firings; and the badge wall, a badge per row, where tapping a badge opens its name, goal and
// line. A tab taller than the panel scrolls in it by a drag, the wheel, the arrow keys or the
// page keys, with a scrollbar at the panel's right edge; a drag taps nothing.
export class StatsScene extends Scene {
  private burst = false;
  // The open tab's content, clipped to the view and moved up by the scroll.
  private content: GameObjects.Container | undefined;
  // Where text() adds its text: the content while the open tab draws.
  private drawingInto: GameObjects.Container | undefined;
  private detail: number | undefined;
  private pressed: Target | undefined;
  private presses: TargetPressListener | undefined;
  private resumeKey: SceneKey | undefined;
  private scroll: ListScroll = listScroll(0);
  private scrollbar: ScrollbarView | undefined;
  private tab: Tab = "runs";
  // The badge wall's rows as last drawn, each badge's tap target.
  private wallRows: Rect[] = [];

  constructor() {
    super(SCENE_KEYS.stats);
  }

  create(data?: OverlayData): void {
    this.resumeKey = data?.resume;
    this.pressed = undefined;
    this.detail = undefined;
    this.scroll = listScroll(0);
    this.tab = "runs";
    this.render();

    // A pressed tab dips, then opens. With a badge's detail open, a tap anywhere closes it.
    this.presses = listenTargetPress<Press>(this, {
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
          this.openTab(TABS[target.tab] ?? this.tab);
        } else {
          this.detail = target.badge;
          this.burst = true;
        }
        this.render();
      },
      same: sameTarget,
      targetAt: (x, y) => (this.detail === undefined ? this.targetAt(x, y) : "dismiss"),
    });
    listenListScroll(this, {
      active: () => this.detail === undefined,
      onDragStart: () => {
        this.presses?.cancel();
        this.pressed = undefined;
        this.render();
      },
      place: () => this.placeContent(),
      rule: SCROLL_RULE,
      scroll: () => this.scroll,
      setScroll: (scroll) => {
        this.scroll = scroll;
      },
      view: VIEW,
    });
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (!menuKeyActs(event.repeat, event.key)) {
        return;
      }
      if (isPauseKey(event.key) || isConfirmKey(event.key)) {
        this.back();
        return;
      }
      if (this.detail !== undefined) {
        return;
      }
      const direction = focusDirectionForKey(event.key);
      const paged = pageKeyScroll(VIEW.height - SCROLL.pageOverlap, event.key, this.scroll);
      if (paged !== undefined || direction === "up" || direction === "down") {
        const step = direction === "up" ? -SCROLL.keyStep : SCROLL.keyStep;
        this.scroll = paged ?? scrollBy(step, this.scroll);
        this.placeContent();
        return;
      }
      if (direction === "left" || direction === "right") {
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

  override update(_time: number, deltaMs: number): void {
    const flung = stepScroll(SCROLL_RULE, deltaMs, this.scroll);
    if (flung !== this.scroll) {
      this.scroll = flung;
      this.placeContent();
    }
  }

  // The open tab's content at its scroll, and the scrollbar's thumb beside it.
  private placeContent(): void {
    this.content?.setY(-this.scroll.y);
    placeScrollbar(statsScrollbar(this.scroll.max, this.scroll.y), this.scrollbar);
  }

  // Another tab opens at its top.
  private openTab(tab: Tab): void {
    if (tab !== this.tab) {
      this.scroll = listScroll(0);
    }
    this.tab = tab;
  }

  private targetAt(x: number, y: number): Target | undefined {
    if (containsPoint(CLOSE.hit, x, y)) {
      return "close";
    }
    const tab = rectIndexAt(TAB_RECTS, x, y);
    if (tab !== undefined) {
      return { tab };
    }
    // Only the view's part of a badge's row is pressed.
    const onWall = this.tab === "badges" && containsPoint(VIEW, x, y);
    const badge = onWall ? rectIndexAt(this.wallRows, x, y + this.scroll.y) : undefined;
    return badge === undefined ? undefined : { badge };
  }

  // A key presses the tab: it dips, then opens.
  private openTabAfterDip(index: number): void {
    this.pressed = { tab: index };
    this.render();
    this.time.delayedCall(FEEDBACK.pressDipMs, () => {
      this.pressed = undefined;
      this.openTab(TABS[index] ?? this.tab);
      this.render();
    });
  }

  private close(): void {
    closeOverlay(this.resumeKey, this);
  }

  // Text at 2x, in the open tab's content when there is one.
  private text(
    x: number,
    y: number,
    value: string,
    options: { color?: number; font?: FontRole; originX?: number } = {},
  ): GameObjects.BitmapText {
    const label = addPixelText(this, x, y, value, {
      color: options.color ?? PALETTE.plum,
      font: options.font ?? "body",
      originX: options.originX ?? 0,
      scale: TEXT_SCALE,
    });
    this.drawingInto?.add(label);
    return label;
  }

  // Each row's label at the left and its value right-aligned at the right, from y.
  private rows(y: number, rows: readonly StatsRow[]): void {
    rows.forEach(({ label, value }, i) => {
      this.text(LEFT, y + i * PITCH, label, { color: PALETTE.darkBrown });
      this.text(RIGHT, y + i * PITCH, value, { originX: 1 });
    });
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
    this.content = undefined;
    this.drawingInto = undefined;
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
      addTab(this, tabs, rect, words.tabs[tab], {
        open: tab === this.tab,
        pressed: sameTarget({ tab: i }, this.pressed),
        reducedMotion,
      });
    });
    addPanel(this, PANEL);
    const root = this.add.container(0, 0);
    const content = this.add.container(0, 0);
    root.add(content);
    maskToRect(this, VIEW_MASK_KEY, VIEW, content);
    this.content = content;
    this.drawingInto = content;
    const bottom = this.drawTab();
    this.drawingInto = undefined;
    this.scroll = resizeScroll(scrollMax(VIEW, bottom), this.scroll);
    this.scrollbar = addScrollbar(this, root, statsScrollbar(this.scroll.max, this.scroll.y));
    this.placeContent();
    const open = this.detail === undefined ? undefined : this.badges()[this.detail];
    if (open !== undefined) {
      this.drawDetail(open);
    }
  }

  // The open tab's content, laid out from its top; returns its bottom.
  private drawTab(): number {
    switch (this.tab) {
      case "runs":
        return this.drawRuns();
      case "dogs":
        return this.drawDogs();
      case "badges":
        return this.drawBadges();
      default:
        return this.tab satisfies never;
    }
  }

  private badges(): BadgeView[] {
    return badgeWall(gameData, profileSave(this));
  }

  private drawRuns(): number {
    const { stats } = profileSave(this);
    const { outcomes, overall } = overallRows(gameData, stats);
    const words = gameData.menuText.stats;
    const { rowsY, sectionGap, top } = STATS_LAYOUT.walks;
    const sections = [
      { heading: words.sections.overall, rows: overall },
      { heading: words.sections.runs, rows: outcomes },
    ];
    let y = top;
    for (const { heading, rows } of sections) {
      this.text(LEFT, y, heading, { font: "title" });
      this.rows(y + rowsY, rows);
      y += rowsY + rows.length * PITCH + sectionGap;
    }
    return walksBottom(sections.map(({ rows }) => rows.length));
  }

  // A block per dog: its face and name, then its walks, neighborhoods and firings, one per
  // row, with a rule between blocks.
  private drawDogs(): number {
    const save = profileSave(this);
    const labels = gameData.menuText.stats.dogColumns;
    const lines = this.add.graphics();
    this.content?.add(lines);
    const dogs = dogRows(gameData, save.owned, save.stats);
    dogs.forEach((row, i) => {
      const top = dogBlockTop(i);
      if (i > 0) {
        fillRect(lines, PALETTE.tan, {
          height: 1,
          width: RIGHT - LEFT + 2 * DOGS.ruleDx,
          x: LEFT - DOGS.ruleDx,
          y: top - DOGS.ruleAbove,
        });
      }
      const face = dogFaceKey(gameData, row.dog);
      this.content?.add(
        this.add.image(LEFT, top, face, tagFrame(this, face, "happy")).setOrigin(0),
      );
      this.text(LEFT + DOGS.nameDx, top + DOGS.nameY, row.name, { font: "title" });
      const values: Record<DogStat, number> = {
        fired: row.timesFired,
        walks: row.walks,
        zones: row.zonesFinished,
      };
      this.rows(
        top + DOGS.rowsY,
        DOG_STATS.map((stat) => ({ label: labels[stat], value: String(values[stat]) })),
      );
    });
    return dogsBottom(dogs.length);
  }

  // The heading and the earned count, then a badge per row: earned ones in colour with a
  // green name, locked ones greyed; each with its goal, or its short goal where the full one
  // does not fit, and a locked one that counts across walks with its progress.
  private drawBadges(): number {
    const save = profileSave(this);
    const badges = this.badges();
    this.text(LEFT, WALL.headingY, gameData.menuText.stats.badges, { font: "title" });
    this.text(RIGHT, WALL.headingY, earnedText(gameData, badges), { originX: 1 });
    const probe = addPixelText(this, 0, 0, "", { color: PALETTE.plum, scale: TEXT_SCALE });
    probe.setVisible(false);
    const inkWidth = (line: string) => {
      setPixelText(probe, line);
      const ink = inkSpan(probe);
      return ink.right - ink.left;
    };
    const cells = badges.map((badge) =>
      wallCell(WALL_TEXT, inkWidth, badge, badgeProgress(gameData, save, badge)),
    );
    probe.destroy();
    // Each row as tall as its badge or its text, whichever is taller.
    this.wallRows = wallRects(
      WALL,
      cells.map((cell) => wallRowHeight(wallCellLineCount(cell))),
    );
    badges.forEach((badge, i) => {
      const rect = this.wallRows[i];
      const cell = cells[i];
      if (rect !== undefined && cell !== undefined) {
        this.drawWallBadge(badge, cell, rect);
      }
    });
    return badgesBottom(this.wallRows);
  }

  private drawWallBadge(badge: BadgeView, cell: WallCellLines, rect: Rect): void {
    const half = BADGE_SIZE / 2;
    const badgeY = rect.y + WALL.badgeTop + half;
    this.content?.add(addBadge(this, badge.art, badge.earned, rect.x + half, badgeY));
    const x = rect.x + WALL_TEXT.x;
    let y = rect.y + WALL_TEXT.y;
    const draw = (lines: readonly string[], color: number) => {
      for (const line of lines) {
        this.text(x, y, line, { color });
        y += WALL_TEXT.lineHeight;
      }
    };
    const colors = BADGE_TEXT_COLORS[badge.earned ? "earned" : "locked"];
    draw(cell.name, PALETTE[colors.name]);
    draw(cell.goal, PALETTE[colors.goal]);
    draw(cell.progress, PALETTE[colors.goal]);
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
    // An earned badge's card: a plum name and goal, a forest status, a dark brown line.
    const locked = BADGE_TEXT_COLORS.locked;
    const colors = badge.earned
      ? { goal: PALETTE.plum, line: PALETTE.darkBrown, name: PALETTE.plum, status: PALETTE.forest }
      : {
          goal: PALETTE[locked.goal],
          line: PALETTE[locked.goal],
          name: PALETTE[locked.name],
          status: PALETTE[locked.goal],
        };
    this.text(center, DETAIL.y + DETAIL_TEXT.nameY, badge.name, {
      color: colors.name,
      font: "title",
      originX: 0.5,
    });
    const words = gameData.menuText.stats;
    const status = badge.earned ? words.badgeEarned : words.badgeLocked;
    this.text(center, DETAIL.y + DETAIL_TEXT.statusY, status, {
      color: colors.status,
      originX: 0.5,
    });
    const x = DETAIL.x + DETAIL_TEXT.x;
    const goal = this.wrap(badge.goal);
    this.text(x, DETAIL.y + DETAIL_TEXT.goalY, goal.join("\n"), { color: colors.goal });
    const line = fillLine(FIELDS, words, "badgeLine", { line: badge.badgeLine });
    const lineY = DETAIL.y + detailLineY(pixelFontMetrics(this, "body"), goal.length);
    this.text(x, lineY, this.wrap(line).join("\n"), { color: colors.line });
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
