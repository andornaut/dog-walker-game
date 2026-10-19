import { assetUrl, parseManifest } from "../assets/manifest";
import { isHashedAssetUrl } from "./cachePolicy";

// The service worker's precache: every URL the game needs to boot offline, and a version that
// changes whenever any of their contents change, so a deploy installs a new worker.
export interface PrecacheManifest {
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

// Every file /art/manifest.json lists, as URLs under artBaseUrl.
export function artManifestUrls(artBaseUrl: string, manifestJson: unknown): string[] {
  const { fonts, images, sounds, sprites } = parseManifest(manifestJson);
  const paths = [
    ...fonts.flatMap(({ fnt, png }) => [png, fnt]),
    ...images.map(({ png }) => png),
    ...sounds.flatMap(({ m4a, ogg }) => [ogg, m4a]),
    ...sprites.flatMap(({ json, png }) => [png, json]),
  ];
  return [...new Set(paths.map((path) => assetUrl(artBaseUrl, path)))];
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
