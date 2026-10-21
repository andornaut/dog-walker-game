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
      "The dogs follow you. Mostly.",
    title: "Switch lanes",
  },
  {
    art: "help-pickups",
    body:
      "Tips are $1 each, and they're most of your money, so grab plenty. " +
      "A dog that reaches a treat cheers its owner: +1♥. " +
      "Aim for a lost wallet or a generous neighbor, too.",
    title: "Tips and treats",
  },
  {
    art: "help-cards",
    body:
      "Bump a puddle, skunk, squirrel, thief or another dog and the walk pauses for a card. " +
      "Each option costs money, hearts or a debuff, and one always costs no money. " +
      "Hold a card for details. Muddy and Stinky wear off on their own.",
    title: "Bumps become cards",
  },
  {
    art: "help-owners",
    body:
      "Each owner has a heart meter: 3♥ for a small dog, 4 medium, 5 big. " +
      "Cones, bins and other plain bumps cost the owner of the dog that touched them, " +
      "often the dog in front, so pick who leads. Small dogs dodge a few. " +
      "At 0♥ the owner fires you and the dog trots home.",
    title: "Keep owners happy",
  },
  {
    art: "help-pulls",
    body:
      "Every dog loves squirrels. A bubble and a line to a squirrel mean a dog is straining. " +
      "Steer away and the pull is off; wait and the pack hops one lane toward it. " +
      "A pull never drags you into an obstacle.",
    title: "Watch for pulls",
  },
  {
    art: "help-zones",
    body:
      "Walk 4 neighborhoods of Maplewood, from Elm Avenue to The Long Way Home. " +
      "Each dog's pay is banked as you finish each one. " +
      "At a fork, each path brings an upgrade, and harder ones pay more. " +
      "Bring every dog home for the Full pack bonus.",
    title: "Four neighborhoods",
  },
] as const satisfies readonly [HelpPage, ...HelpPage[]];
