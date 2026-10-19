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
    },
    {
      id: "park",
      leashColor: "#a22633",
      name: "Bark Park",
      roadColor: "#e4a672",
      roadShadowColor: "#b86f50",
    },
    {
      id: "shops",
      leashColor: "#a22633",
      name: "Sniff Street Shops",
      roadColor: "#c0cbdc",
      roadShadowColor: "#8b9bb4",
    },
    {
      id: "homeStretch",
      leashColor: "#3e2731",
      name: "The Long Way Home",
      roadColor: "#c28569",
      roadShadowColor: "#b86f50",
    },
  ],
} as const satisfies World;
