import { Scene } from "phaser";

import { itemAt } from "../arrays";
import { gameData } from "../data";
import { helpActionForKey, helpActionForPointer } from "../help/helpInput";
import { dotRects, HELP_LAYOUT, type Point } from "../help/helpLayout";
import { applyHelpAction, clampPage, type HelpAction, helpButtons } from "../help/helpPaging";
import { insetRect, type Rect } from "../layout/rect";
import { addFilledRect } from "./draw";
import { listenOnePress } from "./onePress";
import { colorFromHex } from "./palette";
import { addPixelText } from "./pixelText";
import { SCENE_KEYS, type SceneKey } from "./sceneKeys";

// Emitted on game.events when the help closes, by any route.
export const HELP_CLOSED_EVENT = "help-closed";

// The caller pauses itself and launches help; on close, help resumes that scene.
export interface HelpSceneData {
  resume?: SceneKey;
}

interface ButtonColors {
  face: number;
  label: string;
  lip: number;
}

// Wood palette from the art style guide (Endesga 32).
const BACKGROUND_COLOR = 0x733e39;
const BUTTON_DISABLED: ButtonColors = { face: 0x5a6988, label: "#c0cbdc", lip: 0x3a4466 };
const BUTTON_ENABLED: ButtonColors = { face: 0xfeae34, label: "#3e2731", lip: 0xf77622 };
const CLOSE_COLORS = { border: 0xe4a672, face: 0xead4aa, label: "#3e2731" };
const COUNTER_COLOR = "#ead4aa";
// The other pages' dots are hollow rings and the current one is filled, so they differ by shape.
const DOT_COLOR = 0xe4a672;
const DOT_CURRENT_COLOR = 0xffffff;
const FRAME_COLOR = 0x3e2731;
const PLACEHOLDER_COLORS = { fill: 0x262b44, label: "#c0cbdc" };
const TEXT_COLOR = "#ead4aa";
const TITLE_COLOR = "#feae34";
const TOP_BAR_COLOR = 0x3e2731;

// A full-screen overlay listed last in the game config, so it draws over every scene.
export class HelpScene extends Scene {
  private page = 0;
  private pressStart: Point | undefined;
  private resumeKey: SceneKey | undefined;

  constructor() {
    super(SCENE_KEYS.help);
  }

  create(data?: HelpSceneData): void {
    this.page = 0;
    this.pressStart = undefined;
    this.resumeKey = data?.resume;
    this.draw();

    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      const action = helpActionForKey(event.repeat, event.key);
      if (action !== undefined) {
        this.act(action);
      }
    });
    // Taps act on release, so a swipe that starts on a button turns the page instead.
    listenOnePress(this, {
      down: (pointer) => {
        this.pressStart = { x: pointer.x, y: pointer.y };
      },
      up: (pointer, cancelled) => {
        const start = this.pressStart;
        this.pressStart = undefined;
        if (start === undefined || cancelled) {
          return;
        }
        const end = { x: pointer.x, y: pointer.y };
        const action = helpActionForPointer(gameData.help.length, start, end);
        if (action !== undefined) {
          this.act(action);
        }
      },
    });
  }

  private act(action: HelpAction): void {
    const outcome = applyHelpAction(gameData.help.length, action, this.page);
    if (outcome.kind === "close") {
      this.close();
      return;
    }
    if (outcome.page !== this.page) {
      this.page = outcome.page;
      this.draw();
    }
  }

  private close(): void {
    if (this.resumeKey !== undefined) {
      this.scene.resume(this.resumeKey);
    }
    this.game.events.emit(HELP_CLOSED_EVENT);
    this.scene.stop();
  }

  // Redrawn whole on every page turn, reading the pages then, so a live text edit shows up.
  private draw(): void {
    this.children.removeAll(true);
    const pages = gameData.help;
    this.page = clampPage(pages.length, this.page);
    const page = itemAt(pages, this.page);
    const layout = HELP_LAYOUT;

    addFilledRect(this, BACKGROUND_COLOR, layout.screen);
    addFilledRect(this, TOP_BAR_COLOR, layout.topBar);
    addFilledRect(this, BACKGROUND_COLOR, {
      ...layout.topBar,
      height: layout.topBarEdge,
      y: layout.topBar.y + layout.topBar.height - layout.topBarEdge,
    });
    addPixelText(this, layout.heading.x, layout.heading.y, "How to walk", {
      color: colorFromHex(TEXT_COLOR),
      font: "title",
      scale: 2,
    });
    addFilledRect(this, CLOSE_COLORS.border, layout.close);
    addFilledRect(this, CLOSE_COLORS.face, insetRect(1, layout.close));
    this.addCenteredText(2, CLOSE_COLORS.label, layout.close, "X");

    addFilledRect(this, FRAME_COLOR, insetRect(-1, layout.illustration));
    this.drawIllustration(page.art, layout.illustration);

    addPixelText(this, layout.counter.x, layout.counter.y, `${this.page + 1}/${pages.length}`, {
      color: colorFromHex(COUNTER_COLOR),
      font: "title",
    });
    addPixelText(this, layout.title.x, layout.title.y, page.title, {
      color: colorFromHex(TITLE_COLOR),
      font: "title",
      scale: 2,
    });
    this.drawBody(page.body);

    dotRects(pages.length).forEach((dot, i) => {
      if (i === this.page) {
        addFilledRect(this, DOT_CURRENT_COLOR, dot);
      } else {
        addFilledRect(this, DOT_COLOR, dot);
        addFilledRect(this, BACKGROUND_COLOR, insetRect(1, dot));
      }
    });

    const { backEnabled, nextLabel } = helpButtons(pages.length, this.page);
    this.drawButton(backEnabled ? BUTTON_ENABLED : BUTTON_DISABLED, layout.back, "BACK");
    this.drawButton(BUTTON_ENABLED, layout.next, nextLabel);
  }

  // The art is exported at the frame's size; a key not in the manifest yet shows a box.
  private drawIllustration(key: string, frame: Rect): void {
    if (this.textures.exists(key)) {
      this.add.image(frame.x, frame.y, key).setOrigin(0).setCrop(0, 0, frame.width, frame.height);
      return;
    }
    addFilledRect(this, PLACEHOLDER_COLORS.fill, frame);
    this.addCenteredText(1, PLACEHOLDER_COLORS.label, frame, key.toUpperCase());
  }

  // Wrapped by Phaser at the body's width, with the line pitch set to the layout's.
  private drawBody(body: string): void {
    const { lineHeight, width, x, y } = HELP_LAYOUT.body;
    const scale = 2;
    const text = addPixelText(this, x, y, body, {
      color: colorFromHex(TEXT_COLOR),
      maxWidth: width,
      scale,
    });
    text.setLineSpacing(lineHeight / scale - text.fontData.lineHeight);
  }

  private drawButton(colors: ButtonColors, rect: Rect, label: string): void {
    const lip = HELP_LAYOUT.buttonLip;
    const face = { ...rect, height: rect.height - lip };
    addFilledRect(this, colors.lip, { ...face, y: rect.y + lip });
    addFilledRect(this, colors.face, face);
    this.addCenteredText(2, colors.label, face, label);
  }

  private addCenteredText(scale: number, color: string, rect: Rect, text: string): void {
    addPixelText(this, rect.x + rect.width / 2, rect.y + rect.height / 2, text, {
      color: colorFromHex(color),
      font: "title",
      originX: 0.5,
      originY: 0.5,
      scale,
    });
  }
}
