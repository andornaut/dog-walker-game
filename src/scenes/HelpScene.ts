import { Scene } from "phaser";

import { itemAt } from "../arrays";
import { gameData } from "../data";
import { helpActionForKey, helpActionForPointer } from "../help/helpInput";
import { dotRects, HELP_LAYOUT, helpActionAt, type Point } from "../help/helpLayout";
import { applyHelpAction, clampPage, type HelpAction, helpButtons } from "../help/helpPaging";
import { insetRect, type Rect } from "../layout/rect";
import { addFilledRect } from "./draw";
import { listenOnePress } from "./onePress";
import { PALETTE } from "./palette";
import { addPixelText } from "./pixelText";
import { SCENE_KEYS, type SceneKey } from "./sceneKeys";
import { addCloseButton, addMenuButton, TEXT_SCALE } from "./uiKit";

// Emitted on game.events when the help closes, by any route.
export const HELP_CLOSED_EVENT = "help-closed";

// The caller pauses itself and launches help; on close, help resumes that scene.
export interface HelpSceneData {
  resume?: SceneKey;
}

// The other pages' dots are hollow rings and the current one is filled, so they differ by
// shape.
const DOT_COLOR = PALETTE.tan;
const DOT_CURRENT_COLOR = PALETTE.white;

type Pressed = "close" | "next" | "previous";

// The control a press starts on shows pressed until it is released.
function pressedBy(action: HelpAction | undefined): Pressed | undefined {
  switch (action?.kind) {
    case "advance":
      return "next";
    case "close":
    case "previous":
      return action.kind;
    default:
      return undefined;
  }
}

// A full-screen overlay listed last in the game config, so it draws over every scene.
export class HelpScene extends Scene {
  private page = 0;
  private pressed: Pressed | undefined;
  private pressStart: Point | undefined;
  private resumeKey: SceneKey | undefined;

  constructor() {
    super(SCENE_KEYS.help);
  }

  create(data?: HelpSceneData): void {
    this.page = 0;
    this.pressed = undefined;
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
        this.showPressed(pressedBy(helpActionAt(gameData.help.length, this.pressStart)));
      },
      up: (pointer, cancelled) => {
        const start = this.pressStart;
        this.pressStart = undefined;
        this.showPressed(undefined);
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

  private showPressed(pressed: Pressed | undefined): void {
    if (pressed !== this.pressed) {
      this.pressed = pressed;
      this.draw();
    }
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
    const words = gameData.menuText.help;
    this.page = clampPage(pages.length, this.page);
    const page = itemAt(pages, this.page);
    const layout = HELP_LAYOUT;

    addFilledRect(this, PALETTE.darkBrown, layout.screen);
    addFilledRect(this, PALETTE.plum, layout.topBar);
    addFilledRect(this, PALETTE.darkBrown, {
      ...layout.topBar,
      height: layout.topBarEdge,
      y: layout.topBar.y + layout.topBar.height - layout.topBarEdge,
    });
    addPixelText(this, layout.heading.x, layout.heading.y, words.heading, {
      color: PALETTE.cream,
      font: "title",
      scale: TEXT_SCALE,
    });
    addCloseButton(this, this.add.container(0, 0), layout.screen, this.pressed === "close");

    addFilledRect(this, PALETTE.plum, insetRect(-1, layout.illustration));
    this.drawIllustration(page.art, layout.illustration);

    addPixelText(this, layout.counter.x, layout.counter.y, `${this.page + 1}/${pages.length}`, {
      color: PALETTE.cream,
      font: "title",
    });
    addPixelText(this, layout.title.x, layout.title.y, page.title, {
      color: PALETTE.amber,
      font: "title",
      scale: TEXT_SCALE,
    });
    this.drawBody(page.body);

    dotRects(pages.length).forEach((dot, i) => {
      if (i === this.page) {
        addFilledRect(this, DOT_CURRENT_COLOR, dot);
      } else {
        addFilledRect(this, DOT_COLOR, dot);
        addFilledRect(this, PALETTE.darkBrown, insetRect(1, dot));
      }
    });

    const { next, previousEnabled } = helpButtons(pages.length, this.page);
    const previous = addMenuButton(this, layout.previous, words.previous, "secondary");
    previous.setState(
      !previousEnabled ? "disabled" : this.pressed === "previous" ? "pressed" : "normal",
    );
    addMenuButton(this, layout.next, words[next]).setState(
      this.pressed === "next" ? "pressed" : "normal",
    );
  }

  // The art is exported at the frame's size; a key not in the manifest yet shows a box.
  private drawIllustration(key: string, frame: Rect): void {
    if (this.textures.exists(key)) {
      this.add.image(frame.x, frame.y, key).setOrigin(0).setCrop(0, 0, frame.width, frame.height);
      return;
    }
    addFilledRect(this, PALETTE.navy, frame);
    addPixelText(this, frame.x + frame.width / 2, frame.y + frame.height / 2, key.toUpperCase(), {
      color: PALETTE.lightGrey,
      font: "title",
      originX: 0.5,
      originY: 0.5,
    });
  }

  // Wrapped by Phaser at the body's width, with the line pitch set to the layout's.
  private drawBody(body: string): void {
    const { lineHeight, width, x, y } = HELP_LAYOUT.body;
    const text = addPixelText(this, x, y, body, {
      color: PALETTE.cream,
      maxWidth: width,
      scale: TEXT_SCALE,
    });
    text.setLineSpacing(lineHeight / TEXT_SCALE - text.fontData.lineHeight);
  }
}
