export const SCENE_KEYS = {
  boot: "boot",
  card: "card",
  end: "end",
  help: "help",
  hud: "hud",
  pause: "pause",
  run: "run",
  settings: "settings",
  start: "start",
  stats: "stats",
} as const;

export type SceneKey = (typeof SCENE_KEYS)[keyof typeof SCENE_KEYS];
