// npm run art:unused
// Lists the art manifest's keys that no source file, game data or shared table names.
// Informational: it always exits 0.
import { readdirSync, readFileSync } from "node:fs";

import { gameData } from "../data";
import { parseManifest } from "./manifest";
import { keyNames, unusedKeys } from "./unusedArt";

const sources = readdirSync("src", { encoding: "utf8", recursive: true })
  .filter((path) => path.endsWith(".ts") && !path.endsWith(".test.ts"))
  .map((path) => readFileSync(`src/${path}`, "utf8"));
// The tables in shared/ the game reads, such as roadside.json's prop keys.
const tables = readdirSync("shared")
  .filter((path) => path.endsWith(".json"))
  .map((path) => JSON.parse(readFileSync(`shared/${path}`, "utf8")) as unknown);
const manifest = parseManifest(JSON.parse(readFileSync("public/art/manifest.json", "utf8")));
const unused = unusedKeys(keyNames(sources, [gameData, ...tables]), manifest);

const lines = Object.entries(unused).flatMap(([list, keys]) =>
  keys.length === 0 ? [] : [`${list} (${keys.length}):`, ...keys.map((key) => `  ${key}`)],
);
process.stdout.write(
  `${lines.length === 0 ? "Every manifest key is named in src/, the game data or shared/." : lines.join("\n")}\n`,
);
