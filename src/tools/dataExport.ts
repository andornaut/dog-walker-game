import { gameData } from "../data";
import type { GameData } from "../data/types";
import { jsonText } from "./files";
import { gameDataExport } from "./gameDataExport";
import { layoutExport } from "./layoutExport";

// Where npm run export:data writes, relative to the repository root.
export const DATA_EXPORT_DIR = "shared/export";

// Each export file's path from the repository root, and its text.
export function dataExportFiles(data: GameData): Map<string, string> {
  return new Map([
    [`${DATA_EXPORT_DIR}/game-data.json`, jsonText(gameDataExport(data))],
    [`${DATA_EXPORT_DIR}/layout.json`, jsonText(layoutExport(data))],
  ]);
}

// The export of the live game data, for a caller that loads this module fresh.
export function currentDataExportFiles(): Map<string, string> {
  return dataExportFiles(gameData);
}
