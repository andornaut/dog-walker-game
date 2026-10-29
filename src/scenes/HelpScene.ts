import { Scene, Scenes } from "phaser";

import { gameData } from "../data";
import type { HelpPictureId } from "../data/types";
import { helpBody } from "../help/helpBody";
import { helpActionForKey, helpActionForPointer } from "../help/helpInput";
import { dotRects, HELP_LAYOUT, helpActionAt } from "../help/helpLayout";
import { applyHelpAction, clampPage, type HelpAction, helpButtons } from "../help/helpPaging";
import { closeHelp } from "../help/helpSeen";
import { screenArea } from "../input/outsideTap";
import { itemAt } from "../lib/arrays";
import { insetRect, type Point, type Rect } from "../lib/rect";
import { addFilledRect } from "../ui/phaser/draw";
import { PALETTE } from "../ui/phaser/palette";
import { addPixelText, wrapPixelText } from "../ui/phaser/pixelText";
import { TEXT_SCALE } from "../ui/textFit";
import { topBarRects } from "../ui/topBarTrim";
import type { HelpPictureData } from "./HelpPictureScene";
import { listenOnePress } from "./onePress";
import { closeOverlay, listenDismiss, type OverlayData } from "./overlay";
import { updateProfile } from "./profileStore";
import { SCENE_KEYS, type SceneKey } from "./sceneKeys";
import { addCloseButton, addMenuButton, addTapBurst, clearScene } from "./uiKit";

// Emitted on game.events when the help closes, by any route.
export const HELP_CLOSED_EVENT = "help-closed";

// The other pages' dots are hollow rings and the current one is filled, so they differ by
// shape.
const DOT_COLOUR = PALETTE.tan;
const DOT_CURRENT_COLOUR = PALETTE.white;

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

// A full-screen overlay listed after the scenes it opens over, the home screen and the pause
// menu over the walk, and before its picture's scenes, which draw over it. The caller pauses
// itself and launches it (openHelp); on close, help resumes that scene.
export class HelpScene extends Scene {
  private page = 0;
  // The page whose picture shows.
  private picturePage: number | undefined;
  private pressed: Pressed | undefined;
  private pressStart: Point | undefined;
  private resumeKey: SceneKey | undefined;

  constructor() {
    super(SCENE_KEYS.help);
  }

  create(data?: OverlayData): void {
    this.page = 0;
    this.picturePage = undefined;
    this.pressed = undefined;
    this.pressStart = undefined;
    this.resumeKey = data?.resume;
    this.events.once(Scenes.Events.SHUTDOWN, () => this.scene.stop(SCENE_KEYS.helpPicture));
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
        addTapBurst(this, pointer.x, pointer.y);
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
    listenDismiss(this, screenArea([HELP_LAYOUT.screen]), () => this.close());
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
    closeOverlay(this.resumeKey, this);
    void updateProfile(this, closeHelp);
    this.game.events.emit(HELP_CLOSED_EVENT);
  }

  // Redrawn whole on every page turn, reading the pages then, so a live text edit shows up.
  private draw(): void {
    clearScene(this);
    const pages = gameData.help;
    const words = gameData.menuText.help;
    this.page = clampPage(pages.length, this.page);
    const page = itemAt(pages, this.page);
    const layout = HELP_LAYOUT;

    addFilledRect(this, PALETTE.darkBrown, layout.screen);
    topBarRects(layout.topBar).forEach(({ colour, rect }) =>
      addFilledRect(this, PALETTE[colour], rect),
    );
    addPixelText(this, layout.heading.x, layout.heading.y, words.heading, {
      colour: PALETTE.cream,
      font: "title",
      scale: TEXT_SCALE,
    });
    addCloseButton(this, this.add.container(0, 0), layout.close, this.pressed === "close");

    const frame = layout.illustration;
    for (const y of [frame.y - 1, frame.y + frame.height]) {
      addFilledRect(this, PALETTE.plum, { height: 1, width: frame.width, x: frame.x, y });
    }
    this.showPicture(page.art, frame);

    addPixelText(this, layout.title.x, layout.title.y, page.title, {
      colour: PALETTE.amber,
      font: "title",
      scale: layout.title.scale,
    });
    this.drawBody(page.body);

    dotRects(pages.length).forEach((dot, i) => {
      if (i === this.page) {
        addFilledRect(this, DOT_CURRENT_COLOUR, dot);
      } else {
        addFilledRect(this, DOT_COLOUR, dot);
        addFilledRect(this, PALETTE.darkBrown, insetRect(1, dot));
      }
    });

    // Next is the call to action; Previous is disabled on the first page.
    const { next, previousEnabled } = helpButtons(pages.length, this.page);
    const previous = { available: previousEnabled, primary: false };
    addMenuButton(this, layout.previous, words.previous, previous).setPressed(
      this.pressed === "previous",
    );
    addMenuButton(this, layout.next, words[next], { available: true, primary: true }).setPressed(
      this.pressed === "next",
    );
  }

  // The page's picture of the walk screen in frame, drawn over this scene by the picture
  // scenes; started again only when the page changes.
  private showPicture(art: HelpPictureId, frame: Rect): void {
    if (this.picturePage === this.page) {
      return;
    }
    this.picturePage = this.page;
    const data: HelpPictureData = { frame, page: art };
    this.scene.launch(SCENE_KEYS.helpPicture, data);
  }

  // Wrapped at the body's width as the help pages' fit test wraps it, measured on the font, with
  // the line pitch set to the layout's, its names filled from the game data. Phaser's own wrap
  // counts a line's trailing space, so it would break a line that fits exactly.
  private drawBody(body: string): void {
    const { lineHeight, scale, width, x, y } = HELP_LAYOUT.body;
    const style = { colour: PALETTE.cream, scale };
    const lines = wrapPixelText(this, style, width, helpBody(gameData, { body }));
    const text = addPixelText(this, x, y, lines.join("\n"), style);
    text.setLineSpacing(lineHeight / scale - text.fontData.lineHeight);
  }
}
