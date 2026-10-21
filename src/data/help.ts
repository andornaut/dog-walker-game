import type { HelpPage } from "./types";

// The "How to walk" help screen: one page per entry, in this order.
// - art: the key of the page's illustration in public/art/manifest.json "images".
// - body: wrapped to fit the screen, so keep it to about four short sentences.
//   A long sentence can be split into quoted pieces joined with +, each ending in a space.
// - title: shown in capitals above the body.
export const HELP_PAGES = [
  {
    art: "help-lanes",
    body:
      "Drag anywhere: a short drag moves the pack a lane, and each lane-width more moves one more. " +
      "A tap moves one lane toward that side. Keys: arrows, A/D or H/L. " +
      "Some obstacles move: an arrow shows where.",
    title: "Switch lanes",
  },
  {
    art: "help-pickups",
    body:
      "Tips are $1 each, and they're most of your earnings, so grab plenty. " +
      "A dog that reaches a treat cheers its owner: +1♥. " +
      "Aim for a lost wallet or a generous neighbor, too.",
    title: "Tips and treats",
  },
  {
    art: "help-cards",
    body:
      "Bump a skunk, a thief or another dog and the walk pauses for a card. " +
      "Each option costs cash, hearts or a debuff, and one always costs no cash. " +
      "Hold anything for details. A puddle opens no card, but makes the pack Muddy. " +
      "Debuffs wear off on their own.",
    title: "Some bumps bring cards",
  },
  {
    art: "help-owners",
    body:
      "Each owner has hearts: 3♥ small, 4♥ medium, 5♥ big, but big dogs slow your lane changes. " +
      "A plain bump costs 1♥ from the owner of the dog that touched it. " +
      "Small dogs dodge 1 in 4 plain bumps. At 0♥ the owner fires you.",
    title: "Keep owners happy",
  },
  {
    art: "help-pulls",
    body:
      "Every dog loves squirrels. Touching one does nothing, but a bubble and a line to it mean a dog is straining. " +
      "Steer away and the pull is off; wait and the pack hops one lane toward it. " +
      "A pull never drags you into a bump too close to dodge.",
    title: "Watch for pulls",
  },
  {
    art: "help-zones",
    body:
      "Walk 4 neighborhoods of Maplewood, from Elm Avenue to The Long Way Home. " +
      "Each dog's pay is banked as you finish each one, and each is busier than the last. " +
      "At a fork, each path brings an upgrade, and harder ones pay more. " +
      "Bring every dog home for the Full pack bonus.",
    title: "Four neighborhoods",
  },
] as const satisfies readonly [HelpPage, ...HelpPage[]];
