import type { FieldTable } from "../lib/lines";

// The message strip's single lines, filled with fillLine(STRIP_LINE_FIELDS,
// gameData.runText.strip, key, fields); its debuff lines are filled by debuff id.
export const STRIP_LINE_FIELDS = {
  achievement: ["name"],
  dodge: ["dog", "obstacle"],
  effectStart: ["effect", "name"],
  fired: ["dog", "owner"],
  fullPackHome: ["amount"],
  heavyDog: ["dog", "speed"],
  kindWords: ["owner"],
  lowHearts: ["owner"],
  luckyWallet: ["amount"],
  muddyHearts: ["cost", "hearts", "owner"],
  plainHit: ["dog", "hearts", "obstacle", "owner"],
  pull: ["dog"],
  treat: ["dog", "hearts", "owner"],
} as const;

// The {name}s each walk text line may use, by group; a line left out uses none. A line is
// filled with fillLine(RUN_TEXT_FIELDS.<group>, gameData.runText.<group>, key, fields).
export const RUN_TEXT_FIELDS = {
  card: {
    fires: ["owners"],
    forkFees: ["fees"],
    heartForgiven: ["dog", "hearts"],
    need: ["amount"],
  },
  explain: {
    dogHearts: ["hearts", "max"],
    extraHearts: ["hearts", "name", "owner"],
  },
  firedBy: ["owner"],
  fullPackHome: ["amount"],
  homeQuestion: {
    lose: ["fees", "zone"],
    loseBonus: [],
    loseWithBonus: ["fees", "zone"],
    zonesLeft: ["count"],
  },
  lowHearts: ["owner"],
  newWalker: {
    info: ["agility", "perk"],
    infoBase: ["perk"],
    subtitle: ["walker"],
  },
  seconds: ["seconds"],
  strip: {
    ...STRIP_LINE_FIELDS,
    debuffStart: { muddy: ["hearts", "seconds"], stinky: ["seconds"], zoomies: ["seconds"] },
  },
  zoneBanner: ["n", "world"],
  zoneDone: {
    earnings: ["fees", "tips"],
    subtitle: ["zone"],
  },
  zoneProgress: ["n", "total"],
} as const satisfies FieldTable;
