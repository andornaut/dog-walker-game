import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import {
  OMITTED_PHASER_NAMESPACES,
  PHASER_FLAGS,
  phaserEntrySource,
  phaserExports,
  phaserSourceDir,
  replacePhaserFlags,
} from "./phaserBuild";

const REPO = join(import.meta.dirname, "../..");
const SOURCE_DIR = phaserSourceDir();
const ESM_ENTRY = readFileSync(join(SOURCE_DIR, "phaser-esm.js"), "utf8");
const PHASER_EXPORTS = phaserExports(ESM_ENTRY);

// The shipped TypeScript: every module under src/ and the kit but the tests.
const SHIPPED: readonly string[] = ["src", "vendor/game-kit/src"].flatMap((root) =>
  (readdirSync(join(REPO, root), { recursive: true }) as string[])
    .filter((path) => path.endsWith(".ts") && !path.endsWith(".test.ts"))
    .map((path) => join(REPO, root, path)),
);

// Phaser's source files under dir, a folder under phaser/src/.
function phaserFiles(dir: string): string[] {
  return (readdirSync(join(SOURCE_DIR, dir), { recursive: true }) as string[])
    .filter((path) => path.endsWith(".js"))
    .map((path) => join(SOURCE_DIR, dir, path));
}

// What only the omitted namespaces' folders register: game object factories and creators,
// which a scene reaches as this.add.<name> and this.make.<name>, and scene plugins, reached as
// this.<name>. `physics` is the name a scene reaches its default physics system by.
interface SceneNames {
  factories: ReadonlySet<string>;
  plugins: ReadonlySet<string>;
}

function omittedSceneNames(): SceneNames {
  const factory = /GameObject(?:Factory|Creator)\.register\('(\w+)'/g;
  const plugin = /PluginCache\.register\('\w+',\s*\w+,\s*'(\w+)'/g;
  const folders = OMITTED_PHASER_NAMESPACES.flatMap((name) => {
    const module = PHASER_EXPORTS.namespaces.get(name) ?? "";
    return module.split("/").length === 2 ? [module] : [];
  });
  const texts = folders.flatMap(phaserFiles).map((file) => readFileSync(file, "utf8"));
  const names = (pattern: RegExp) =>
    texts.flatMap((text) => [...text.matchAll(pattern)].map(([, name]) => name ?? ""));
  return {
    factories: new Set(names(factory)),
    plugins: new Set(["physics", ...names(plugin)]),
  };
}

// What a module's text uses of Phaser that the build's Phaser may lack: each value it imports
// from "phaser" ("*" for a default, namespace or dynamic import, which the scan cannot follow)
// and each of names it reaches: a factory through add or make, or a plugin by any property.
function phaserUses(names: SceneNames, text: string): string[] {
  const source = ts.createSourceFile("module.ts", text, ts.ScriptTarget.Latest, true);
  const uses: string[] = [];
  const isPhaser = (node: ts.Node | undefined) =>
    node !== undefined && ts.isStringLiteral(node) && node.text === "phaser";
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && isPhaser(node.moduleSpecifier)) {
      const clause = node.importClause;
      if (clause !== undefined && !clause.isTypeOnly) {
        const bindings = clause.namedBindings;
        if (clause.name !== undefined || (bindings && ts.isNamespaceImport(bindings))) {
          uses.push("*");
        }
        if (bindings && ts.isNamedImports(bindings)) {
          for (const element of bindings.elements.filter(({ isTypeOnly }) => !isTypeOnly)) {
            uses.push((element.propertyName ?? element.name).text);
          }
        }
      }
    } else if (ts.isExportDeclaration(node) && isPhaser(node.moduleSpecifier)) {
      uses.push("*");
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      isPhaser(node.arguments[0])
    ) {
      uses.push("*");
    } else if (
      ts.isPropertyAccessExpression(node) &&
      names.factories.has(node.name.text) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ["add", "make"].includes(node.expression.name.text)
    ) {
      uses.push(node.name.text);
    } else if (
      (ts.isPropertyAccessExpression(node) || ts.isPropertyAssignment(node)) &&
      ts.isIdentifier(node.name) &&
      names.plugins.has(node.name.text)
    ) {
      uses.push(node.name.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return uses;
}

describe("the build's Phaser", () => {
  it("omits only namespaces Phaser's entry exports", () => {
    const missing = OMITTED_PHASER_NAMESPACES.filter(
      (name) => !PHASER_EXPORTS.namespaces.has(name),
    );
    expect(missing).toEqual([]);
  });

  it("sets each feature flag Phaser's own ESM build sets, the Canvas renderer off", () => {
    const config = readFileSync(join(SOURCE_DIR, "../config/webpack.dist.config.js"), "utf8");
    const esmBuild = config.slice(config.indexOf("name: 'phaser-esm'"));
    const flags = Object.fromEntries(
      [...esmBuild.matchAll(/"typeof (\w+)": JSON\.stringify\((true|false)\)/g)].map(
        ([, flag, value]) => [flag, value === "true"],
      ),
    );
    expect(PHASER_FLAGS).toEqual({ ...flags, CANVAS_RENDERER: false });
  });

  it.each([
    ["a flag", "if (typeof CANVAS_RENDERER) {}", "if (false) {}"],
    ["a negated flag", "!typeof WEBGL_RENDERER", "!true"],
    ["a global", "typeof URL === 'function'", "typeof URL === 'function'"],
    ["a flag Phaser's build leaves unset", "typeof PLUGIN_FBINSTANT", "typeof PLUGIN_FBINSTANT"],
  ])("replaces %s as Phaser's build does", (_, code, replaced) => {
    expect(replacePhaserFlags(code)).toBe(replaced);
  });

  it("exports every kept namespace and constant, and no omitted namespace", () => {
    const entry = phaserEntrySource(SOURCE_DIR, ESM_ENTRY);
    const exported = [...entry.matchAll(/^ {2}(\w+): /gm)].map(([, name]) => name);
    const kept = [...PHASER_EXPORTS.namespaces.keys()].filter(
      (name) => !OMITTED_PHASER_NAMESPACES.includes(name),
    );
    expect(exported.sort()).toEqual([...kept, ...PHASER_EXPORTS.constants.keys()].sort());
    expect(kept).toContain("GameObjects");
  });

  it.each([
    ["a namespace", 'import { Physics, Scene } from "phaser";', ["Physics", "Scene"]],
    ["a renamed namespace", 'import { Math as PhaserMath } from "phaser";', ["Math"]],
    ["types only", 'import type { Physics } from "phaser";', []],
    ["an inline type", 'import { type Geom, Scene } from "phaser";', ["Scene"]],
    ["the default export", 'import Phaser from "phaser";', ["*"]],
    ["the namespace object", 'import * as Phaser from "phaser";', ["*"]],
    ["a dynamic import", 'void import("phaser");', ["*"]],
    ["a re-export", 'export { Physics } from "phaser";', ["*"]],
    ["a scene plugin", "this.physics.add.sprite(0, 0, key);", ["physics"]],
    ["a factory", "scene.add.tilemap({ key });", ["tilemap"]],
    ["a creator", "this.make.tilemap({ key });", ["tilemap"]],
    ["a factory's name elsewhere", "const { tilemap } = level; level.tilemap.x = 1;", []],
    ["a game config key", "new Game({ physics: {} });", ["physics"]],
    ["another module", 'import { x } from "./phaser";', []],
  ])("finds %s", (_, text, uses) => {
    const names = { factories: new Set(["tilemap"]), plugins: new Set(["physics"]) };
    expect(phaserUses(names, text)).toEqual(uses);
  });

  it("leaves out nothing the game uses", () => {
    const names = omittedSceneNames();
    const lacking = new Set([
      ...OMITTED_PHASER_NAMESPACES,
      ...names.factories,
      ...names.plugins,
      "*",
    ]);
    const uses = SHIPPED.flatMap((file) =>
      phaserUses(names, readFileSync(file, "utf8"))
        .filter((use) => lacking.has(use))
        .map((use) => `${relative(REPO, file)}: ${use}`),
    );
    expect(names.factories).toContain("tilemap");
    expect(names.plugins).toContain("arcadePhysics");
    expect(uses).toEqual([]);
  });
});
