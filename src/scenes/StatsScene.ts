import { clampIndex } from "@andornaut/game-kit/arrays";
import { containsPoint, insetRect, type Rect } from "@andornaut/game-kit/rect";
import { type GameObjects, Scene } from "phaser";

import { dogFaceKey } from "../assets/spriteKeys";
import { gameData } from "../data";
import {
  BADGE_TEXT_COLOURS,
  badgeProgress,
  type BadgeView,
  badgeWall,
  earnedText,
  wallCell,
  type WallCellLines,
  wallRects,
} from "../home/badgesView";
import { FEEDBACK } from "../home/feedback";
import { focusDirectionForKey } from "../home/focus";
import { HOME_BAR_HITS, overlayRegion } from "../home/homeBar";
import {
  badgesBottom,
  DOG_STATS,
  dogBlockTop,
  dogsBottom,
  type DogStat,
  earnedBand,
  earnedCheck,
  STATS_LAYOUT,
  STATS_TABS,
  statsListFrame,
  statsScrollbar,
  type StatsTab,
  statsTabRects,
  walksBottom,
  walksHeadingTops,
  wallLineTops,
  wallRowHeight,
} from "../home/statsLayout";
import { dogRows, overallRows, type StatsRow } from "../home/statsView";
import { isConfirmKey, isPauseKey, menuKeyActs } from "../input/keyBindings";
import {
  type ListScroll,
  listScroll,
  pageKeyScroll,
  resizeScroll,
  scrollBy,
  scrollMax,
  stepScroll,
} from "../input/listScroll";
import { screenArea } from "../input/outsideTap";
import { rectIndexAt } from "../ui/grid";
import { PALETTE } from "../ui/palette";
import { fillRect } from "../ui/phaser/draw";
import {
  type FontRole,
  inkSpan,
  pixelFontMetrics,
  setPixelText,
  withProbe,
} from "../ui/phaser/pixelText";
import { addBadge, addBadgeDetail, BADGE_SIZE } from "./badges";
import { listenHomeBar } from "./homeBarPress";
import { closeOverlay, listenDismiss, type OverlayData } from "./overlay";
import { currentSettings, profileSave } from "./profileStore";
import { SCENE_KEYS, type SceneKey } from "./sceneKeys";
import {
  addScrollbar,
  LIST_SCROLL_RULE,
  listenListScroll,
  maskToRect,
  placeScrollbar,
  type ScrollbarView,
} from "./scrollView";
import { addCountNote, addShopPage, addShopTabs, placeInkRight } from "./shopPage";
import { listenTargetPress, sameByValue, type TargetPressListener } from "./targetPress";
import { addBodyText, addTagImage, addTapBurst, BODY_TEXT, clearScene, tagFrame } from "./uiKit";

type Tab = StatsTab;
type Target = "close" | { badge: number } | { tab: number };
// A press while a badge's detail is open dismisses it, wherever it lands.
type Press = Target | "dismiss";

const TABS = STATS_TABS;
const TAB_RECTS: readonly Rect[] = statsTabRects();
const CLOSE = STATS_LAYOUT.close;
const PANEL: Rect = STATS_LAYOUT.panel;
const LEFT = STATS_LAYOUT.rows.left;
const PITCH = STATS_LAYOUT.rows.pitch;
const DOGS = STATS_LAYOUT.dogs;
const WALL = STATS_LAYOUT.wall;
const EARNED = WALL.earned;
const WALL_TEXT = STATS_LAYOUT.wallText;
const VIEW: Rect = STATS_LAYOUT.view;
const SCROLL = STATS_LAYOUT.scroll;
// A screen-sized texture, white over the view: the mask that clips each tab's content to it.
const VIEW_MASK_KEY = "stats-view-mask";
// The tab the Logbook opens on, its first.
const OPEN_TAB: Tab = "badges";

// The Logbook, which the home screen's Logbook button opens, on the Pet shop's page under the
// home screen's top bar (addShopPage), in three tabs: the badge wall, a badge per row, where
// tapping a badge opens its name, goal and line; a block per dog with its walks, zones and
// firings; and overall figures and walks by outcome. A tab longer than the shop's list area
// scrolls in it by a drag, the wheel, the arrow keys or the page keys, with the shop's
// scrollbar beside it; a drag taps nothing.
export class StatsScene extends Scene {
  private burst = false;
  // The open tab's content, clipped to the view and moved up by the scroll.
  private content: GameObjects.Container | undefined;
  // Where text() adds its text: the content while the open tab draws.
  private drawingInto: GameObjects.Container | undefined;
  private detail: number | undefined;
  // The open tab's view and its values' right edge, by whether it scrolls.
  private frame = statsListFrame(false);
  private pressed: Target | undefined;
  private presses: TargetPressListener | undefined;
  private resumeKey: SceneKey | undefined;
  private scroll: ListScroll = listScroll(0);
  private scrollbar: ScrollbarView | undefined;
  private tab: Tab = OPEN_TAB;
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
    this.tab = OPEN_TAB;
    this.render();

    // A pressed tab dips, then opens. With a badge's detail open, a tap on the page's card
    // closes the detail, and one off the card closes the page, as on the shop.
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
      same: sameByValue,
      targetAt: (x, y) => {
        if (this.detail === undefined) {
          return this.targetAt(x, y);
        }
        return containsPoint(PANEL, x, y) ? "dismiss" : undefined;
      },
    });
    listenListScroll(this, {
      active: () => this.detail === undefined,
      onDragStart: () => {
        this.presses?.cancel();
        this.pressed = undefined;
        this.render();
      },
      place: () => this.placeContent(),
      rule: LIST_SCROLL_RULE,
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
        const next = clampIndex(TABS.length, index + (direction === "left" ? -1 : 1));
        if (next !== index) {
          this.openTabAfterDip(next);
        }
      }
    });
    // The top bar's empty area and the margins around the card close the page, as on the shop,
    // and the top bar's buttons keep their own taps. Back closes an open badge first, as Escape
    // does.
    listenDismiss(
      this,
      screenArea([PANEL, ...HOME_BAR_HITS]),
      () => this.close(),
      () => this.back(),
    );
    listenHomeBar(this, () => this.close());
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
    const flung = stepScroll(LIST_SCROLL_RULE, deltaMs, this.scroll);
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
    options: { align?: "centre"; colour?: number; font?: FontRole; originX?: number } = {},
  ): GameObjects.BitmapText {
    return addBodyText(this, this.drawingInto, { x, y }, value, options);
  }

  // Each row's label's ink from the left and its value's ink up to the right, from y, so the
  // label and the value are as far in from the card's frame on a tab with no scrollbar.
  private rows(y: number, rows: readonly StatsRow[]): void {
    rows.forEach(({ label, value }, i) => {
      const top = y + i * PITCH;
      this.text(LEFT, top, label, { colour: PALETTE.darkBrown });
      placeInkRight(this.text(0, top, value), this.frame.right, top);
    });
  }

  private render(): void {
    clearScene(this);
    this.content = undefined;
    this.drawingInto = undefined;
    const words = gameData.menuText.stats;
    const root = this.add.container(0, 0);
    addShopPage(this, root, this.pressed === "close", words.title);
    addShopTabs(
      this,
      root,
      TABS.map((tab, i) => ({
        label: words.tabs[tab],
        open: tab === this.tab,
        pressed: sameByValue({ tab: i }, this.pressed),
      })),
    );
    const content = this.add.container(0, 0);
    root.add(content);
    this.content = content;
    this.drawingInto = content;
    // Laid out with no scrollbar, then again beside one if it scrolls.
    this.frame = statsListFrame(false);
    let bottom = this.drawTab();
    if (scrollMax(VIEW, bottom) > 0) {
      content.removeAll(true);
      this.frame = statsListFrame(true);
      bottom = this.drawTab();
    }
    this.drawingInto = undefined;
    maskToRect(this, VIEW_MASK_KEY, this.frame.rect, content);
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
    const { rowsY } = STATS_LAYOUT.walks;
    const sections = [
      { heading: words.sections.overall, rows: overall },
      { heading: words.sections.runs, rows: outcomes },
    ];
    const counts = sections.map(({ rows }) => rows.length);
    const tops = walksHeadingTops(counts);
    sections.forEach(({ heading, rows }, i) => {
      const y = tops[i] ?? 0;
      this.text(LEFT, y, heading, { font: "title" });
      this.rows(y + rowsY, rows);
    });
    return walksBottom(counts);
  }

  // A block per dog: its face and name, then its walks, neighbourhoods and firings, one per
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
          width: this.frame.right - LEFT + 2 * DOGS.ruleDx,
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

  // The earned count at the rows' right, then a badge per row: earned ones in colour with a green name
  // on a gold band, ticked, locked ones greyed; each with its goal, or its short goal where the
  // full one does not fit, and a locked one that counts across walks with its progress.
  private drawBadges(): number {
    const save = profileSave(this);
    const badges = this.badges();
    addCountNote(
      this,
      this.drawingInto,
      this.frame.right,
      WALL.headingY,
      earnedText(gameData, badges),
    );
    const cells = withProbe(this, BODY_TEXT, (probe) => {
      const inkWidth = (line: string) => {
        setPixelText(probe, line);
        const ink = inkSpan(probe);
        return ink.right - ink.left;
      };
      return badges.map((badge) =>
        wallCell(WALL_TEXT, inkWidth, badge, badgeProgress(gameData, save, badge)),
      );
    });
    // Each line's capitals' top, the goal's clear of the name's line.
    const body = pixelFontMetrics(this, "body");
    const tops = cells.map((cell) => wallLineTops(body, cell));
    // Each row as tall as its badge or its text, whichever is taller.
    this.wallRows = wallRects(WALL, tops.map(wallRowHeight));
    badges.forEach((badge, i) => {
      const rect = this.wallRows[i];
      const cell = cells[i];
      if (rect !== undefined && cell !== undefined) {
        this.drawWallBadge(badge, cell, { rect, tops: tops[i] ?? [] });
      }
    });
    return badgesBottom(this.wallRows);
  }

  // A wall row: its badge, and its text's lines with their capitals' tops at tops under the
  // row's top.
  private drawWallBadge(
    badge: BadgeView,
    cell: WallCellLines,
    at: { rect: Rect; tops: readonly number[] },
  ): void {
    const { rect } = at;
    if (badge.earned) {
      const band = earnedBand(rect);
      const g = this.add.graphics();
      fillRect(g, PALETTE[EARNED.outline], band);
      fillRect(g, PALETTE[EARNED.fill], insetRect(1, band));
      this.content?.add(g);
    }
    const half = BADGE_SIZE / 2;
    const badgeY = rect.y + WALL.badgeTop + half;
    this.content?.add(addBadge(this, badge.art, badge.earned, rect.x + half, badgeY));
    if (badge.earned) {
      const check = earnedCheck(rect);
      const tick = addTagImage(this, "ui-check", "tick", check.x, check.y);
      if (tick !== undefined) {
        this.content?.add(tick);
      }
    }
    const colours = BADGE_TEXT_COLOURS[badge.earned ? "earned" : "locked"];
    const lines = [
      ...cell.name.map((line) => [line, colours.name] as const),
      ...[...cell.goal, ...cell.progress].map((line) => [line, colours.goal] as const),
    ];
    lines.forEach(([line, colour], i) => {
      const y = rect.y + (at.tops[i] ?? 0);
      this.text(rect.x + WALL_TEXT.x, y, line, { colour: PALETTE[colour] });
    });
  }

  // The tapped badge's card (addBadgeDetail); an earned one bursts with confetti as it opens.
  // Any tap closes it.
  private drawDetail(badge: BadgeView): void {
    const reduced = currentSettings(this).reducedMotion;
    const dim = overlayRegion("home");
    addBadgeDetail(this, this.add.container(0, 0), dim, reduced, this.burst, badge);
    this.burst = false;
  }
}
