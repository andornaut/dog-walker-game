// npm run export:data [-- --check]
// Writes shared/export/game-data.json and layout.json from the game's modules, for art's tools.
// --check writes nothing and fails if the committed files differ from what the code exports.
import { gameData } from "../data";
import { dataExportFiles } from "./dataExport";
import { writeOrCheck } from "./files";

process.exitCode = await writeOrCheck(
  "npm run export:data",
  "shared/export",
  dataExportFiles(gameData),
);
