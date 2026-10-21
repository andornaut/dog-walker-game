import { ATLAS_MANIFEST_PATH, parseAtlasManifest } from "../assets/atlas/atlasManifest";
import { assetUrl, parseManifest } from "../assets/manifest";
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

// A path relative to the directory of the file at basePath, as a browser resolves it.
export function resolveRelativePath(basePath: string, relativePath: string): string {
  const segments = basePath.split("/").slice(0, -1);
  for (const segment of relativePath.split("/")) {
    if (segment === "..") {
      segments.pop();
    } else if (segment !== ".") {
      segments.push(segment);
    }
  }
  return segments.join("/");
}

// Every file /art/manifest.json lists except the sounds, as URLs under artBaseUrl, and except
// the files of the images and sprites in atlased, which load from their atlas page instead.
export function artManifestUrls(
  artBaseUrl: string,
  manifestJson: unknown,
  atlased: ReadonlySet<string> = new Set(),
): string[] {
  const { fonts, images, sprites } = parseManifest(manifestJson);
  const own = ({ key }: { key: string }) => !atlased.has(key);
  const paths = [
    ...fonts.flatMap(({ fnt, png }) => [png, fnt]),
    ...images.filter(own).map(({ png }) => png),
    ...sprites.filter(own).flatMap(({ json, png }) => [png, json]),
  ];
  return [...new Set(paths.map((path) => assetUrl(artBaseUrl, path)))];
}

// The sound files /art/manifest.json lists, by format, as URLs under artBaseUrl.
export function artSoundUrls(
  artBaseUrl: string,
  manifestJson: unknown,
): Record<SoundFormat, string[]> {
  const { sounds } = parseManifest(manifestJson);
  const urls = (format: SoundFormat) => [
    ...new Set(sounds.map((sound) => assetUrl(artBaseUrl, sound[format]))),
  ];
  return { m4a: urls("m4a"), ogg: urls("ogg") };
}

// The atlas manifest's URL and its pages' URLs, under artBaseUrl, and the keys it covers.
export function atlasUrls(
  artBaseUrl: string,
  atlasJson: unknown,
): { keys: Set<string>; urls: string[] } {
  const { pages, textures } = parseAtlasManifest(atlasJson);
  return {
    keys: new Set(textures.map(({ key }) => key)),
    urls: [ATLAS_MANIFEST_PATH, ...pages.map(({ png }) => png)].map((path) =>
      assetUrl(artBaseUrl, path),
    ),
  };
}

const FONT_PAGE_FILE = /<page\b[^>]*\bfile="([^"]+)"/g;

// The files an art data file loads in turn: an Aseprite sheet's meta.image, or a BMFont's page
// images. Resolved against the data file's URL.
export function artReferencedUrls(url: string, text: string): string[] {
  if (url.endsWith(".fnt")) {
    return [...text.matchAll(FONT_PAGE_FILE)].map((match) =>
      resolveRelativePath(url, match[1] ?? ""),
    );
  }
  if (url.endsWith(".json")) {
    const image = (JSON.parse(text) as { meta?: { image?: unknown } }).meta?.image;
    return typeof image === "string" && image !== "" ? [resolveRelativePath(url, image)] : [];
  }
  return [];
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
