import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { ArtFiles } from "./artManifest";

// The generated files are committed, so they are written in one stable form: two-space
// indents and a final newline, as art's Python tools write JSON.
export function jsonText(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function readText(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}

// Writes text to path unless it already holds it, so an unchanged file keeps its timestamp
// and a dev server watching it sees no change. Returns whether it wrote.
export async function writeIfChanged(path: string, text: string): Promise<boolean> {
  if ((await readText(path)) === text) {
    return false;
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text);
  return true;
}

// The names of the files directly in dir, sorted; none when dir does not exist.
async function fileNames(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}

// Compares generated files with those on disk under root: the paths whose text differs.
export async function staleFiles(root: string, files: ReadonlyMap<string, string>) {
  const stale = await Promise.all(
    [...files].map(async ([path, text]) =>
      (await readText(join(root, path))) === text ? null : path,
    ),
  );
  return stale.filter((path) => path !== null);
}

export async function writeFiles(root: string, files: ReadonlyMap<string, string>) {
  const written = await Promise.all(
    [...files].map(async ([path, text]) =>
      (await writeIfChanged(join(root, path), text)) ? path : null,
    ),
  );
  return written.filter((path) => path !== null);
}

// The art directory on disk, for generateArtManifest.
export function nodeArtFiles(artDir: string): ArtFiles {
  return {
    list: async (dir) => fileNames(join(artDir, dir)),
    read: async (path) => new Uint8Array(await readFile(join(artDir, path))),
  };
}
