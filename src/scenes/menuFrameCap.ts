import { Core, type Game } from "phaser";

import { type FrameGate, gateFrame, MENU_FPS, OPEN_GATE } from "../pwa/frameCap";
import { SCENE_KEYS } from "./sceneKeys";

// Caps the frame rate at MENU_FPS whenever no walk is on. Phaser's loop calls its step on every
// display frame; this passes on only the frames gateFrame draws, each with the time of the frames
// it skipped, so animations, tweens and timers keep their speed. While RunScene is active (the
// walk, its cards and its pause menu) every frame draws. The loop takes its step when it starts,
// after the game's READY event, so the step is wrapped on the first frame and gated from the next.
export function capMenuFrameRate(game: Game): void {
  game.events.once(Core.Events.PRE_STEP, () => {
    const step = game.loop.callback;
    let gate: FrameGate = OPEN_GATE;
    game.loop.callback = (time, delta) => {
      const walking = game.scene.isActive(SCENE_KEYS.run);
      const frame = gateFrame(walking ? undefined : MENU_FPS, delta, gate);
      gate = frame.gate;
      if (frame.draw) {
        step(time, frame.elapsedMs);
      }
    };
  });
}
