import type { RunText } from "./types";

// The walk's text. A {name} is filled in by the game, and src/hud/runText.ts lists the names
// each line may use.
export const RUN_TEXT = {
  card: {
    fires: "Fires {owners}",
    forkFees: "Fees ×{fees}",
    forkSubtitle: "Pick the next zone",
    forkTitle: "Which way?",
    free: "Free",
    need: "Need {amount}",
    pickOne: "Pick one",
    quirkNoLoss: "No tips lost ({quirk})",
    skip: "Skip",
    skipEffect: "Poop bags: walk on, nothing happens.",
    skipHeld: "Walk on: nothing happens.",
    stopSubtitle: "A stop on the way",
    upgradeDuration: { nextZone: "Next zone", now: "Now", run: "Whole walk" },
    upgradeTitle: "Pick an upgrade",
    walkerGreeting: "{walker}: Nice pack! Mind if I walk with you sometime?",
  },
  fired: "FIRED!",
  firedBy: "{owner} fires you",
  homeQuestion: {
    body: "You keep tips and earlier zones' fees. This zone pays nothing.",
    headHome: "Head home",
    keepWalking: "Keep walking",
    title: "Head home?",
  },
  hopOver: "Hop!",
  lowHearts: "1 ♥ left!",
  newWalker: {
    button: "Welcome!",
    info: "{pace} · {style}",
    title: "{walker} joins you!",
  },
  outOfMoney: "you're out of money",
  zoneDone: {
    earnings: "+{fees} fees · +{tips} tips",
    title: "{zone} done!",
  },
} as const satisfies RunText;
