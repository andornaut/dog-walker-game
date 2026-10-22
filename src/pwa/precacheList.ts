import type { ArtFileMap } from "../assets/artUrl";
import { parseManifest } from "../assets/manifest";
import type { SoundFormat } from "../audio/soundFormat";
import { isHashedAssetUrl } from "./cachePolicy";

// The service worker's precache: every URL the game needs to boot offline, each sound file by
// format (the worker stores the one format the page plays), and a version that changes whenever
// any of their contents change, so a deploy installs a new worker.
export interface PrecacheManifest {
  sounds: Record<SoundFormat, string[]>;
  urls: string[];
  version: string;
}

// The build output, reduced to what the precache walk reads. Vite records the CSS and assets a
// chunk imports under viteMetadata.
export interface BundleFile {
  dynamicImports?: readonly string[];
  imports?: readonly string[];
  type: "asset" | "chunk";
  viteMetadata?: { importedAssets: ReadonlySet<string>; importedCss: ReadonlySet<string> };
}

const ROOT_RELATIVE_ATTRIBUTE = /\s(?:href|src)="(\/[^"/][^"]*)"/g;

// Root-relative src and href values in a built HTML page, in document order without repeats.
// Protocol-relative URLs (//host/...) are another origin and are left out.
export function rootRelativeUrls(html: string): string[] {
  const urls = Array.from(html.matchAll(ROOT_RELATIVE_ATTRIBUTE), (match) => match[1] ?? "");
  return [...new Set(urls)];
}

// Every bundle file the given entry files load, directly or through imports, including the
// entries themselves. File names are relative to the output directory, as in the bundle.
export function bundleDependencies(
  bundle: Readonly<Record<string, BundleFile>>,
  entryFileNames: readonly string[],
): string[] {
  const found = new Set<string>();
  const pending = [...entryFileNames];
  while (pending.length > 0) {
    const fileName = pending.pop() ?? "";
    const file = bundle[fileName];
    if (file === undefined || found.has(fileName)) {
      continue;
    }
    found.add(fileName);
    pending.push(
      ...(file.imports ?? []),
      ...(file.dynamicImports ?? []),
      ...(file.viteMetadata?.importedCss ?? []),
      ...(file.viteMetadata?.importedAssets ?? []),
    );
  }
  return [...found].sort();
}

// The art the game loads, as the URLs of its hashed files: the sound files by format, for the
// worker to store the one the page plays, and every other file. Only the map's files are listed,
// so no unhashed art is precached.
export function hashedArtUrls(
  artFiles: ArtFileMap,
  manifestJson: unknown,
): { sounds: Record<SoundFormat, string[]>; urls: string[] } {
  const { sounds } = parseManifest(manifestJson);
  const url = (fileName: string) => `/${fileName}`;
  const soundUrls = (format: SoundFormat) =>
    sounds.flatMap((sound) => artFiles.get(sound[format]) ?? []).map(url);
  const soundPaths = new Set(sounds.flatMap(({ m4a, ogg }) => [m4a, ogg]));
  return {
    sounds: { m4a: soundUrls("m4a"), ogg: soundUrls("ogg") },
    urls: [...artFiles]
      .filter(([path]) => !soundPaths.has(path))
      .map(([, fileName]) => url(fileName)),
  };
}

// The icons a web app manifest names.
export function webManifestIconUrls(manifestJson: unknown): string[] {
  const icons = (manifestJson as { icons?: unknown } | null)?.icons;
  if (!Array.isArray(icons)) {
    return [];
  }
  return icons
    .map((icon: unknown) => (icon as { src?: unknown } | null)?.src)
    .filter((src): src is string => typeof src === "string" && src.startsWith("/"));
}

// The text a version hash is computed over: each URL with its content hash, in URL order.
// Hashed assets need no content hash because their name already changes with their content.
export function precacheFingerprint(contentHashes: ReadonlyMap<string, string>): string {
  return [...contentHashes.keys()]
    .sort()
    .map((url) => `${url} ${isHashedAssetUrl(url) ? "" : (contentHashes.get(url) ?? "")}`)
    .join("\n");
}
