import { type Scene, Scenes } from "phaser";

// Set in the game registry, and emitted on the game, once boot has loaded and registered the
// art and sounds it left until after the home screen showed.
const ART_READY = "art-ready";

export function markArtReady(scene: Scene): void {
  scene.registry.set(ART_READY, true);
  scene.game.events.emit(ART_READY);
}

export function artReady(scene: Scene): boolean {
  return scene.registry.get(ART_READY) === true;
}

// Calls then once every asset has loaded: now if they have, else when they do, unless the
// scene shuts down first.
export function whenArtReady(scene: Scene, then: () => void): void {
  if (artReady(scene)) {
    then();
    return;
  }
  const { events } = scene.game;
  const forget = () => events.off(ART_READY, ready);
  const ready = () => {
    scene.events.off(Scenes.Events.SHUTDOWN, forget);
    then();
  };
  events.once(ART_READY, ready);
  scene.events.once(Scenes.Events.SHUTDOWN, forget);
}
