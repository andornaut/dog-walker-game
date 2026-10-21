import type { FieldTable } from "../text/lines";

// The message strip's single lines, filled with fillLine(STRIP_LINE_FIELDS,
// gameData.runText.strip, key, fields); its debuff lines are filled by debuff id.
export const STRIP_LINE_FIELDS = {
  achievement: ["name"],
  dodge: ["dog", "obstacle"],
  fired: ["dog", "owner"],
  fullPackHome: ["amount"],
  kindWords: ["owner"],
  lowHearts: ["owner"],
  luckyWallet: ["amount"],
  plainHit: ["dog", "hearts", "obstacle", "owner"],
  pull: ["dog"],
  pullCancel: ["dog"],
  treat: ["dog", "hearts", "owner"],
} as const;

// The {name}s each walk text line may use, by group; a line left out uses none. A line is
// filled with fillLine(RUN_TEXT_FIELDS.<group>, gameData.runText.<group>, key, fields).
export const RUN_TEXT_FIELDS = {
  card: {
    fires: ["owners"],
    forkFees: ["fees"],
    need: ["amount"],
  },
  explain: {
    debuff: ["name", "stake"],
    dog: ["dog", "hearts", "max", "owner", "size"],
    effect: ["effect", "name"],
    moreEffects: ["count"],
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
    subtitle: ["walker"],
  },
  strip: {
    ...STRIP_LINE_FIELDS,
    debuffStart: { muddy: ["seconds"], stinky: ["seconds"], zoomies: ["seconds"] },
  },
  zoneDone: {
    earnings: ["fees", "tips"],
    subtitle: ["zone"],
  },
} as const satisfies FieldTable;
