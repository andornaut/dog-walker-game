import type { EncounterId, MinorObstacleId } from "../data/types";
import { insetRect, type Rect, ringRects } from "../lib/rect";
import { PALETTE } from "../ui/phaser/palette";

// Every bump flashes a border round the whole screen in the bump's colour and nudges the road:
// a minor obstacle's hit, a mover's included and one that costs cash while Spotlight lasts, and
// a card or contact obstacle's hit. A squirrel is not a bump: touching it does nothing. The
// border is BUMP_FLASH.width pixels of the colour at the screen's edge with an ink keyline
// BUMP_FLASH.keyline wide just inside it, so it reads over a backdrop of its own colour, and
// it shows for BUMP_FLASH.ms, as long as an encounter's edge flash. The nudge is a mover's road
// shake (ROAD_SHAKE in hitEffects.ts); reduced motion keeps the border and drops the nudge.
export const BUMP_FLASH = { keyline: 1, ms: 280, width: 2 } as const;

// The colours a border may take: each reads against the HUD's dark panels.
type BorderColour =
  | "amber"
  | "cream"
  | "cyan"
  | "green"
  | "lightGrey"
  | "mauve"
  | "orange"
  | "pink"
  | "red"
  | "tan"
  | "white"
  | "yellow";

// An encounter's flash colour, which names its ui-hit-flash-<colour> edge flash strip.
export type FlashColour = "amber" | "mauve" | "orange" | "pink" | "sky";

export const FLASH_COLOURS: Readonly<Partial<Record<EncounterId, FlashColour>>> = {
  capybara: "amber",
  droppedCone: "pink",
  fishCrates: "sky",
  otherDog: "pink",
  porchCat: "orange",
  promoTeam: "amber",
  puddle: "sky",
  skunk: "mauve",
  squirrel: "orange",
  thief: "amber",
  weddingShoot: "pink",
};

// The border colour of each edge flash strip's colour.
const STRIP_BORDERS: Readonly<Record<FlashColour, BorderColour>> = {
  amber: "amber",
  mauve: "mauve",
  orange: "orange",
  pink: "pink",
  sky: "cyan",
};

// Each minor obstacle's border: its sprite's main colour, the outline and dark shading aside.
export const MINOR_FLASH_COLOURS: Readonly<Record<MinorObstacleId, BorderColour>> = {
  ball: "red",
  barrier2: "orange",
  barrier3: "orange",
  bench: "tan",
  bunny: "white",
  busker: "green",
  car: "cyan",
  cargoBike: "tan",
  cat: "white",
  clothingRack: "mauve",
  cone: "orange",
  couple: "mauve",
  coyote: "tan",
  cyclist: "cyan",
  deliveryCyclist: "cyan",
  deliveryTruck: "tan",
  ducklings: "yellow",
  frisbeeDog: "red",
  garbageTruck: "green",
  goose: "white",
  hedge: "green",
  hotDogCart: "amber",
  iceCreamTruck: "pink",
  jogger: "orange",
  kidOnBike: "yellow",
  leafPile: "orange",
  lifeguardChair: "red",
  mailCarrier: "cyan",
  parkedCar: "cyan",
  patioRail: "green",
  pedicab: "cyan",
  picnicBlanket: "red",
  pigeons: "lightGrey",
  porchSteps: "red",
  produceCrates: "tan",
  raccoon: "lightGrey",
  rollerblader: "green",
  rollingBarrel: "tan",
  sandcastle: "tan",
  sandwichBoard: "green",
  scooter: "cyan",
  seagull: "white",
  streetcar: "red",
  stroller: "green",
  tourist: "cream",
  trashCan: "green",
  ttcBus: "red",
  velvetRope: "yellow",
};

// What was bumped: a minor obstacle, or an encounter that is an obstacle.
export type BumpSource =
  | { readonly encounter: EncounterId; readonly kind: "encounter" }
  | { readonly kind: "minor"; readonly obstacle: MinorObstacleId };

// An encounter with no flash colour flashes amber, as its edge flash does.
export function encounterFlashColour(encounter: EncounterId): FlashColour {
  return FLASH_COLOURS[encounter] ?? "amber";
}

export interface BumpFlash {
  readonly colour: number;
  readonly nudge: boolean;
}

export function bumpFlash(still: boolean, source: BumpSource): BumpFlash {
  const name =
    source.kind === "minor"
      ? MINOR_FLASH_COLOURS[source.obstacle]
      : STRIP_BORDERS[encounterFlashColour(source.encounter)];
  return { colour: PALETTE[name], nudge: !still };
}

// The border round screen: the bump's colour band at its edge and the ink keyline inside it,
// each as its top, bottom, left and right rects.
export function bumpBorder(screen: Rect): { band: Rect[]; keyline: Rect[] } {
  return {
    band: ringRects(BUMP_FLASH.width, screen),
    keyline: ringRects(BUMP_FLASH.keyline, insetRect(BUMP_FLASH.width, screen)),
  };
}
