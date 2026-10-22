// npm run art:unused
// Lists the art manifest's keys that no source file, game data, shared table or site page names.
// Informational: it exits 0 whatever it finds.
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
// The keys the site's pages and the nav load by path, such as the home page's portraits.
const pageKeys = [
  ...readdirSync("pages", { encoding: "utf8", recursive: true })
    .filter((path) => path.endsWith(".html"))
    .map((path) => `pages/${path}`),
  ...readdirSync("public")
    .filter((path) => /\.(?:css|html|js)$/.test(path))
    .map((path) => `public/${path}`),
].flatMap((path) =>
  [...readFileSync(path, "utf8").matchAll(/\/art\/[a-z]+\/([a-z0-9-]+)\./g)].map(([, key]) => key),
);
const manifest = parseManifest(JSON.parse(readFileSync("public/art/manifest.json", "utf8")));
const unused = unusedKeys(keyNames(sources, [gameData, ...tables, pageKeys]), manifest);

const lines = Object.entries(unused).flatMap(([list, keys]) =>
  keys.length === 0 ? [] : [`${list} (${keys.length}):`, ...keys.map((key) => `  ${key}`)],
);
const allNamed = "Every manifest key is named in src/, the game data, shared/ or the site's pages.";
process.stdout.write(`${lines.length === 0 ? allNamed : lines.join("\n")}\n`);
