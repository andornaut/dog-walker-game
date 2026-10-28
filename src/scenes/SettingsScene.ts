import { type GameObjects, Scene } from "phaser";

import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import type { MenuText } from "../data/types";
import { FEEDBACK } from "../home/feedback";
import { type Focus, focusDirectionForKey, moveFocus } from "../home/focus";
import { MENU_TEXT_FIELDS } from "../home/menuText";
import {
  knobX,
  SETTINGS_ROW,
  type SettingsLayout,
  settingsLayout,
  setVolumeSteps,
  SWITCH_NOTE_FIT,
  VOLUME_STEPS,
  type VolumeKey,
  volumePercent,
  volumeStepAt,
  volumeStepForKey,
  volumeSteps,
} from "../home/settings";
import { isConfirmKey, isMuteKey, isPauseKey, menuKeyActs } from "../input/keyBindings";
import { itemAt } from "../lib/arrays";
import { fillLine } from "../lib/lines";
import { containsPoint, insetRect, type Rect } from "../lib/rect";
import type { Settings } from "../save/schema";
import { closeFace } from "../ui/closeControl";
import { PLAIN_ITEM, tileState } from "../ui/interaction";
import { drawFocusRing, fillRect } from "../ui/phaser/draw";
import { PALETTE } from "../ui/phaser/palette";
import { addPixelText, fitPixelTextsAlike, type LabelToFit } from "../ui/phaser/pixelText";
import { GREYED } from "../ui/selection";
import { TEXT_SCALE } from "../ui/textFit";
import { addDetailCard } from "./homePanels";
import { listenOnePress } from "./onePress";
import { closeOverlay, listenDismiss, type OverlayData } from "./overlay";
import { currentSettings, setSettings } from "./profileStore";
import { SCENE_KEYS, type SceneKey } from "./sceneKeys";
import { soundboardOf } from "./soundboard";
import { listenTargetPress } from "./targetPress";
import {
  addCloseButton,
  addNineSlice,
  addScreenBackdrop,
  addSelectTile,
  addTagImage,
  addTapBurst,
  clearScene,
} from "./uiKit";

// Emitted on game.events when settings close.
export const SETTINGS_CLOSED_EVENT = "settings-closed";

type SwitchKey = "muted" | "reducedMotion";
type SettingsWord = Exclude<keyof MenuText["settings"], "volume">;

// Each row carries a 16x16 -panel icon with on and off tags, and the menuText.settings keys
// of its label and note.
type Row =
  | { icon: string; key: SwitchKey; kind: "switch"; label: SettingsWord; note: SettingsWord }
  | { icon: string; key: VolumeKey; kind: "slider"; label: SettingsWord };

type Target = { kind: "close" } | { key: SwitchKey; kind: "switch" };

function sameTarget(a: Target, b: Target): boolean {
  return a.kind === "close" ? b.kind === "close" : b.kind === "switch" && a.key === b.key;
}

// Four rows, each its own tap target, and the close control.
const ROWS: readonly Row[] = [
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
const ROW_KINDS = ROWS.map((row) => row.kind);
const ICON_DX = 6;
const { labelDx: LABEL_DX } = SETTINGS_ROW;
const SWITCH_ROW = SETTINGS_ROW.switch;
const SWITCH = SWITCH_ROW.switch;
const KNOB_HEIGHT = 16;
// The keyboard moves through the rows, then the close control, one per focus row.
const FOCUS_ROW_LENGTHS: readonly number[] = [...ROWS.map(() => 1), 1];
// The ring stays inside the panel's 8px margin.
const FOCUS_OUTSET = 3;

function rowIndex(key: SwitchKey | VolumeKey): number {
  return ROWS.findIndex((row) => row.key === key);
}

// A switch is on when its setting is: sound is on while not muted.
function switchOn(key: SwitchKey, settings: Settings): boolean {
  return key === "muted" ? !settings.muted : settings.reducedMotion;
}

// Sound on or off, music and effects volume, and reduced motion, reachable from the home
// screen and the pause menu. Every change is saved and applied at once. A switch row is
// normal and shows its setting in its switch; a tap dips the row, then flips it. Up and Down
// move the keyboard's focus through the rows and the close control; Enter or Space presses
// the focused row, and on a slider the left and right keys, Home and End set the volume.
export class SettingsScene extends Scene {
  private dragging: VolumeKey | undefined;
  private focus: Focus | null = null;
  private layout: SettingsLayout = settingsLayout(SCREEN_CONFIG, ROW_KINDS);
  private pressed: Target | undefined;
  private resumeKey: SceneKey | undefined;

  constructor() {
    super(SCENE_KEYS.settings);
  }

  create(data?: OverlayData): void {
    this.resumeKey = data?.resume;
    this.layout = settingsLayout(SCREEN_CONFIG, ROW_KINDS);
    this.dragging = undefined;
    this.focus = null;
    this.pressed = undefined;
    this.render();

    // The close control and the switch rows; a switch dips, then flips.
    listenTargetPress<Target>(this, {
      dipMs: (target) => (target.kind === "switch" ? FEEDBACK.pressDipMs : 0),
      onPressed: (target) => {
        this.pressed = target;
        this.render();
      },
      onTap: (target) => {
        if (target.kind === "close") {
          this.close();
        } else {
          this.flip(target.key);
        }
      },
      same: sameTarget,
      targetAt: (x, y) => this.targetAt(x, y),
    });
    // The sliders, dragged from a press on their row; every press bursts where it lands.
    listenOnePress(this, {
      down: (pointer) => {
        const row = ROWS.find((_, i) => containsPoint(this.rowRect(i), pointer.x, pointer.y));
        if (row?.kind === "slider" && !currentSettings(this).muted) {
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
    // The screen around the card closes, as the close control in its band does.
    listenDismiss(this, [this.layout.panel], () => this.close());
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (menuKeyActs(event.repeat, event.key)) {
        this.onKey(event.key);
      }
    });
  }

  private onKey(key: string): void {
    const focusedRow = this.focus === null ? undefined : ROWS[this.focus.row];
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
      this.focus = moveFocus(FOCUS_ROW_LENGTHS, direction, this.focus);
      this.render();
    } else if (isPauseKey(key)) {
      this.close();
    } else if (isConfirmKey(key)) {
      this.confirm(focusedRow);
    } else if (isMuteKey(key)) {
      this.flipAfterDip("muted");
    }
  }

  // Enter or Space flips a focused switch, and closes from the close control or with nothing
  // focused.
  private confirm(focusedRow: Row | undefined): void {
    if (focusedRow?.kind === "switch") {
      this.flipAfterDip(focusedRow.key);
    } else if (focusedRow === undefined) {
      this.close();
    }
  }

  private rowRect(index: number): Rect {
    return itemAt(this.layout.rows, index);
  }

  private targetAt(x: number, y: number): Target | undefined {
    if (containsPoint(this.layout.close.hit, x, y)) {
      return { kind: "close" };
    }
    const row = ROWS.find((_, i) => containsPoint(this.rowRect(i), x, y));
    return row?.kind === "switch" ? { key: row.key, kind: "switch" } : undefined;
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
    clearScene(this);
    const settings = currentSettings(this);
    const { band, close, panel, title } = this.layout;
    addScreenBackdrop(this);
    // The card and its title band.
    addDetailCard(this, this.add.container(0, 0), panel, band);
    addPixelText(this, title.x, title.y, gameData.menuText.settings.title, {
      colour: PALETTE.white,
      font: "title",
      originX: 0.5,
      scale: TEXT_SCALE,
    });
    const rows = this.add.container(0, 0);
    const notes: LabelToFit[] = [];
    for (const row of ROWS) {
      if (row.kind === "switch") {
        notes.push(this.drawSwitchRow(rows, row, settings));
      } else {
        this.drawSlider(row, settings);
      }
    }
    // Every switch row's note at the largest size that fits them all.
    fitPixelTextsAlike(SWITCH_NOTE_FIT.styles, notes);
    // Over the rows, since a switch row's face covers its top row.
    const separators = this.add.graphics();
    this.layout.separators.forEach((rect) => fillRect(separators, PALETTE.tan, rect));
    addCloseButton(this, this.add.container(0, 0), close, this.pressed?.kind === "close");
    if (this.focus !== null) {
      const focused =
        this.focus.row < ROWS.length ? this.rowRect(this.focus.row) : closeFace(close);
      drawFocusRing(this.add.graphics(), FOCUS_OUTSET, focused);
    }
  }

  // A switch row, its note left for render to fit with the others'. Returns the note.
  private drawSwitchRow(
    parent: GameObjects.Container,
    row: Extract<Row, { kind: "switch" }>,
    settings: Settings,
  ): LabelToFit {
    const rect = this.rowRect(rowIndex(row.key));
    const on = switchOn(row.key, settings);
    // The row is normal; whether it is on shows in its switch.
    const tile = addSelectTile(this, parent, rect, {
      edge: false,
      reducedMotion: settings.reducedMotion,
      state: "normal",
      tile: false,
    });
    if (this.pressed?.kind === "switch" && this.pressed.key === row.key) {
      tile.container.y += FEEDBACK.pressDipPx;
    }
    const { x, y } = rect;
    const icon = addTagImage(this, row.icon, on ? "on" : "off", x + ICON_DX, y + SWITCH_ROW.iconDy);
    const words = gameData.menuText.settings;
    const label = addPixelText(this, x + LABEL_DX, y + SWITCH_ROW.labelDy, words[row.label], {
      colour: PALETTE[tile.look.text],
      font: "title",
      scale: TEXT_SCALE,
    });
    const noteAt = { x: x + LABEL_DX, y: y + SWITCH_ROW.noteDy };
    const note = addPixelText(this, noteAt.x, noteAt.y, words[row.note], {
      colour: PALETTE.darkBrown,
      scale: SWITCH_ROW.scale,
    });
    const noteFit = { label: note, room: SWITCH_NOTE_FIT.room, ...noteAt };
    tile.content.add(icon === undefined ? [label, note] : [icon, label, note]);
    const switchX = x + SWITCH.dx;
    const switchY = y + SWITCH.dy;
    const image = addTagImage(this, "ui-switch", on ? "on" : "off", switchX, switchY);
    if (image !== undefined) {
      tile.content.add(image);
      return noteFit;
    }
    const g = this.add.graphics();
    fillRect(g, on ? PALETTE.forest : PALETTE.slate, {
      height: SWITCH.height,
      width: SWITCH.width,
      x: switchX,
      y: switchY,
    });
    tile.content.add(g);
    return noteFit;
  }

  // A volume slider: drag along the row to set it. Muted, it is disabled and reads "Muted".
  private drawSlider(row: Extract<Row, { kind: "slider" }>, settings: Settings): void {
    const { key } = row;
    const { x, y } = this.rowRect(rowIndex(key));
    const { track: slider } = this.layout;
    const active = tileState({ ...PLAIN_ITEM, available: !settings.muted }) !== "disabled";
    const steps = volumeSteps(settings[key]);
    const ink = active ? PALETTE.plum : PALETTE[GREYED.text];
    const { iconDy, labelDy } = SETTINGS_ROW.slider;
    addTagImage(this, row.icon, active && steps > 0 ? "on" : "off", x + ICON_DX, y + iconDy);
    const words = gameData.menuText.settings;
    const label = { colour: ink, font: "title", scale: TEXT_SCALE } as const;
    addPixelText(this, x + LABEL_DX, y + labelDy, words[row.label], label);
    addPixelText(
      this,
      slider.x + slider.width,
      y + labelDy,
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
