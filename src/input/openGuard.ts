// What an open guard reads from the game: its step events, as Phaser's game.events emits them
// (Core.Events.PRE_STEP and POST_STEP).
export interface StepEvents {
  once(event: "poststep" | "prestep", listener: () => void): unknown;
}

export type OpenGuard = (events: StepEvents, owner: object, open: () => void) => boolean;

// One opener's guard against a second tap opening a second copy of what the first opened.
// Phaser queues a scene's pause, launch, resume and stop to the next game step, so until that
// step the scene that asked for an open still takes taps. The guard runs open at once, and says
// so, unless owner already opened since the last step that applied the scene queue. Each step
// applies the queue between its prestep and its poststep, so the next whole step applies it.
export function openGuard(): OpenGuard {
  const opened = new WeakSet<object>();
  return (events, owner, open) => {
    if (opened.has(owner)) {
      return false;
    }
    opened.add(owner);
    events.once("prestep", () => events.once("poststep", () => opened.delete(owner)));
    open();
    return true;
  };
}
