import type { RunText } from "./types";

// The walk's text. A {name} is filled in by the game, and src/hud/runText.ts lists the names
// each line may use.
export const RUN_TEXT = {
  card: {
    fires: "Fires {owners}",
    forkFees: "Pay ×{fees}",
    forkSubtitle: "Each path brings an upgrade",
    forkTitle: "Which way?",
    free: "Free",
    need: "Need {amount}",
    pickOne: "Pick one",
    skip: "Walk on by",
    skipEffect: "Skip this card, free once each neighborhood.",
    skipHeld: "Walk on by: nothing happens.",
    upgradeDuration: { nextZone: "Next neighborhood", now: "Now", run: "Whole walk" },
  },
  dodge: "Dodge!",
  fired: "FIRED!",
  firedBy: "{owner} fired you!",
  fullPackHome: "Full pack home! +{amount}",
  homeQuestion: {
    headHome: "Head home",
    keepWalking: "Keep walking",
    lose: "You give up {fees} in pay for {zone}.",
    loseBonus: "You give up the Full pack bonus.",
    loseWithBonus: "You give up {fees} in pay for {zone} and the Full pack bonus.",
    title: "Head home?",
    zonesLeft: "Neighborhoods left: {count}",
  },
  lowHearts: "{owner} has 1♥ left!",
  newWalker: {
    button: "Welcome!",
    info: "{agility} · {perk}",
    subtitle: "{walker} joins you!",
    title: "New walker!",
  },
  outOfMoney: "out of cash",
  strip: {
    achievement: "Achievement! {name}",
  },
  zoneDone: {
    earnings: "{fees} pay · {tips} tips",
    subtitle: "{zone}",
    title: "Neighborhood done!",
  },
} as const satisfies RunText;
