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
    walkerGreeting: "Nice pack! Mind if I walk with you sometime?",
  },
  fired: "FIRED!",
  firedBy: "{owner} fires you",
  homeQuestion: {
    headHome: "Head home",
    keep: "You keep {money}: tips and earlier zones' fees.",
    keepWalking: "Keep walking",
    lose: "You give up {fees} in fees for {zone}.",
    title: "Head home?",
    zonesLeft: "Zones left: {count}",
  },
  hopOver: "Hop!",
  lowHearts: "1 ♥ left!",
  newWalker: {
    button: "Welcome!",
    info: "{pace} · {style}",
    subtitle: "{walker} joins you!",
    title: "New walker!",
  },
  outOfMoney: "you're out of money",
  strip: {
    achievement: "Achievement! {name}",
  },
  zoneDone: {
    earnings: "{fees} fees  ·  {tips} tips",
    subtitle: "{zone}",
    title: "Zone done!",
  },
} as const satisfies RunText;
