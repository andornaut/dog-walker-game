// First, so the crash screen catches an error thrown while any other module loads.
import "./crash/install";
import "./main.css";

import { MENU_FPS } from "@andornaut/game-kit/clock/frameCap";
import { capFrameRate } from "@andornaut/game-kit/clock/phaser/capFrameRate";
import { Core, Game, Scale, WEBGL } from "phaser";

import { CRASH_SCREEN } from "./crash/crashScreen";
import { SCREEN_CONFIG } from "./data/screen";
import { applyPendingSaveEdits, type DevPanelHost, mountDevPanel } from "./dev/devPanel";
import { DEV_CHEATS_KEY } from "./dev/devPanelModel";
import { devToolsOn } from "./dev/devTools";
import { pageRunSetup } from "./dev/pageRunSetup";
import { noteKeyPress } from "./input/keyNumbers";
import { lostTouches } from "./input/touches";
import { noteWalkStarted, setOnHomeScreen, setupPhoneApp, storagePersistence } from "./pwa";
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
import { QuitScene } from "./scenes/QuitScene";
import { RunScene } from "./scenes/RunScene";
import { SCENE_KEYS } from "./scenes/sceneKeys";
import { SettingsScene } from "./scenes/SettingsScene";
import { ShopScene } from "./scenes/ShopScene";
import { StartScene } from "./scenes/StartScene";
import { StatsScene } from "./scenes/StatsScene";
import { TapBurstScene } from "./scenes/TapBurstScene";
import { ZoneCelebrationScene } from "./scenes/ZoneCelebrationScene";

// The dev panel's view of the game: the cheats are a registry entry RunScene reads each frame.
function devPanelHost(game: Game): DevPanelHost {
  return {
    persistence: storagePersistence(),
    setCheats: (cheats) => {
      game.registry.set(DEV_CHEATS_KEY, cheats);
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
// pause menu over the HUD, help (its page's picture of the walk, HUD and card over it),
// settings and stats over those, and the dev overlay, which starts itself, over everything.
// Boot runs first and starts the start screen. The canvas clears to the page's ink, so launch
// shows no rectangle before the loading screen's art; the walk fills its own ink.
function bootGame(): Game {
  // The dev bar shows before the game measures #game: Phaser sizes the canvas as it boots and
  // can miss a change to #game's height made just after, leaving the canvas clipped.
  const devPanel = devToolsOn() ? document.getElementById("dev-panel") : null;
  if (devPanel !== null) {
    devPanel.hidden = false;
  }
  const game = new Game({
    backgroundColor: "#181425",
    height: SCREEN_CONFIG.height,
    // Two touch pointers, so the walk sees a finger that lands while another rests.
    input: { activePointers: 2 },
    parent: "game",
    pixelArt: true,
    // Phaser's Scale Manager fits the canvas to #game at the largest zoom that fits, fractional
    // included, keeping SCREEN_CONFIG's resolution scaled by CSS and drawn nearest-neighbour
    // (pixelArt), at #game's top and centred across, so the spare height sits under the dog
    // cards, where the walk steers from the page too.
    scale: { autoCenter: Scale.CENTER_HORIZONTALLY, mode: Scale.FIT },
    // Scenes draw in this order. The Logbook, the settings and help, which the home top bar
    // opens over the Pet shop, come after it, help's pictures after help, and the tap bursts
    // over every scene but the dev overlay.
    scene: [
      BootScene,
      StartScene,
      RunScene,
      HudScene,
      CardScene,
      ZoneCelebrationScene,
      PauseScene,
      EndScene,
      ShopScene,
      StatsScene,
      CelebrationScene,
      QuitScene,
      SettingsScene,
      HelpScene,
      HelpPictureScene,
      new HudScene(SCENE_KEYS.helpHud),
      new CardScene(SCENE_KEYS.helpCard),
      TapBurstScene,
      DevOverlayScene,
    ],
    // WebGL only: the build's Phaser has no Canvas renderer (src/tools/phaserBuild.ts).
    type: WEBGL,
    width: SCREEN_CONFIG.width,
  });

  CRASH_SCREEN.stopGameOnCrash(() => {
    game.pause();
    game.sound.pauseAll();
  });
  // Menus draw at most about 60 frames a second; a walk (RunScene) draws every frame.
  capFrameRate(MENU_FPS, () => game.scene.isActive(SCENE_KEYS.run), game);
  // The installed app has no dev panel, so its #dev-panel stays hidden and no cheat is set.
  if (devToolsOn()) {
    mountDevPanel(devPanelHost(game), devPanel);
  }

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

// The game boots at once, loading while the service worker checks for a newer version: BootScene
// holds the save and the home screen until launchReady, so a fresh load switching to a newer
// version never draws the old home screen first. It boots once the dev panel's queued save edits
// are written, so the game loads the edited save. The installed app writes none.
setupPhoneApp();
void (devToolsOn() ? applyPendingSaveEdits() : Promise.resolve()).then(bootGame);
