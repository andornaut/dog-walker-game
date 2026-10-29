import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import type { Plugin } from "vite";

// The Phaser namespaces the game reads nothing from, which the build's Phaser leaves out. A
// module in one is still bundled when a kept module requires it. phaserBuild.test.ts fails when
// the game imports one of these, or reaches a factory or scene plugin only they register.
export const OMITTED_PHASER_NAMESPACES: readonly string[] = [
  "Actions",
  "Class",
  "Curves",
  "DOM",
  "Geom",
  "Physics",
  "Plugins",
  "Structs",
  "Tilemaps",
  "Utils",
];

// Phaser's feature flags, which its own build replaces in each `typeof <FLAG>` test of its
// source: the values of its ESM build (config/webpack.dist.config.js), with the Canvas renderer
// left out, since the game runs on WebGL alone (`type: WEBGL` in src/main.ts).
export const PHASER_FLAGS: Readonly<Record<string, boolean>> = {
  CANVAS_RENDERER: false,
  EXPERIMENTAL: false,
  FEATURE_SOUND: true,
  WEBGL_DEBUG: false,
  WEBGL_RENDERER: true,
};

// The entry module the build resolves `phaser` to. Rolldown's \0 prefix marks it as naming no
// file; vite.config.ts puts it in the Phaser chunk.
export const PHASER_ENTRY_ID = "\0phaser-entry.cjs";

const FLAG_TEST = /typeof ([A-Z][A-Z0-9_]+)\b/g;
const NAMESPACE_EXPORT = /^export const (\w+) = require\('([^']+)'\);$/;
const CONSTANT_EXPORT = /^export const (\w+) = CONST\.(\w+);$/;
const POLYFILL = /^require\('(\.\/polyfills\/[^']+)'\);$/;

// Phaser's source folder, phaser/src/, found through its package.json (the package's exports name
// no other path).
export function phaserSourceDir(): string {
  return join(dirname(createRequire(import.meta.url).resolve("phaser/package.json")), "src");
}

interface PhaserExports {
  // Each namespace's module, relative to phaser/src/.
  namespaces: Map<string, string>;
  // Each constant's key in phaser/src/const.js.
  constants: Map<string, string>;
  polyfills: string[];
}

// The named exports of Phaser's ESM entry, phaser/src/phaser-esm.js. Throws on an export of any
// other form, so a Phaser release that changes the entry's shape stops the build.
export function phaserExports(esmEntry: string): PhaserExports {
  const exports: PhaserExports = { constants: new Map(), namespaces: new Map(), polyfills: [] };
  const lines = esmEntry.split("\n").map((line) => line.trim());
  const defaultExport = lines.findIndex((line) => line.startsWith("export default"));
  for (const line of defaultExport < 0 ? lines : lines.slice(0, defaultExport)) {
    const namespace = NAMESPACE_EXPORT.exec(line);
    const constant = CONSTANT_EXPORT.exec(line);
    const polyfill = POLYFILL.exec(line);
    if (namespace?.[1] !== undefined && namespace[2] !== undefined) {
      exports.namespaces.set(namespace[1], namespace[2]);
    } else if (constant?.[1] !== undefined && constant[2] !== undefined) {
      exports.constants.set(constant[1], constant[2]);
    } else if (polyfill?.[1] !== undefined) {
      exports.polyfills.push(polyfill[1]);
    } else if (line.startsWith("export ")) {
      throw new Error(`phaser-esm.js has an export this build cannot read: ${line}`);
    }
  }
  return exports;
}

// The entry as CommonJS, like Phaser's own: its namespaces less the omitted ones, and its
// constants, each module named by its absolute path.
export function phaserEntrySource(sourceDir: string, esmEntry: string): string {
  const { constants, namespaces, polyfills } = phaserExports(esmEntry);
  const path = (module: string) => JSON.stringify(join(sourceDir, module));
  const kept = [...namespaces].filter(([name]) => !OMITTED_PHASER_NAMESPACES.includes(name));
  return [
    ...polyfills.map((module) => `require(${path(module)});`),
    `var CONST = require(${path("./const")});`,
    "module.exports = {",
    ...kept.map(([name, module]) => `  ${name}: require(${path(module)}),`),
    ...[...constants].map(([name, key]) => `  ${name}: CONST.${key},`),
    "};",
    "",
  ].join("\n");
}

// code with each of Phaser's feature flag tests replaced by its value.
export function replacePhaserFlags(code: string): string {
  return code.replace(FLAG_TEST, (test, flag: string) =>
    flag in PHASER_FLAGS ? String(PHASER_FLAGS[flag]) : test,
  );
}

// The production build only: resolves `phaser` to an entry built from Phaser's source without
// the omitted namespaces, and replaces the feature flags in Phaser's source, so the Canvas
// renderer drops out. The dev server and Vitest load the package's own bundle.
export function phaserBuildPlugin(): Plugin {
  const sourceDir = phaserSourceDir();
  const inSource = (id: string) => id.startsWith(`${sourceDir}/`);
  return {
    apply: "build",
    enforce: "pre",
    load(id) {
      if (id !== PHASER_ENTRY_ID) {
        return undefined;
      }
      const esmEntry = readFileSync(join(sourceDir, "phaser-esm.js"), "utf8");
      return { code: phaserEntrySource(sourceDir, esmEntry), moduleType: "js" };
    },
    name: "dog-walker-phaser-build",
    resolveId(id) {
      return id === "phaser" ? PHASER_ENTRY_ID : undefined;
    },
    transform(code, id) {
      return inSource(id) ? { code: replacePhaserFlags(code), map: null } : undefined;
    },
  };
}
