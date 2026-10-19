import { Core, type Game } from "phaser";

import { SCENE_KEYS } from "./sceneKeys";

// Reports on each change whether the home screen is in front: StartScene running, not stopped
// for a walk or paused under help, settings or stats. Polled per step, so StartScene needs no
// hook of its own.
export function watchHomeScreen(game: Game, onChange: (onHome: boolean) => void): void {
  let last: boolean | undefined;
  game.events.on(Core.Events.POST_STEP, () => {
    const onHome = game.scene.isActive(SCENE_KEYS.start);
    if (onHome !== last) {
      last = onHome;
      onChange(onHome);
    }
  });
}
