export const SCENE_KEYS = {
  boot: "boot",
  card: "card",
  celebration: "celebration",
  end: "end",
  help: "help",
  // The help pages' pictures: the walk, and the HUD and a card over it.
  helpCard: "helpCard",
  helpHud: "helpHud",
  helpPicture: "helpPicture",
  hud: "hud",
  pause: "pause",
  run: "run",
  settings: "settings",
  shop: "shop",
  start: "start",
  stats: "stats",
  zoneCelebration: "zoneCelebration",
} as const;

export type SceneKey = (typeof SCENE_KEYS)[keyof typeof SCENE_KEYS];
