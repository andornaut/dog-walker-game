import type { GameData } from "../data/types";
import { DEFAULT_WALKER, WALKER_PACES, WALKER_STYLES, WALKERS } from "../data/walkers";

// The walker data, for a test's data object. Under TEST_TUNING no walker changes anything.
export const TEST_WALKER_DATA: Pick<
  GameData,
  "defaultWalker" | "walkerPaces" | "walkerStyles" | "walkers"
> = {
  defaultWalker: DEFAULT_WALKER,
  walkerPaces: WALKER_PACES,
  walkerStyles: WALKER_STYLES,
  walkers: WALKERS,
};
