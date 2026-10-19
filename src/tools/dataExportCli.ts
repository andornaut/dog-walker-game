// npm run export:data [-- --check]
// Writes shared/export/game-data.json and layout.json from the game's modules, for art's tools.
// --check writes nothing and fails if the committed files differ from what the code exports.
import { gameData } from "../data";
import { dataExportFiles } from "./dataExport";
import { staleFiles, writeFiles } from "./files";

const check = process.argv.includes("--check");
const files = dataExportFiles(gameData);
const root = process.cwd();

if (check) {
  const stale = await staleFiles(root, files);
  for (const path of stale) {
    process.stderr.write(`${path} is out of date: run npm run export:data\n`);
  }
  process.exitCode = stale.length === 0 ? 0 : 1;
} else {
  const written = await writeFiles(root, files);
  process.stdout.write(
    written.length === 0 ? "shared/export is up to date\n" : `wrote ${written.join(", ")}\n`,
  );
}
