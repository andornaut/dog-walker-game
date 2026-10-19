export const SCENE_KEYS = {
  boot: "boot",
  card: "card",
  end: "end",
  help: "help",
  hud: "hud",
  pause: "pause",
  run: "run",
  start: "start",
} as const;

export type SceneKey = (typeof SCENE_KEYS)[keyof typeof SCENE_KEYS];
