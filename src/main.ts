import "./main.css";

import { AUTO, Core, Game, Scale } from "phaser";

import { installCrashScreen } from "./crash/crashScreen";
import { SCREEN_CONFIG } from "./data/screen";
import { applyPendingSaveEdits, type DevPanelHost, mountDevPanel } from "./dev/devPanel";
import { DEV_CHEATS_KEY } from "./dev/devPanelModel";
import { pageRunSetup } from "./dev/pageRunSetup";
import { noteKeyPress } from "./input/keyNumbers";
import { lostTouches } from "./input/touches";
import { integerZoom } from "./layout/integerZoom";
import { noteWalkStarted, setOnHomeScreen, setupPhoneApp } from "./pwa";
import { BootScene } from "./scenes/BootScene";
import { CardScene } from "./scenes/CardScene";
import { CelebrationScene } from "./scenes/CelebrationScene";
import { DevOverlayScene } from "./scenes/DevOverlayScene";
import { EndScene } from "./scenes/EndScene";
import { HelpPictureScene } from "./scenes/HelpPictureScene";
import { HelpScene } from "./scenes/HelpScene";
import { watchHomeScreen } from "./scenes/homeScreen";
import { HudScene } from "./scenes/HudScene";
import { PauseScene } from "./scenes/PauseScene";
import { RunScene } from "./scenes/RunScene";
import { SCENE_KEYS } from "./scenes/sceneKeys";
import { SettingsScene } from "./scenes/SettingsScene";
import { ShopScene } from "./scenes/ShopScene";
import { StartScene } from "./scenes/StartScene";
import { StatsScene } from "./scenes/StatsScene";
import { ZoneCelebrationScene } from "./scenes/ZoneCelebrationScene";

let game: Game | undefined;

// Installed first, to catch errors while the game boots. A crash before the game exists has
// nothing to pause.
installCrashScreen({
  dev: pageRunSetup().setup.dev,
  onCrash: () => {
    game?.pause();
    game?.sound.pauseAll();
  },
});

// The dev panel's view of the game: the cheats are a registry entry RunScene reads each frame.
function devPanelHost(game: Game): DevPanelHost {
  return {
    setCheats: (cheats) => {
      game.registry.set(DEV_CHEATS_KEY, cheats);
    },
  };
}

// Keeps the canvas at the integer zoom for #game's size and the screen's pixel ratio, centred
// in it with the page's background around it. Phaser measures #game and emits a resize on
// each change, a change of pixel ratio included, since that resizes the window.
function fitWholePixels(game: Game): void {
  const fit = () => {
    const { height, width } = game.scale.parentSize;
    if (width <= 0 || height <= 0) {
      return;
    }
    const zoom = integerZoom(SCREEN_CONFIG, window.devicePixelRatio || 1, { height, width });
    if (zoom !== game.scale.zoom) {
      game.scale.setZoom(zoom);
    }
  };
  game.scale.on(Scale.Events.RESIZE, fit);
  game.events.once(Core.Events.READY, fit);
}

// Reports the first walk, which counts as the player interacting, then stops watching.
function watchFirstWalk(game: Game): void {
  const check = () => {
    if (game.scene.isActive(SCENE_KEYS.run)) {
      game.events.off(Core.Events.POST_STEP, check);
      noteWalkStarted();
    }
  };
  game.events.on(Core.Events.POST_STEP, check);
}

// Scenes render in list order: the HUD over the road, cards, the zone celebration and the
// pause menu over the HUD, help (its page's picture of the walk, HUD and card over it),
// settings and stats over those, and the dev overlay, which starts itself, over everything.
// Boot runs first and starts the start screen.
function bootGame(): Game {
  const game = new Game({
    backgroundColor: "#181425",
    height: SCREEN_CONFIG.height,
    // Two touch pointers, so the walk sees a finger that lands while another rests.
    input: { activePointers: 2 },
    parent: "game",
    pixelArt: true,
    // Sized by whole device pixels per game pixel, in fitWholePixels.
    scale: { autoCenter: Scale.CENTER_BOTH, mode: Scale.NONE },
    scene: [
      BootScene,
      StartScene,
      RunScene,
      HudScene,
      CardScene,
      ZoneCelebrationScene,
      PauseScene,
      EndScene,
      HelpScene,
      HelpPictureScene,
      new HudScene(SCENE_KEYS.helpHud),
      new CardScene(SCENE_KEYS.helpCard),
      SettingsScene,
      ShopScene,
      StatsScene,
      CelebrationScene,
      DevOverlayScene,
    ],
    type: AUTO,
    width: SCREEN_CONFIG.width,
  });

  fitWholePixels(game);
  mountDevPanel(devPanelHost(game), document.getElementById("dev-panel"));

  // Captured before the scenes see it, so the key that opens a menu already shows its numbers.
  window.addEventListener("keydown", noteKeyPress, { capture: true });

  // Phaser gives a new touch only a free pointer, so a touch whose end the browser never
  // delivered would hold its pointer and every later touch would be dropped. A touchstart lists
  // every touch on the screen, so a pointer holding one no longer there is freed before Phaser
  // handles it; the scenes take the new press on the freed pointer as a fresh one.
  window.addEventListener(
    "touchstart",
    (event) => {
      const held = game.input.pointers.filter((pointer) => pointer.active && pointer.wasTouch);
      const lost = lostTouches(
        held.map((pointer) => pointer.identifier),
        Array.from(event.touches, (touch) => touch.identifier),
      );
      held
        .filter((pointer) => lost.includes(pointer.identifier))
        .forEach((pointer) => pointer.reset());
    },
    { capture: true, passive: true },
  );

  // With dev=1, the game is reachable from the console and from headless checks.
  if (pageRunSetup().setup.dev) {
    Object.assign(globalThis, { dogWalkerGame: game });
  }

  // The update notice shows on the home screen only.
  watchHomeScreen(game, setOnHomeScreen);
  watchFirstWalk(game);
  return game;
}

// The game boots once the service worker has had the chance to switch a fresh load to a newer
// version, so it never draws the old one first, and once the dev panel's queued save edits are
// written, so the game loads the edited save.
void setupPhoneApp()
  .then(applyPendingSaveEdits)
  .then(() => {
    game = bootGame();
  });
