// npm run art:manifest [-- --check]
// Writes public/art/manifest.json from the files under public/art/ and manifest.extra.json.
// --check writes nothing and fails if the committed manifest differs from what the files give.
import { join } from "node:path";

import { ART_MANIFEST, artManifestText, generateArtManifest } from "./artManifest";
import { nodeArtFiles, staleFiles, writeFiles } from "./files";

const ART_DIR = "public/art";

const check = process.argv.includes("--check");
const root = process.cwd();
const manifest = await generateArtManifest(nodeArtFiles(join(root, ART_DIR)));
const files = new Map([[`${ART_DIR}/${ART_MANIFEST}`, artManifestText(manifest)]]);

if (check) {
  const stale = await staleFiles(root, files);
  for (const path of stale) {
    process.stderr.write(`${path} differs from the files on disk: run npm run art:manifest\n`);
  }
  process.exitCode = stale.length === 0 ? 0 : 1;
} else {
  const written = await writeFiles(root, files);
  process.stdout.write(
    written.length === 0
      ? `${ART_DIR}/${ART_MANIFEST} is up to date\n`
      : `wrote ${written.join(", ")}\n`,
  );
}
