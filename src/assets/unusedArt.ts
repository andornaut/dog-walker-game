import ts from "typescript";

import { splitDepthKey } from "./depthSteps";
import type { AssetManifest } from "./manifest";
import { kebabCase } from "./spriteKeys";

// The names source code and game data could build a manifest key from: every string literal,
// every template literal's fixed parts, and every string in the game data.
interface KeyNames {
  // Each template literal with a letter or digit in a fixed part, as a pattern whose holes stand
  // for any name. A template whose fixed parts are only separators, such as `${a}-${b}`, would
  // name nearly any key, so it is left out.
  readonly patterns: readonly RegExp[];
  readonly words: ReadonlySet<string>;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// A data string as a key would spell it: as it is, and in kebab case. A zone's art name is
// already a data string.
function spellings(text: string): string[] {
  return [text, kebabCase(text)];
}

// Every string in a JSON-like value, its object keys included.
function stringsIn(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(stringsIn);
  }
  if (typeof value === "object" && value !== null) {
    return Object.entries(value).flatMap(([key, item]) => [key, ...stringsIn(item)]);
  }
  return [];
}

export function keyNames(sources: readonly string[], data: unknown): KeyNames {
  const words = new Set(stringsIn(data).flatMap(spellings));
  const patterns: RegExp[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      words.add(node.text);
    } else if (ts.isTemplateExpression(node)) {
      const parts = [node.head.text, ...node.templateSpans.map((span) => span.literal.text)];
      if (parts.some((part) => /[a-z0-9]/i.test(part))) {
        patterns.push(new RegExp(`^${parts.map(escapeRegExp).join("(.+)")}$`));
      }
    }
    ts.forEachChild(node, visit);
  };
  for (const source of sources) {
    visit(ts.createSourceFile("source.ts", source, ts.ScriptTarget.Latest));
  }
  return { patterns, words };
}

// Whether a key is a name, or fills a template's holes with names or with keys other templates
// build, as `${ownerFaceKey(data, dog)}-20` does. Each pattern has a fixed part, so every hole
// is shorter than its key and the recursion ends.
function named(names: KeyNames, seen: Map<string, boolean>, key: string): boolean {
  const known = seen.get(key);
  if (known !== undefined) {
    return known;
  }
  const result =
    names.words.has(key) ||
    names.patterns.some((pattern) => {
      const holes = pattern.exec(key)?.slice(1);
      return holes !== undefined && holes.every((hole) => named(names, seen, hole));
    });
  seen.set(key, result);
  return result;
}

// The manifest keys nothing names, by list, depth variants counted under their base sprite.
// It reads names rather than following calls, so it can miss a key built some other way.
export function unusedKeys(names: KeyNames, manifest: AssetManifest): Record<string, string[]> {
  const lists = { fonts: manifest.fonts, images: manifest.images, sounds: manifest.sounds };
  const sprites = [...new Set(manifest.sprites.map(({ key }) => splitDepthKey(key).base))];
  const seen = new Map<string, boolean>();
  return Object.fromEntries(
    Object.entries({ ...lists, sprites: sprites.map((key) => ({ key })) }).map(
      ([list, entries]) => [
        list,
        entries.map(({ key }) => key).filter((key) => !named(names, seen, key)),
      ],
    ),
  );
}
