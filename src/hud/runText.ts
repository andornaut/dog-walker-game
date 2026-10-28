import type { FieldTable } from "../lib/lines";

// The message strip's single lines, filled with stripLine (src/hud/stripLines.ts); its debuff lines
// are filled by debuff id.
export const STRIP_LINE_FIELDS = {
  achievement: ["name"],
  cashHit: ["amount"],
  dodge: ["dog", "obstacle"],
  effectStart: ["effect", "name"],
  fired: ["dog", "owner"],
  fullPackHome: ["amount"],
  gearFound: ["gear"],
  gearSwapped: ["gear", "old"],
  largeDog: ["dog", "speed"],
  luckyNeighbour: ["gains", "hearts"],
  luckyNeighbourGain: ["dog", "hearts", "owner"],
  luckyWallet: ["amount"],
  plainHit: ["dog", "hearts", "obstacle", "owner"],
  pull: ["dog"],
  secondChance: ["owner"],
  spareTreatSaved: [],
  spareTreatUsed: ["owner"],
  treat: ["dog", "hearts", "owner"],
} as const;

// CLEANUP (added 2026-10-28): strip lines the walk no longer says, whose names the text may use
// until gameplay drops them from the data; then delete this table and its paths in
// UNSAID_RUN_TEXT.
const UNSAID_STRIP_FIELDS = {
  lowHearts: ["owner"],
} as const;

// CLEANUP (added 2026-10-28): the paths of the walk text lines no code says, for the text tests
// to pass over until gameplay drops them from the data; then delete this list.
export const UNSAID_RUN_TEXT: readonly string[] = ["strip.lowHearts"];

// The {name}s each walk text line may use, by group; a line left out uses none. A line is
// filled with fillLine(RUN_TEXT_FIELDS.<group>, gameData.runText.<group>, key, fields).
export const RUN_TEXT_FIELDS = {
  card: {
    fires: ["owners"],
    heartForgiven: ["dog", "hearts"],
    need: ["amount"],
  },
  explain: {
    dogHearts: ["hearts", "max"],
    extraHearts: ["hearts", "name", "owner"],
  },
  firedBy: ["owner"],
  foundGear: ["gear"],
  fullPackHome: ["amount"],
  homeQuestion: {
    lose: ["fees", "zone"],
    zonesLeft: ["count"],
  },
  lowHearts: ["owner"],
  newWalker: {
    agility: ["agility"],
    perk: ["perk"],
    subtitle: ["walker"],
  },
  seconds: ["seconds"],
  strip: {
    ...STRIP_LINE_FIELDS,
    ...UNSAID_STRIP_FIELDS,
    debuffStart: {
      muddy: ["seconds", "slower"],
      spotlight: ["cash", "seconds"],
      stinky: ["seconds"],
      zoomies: ["seconds"],
    },
  },
  zoneBanner: ["n", "world"],
  zoneDone: {
    earnings: ["fees", "tips"],
    subtitle: ["zone"],
  },
  zoneProgress: ["n", "total"],
} as const satisfies FieldTable;
