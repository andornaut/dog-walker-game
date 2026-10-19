// npm run art:unused
// Lists the art manifest's keys that no source file or game data names. Informational: it
// always exits 0.
import { gameData } from "../data";
import { parseManifest } from "./manifest";
import { keyNames, unusedKeys } from "./unusedArt";

// The parts of Node this script uses. The project's types are the browser's, so Node is
// reached through globalThis rather than @types/node.
interface NodeModules {
  "node:fs": {
    readdirSync(path: string, options: { recursive: true }): string[];
    readFileSync(path: string, encoding: "utf8"): string;
  };
}

interface NodeProcess {
  getBuiltinModule<Id extends keyof NodeModules>(id: Id): NodeModules[Id];
  readonly stdout: { write(text: string): boolean };
}

const nodeProcess = (globalThis as unknown as { readonly process: NodeProcess }).process;
const fs = nodeProcess.getBuiltinModule("node:fs");

const sources = fs
  .readdirSync("src", { recursive: true })
  .filter((path) => path.endsWith(".ts") && !path.endsWith(".test.ts"))
  .map((path) => fs.readFileSync(`src/${path}`, "utf8"));
const manifest = parseManifest(JSON.parse(fs.readFileSync("public/art/manifest.json", "utf8")));
const unused = unusedKeys(keyNames(sources, gameData), manifest);

const lines = Object.entries(unused).flatMap(([list, keys]) =>
  keys.length === 0 ? [] : [`${list} (${keys.length}):`, ...keys.map((key) => `  ${key}`)],
);
nodeProcess.stdout.write(
  `${lines.length === 0 ? "Every manifest key is named in src/ or the game data." : lines.join("\n")}\n`,
);
