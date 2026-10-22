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
async function staleFiles(root: string, files: ReadonlyMap<string, string>) {
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

// A generator CLI's run from the repository root, returning its exit code. With --check it
// writes nothing and fails if a committed file differs from files, naming the command that
// regenerates it; otherwise it writes the files that changed, or says that name is up to date.
export async function writeOrCheck(
  command: string,
  name: string,
  files: ReadonlyMap<string, string>,
): Promise<number> {
  const root = process.cwd();
  if (process.argv.includes("--check")) {
    const stale = await staleFiles(root, files);
    for (const path of stale) {
      process.stderr.write(`${path} is out of date: run ${command}\n`);
    }
    return stale.length === 0 ? 0 : 1;
  }
  const written = await writeFiles(root, files);
  process.stdout.write(
    written.length === 0 ? `${name} is up to date\n` : `wrote ${written.join(", ")}\n`,
  );
  return 0;
}

// The art directory on disk, for generateArtManifest.
export function nodeArtFiles(artDir: string): ArtFiles {
  return {
    list: async (dir) => fileNames(join(artDir, dir)),
    read: async (path) => new Uint8Array(await readFile(join(artDir, path))),
  };
}
