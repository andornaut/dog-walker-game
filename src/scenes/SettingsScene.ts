import { type GameObjects, Scene, Scenes } from "phaser";

import { gameData } from "../data";
import { SCREEN_CONFIG, SCREEN_LAYOUT } from "../data/screen";
import type { MenuText } from "../data/types";
import { FEEDBACK } from "../home/feedback";
import { type Focus, focusDirectionForKey, moveFocus } from "../home/focus";
import { MENU_TEXT_FIELDS } from "../home/menuText";
import {
  INSTALL_STEPS_FIT,
  type InstallStepsLayout,
  installStepsLayout,
  knobX,
  noteRoom,
  SETTINGS_NOTE_STYLE,
  SETTINGS_ROW,
  type SettingsFonts,
  type SettingsLayout,
  settingsLayout,
  type SettingsRowShape,
  setVolumeSteps,
  VOLUME_STEPS,
  type VolumeKey,
  volumePercent,
  volumeStepAt,
  volumeStepForKey,
  volumeSteps,
} from "../home/settings";
import { isConfirmKey, isMuteKey, isPauseKey, menuKeyActs } from "../input/keyBindings";
import { screenArea } from "../input/outsideTap";
import { itemAt } from "../lib/arrays";
import { fillLine } from "../lib/lines";
import { containsPoint, insetRect, type Rect } from "../lib/rect";
import {
  installApp,
  installState,
  menuBrowser,
  type MenuInstallBrowser,
  offersInstall,
  onInstallStateChange,
} from "../pwa";
import type { Settings } from "../save/schema";
import { closeFace } from "../ui/closeControl";
import { PLAIN_ITEM, tileState } from "../ui/interaction";
import { addDim, drawFocusRing, fillRect } from "../ui/phaser/draw";
import { PALETTE } from "../ui/phaser/palette";
import {
  addPixelText,
  fitPixelText,
  labelInkWidth,
  pixelFontMetrics,
  setPixelText,
  withProbe,
} from "../ui/phaser/pixelText";
import { addRampDim } from "../ui/phaser/rampDim";
import { GREYED } from "../ui/selection";
import { fittingText, TEXT_SCALE } from "../ui/textFit";
import { addCardTitle, addDetailCard } from "./homePanels";
import { listenOnePress } from "./onePress";
import { closeOverlay, listenOutsideTap, onBackPressed, type OverlayData } from "./overlay";
import { currentSettings, setSettings } from "./profileStore";
import { SCENE_KEYS, type SceneKey } from "./sceneKeys";
import { soundboardOf } from "./soundboard";
import { listenTargetPress, sameByValue } from "./targetPress";
import {
  addBodyText,
  addCloseButton,
  addMenuButton,
  addNineSlice,
  addSelectTile,
  addTagImage,
  addTapBurst,
  BODY_TEXT,
  clearScene,
} from "./uiKit";

// Emitted on game.events when settings close.
export const SETTINGS_CLOSED_EVENT = "settings-closed";

type SwitchKey = "muted" | "reducedMotion";
type SettingsWord = Exclude<keyof MenuText["settings"], "installSteps" | "volume">;
// The open install steps' card, with the browser whose steps it shows.
type OpenSteps = InstallStepsLayout & { readonly browser: MenuInstallBrowser };

// Each row carries a 16x16 -panel icon with on and off tags, and the menuText.settings keys
// of its label, its note and its button's label.
type Row =
  | {
      button: SettingsWord;
      icon: string;
      key: "install";
      kind: "button";
      label: SettingsWord;
      note: SettingsWord;
    }
  | { icon: string; key: SwitchKey; kind: "switch"; label: SettingsWord; note: SettingsWord }
  | { icon: string; key: VolumeKey; kind: "slider"; label: SettingsWord };
type NotedRow = Extract<Row, { note: SettingsWord }>;

type Target =
  | { kind: "close" }
  | { kind: "install" }
  | { kind: "stepsClose" }
  | { key: SwitchKey; kind: "switch" };

// Four rows, each its own tap target, and the close control.
const SETTING_ROWS: readonly Row[] = [
  {
    icon: "icon-sound-panel",
    key: "muted",
    kind: "switch",
    label: "sound",
    note: "soundNote",
  },
  { icon: "icon-music-panel", key: "musicVolume", kind: "slider", label: "music" },
  { icon: "icon-effects-panel", key: "sfxVolume", kind: "slider", label: "effects" },
  {
    icon: "icon-motion-panel",
    key: "reducedMotion",
    kind: "switch",
    label: "motion",
    note: "motionNote",
  },
];
// Under them while the game can be installed (offersInstall).
const INSTALL_ROW: Row = {
  button: "installButton",
  icon: "icon-install-panel",
  key: "install",
  kind: "button",
  label: "install",
  note: "installNote",
};
// The button each browser's install steps start from, drawn before them: Safari's Share, or
// Firefox's menu.
const STEPS_ICONS: Readonly<Record<MenuInstallBrowser, string>> = {
  firefoxAndroid: "icon-browser-menu",
  ios: "icon-share",
};
const { icon: ICON, label: LABEL, note: NOTE } = SETTINGS_ROW;
const KNOB_HEIGHT = 16;
// The ring stays inside the panel's 8px margin.
const FOCUS_OUTSET = 3;

function settingsRows(installable: boolean): readonly Row[] {
  return installable ? [...SETTING_ROWS, INSTALL_ROW] : SETTING_ROWS;
}

// How many lines a browser's install steps wrap onto in their card.
function stepsLines(scene: Scene, steps: string): number {
  return withProbe(scene, BODY_TEXT, (probe) => {
    setPixelText(probe, steps);
    return fitPixelText(probe, INSTALL_STEPS_FIT, 0, 0);
  }).lines.length;
}

function hasNote(row: Row): row is NotedRow {
  return row.kind !== "slider";
}

// Each row's shape: its note, wrapped in its room as render sets it, decides how many lines it
// takes.
function rowShapes(scene: Scene, rows: readonly Row[]): SettingsRowShape[] {
  const words = gameData.menuText.settings;
  return rows.map((row) => {
    if (!hasNote(row)) {
      return { kind: row.kind };
    }
    const { lines } = withProbe(scene, BODY_TEXT, (probe) =>
      fittingText(SETTINGS_NOTE_STYLE, labelInkWidth(probe), noteRoom(row.kind), words[row.note]),
    );
    return { kind: row.kind, noteLines: lines.length };
  });
}

const NO_FONT = { capHeight: 0, capTop: 0, inkBottom: 0, lineHeight: 0 };
const NO_FONTS: SettingsFonts = { body: NO_FONT, title: NO_FONT };

function settingsFonts(scene: Scene): SettingsFonts {
  return { body: pixelFontMetrics(scene, "body"), title: pixelFontMetrics(scene, "title") };
}

// A switch is on when its setting is: sound is on while not muted.
function switchOn(key: SwitchKey, settings: Settings): boolean {
  return key === "muted" ? !settings.muted : settings.reducedMotion;
}

// What the settings are launched with: the scene under them, which they resume on close, and
// the part of the screen they dim: the whole start screen, or the walk view the pause menu dims.
export interface SettingsData extends OverlayData {
  readonly dim: Rect;
}

// Sound on or off, music and effects volume, reduced motion and, until the game is installed
// where it can be, Install, reachable from the home screen and the pause menu. The card draws
// over the screen it opens from, its dim part ramp-dimmed as under the pause menu. Every change
// is saved and applied at once. A switch row is normal and shows its setting in its switch; a
// tap dips the row, then flips it. A tap anywhere on the Install row, its Get button included,
// dips it, then opens the browser's install prompt or, in a browser that installs only from its
// own menu (iOS, Firefox for Android), a card with that browser's steps over the settings. Up and
// Down move the keyboard's focus through the rows and the close control; Enter or Space presses
// the focused row, and on a slider the left and right keys, Home and End set the volume.
export class SettingsScene extends Scene {
  private dim: Rect = SCREEN_LAYOUT.screen;
  // The ramp dim's objects, kept as the card redraws over them.
  private dimmed: readonly GameObjects.GameObject[] = [];
  private dragging: VolumeKey | undefined;
  private focus: Focus | null = null;
  // No rows until create measures their notes, so no font is read.
  private layout: SettingsLayout = settingsLayout(NO_FONTS, SCREEN_CONFIG, []);
  private pressed: Target | undefined;
  private resumeKey: SceneKey | undefined;
  private rows: readonly Row[] = SETTING_ROWS;
  // The install steps' card and the browser whose steps it shows, while it is open.
  private steps: OpenSteps | undefined;

  constructor() {
    super(SCENE_KEYS.settings);
  }

  create(data: SettingsData): void {
    this.resumeKey = data.resume;
    this.dim = data.dim;
    this.dimmed = addRampDim(this, data.dim);
    this.rows = settingsRows(offersInstall(installState()));
    this.layout = settingsLayout(settingsFonts(this), SCREEN_CONFIG, rowShapes(this, this.rows));
    this.dragging = undefined;
    this.focus = null;
    this.pressed = undefined;
    this.steps = undefined;
    this.render();

    // The install row comes and goes as the game becomes installable or installed.
    const stopWatching = onInstallStateChange(() => this.scene.restart(data));
    this.events.once(Scenes.Events.SHUTDOWN, stopWatching);

    // The close control, the switch rows and the install row, which dip before they act, and
    // the steps' card's close control.
    listenTargetPress<Target>(this, {
      dipMs: (target) =>
        target.kind === "switch" || target.kind === "install" ? FEEDBACK.pressDipMs : 0,
      onPressed: (target) => {
        this.pressed = target;
        this.render();
      },
      onTap: (target) => this.tap(target),
      same: sameByValue,
      targetAt: (x, y) => this.targetAt(x, y),
    });
    // The sliders, dragged from a press on their row; every press bursts where it lands.
    listenOnePress(this, {
      down: (pointer) => {
        const row = this.rows.find((_, i) => containsPoint(this.rowRect(i), pointer.x, pointer.y));
        if (this.steps === undefined && row?.kind === "slider" && !currentSettings(this).muted) {
          this.dragging = row.key;
          this.slideTo(pointer.x);
          // The knob shows pressed while held.
          this.render();
        }
        addTapBurst(this, pointer.x, pointer.y);
      },
      move: (pointer) => {
        if (this.dragging !== undefined) {
          this.slideTo(pointer.x);
        }
      },
      up: (_, cancelled) => {
        if (this.dragging === undefined) {
          return;
        }
        // A sample at the new level, so the player hears what they picked.
        if (!cancelled && this.dragging === "sfxVolume") {
          soundboardOf(this).play("tip");
        }
        this.dragging = undefined;
        this.render();
      },
    });
    // The back button and the dimmed screen around the card close it, as the close control in
    // its band does; over the walk, the lit top bar and dog cards are not around it. While the
    // steps' card is open, the back button and the screen around that card close it, the
    // settings card included. As listenDismiss, with the area read as each press lands.
    onBackPressed(this, () => this.back());
    listenOutsideTap(
      this,
      () =>
        this.steps === undefined
          ? { covered: [this.layout.panel], dim: this.dim }
          : screenArea([this.steps.card]),
      () => this.back(),
    );
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (menuKeyActs(event.repeat, event.key)) {
        this.onKey(event.key);
      }
    });
  }

  private onKey(key: string): void {
    if (this.steps !== undefined) {
      if (isPauseKey(key) || isConfirmKey(key)) {
        this.closeSteps();
      }
      return;
    }
    const focusedRow = this.focus === null ? undefined : this.rows[this.focus.row];
    if (focusedRow?.kind === "slider") {
      const settings = currentSettings(this);
      const current = volumeSteps(settings[focusedRow.key]);
      const steps = volumeStepForKey(key, current);
      if (steps !== undefined) {
        if (!settings.muted && steps !== current) {
          this.change(setVolumeSteps(focusedRow.key, steps, settings));
          // A sample at the new level, as after a drag.
          if (focusedRow.key === "sfxVolume") {
            soundboardOf(this).play("tip");
          }
        }
        return;
      }
    }
    const direction = focusDirectionForKey(key);
    if (direction !== undefined) {
      // The rows, then the close control, one per focus row.
      this.focus = moveFocus([...this.rows.map(() => 1), 1], direction, this.focus);
      this.render();
    } else if (isPauseKey(key)) {
      this.close();
    } else if (isConfirmKey(key)) {
      this.confirm(focusedRow);
    } else if (isMuteKey(key)) {
      this.flipAfterDip("muted");
    }
  }

  // Enter or Space flips a focused switch, presses Install, and closes from the close
  // control or with nothing focused.
  private confirm(focusedRow: Row | undefined): void {
    if (focusedRow?.kind === "switch") {
      this.flipAfterDip(focusedRow.key);
    } else if (focusedRow?.kind === "button") {
      this.pressed = { kind: "install" };
      this.render();
      this.time.delayedCall(FEEDBACK.pressDipMs, () => this.install());
    } else if (focusedRow === undefined) {
      this.close();
    }
  }

  private tap(target: Target): void {
    switch (target.kind) {
      case "close":
        this.close();
        return;
      case "install":
        this.install();
        return;
      case "stepsClose":
        this.closeSteps();
        return;
      case "switch":
        this.flip(target.key);
    }
  }

  // The browser's install prompt, asked for while the tap still counts as the player's
  // gesture, or the steps for the browser's own menu.
  private install(): void {
    this.pressed = undefined;
    this.render();
    void installApp().then((outcome) => {
      const browser = menuBrowser();
      if (outcome === "menuSteps" && browser !== undefined && this.scene.isActive()) {
        this.openSteps(browser);
      }
    });
  }

  private openSteps(browser: MenuInstallBrowser): void {
    const lines = stepsLines(this, gameData.menuText.settings.installSteps[browser].steps);
    this.steps = { ...installStepsLayout(SCREEN_CONFIG, lines), browser };
    this.render();
  }

  private closeSteps(): void {
    this.steps = undefined;
    this.pressed = undefined;
    this.render();
  }

  // The back button and a tap outside the open card close the steps' card first.
  private back(): void {
    if (this.steps === undefined) {
      this.close();
    } else {
      this.closeSteps();
    }
  }

  private rowIndex(key: Row["key"]): number {
    return this.rows.findIndex((row) => row.key === key);
  }

  private rowRect(index: number): Rect {
    return itemAt(this.layout.rows, index).rect;
  }

  private targetAt(x: number, y: number): Target | undefined {
    if (this.steps !== undefined) {
      return containsPoint(this.steps.close.hit, x, y) ? { kind: "stepsClose" } : undefined;
    }
    if (containsPoint(this.layout.close.hit, x, y)) {
      return { kind: "close" };
    }
    const row = this.rows.find((_, i) => containsPoint(this.rowRect(i), x, y));
    if (row?.kind === "switch") {
      return { key: row.key, kind: "switch" };
    }
    return row?.kind === "button" ? { kind: "install" } : undefined;
  }

  // A key presses the switch row: it dips, then flips.
  private flipAfterDip(key: SwitchKey): void {
    this.pressed = { key, kind: "switch" };
    this.render();
    this.time.delayedCall(FEEDBACK.pressDipMs, () => this.flip(key));
  }

  private flip(key: SwitchKey): void {
    this.pressed = undefined;
    const settings = currentSettings(this);
    this.change({ ...settings, [key]: !settings[key] });
  }

  private slideTo(x: number): void {
    const key = this.dragging;
    if (key === undefined) {
      return;
    }
    const settings = currentSettings(this);
    const steps = volumeStepAt(this.layout.track, x);
    if (steps !== volumeSteps(settings[key])) {
      this.change(setVolumeSteps(key, steps, settings));
    }
  }

  private change(settings: Settings): void {
    void setSettings(this, settings);
    this.render();
  }

  private close(): void {
    closeOverlay(this.resumeKey, this);
    this.game.events.emit(SETTINGS_CLOSED_EVENT);
  }

  private render(): void {
    clearScene(this, this.dimmed);
    const settings = currentSettings(this);
    const { band, close, panel } = this.layout;
    // The card and its title band.
    addDetailCard(this, this.add.container(0, 0), panel, band);
    addCardTitle(this, panel, gameData.menuText.settings.title);
    const rows = this.add.container(0, 0);
    for (const row of this.rows) {
      if (hasNote(row)) {
        this.drawNotedRow(rows, row, settings);
      } else {
        this.drawSlider(row, settings);
      }
    }
    // Over the rows, since a switch row's face covers its top row.
    const separators = this.add.graphics();
    this.layout.separators.forEach((rect) => fillRect(separators, PALETTE.tan, rect));
    addCloseButton(this, this.add.container(0, 0), close, this.pressed?.kind === "close");
    if (this.focus !== null && this.steps === undefined) {
      const focused =
        this.focus.row < this.rows.length ? this.rowRect(this.focus.row) : closeFace(close);
      drawFocusRing(this.add.graphics(), FOCUS_OUTSET, focused);
    }
    if (this.steps !== undefined) {
      this.drawSteps(this.steps);
    }
  }

  // The install steps' card over the dimmed settings: its title in the band, its close control,
  // and the browser's button glyph and steps under the band, the glyph left out while missing.
  private drawSteps(steps: OpenSteps): void {
    const words = gameData.menuText.settings.installSteps[steps.browser];
    const icon = STEPS_ICONS[steps.browser];
    addDim(this, SCREEN_LAYOUT.screen);
    addDetailCard(this, this.add.container(0, 0), steps.card, steps.band);
    addCardTitle(this, steps.card, words.title);
    if (this.textures.exists(icon)) {
      this.add.image(steps.icon.x, steps.icon.y, icon).setOrigin(0);
    }
    const text = addBodyText(this, undefined, steps.steps, words.steps);
    fitPixelText(text, INSTALL_STEPS_FIT, steps.steps.x, steps.steps.y);
    addCloseButton(
      this,
      this.add.container(0, 0),
      steps.close,
      this.pressed?.kind === "stepsClose",
    );
  }

  // A switch or install row: a normal row that dips while pressed, with its icon, label and note,
  // and its switch or button. A switch row shows its setting in its icon and switch. The note
  // wraps in its room, as rowShapes measured it.
  private drawNotedRow(parent: GameObjects.Container, row: NotedRow, settings: Settings): void {
    const index = this.rowIndex(row.key);
    const { control, noteY, rect } = itemAt(this.layout.rows, index);
    const on = row.kind === "button" || switchOn(row.key, settings);
    const tile = addSelectTile(this, parent, rect, {
      edge: false,
      reducedMotion: settings.reducedMotion,
      state: "normal",
      tile: false,
    });
    const pressed =
      row.kind === "button"
        ? this.pressed?.kind === "install"
        : this.pressed?.kind === "switch" && this.pressed.key === row.key;
    if (pressed) {
      tile.container.y += FEEDBACK.pressDipPx;
    }
    const { x, y } = rect;
    const icon = addTagImage(this, row.icon, on ? "on" : "off", x + ICON.dx, y + ICON.dy);
    const words = gameData.menuText.settings;
    const label = addPixelText(this, x + LABEL.dx, y + LABEL.dy, words[row.label], {
      colour: PALETTE[tile.look.text],
      font: "title",
      scale: TEXT_SCALE,
    });
    const noteAt = { x: x + NOTE.dx, y: noteY ?? y };
    const note = addPixelText(this, noteAt.x, noteAt.y, words[row.note], {
      colour: PALETTE.darkBrown,
      scale: TEXT_SCALE,
    });
    tile.content.add(icon === undefined ? [label, note] : [icon, label, note]);
    fitPixelText(
      note,
      { room: noteRoom(row.kind), style: SETTINGS_NOTE_STYLE },
      noteAt.x,
      noteAt.y,
    );
    if (control === null) {
      return;
    }
    if (row.kind === "button") {
      addMenuButton(
        this,
        control,
        words[row.button],
        { available: true, primary: false, secondary: true },
        tile.content,
      );
      return;
    }
    const image = addTagImage(this, "ui-switch", on ? "on" : "off", control.x, control.y);
    if (image !== undefined) {
      tile.content.add(image);
      return;
    }
    const g = this.add.graphics();
    fillRect(g, on ? PALETTE.forest : PALETTE.slate, control);
    tile.content.add(g);
  }

  // A volume slider: drag along the row to set it. Muted, it is disabled and reads "Muted".
  private drawSlider(row: Extract<Row, { kind: "slider" }>, settings: Settings): void {
    const { key } = row;
    const { x, y } = this.rowRect(this.rowIndex(key));
    const { track: slider } = this.layout;
    const active = tileState({ ...PLAIN_ITEM, available: !settings.muted }) !== "disabled";
    const steps = volumeSteps(settings[key]);
    const ink = active ? PALETTE.plum : PALETTE[GREYED.text];
    addTagImage(this, row.icon, active && steps > 0 ? "on" : "off", x + ICON.dx, y + ICON.dy);
    const words = gameData.menuText.settings;
    const label = { colour: ink, font: "title", scale: TEXT_SCALE } as const;
    addPixelText(this, x + LABEL.dx, y + LABEL.dy, words[row.label], label);
    addPixelText(
      this,
      slider.x + slider.width,
      y + LABEL.dy,
      active
        ? fillLine(MENU_TEXT_FIELDS.settings, words, "volume", {
            percent: String(volumePercent(steps)),
          })
        : words.muted,
      { ...label, originX: 1 },
    );
    const track: Rect = {
      height: slider.height,
      width: slider.width,
      x: slider.x,
      y: y + slider.dy,
    };
    const kx = knobX(slider, steps);
    const knobTag = !active ? "disabled" : this.dragging === key ? "pressed" : "normal";
    if (this.textures.exists("ui-slider") && this.textures.exists("ui-slider-knob")) {
      const suffix = active ? "" : "-disabled";
      addNineSlice(this, "ui-slider", track, `empty${suffix}`);
      addNineSlice(
        this,
        "ui-slider",
        { ...track, width: kx + slider.knobWidth - track.x },
        `filled${suffix}`,
      );
      addTagImage(this, "ui-slider-knob", knobTag, kx, track.y - 3);
      return;
    }
    this.drawSliderFallback(track, steps, active);
  }

  // The slider in code while ui-slider or ui-slider-knob is missing.
  private drawSliderFallback(track: Rect, steps: number, active: boolean): void {
    const g = this.add.graphics();
    fillRect(g, active ? PALETTE.plum : PALETTE.neutralGrey, track);
    const inner = insetRect(1, track);
    fillRect(g, active ? PALETTE.tan : PALETTE.neutralLightGrey, inner);
    fillRect(g, active ? PALETTE.forest : PALETTE.neutralGrey, {
      ...inner,
      width: Math.round((inner.width * steps) / VOLUME_STEPS),
    });
    const kx = knobX(this.layout.track, steps);
    const top = track.y - 3;
    fillRect(g, active ? PALETTE.plum : PALETTE.neutralGrey, {
      height: KNOB_HEIGHT,
      width: this.layout.track.knobWidth,
      x: kx,
      y: top,
    });
    fillRect(g, active ? PALETTE.cream : PALETTE.neutralLightGrey, {
      height: KNOB_HEIGHT - 2,
      width: this.layout.track.knobWidth - 2,
      x: kx + 1,
      y: top + 1,
    });
    fillRect(g, active ? PALETTE.tan : PALETTE.neutralGrey, {
      height: 2,
      width: this.layout.track.knobWidth - 2,
      x: kx + 1,
      y: top + 13,
    });
    fillRect(g, active ? PALETTE.tan : PALETTE.neutralGrey, {
      height: 7,
      width: 2,
      x: kx + 4,
      y: top + 4,
    });
  }
}
