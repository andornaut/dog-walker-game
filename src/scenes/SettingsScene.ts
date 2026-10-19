import { type Input, Scene } from "phaser";

import { SCREEN_CONFIG } from "../data/screen";
import { wrapWords } from "../home/home";
import { stepVolume, VOLUME_STEPS, type VolumeKey, volumeSteps } from "../home/settings";
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
import { addMenuButton, addPanel, addTagImage, type ButtonState, TEXT_SCALE } from "./uiKit";

// The caller pauses itself and launches settings; settings resumes it on close.
export interface SettingsSceneData {
  resume?: SceneKey;
}

// Emitted on game.events when settings close.
export const SETTINGS_CLOSED_EVENT = "settings-closed";

type Target =
  | { direction: -1 | 1; key: VolumeKey; kind: "volume" }
  | { kind: "close" }
  | { kind: "motion" }
  | { kind: "sound" };

// Every control is at least 44 game pixels on each side, with 8 or more between them.
const BUTTON = 44;
const PANEL: Rect = { height: 400, width: 344, x: 8, y: 56 };
const LEFT = 24;
const SOUND_ROW: Rect = { height: BUTTON, width: 328, x: 16, y: 68 };
const SWITCH = { height: 16, width: 32 };
const VOLUME_ROWS: readonly { icon: string; key: VolumeKey; label: string; y: number }[] = [
  { icon: "icon-music", key: "musicVolume", label: "Music", y: 132 },
  { icon: "icon-sound", key: "sfxVolume", label: "Effects", y: 192 },
];
const STEP_X = { down: 120, up: 292 };
const BAR = { gap: 2, height: 12, segment: 10, x: 170 };
const MOTION_BUTTON: Rect = { height: BUTTON, width: 100, x: 236, y: 252 };
const NOTE = { chars: 44, lineHeight: 16, y: 310 };
const DONE_BUTTON: Rect = { height: BUTTON, width: 200, x: 80, y: 396 };

function stepRect(direction: -1 | 1, y: number): Rect {
  return { height: BUTTON, width: BUTTON, x: direction < 0 ? STEP_X.down : STEP_X.up, y };
}

function sameTarget(a: Target | undefined, b: Target | undefined): boolean {
  return a !== undefined && b !== undefined && JSON.stringify(a) === JSON.stringify(b);
}

// Sound on or off, music and effects volume, and reduced motion, reachable from the home
// screen and the pause menu. Every change is saved and applied at once.
export class SettingsScene extends Scene {
  private pressed: Target | undefined;
  private resumeKey: SceneKey | undefined;

  constructor() {
    super(SCENE_KEYS.settings);
  }

  create(data?: SettingsSceneData): void {
    this.resumeKey = data?.resume;
    this.pressed = undefined;
    this.render();

    this.input.on("pointerdown", (pointer: Input.Pointer) => {
      this.pressed = this.targetAt(pointer.x, pointer.y);
      this.render();
    });
    this.input.on("pointerup", (pointer: Input.Pointer) => {
      const target = this.targetAt(pointer.x, pointer.y);
      const pressed = this.pressed;
      this.pressed = undefined;
      if (target !== undefined && sameTarget(target, pressed)) {
        this.act(target);
      } else {
        this.render();
      }
    });
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (isPauseKey(event.key) || isConfirmKey(event.key)) {
        this.close();
      } else if (isMuteKey(event.key)) {
        this.act({ kind: "sound" });
      }
    });
    const onBack = () => this.close();
    window.addEventListener(PHONE_EVENTS.backPressed, onBack);
    this.events.once("shutdown", () =>
      window.removeEventListener(PHONE_EVENTS.backPressed, onBack),
    );
  }

  private targetAt(x: number, y: number): Target | undefined {
    for (const row of VOLUME_ROWS) {
      for (const direction of [-1, 1] as const) {
        if (containsPoint(stepRect(direction, row.y), x, y)) {
          return { direction, key: row.key, kind: "volume" };
        }
      }
    }
    const fixed: readonly [Rect, Target][] = [
      [SOUND_ROW, { kind: "sound" }],
      [MOTION_BUTTON, { kind: "motion" }],
      [DONE_BUTTON, { kind: "close" }],
    ];
    return fixed.find(([rect]) => containsPoint(rect, x, y))?.[1];
  }

  private act(target: Target): void {
    const settings = currentSettings(this);
    switch (target.kind) {
      case "close":
        this.close();
        return;
      case "motion":
        this.change({ ...settings, reducedMotion: !settings.reducedMotion });
        return;
      case "sound":
        this.change({ ...settings, muted: !settings.muted });
        return;
      case "volume":
        this.change(stepVolume(target.key, target.direction, settings));
        // A sample at the new level, so the player hears what they picked.
        if (target.key === "sfxVolume") {
          soundboardOf(this).play("tip");
        }
        return;
      default:
        target satisfies never;
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

  private buttonState(target: Target): ButtonState {
    return sameTarget(this.pressed, target) ? "pressed" : "normal";
  }

  private label(x: number, y: number, text: string, font: "body" | "title" = "title"): void {
    addPixelText(this, x, y, text, { color: PALETTE.plum, font, scale: TEXT_SCALE });
  }

  private render(): void {
    this.children.removeAll(true);
    const settings = currentSettings(this);
    const g = this.add.graphics();
    fillRect(g, PALETTE.darkBrown, {
      height: SCREEN_CONFIG.height,
      width: SCREEN_CONFIG.width,
      x: 0,
      y: 0,
    });
    fillRect(g, PALETTE.plum, { height: 40, width: SCREEN_CONFIG.width, x: 0, y: 0 });
    addPixelText(this, 16, 12, "Settings", {
      color: PALETTE.cream,
      font: "title",
      scale: TEXT_SCALE,
    });
    addPanel(this, PANEL);

    // The whole Sound row is the switch's tap target; a press darkens it.
    if (this.buttonState({ kind: "sound" }) === "pressed") {
      fillRect(this.add.graphics(), PALETTE.tan, SOUND_ROW);
    }
    this.label(LEFT, SOUND_ROW.y + 16, "Sound");
    const switchX = SOUND_ROW.x + SOUND_ROW.width - SWITCH.width - 8;
    const switchY = SOUND_ROW.y + (SOUND_ROW.height - SWITCH.height) / 2;
    const tag = settings.muted ? "off" : "on";
    if (addTagImage(this, "ui-switch", tag, switchX, switchY) === undefined) {
      addPixelText(this, switchX + SWITCH.width, SOUND_ROW.y + 16, settings.muted ? "Off" : "On", {
        color: PALETTE.plum,
        font: "title",
        originX: 1,
        scale: TEXT_SCALE,
      });
    }

    for (const row of VOLUME_ROWS) {
      const steps = volumeSteps(settings[row.key]);
      const audible = steps > 0 && !settings.muted;
      // The icons are drawn for a dark button face, so they sit on a plum tile here.
      fillRect(this.add.graphics(), PALETTE.plum, {
        height: 20,
        width: 20,
        x: LEFT - 2,
        y: row.y + 2,
      });
      addTagImage(this, row.icon, audible ? "on" : "off", LEFT, row.y + 4);
      this.label(LEFT + 24, row.y + 8, row.label, "body");
      this.label(LEFT, row.y + 26, `${steps * 10}%`, "body");
      for (const direction of [-1, 1] as const) {
        const limit = direction < 0 ? steps === 0 : steps === VOLUME_STEPS;
        const target: Target = { direction, key: row.key, kind: "volume" };
        addMenuButton(this, stepRect(direction, row.y), direction < 0 ? "-" : "+").setState(
          limit ? "disabled" : this.buttonState(target),
        );
      }
      const bars = this.add.graphics();
      for (let i = 0; i < VOLUME_STEPS; i++) {
        const segment: Rect = {
          height: BAR.height,
          width: BAR.segment,
          x: BAR.x + i * (BAR.segment + BAR.gap),
          y: row.y + (BUTTON - BAR.height) / 2 - 2,
        };
        // Filled steps are solid and empty ones hollow, so the level never relies on colour.
        fillRect(bars, PALETTE.plum, segment);
        if (i >= steps) {
          fillRect(bars, PALETTE.cream, {
            height: segment.height - 2,
            width: segment.width - 2,
            x: segment.x + 1,
            y: segment.y + 1,
          });
        }
      }
    }

    this.label(LEFT, MOTION_BUTTON.y + 6, "Reduced");
    this.label(LEFT, MOTION_BUTTON.y + 24, "motion");
    addMenuButton(this, MOTION_BUTTON, settings.reducedMotion ? "On" : "Off").setState(
      this.buttonState({ kind: "motion" }),
    );
    const note = "Reduced motion keeps every highlight and skips the movement.";
    wrapWords(NOTE.chars, note).forEach((line, i) =>
      this.label(LEFT, NOTE.y + i * NOTE.lineHeight, line, "body"),
    );
    addMenuButton(this, DONE_BUTTON, "Done").setState(this.buttonState({ kind: "close" }));
  }
}
