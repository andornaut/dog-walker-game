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
      "Drag anywhere: each lane-width you drag moves the pack one lane. " +
      "A tap moves one lane toward that side. Keys: arrows, A/D or H/L.",
    title: "Switch lanes",
  },
  {
    art: "help-pickups",
    body:
      "Run into tips for money. Smaller packs get a little extra. Treats are carried, up to 3. " +
      "Tap a doghouse to give its owner a treat: +1♥.",
    title: "Tips and treats",
  },
  {
    art: "help-cards",
    body:
      "Hit a skunk, puddle or thief and the walk pauses. " +
      "Pick a card: pay up, or upset the owners. " +
      "Every card shows its outcome; hold one for details. One is always free. " +
      "Cones and bins just cost a few tips. " +
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
      "A bubble and a dotted line over a dog mean a pull. " +
      "It tugs the pack one lane toward what it wants, never into an obstacle. " +
      "Drag back any time.",
    title: "Watch for pulls",
  },
  {
    art: "help-needs",
    body:
      "Each dog has a need: Friendly, Playful, Nosy, Regular or Thirsty. " +
      "When it's urgent, a bubble shows and the dog pulls toward its spot. " +
      "Steer into the spot for a happy owner. Left too long, it goes wrong.",
    title: "Needs",
  },
  {
    art: "help-zones",
    body:
      "Walk 4 zones of Maple Street, picking the next at each fork. " +
      "Every dog pays its fee after each zone. " +
      "Between zones, pick an upgrade card. Head home any time from the pause menu.",
    title: "Four zones",
  },
] as const satisfies readonly [HelpPage, ...HelpPage[]];
