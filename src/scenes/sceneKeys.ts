export const SCENE_KEYS = {
  card: "card",
  help: "help",
  hud: "hud",
  run: "run",
} as const;

export type SceneKey = (typeof SCENE_KEYS)[keyof typeof SCENE_KEYS];
