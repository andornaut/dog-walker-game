// The page's crash screen (the kit's crash/crashScreen), in the game's words and palette, with
// the message, stack and build label under dev=1. It writes nothing to the save, whose
// in-memory state may be corrupt; the walk's last checkpoint is already saved, and the next
// launch resumes or banks it. A checkpoint the walk writes after the crash, as the page hides,
// keeps no resume point (stopResuming in src/main.ts), so that launch banks it.
// src/crash/install.ts imports this module before any other game module.
import "@andornaut/game-kit/crash/crash.css";

import { BUILD_LABEL } from "@andornaut/game-kit/build/buildLabel";
import { installCrashScreen } from "@andornaut/game-kit/crash/crashScreen";

import palette from "../../shared/palette.json";
import { MENU_TEXT } from "../data/menuText";
import { pageSearch } from "../dev/devTools";
import { devInSearch } from "../dev/runSetup";

const colour = (name: keyof typeof palette) => `#${palette[name].hex}`;

// The button copies the canvas buttons: amber face, orange lip, plum text.
export const CRASH_SCREEN = installCrashScreen({
  buildLabel: BUILD_LABEL,
  colours: {
    background: colour("plum"),
    buttonFace: colour("amber"),
    buttonLip: colour("orange"),
    ink: colour("ink"),
    text: colour("cream"),
  },
  dev: devInSearch(pageSearch()),
  words: MENU_TEXT.crash,
});
