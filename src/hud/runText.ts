import type { FieldTable } from "../lib/lines";

// The message strip's single lines, filled with fillLine(STRIP_LINE_FIELDS,
// gameData.runText.strip, key, fields); its debuff lines are filled by debuff id.
export const STRIP_LINE_FIELDS = {
  achievement: ["name"],
  cashHit: ["amount", "dog", "obstacle"],
  dodge: ["dog", "obstacle"],
  effectStart: ["effect", "name"],
  fired: ["dog", "owner"],
  fullPackHome: ["amount"],
  largeDog: ["dog", "speed"],
  lowHearts: ["owner"],
  luckyWallet: ["amount"],
  muddyHearts: ["cost", "hearts", "owner"],
  plainHit: ["dog", "hearts", "obstacle", "owner"],
  pull: ["dog"],
  secondChance: ["owner"],
  treat: ["dog", "hearts", "owner"],
} as const;

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
  fullPackHome: ["amount"],
  homeQuestion: {
    lose: ["fees", "zone"],
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
    debuffStart: {
      muddy: ["hearts", "seconds"],
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
