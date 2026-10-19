import type { World } from "./types";

// The first world: a fixed route of zones, each the same distance.
export const WORLD = {
  name: "Maple Street",
  zones: [
    { id: "street", name: "Street", roadColor: "#3a4466", roadShadowColor: "#262b44" },
    { id: "park", name: "Park", roadColor: "#e4a672", roadShadowColor: "#b86f50" },
    { id: "shops", name: "Shops", roadColor: "#c0cbdc", roadShadowColor: "#8b9bb4" },
    { id: "homeStretch", name: "Home stretch", roadColor: "#c28569", roadShadowColor: "#b86f50" },
  ],
} as const satisfies World;
