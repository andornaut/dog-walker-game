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
      "Tap the left or right side of the road, or swipe. Keys: arrows, A/D or H/L. " +
      "Each tap moves the pack one lane. Hold to keep moving.",
    title: "Switch lanes",
  },
  {
    art: "help-pickups",
    body:
      "Run into tips for money. A smaller pack earns bigger tips. Treats are carried, up to 3. " +
      "Tap a dog's slot to give its owner a treat: +1♥.",
    title: "Tips and treats",
  },
  {
    art: "help-cards",
    body:
      "Hit a skunk, puddle or thief and the walk pauses. " +
      "Pick a card: pay up, or upset the owners. " +
      "Every card shows its outcome. One is always free. " +
      "Some bumps are lucky, like a lost wallet.",
    title: "Bumps become cards",
  },
  {
    art: "help-owners",
    body:
      "Each owner has a happiness meter: ♥. Bumps and choices raise or lower it. " +
      "At 0♥ the owner fires you, takes back that dog's fees, and the dog goes home.",
    title: "Keep owners happy",
  },
  {
    art: "help-pulls",
    body:
      "A dog that leans and barks is about to pull. " +
      "It tugs the pack one lane. Steer back any time. " +
      "Food lovers pull toward treats, chasers toward squirrels.",
    title: "Watch for pulls",
  },
  {
    art: "help-zones",
    body:
      "Walk the 4 zones of Maple Street. Every dog pays its fee after each zone. " +
      "Between zones, pick an upgrade card. Head home any time from the pause menu.",
    title: "Four zones",
  },
] as const satisfies readonly [HelpPage, ...HelpPage[]];
