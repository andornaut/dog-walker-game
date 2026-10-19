import { type GameObjects, type Input, Scene } from "phaser";

import { SCREEN_CONFIG } from "../data/screen";
import { FEEDBACK, settleDelay } from "../home/feedback";
import {
  knobX,
  setVolumeSteps,
  type SliderTrack,
  VOLUME_STEPS,
  type VolumeKey,
  volumeStepAt,
  volumeSteps,
} from "../home/settings";
import { isConfirmKey, isMuteKey, isPauseKey } from "../input/keyBindings";
import { containsPoint, type Rect } from "../layout/rect";
import { PHONE_EVENTS } from "../pwa";
import type { Settings } from "../save/schema";
import { fillRect } from "./draw";
import { PALETTE } from "./palette";
import { addPixelText } from "./pixelText";
import { currentSettings, setSettings } from "./profileStore";
import { SCENE_KEYS, type SceneKey } from "./sceneKeys";
import { soundboardOf } from "./soundboard";
import {
  addMenuButton,
  addNineSlice,
  addPanel,
  addSelectTile,
  addTagImage,
  addTapBurst,
  clearScene,
  TEXT_SCALE,
} from "./uiKit";

// The caller pauses itself and launches settings; settings resumes it on close.
export interface SettingsSceneData {
  resume?: SceneKey;
}

// Emitted on game.events when settings close.
export const SETTINGS_CLOSED_EVENT = "settings-closed";

type SwitchKey = "muted" | "reducedMotion";

// Each row carries a 16x16 -panel icon with on and off tags.
type Row =
  | { icon: string; key: SwitchKey; kind: "switch"; label: string; note: string }
  | { icon: string; key: VolumeKey; kind: "slider"; label: string };

type Target = { kind: "close" } | { key: SwitchKey; kind: "switch" };

// The layout of the menus mock, centred over the run's road: four rows 44 tall, each its own
// tap target, and Back.
const PANEL: Rect = { height: 276, width: 248, x: 96, y: 277 };
const TITLE = { x: 220, y: 293 };
const ROW = { height: 44, width: 232, x: 104, y: 315 };
const ROWS: readonly Row[] = [
  {
    icon: "icon-sound-panel",
    key: "muted",
    kind: "switch",
    label: "Sound",
    note: "Mutes music and effects",
  },
  { icon: "icon-music-panel", key: "musicVolume", kind: "slider", label: "Music" },
  { icon: "icon-effects-panel", key: "sfxVolume", kind: "slider", label: "Effects" },
  {
    icon: "icon-motion-panel",
    key: "reducedMotion",
    kind: "switch",
    label: "Reduced motion",
    note: "Skips shakes, hops and bobs",
  },
];
// From a row's top-left: the icon, at the switch row's or the slider row's height, and the
// label beside it.
const ICON = { dx: 6, dySlider: 4, dySwitch: 14 };
const LABEL_DX = 26;
const SWITCH = { dx: 188, dy: 14, height: 16, width: 32 };
const TRACK: SliderTrack & { dy: number; height: number } = {
  dy: 24,
  height: 10,
  knobWidth: 10,
  width: 216,
  x: 112,
};
const KNOB_HEIGHT = 16;
const BACK_BUTTON: Rect = { height: 40, width: 200, x: 120, y: 499 };

function rowRect(index: number): Rect {
  return { ...ROW, y: ROW.y + index * ROW.height };
}

function rowIndex(key: SwitchKey | VolumeKey): number {
  return ROWS.findIndex((row) => row.key === key);
}

// A switch is on when its setting is: sound is on while not muted.
function switchOn(key: SwitchKey, settings: Settings): boolean {
  return key === "muted" ? !settings.muted : settings.reducedMotion;
}

// Sound on or off, music and effects volume, and reduced motion, reachable from the home
// screen and the pause menu. Every change is saved and applied at once. A switch row that is
// on shows the selected state; a tap dips the row, then flips it.
export class SettingsScene extends Scene {
  private dragging: VolumeKey | undefined;
  private pressed: Target | undefined;
  private resumeKey: SceneKey | undefined;

  constructor() {
    super(SCENE_KEYS.settings);
  }

  create(data?: SettingsSceneData): void {
    this.resumeKey = data?.resume;
    this.dragging = undefined;
    this.pressed = undefined;
    this.render();

    let pressedAt = 0;
    this.input.on("pointerdown", (pointer: Input.Pointer) => {
      const row = ROWS.find((_, i) => containsPoint(rowRect(i), pointer.x, pointer.y));
      if (row?.kind === "slider") {
        if (!currentSettings(this).muted) {
          this.dragging = row.key;
          this.slideTo(pointer.x);
          // The knob shows pressed while held.
          this.render();
        }
      } else {
        this.pressed = this.targetAt(pointer.x, pointer.y);
        pressedAt = this.time.now;
        this.render();
      }
      addTapBurst(this, pointer.x, pointer.y);
    });
    this.input.on("pointermove", (pointer: Input.Pointer) => {
      if (this.dragging !== undefined) {
        this.slideTo(pointer.x);
      }
    });
    this.input.on("pointerup", (pointer: Input.Pointer) => {
      if (this.dragging !== undefined) {
        // A sample at the new level, so the player hears what they picked.
        if (this.dragging === "sfxVolume") {
          soundboardOf(this).play("tip");
        }
        this.dragging = undefined;
        this.render();
        return;
      }
      const target = this.targetAt(pointer.x, pointer.y);
      const pressed = this.pressed;
      if (target?.kind === "close" && pressed?.kind === "close") {
        this.close();
      } else if (
        target?.kind === "switch" &&
        pressed?.kind === "switch" &&
        target.key === pressed.key
      ) {
        this.flipAfter(target.key, settleDelay(this.time.now, pressedAt));
      } else {
        this.pressed = undefined;
        this.render();
      }
    });
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (isPauseKey(event.key) || isConfirmKey(event.key)) {
        this.close();
      } else if (isMuteKey(event.key)) {
        this.pressed = { key: "muted", kind: "switch" };
        this.render();
        this.flipAfter("muted", FEEDBACK.pressDipMs);
      }
    });
    const onBack = () => this.close();
    window.addEventListener(PHONE_EVENTS.backPressed, onBack);
    this.events.once("shutdown", () =>
      window.removeEventListener(PHONE_EVENTS.backPressed, onBack),
    );
  }

  private targetAt(x: number, y: number): Target | undefined {
    if (containsPoint(BACK_BUTTON, x, y)) {
      return { kind: "close" };
    }
    const row = ROWS.find((_, i) => containsPoint(rowRect(i), x, y));
    return row?.kind === "switch" ? { key: row.key, kind: "switch" } : undefined;
  }

  // The pressed switch row stays dipped for delayMs, then flips.
  private flipAfter(key: SwitchKey, delayMs: number): void {
    this.time.delayedCall(delayMs, () => {
      this.pressed = undefined;
      const settings = currentSettings(this);
      this.change({ ...settings, [key]: !settings[key] });
    });
  }

  private slideTo(x: number): void {
    const key = this.dragging;
    if (key === undefined) {
      return;
    }
    const settings = currentSettings(this);
    const steps = volumeStepAt(TRACK, x);
    if (steps !== volumeSteps(settings[key])) {
      this.change(setVolumeSteps(key, steps, settings));
    }
  }

  private change(settings: Settings): void {
    void setSettings(this, settings);
    this.render();
  }

  private close(): void {
    if (this.resumeKey !== undefined) {
      this.scene.resume(this.resumeKey);
    }
    this.game.events.emit(SETTINGS_CLOSED_EVENT);
    this.scene.stop();
  }

  private render(): void {
    clearScene(this);
    const settings = currentSettings(this);
    const g = this.add.graphics();
    fillRect(g, PALETTE.darkBrown, {
      height: SCREEN_CONFIG.height,
      width: SCREEN_CONFIG.width,
      x: 0,
      y: 0,
    });
    // A 1px tan rim keeps the panel's edge clear of what is behind it.
    fillRect(g, PALETTE.tan, {
      height: PANEL.height + 2,
      width: PANEL.width + 2,
      x: PANEL.x - 1,
      y: PANEL.y - 1,
    });
    addPanel(this, PANEL);
    addPixelText(this, TITLE.x, TITLE.y, "Settings", {
      color: PALETTE.plum,
      font: "title",
      originX: 0.5,
      scale: TEXT_SCALE,
    });
    const separators = this.add.graphics();
    ROWS.forEach((_, i) => {
      if (i > 0) {
        const rect = rowRect(i);
        fillRect(separators, PALETTE.tan, {
          height: 1,
          width: rect.width - 8,
          x: rect.x + 4,
          y: rect.y,
        });
      }
    });
    const rows = this.add.container(0, 0);
    for (const row of ROWS) {
      if (row.kind === "switch") {
        this.drawSwitchRow(rows, row, settings);
      } else {
        this.drawSlider(row, settings);
      }
    }
    addMenuButton(this, BACK_BUTTON, "Back").setState(
      this.pressed?.kind === "close" ? "pressed" : "normal",
    );
  }

  private drawSwitchRow(
    parent: GameObjects.Container,
    row: Extract<Row, { kind: "switch" }>,
    settings: Settings,
  ): void {
    const rect = rowRect(rowIndex(row.key));
    const on = switchOn(row.key, settings);
    const tile = addSelectTile(this, parent, rect, {
      badge: "tick",
      edge: false,
      full: false,
      reducedMotion: settings.reducedMotion,
      rest: "cream",
      selected: on,
    });
    if (this.pressed?.kind === "switch" && this.pressed.key === row.key) {
      tile.container.y += FEEDBACK.pressDipPx;
    }
    const { x, y } = rect;
    const icon = addTagImage(this, row.icon, on ? "on" : "off", x + ICON.dx, y + ICON.dySwitch);
    const label = addPixelText(this, x + LABEL_DX, y + 12, row.label, {
      color: PALETTE[tile.look.text],
      font: "title",
    });
    const note = addPixelText(this, x + LABEL_DX, y + 26, row.note, { color: PALETTE.darkBrown });
    tile.content.add(icon === undefined ? [label, note] : [icon, label, note]);
    const switchX = x + SWITCH.dx;
    const switchY = y + SWITCH.dy;
    const image = addTagImage(this, "ui-switch", on ? "on" : "off", switchX, switchY);
    if (image !== undefined) {
      tile.content.add(image);
      return;
    }
    const g = this.add.graphics();
    fillRect(g, on ? PALETTE.forest : PALETTE.slate, {
      height: SWITCH.height,
      width: SWITCH.width,
      x: switchX,
      y: switchY,
    });
    tile.content.add(g);
  }

  // A volume slider: drag along the row to set it. Muted, it is inactive and reads "Muted".
  private drawSlider(row: Extract<Row, { kind: "slider" }>, settings: Settings): void {
    const { key } = row;
    const { x, y } = rowRect(rowIndex(key));
    const active = !settings.muted;
    const steps = volumeSteps(settings[key]);
    const ink = active ? PALETTE.plum : PALETTE.slate;
    addTagImage(this, row.icon, active && steps > 0 ? "on" : "off", x + ICON.dx, y + ICON.dySlider);
    addPixelText(this, x + LABEL_DX, y + 9, row.label, { color: ink, font: "title" });
    addPixelText(this, TRACK.x + TRACK.width, y + 9, active ? `${steps * 10}%` : "Muted", {
      color: ink,
      font: "title",
      originX: 1,
    });
    const track: Rect = { height: TRACK.height, width: TRACK.width, x: TRACK.x, y: y + TRACK.dy };
    const kx = knobX(TRACK, steps);
    const knobTag = !active ? "disabled" : this.dragging === key ? "pressed" : "normal";
    if (this.textures.exists("ui-slider") && this.textures.exists("ui-slider-knob")) {
      const suffix = active ? "" : "-disabled";
      addNineSlice(this, "ui-slider", track, `empty${suffix}`);
      addNineSlice(
        this,
        "ui-slider",
        { ...track, width: kx + TRACK.knobWidth - track.x },
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
    fillRect(g, active ? PALETTE.plum : PALETTE.grey, track);
    const inner = {
      height: track.height - 2,
      width: track.width - 2,
      x: track.x + 1,
      y: track.y + 1,
    };
    fillRect(g, active ? PALETTE.tan : PALETTE.lightGrey, inner);
    fillRect(g, active ? PALETTE.forest : PALETTE.grey, {
      ...inner,
      width: Math.round((inner.width * steps) / VOLUME_STEPS),
    });
    const kx = knobX(TRACK, steps);
    const top = track.y - 3;
    fillRect(g, active ? PALETTE.plum : PALETTE.grey, {
      height: KNOB_HEIGHT,
      width: TRACK.knobWidth,
      x: kx,
      y: top,
    });
    fillRect(g, active ? PALETTE.cream : PALETTE.lightGrey, {
      height: KNOB_HEIGHT - 2,
      width: TRACK.knobWidth - 2,
      x: kx + 1,
      y: top + 1,
    });
    fillRect(g, active ? PALETTE.tan : PALETTE.grey, {
      height: 2,
      width: TRACK.knobWidth - 2,
      x: kx + 1,
      y: top + 13,
    });
    fillRect(g, active ? PALETTE.tan : PALETTE.grey, {
      height: 7,
      width: 2,
      x: kx + 4,
      y: top + 4,
    });
  }
}
