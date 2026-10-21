import type { GameData } from "../data/types";
import { read } from "./units";

export type FaceMood = "happy" | "neutral" | "upset";

// How an owner or dog looks at a number of hearts.
export function faceMood(data: Pick<GameData, "tuning">, hearts: number): FaceMood {
  if (hearts >= read(data.tuning, "hearts", "faceHappyFrom")) {
    return "happy";
  }
  return hearts >= read(data.tuning, "hearts", "faceNeutralFrom") ? "neutral" : "upset";
}
