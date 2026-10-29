import type { FieldTable } from "../lib/lines";

// The message strip's single lines, filled with stripLine (src/hud/stripLines.ts); its debuff lines
// are filled by debuff id.
export const STRIP_LINE_FIELDS = {
  achievement: ["name"],
  cashHit: [],
  dodge: ["dog", "obstacle"],
  effectStart: ["effect", "name"],
  fired: ["dog", "owner"],
  fullPackHome: ["amount"],
  gearFound: ["gear"],
  gearSwapped: ["gear", "old"],
  largeDog: ["dog", "speed"],
  luckyNeighbour: ["hearts"],
  luckyWallet: [],
  plainHit: ["dog", "hearts", "obstacle", "owner"],
  pull: ["dog"],
  secondChance: ["owner"],
  spareTreatSaved: [],
  spareTreatUsed: ["owner"],
  treat: ["dog", "hearts", "owner"],
  treatCash: [],
} as const;

// The {name}s each walk text line may use, by group; a line left out uses none. A line is
// filled with fillLine(RUN_TEXT_FIELDS.<group>, gameData.runText.<group>, key, fields).
export const RUN_TEXT_FIELDS = {
  card: {
    fires: ["owners"],
    heartForgiven: ["dog", "hearts"],
    heartsEach: ["hearts"],
    need: ["amount"],
  },
  explain: {
    dogHearts: ["hearts", "max"],
    extraHearts: ["hearts", "name", "owner"],
  },
  firedBy: ["owner"],
  foundGear: ["gear"],
  homeQuestion: {
    lose: ["lost", "zone"],
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
    debuffStart: {
      muddy: ["seconds"],
      spotlight: ["cash", "seconds"],
      stinky: ["seconds"],
      zoomies: ["seconds"],
    },
  },
  zoneBanner: ["n", "world"],
  zoneDone: {
    earnings: { bonus: ["amount"], fees: ["amount"], tips: ["amount"] },
    subtitle: ["zone"],
  },
  zoneProgress: ["n", "total"],
} as const satisfies FieldTable;
