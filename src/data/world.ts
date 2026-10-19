import type { World } from "./types";

// The first world: a fixed route of zones, each the same distance.
export const WORLD = {
  name: "Maple Street",
  zones: [
    {
      id: "street",
      leashColor: "#f6757a",
      name: "Woof Way",
      roadColor: "#3a4466",
      roadShadowColor: "#262b44",
      weights: {
        needSpots: { fireHydrant: 2, lampPost: 2, playmate: 1, stranger: 1, tree: 1, waterBowl: 1 },
      },
    },
    {
      id: "park",
      leashColor: "#a22633",
      name: "Bark Park",
      roadColor: "#e4a672",
      roadShadowColor: "#b86f50",
      weights: {
        needSpots: { fireHydrant: 1, lampPost: 1, playmate: 3, stranger: 1, tree: 2, waterBowl: 2 },
      },
    },
    {
      id: "shops",
      leashColor: "#a22633",
      name: "Sniff Street Shops",
      roadColor: "#c0cbdc",
      roadShadowColor: "#8b9bb4",
      weights: {
        needSpots: { fireHydrant: 2, lampPost: 2, playmate: 1, stranger: 3, tree: 1, waterBowl: 2 },
      },
    },
    {
      id: "homeStretch",
      leashColor: "#3e2731",
      name: "The Long Way Home",
      roadColor: "#c28569",
      roadShadowColor: "#b86f50",
      weights: {
        needSpots: { fireHydrant: 1, lampPost: 1, playmate: 1, stranger: 1, tree: 1, waterBowl: 1 },
      },
    },
  ],
} as const satisfies World;
