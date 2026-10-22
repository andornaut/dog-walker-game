// npm run art:manifest [-- --check]
// Writes public/art/manifest.json from the files under public/art/ and manifest.extra.json.
// --check writes nothing and fails if the committed manifest differs from what the files give.
import { join } from "node:path";

import { ART_DIR, ART_MANIFEST, artManifestText, generateArtManifest } from "./artManifest";
import { nodeArtFiles, writeOrCheck } from "./files";

const path = `public/${ART_DIR}/${ART_MANIFEST}`;
const manifest = await generateArtManifest(nodeArtFiles(join(process.cwd(), `public/${ART_DIR}`)));

process.exitCode = await writeOrCheck(
  "npm run art:manifest",
  path,
  new Map([[path, artManifestText(manifest)]]),
);
