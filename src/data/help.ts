import type { HelpPage } from "./types";

// The "How to walk" help screen: one page per entry, in this order. Draft text.
// - art: the key of the page's illustration in public/art/manifest.json "images".
// - body: wrapped to fit the screen, so keep it to about four short sentences.
//   A long sentence can be split into quoted pieces joined with +, each ending in a space.
// - title: shown in capitals above the body.
export const HELP_PAGES = [
  {
    art: "help-lanes",
    body:
      "Drag anywhere: a short drag moves the pack a lane, and each lane-width more moves one more. " +
      "A tap moves one lane toward that side. Keys: arrows, A/D or H/L.",
    title: "Switch lanes",
  },
  {
    art: "help-pickups",
    body: "Run into tips for $1 each. A dog that runs into a treat cheers its owner: +1♥.",
    title: "Tips and treats",
  },
  {
    art: "help-cards",
    body:
      "Hit a skunk, puddle or thief and the walk pauses. " +
      "Pick a card: pay up, or upset the owners. " +
      "Every card shows its outcome; hold one for details. One always costs no money. " +
      "Cones and bins cost the bumped dog's owner a heart. " +
      "Some bumps are lucky, like a lost wallet.",
    title: "Bumps become cards",
  },
  {
    art: "help-owners",
    body:
      "Each owner has a happiness meter: ♥, 3 for a small dog, 4 medium, 5 big. " +
      "A bump costs the owner of the dog it touches, and big dogs get bumped most. " +
      "At 0♥ the owner fires you, the dog goes home, and you lose its pay for the walk.",
    title: "Keep owners happy",
  },
  {
    art: "help-pulls",
    body:
      "A bubble and a dotted line over a dog mean a pull. " +
      "Every dog pulls toward squirrels: one lane at a time, never into an obstacle. " +
      "Drag back any time.",
    title: "Watch for pulls",
  },
  {
    art: "help-needs",
    body:
      "Hydrants, lamp posts, trees, water bowls and waving strangers are heart spots. " +
      "Steer into one and the dog that reaches it cheers its owner: +1♥.",
    title: "Heart spots",
  },
  {
    art: "help-zones",
    body:
      "Walk 4 neighborhoods of Maplewood, picking the next at each fork. " +
      "Each dog earns pay for each neighborhood, paid when it gets home. " +
      "Between neighborhoods, pick an upgrade card. Head home any time from the pause menu.",
    title: "Four neighborhoods",
  },
] as const satisfies readonly [HelpPage, ...HelpPage[]];
