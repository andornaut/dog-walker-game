import "./main.css";

import { AUTO, Core, Game, Scale } from "phaser";

import { installCrashScreen } from "./crash/crashScreen";
import { SCREEN_CONFIG } from "./data/screen";
import {
  DEV_OVERLAY_TOGGLE_EVENT,
  DEV_OVERLAY_VISIBLE_KEY,
  DEV_ROAD_FADE_KEY,
  DEV_STATE_EVENT,
  type DevState,
} from "./dev/devOverlay";
import { type DevPanelHost, mountDevPanel } from "./dev/devPanel";
import { disableDevMode, pageRunSetup } from "./dev/pageRunSetup";
import { noteKeyPress } from "./input/keyNumbers";
import { lostTouches } from "./input/touches";
import { noteWalkStarted, setOnHomeScreen, setupPhoneApp } from "./pwa";
import { BootScene } from "./scenes/BootScene";
import { CardScene } from "./scenes/CardScene";
import { CelebrationScene } from "./scenes/CelebrationScene";
import { DevOverlayScene } from "./scenes/DevOverlayScene";
import { EndScene } from "./scenes/EndScene";
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

// The dev panel's view of the game. The panel asks the overlay to show or hide by an event, and
// reads its visibility from the registry, which the backquote toggle also updates, so each
// control sees the other's change. The road fade is a registry flag RunScene reads each frame.
function devPanelHost(game: Game): DevPanelHost {
  let devState: DevState | undefined;
  game.events.on(DEV_STATE_EVENT, (state: DevState) => {
    devState = state;
  });
  return {
    currentSetup: () => devState?.setup ?? pageRunSetup().setup,
    disable: () => {
      disableDevMode();
      devState = undefined;
      game.events.emit(DEV_OVERLAY_TOGGLE_EVENT, false);
      Reflect.deleteProperty(globalThis, "dogWalkerGame");
    },
    // Unset until the overlay scene has run create, which shows it when the URL has dev=1.
    overlayVisible: () =>
      (game.registry.get(DEV_OVERLAY_VISIBLE_KEY) as boolean | undefined) ??
      pageRunSetup().setup.dev,
    roadFade: () => game.registry.get(DEV_ROAD_FADE_KEY) === true,
    setOverlayVisible: (visible) => {
      game.events.emit(DEV_OVERLAY_TOGGLE_EVENT, visible);
    },
    setRoadFade: (on) => {
      game.registry.set(DEV_ROAD_FADE_KEY, on);
    },
  };
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
// pause menu over the HUD, help, settings and stats over those, and the dev overlay, which
// starts itself, over everything. Boot runs first and starts the start screen.
function bootGame(): Game {
  const game = new Game({
    backgroundColor: "#181425",
    height: SCREEN_CONFIG.height,
    // Two touch pointers, so the walk sees a finger that lands while another rests.
    input: { activePointers: 2 },
    parent: "game",
    pixelArt: true,
    scale: { autoCenter: Scale.CENTER_BOTH, mode: Scale.FIT },
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
      SettingsScene,
      ShopScene,
      StatsScene,
      CelebrationScene,
      DevOverlayScene,
    ],
    type: AUTO,
    width: SCREEN_CONFIG.width,
  });

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
// version, so it never draws the old one first.
void setupPhoneApp().then(() => {
  game = bootGame();
});
