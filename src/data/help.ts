import type { HelpPage } from "./types";

// The "How to walk" help screen: one page per entry, in this order.
// - art: which picture of the walk screen the page shows (src/help/helpPictures.ts).
// - body: wrapped to fit the screen in at most six lines. A long sentence can be split into
//   quoted pieces joined with +, each ending in a space. The {name}s it may use are listed in
//   src/help/helpBody.ts and filled from the game data.
// - title: shown in capitals above the body.
export const HELP_PAGES = [
  {
    art: "lanes",
    body:
      "Drag anywhere: a short drag moves the pack a lane, and each lane-width more moves one more. " +
      "A tap moves one lane toward that side. Keys: arrows, A/D or H/L. " +
      "Some obstacles move: an arrow shows where.",
    title: "Switch lanes",
  },
  {
    art: "pickups",
    body:
      "Tips are {tip} each, on top of each dog's pay, so grab what you can. " +
      "A dog that reaches a treat cheers its owner: +{treatHearts}♥. " +
      "Aim for a lost wallet or a friendly neighbor, too.",
    title: "Tips and treats",
  },
  {
    art: "cards",
    body:
      "A skunk, a thief or another dog opens a card. " +
      "Each option costs cash, hearts or a debuff, and one always costs no cash. " +
      "A puddle makes the pack Muddy. Debuffs wear off after {debuffSeconds}s. " +
      "Hold a card, an icon or a bar for details.",
    title: "Some bumps bring cards",
  },
  {
    art: "owners",
    body:
      "Owners have {smallHearts}♥ small, {mediumHearts}♥ medium, {bigHearts}♥ big, " +
      "and big dogs slow your lane changes. " +
      "A lone dog's owner gets +{loneBonus}♥, a pair's lead +{pairBonus}♥. " +
      "A plain bump costs that dog's owner {bumpHearts}♥; small dogs dodge 1 in {dodgeIn}. " +
      "At 0♥ the owner fires you.",
    title: "Keep owners happy",
  },
  {
    art: "pulls",
    body:
      "Every dog loves squirrels. Touching one does nothing, but a bubble and a line to it mean a dog is straining. " +
      "Steer away and the pull is off; wait and the pack lurches one lane toward it. " +
      "A pull never drags you into a bump too close to dodge.",
    title: "Watch for pulls",
  },
  {
    art: "zones",
    body:
      "Walk {walkLength} neighborhoods of {world}, each busier than the last. " +
      "Each dog's pay is banked as you finish one. " +
      "At a fork, each path brings an upgrade, and harder ones pay more. " +
      "Bring every dog home for the Pack bonus.",
    title: "Neighborhoods",
  },
] as const satisfies readonly [HelpPage, ...HelpPage[]];
