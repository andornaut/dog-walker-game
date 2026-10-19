import type { RunText } from "./types";

// The walk's text. A {name} is filled in by the game, and src/hud/runText.ts lists the names
// each line may use.
export const RUN_TEXT = {
  card: {
    forkSubtitle: "Pick the next zone",
    forkTitle: "Which way?",
    free: "Free",
    need: "Need {amount}",
    pickOne: "Pick one",
    skip: "Skip",
    skipEffect: "Poop bags: walk on, nothing happens.",
    skipHeld: "Walk on: nothing happens.",
    stopSubtitle: "A stop on the way",
    upgradeSubtitle: "Pick one for the rest of the walk",
    upgradeTitle: "Pick an upgrade",
  },
  fired: "FIRED!",
  homeQuestion: {
    body: "You keep tips and earlier zones' fees. This zone pays nothing.",
    headHome: "Head home",
    keepWalking: "Keep walking",
    title: "Head home?",
  },
  lowHearts: "1 ♥ left!",
} as const satisfies RunText;
