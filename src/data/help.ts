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
      "Some obstacles move: an arrow shows where, and every arrow is real.",
    title: "Switch lanes",
  },
  {
    art: "pickups",
    body:
      "Tips are {tip} each, on top of each dog's pay. " +
      "A treat gives its dog's owner +{treatHearts}♥, or {treatCash} when every owner is full. " +
      "Aim for a lost wallet or a friendly neighbour, and grab dropped gear: " +
      "it works for the rest of the walk.",
    title: "Tips, treats and finds",
  },
  {
    art: "cards",
    body:
      "Skunks, thieves, dogs and more open cards. " +
      "Each option costs cash, hearts or a debuff; one never costs cash. " +
      "Puddles and potholes make the pack Muddy. Debuffs wear off in time. " +
      "Hold a card, icon or bar for details.",
    title: "Some obstacles bring cards",
  },
  {
    art: "owners",
    body:
      "Owners have {smallHearts}♥ small, {mediumHearts}♥ medium, {largeHearts}♥ large, " +
      "and large dogs slow your lane changes. " +
      "A lone dog's owner gets +{loneBonus}♥, a pair's lead +{pairBonus}♥. " +
      "A bump costs that dog's owner {bumpHearts}♥; small dogs dodge 1 in {dodgeIn}. " +
      "At 0♥ the owner fires you.",
    title: "Keep owners happy",
  },
  {
    art: "pulls",
    body:
      "Touching a squirrel does nothing, but a bubble and a line to it mean a dog is straining. " +
      "Steer away and the pull is off; wait and the pack lurches one lane toward it. " +
      "A pull never drags you into a bump too close to dodge.",
    title: "Watch for pulls",
  },
  {
    art: "zones",
    body:
      "Walk {walkLength} neighbourhoods of {world}, each busier than the last. " +
      "Each dog's pay is banked as you finish one. " +
      "At a fork, each path brings an upgrade. " +
      "Bring every dog home for the {walkBonus} Walk bonus, " +
      "or pause to head home early with your cash.",
    title: "Neighbourhoods",
  },
] as const satisfies readonly [HelpPage, ...HelpPage[]];
