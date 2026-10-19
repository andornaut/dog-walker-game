import type { Loader, Scene } from "phaser";

import { byteFraction, type FileProgress, UNKNOWN_FILE_BYTES } from "../layout/loadingScreen";

// Reports how far the scene's load is, by bytes, on each file's progress. A file weighs its
// size from expectedBytes by key, else its size once the server sends it, else
// UNKNOWN_FILE_BYTES. The report never goes back, though a size that arrives late can stall it.
// Call after queueing the files and before starting the load.
export function onLoadProgress(
  scene: Scene,
  expectedBytes: ReadonlyMap<string, number>,
  report: (fraction: number) => void,
): void {
  const files = new Map<Loader.File, FileProgress>();
  const track = (file: Loader.File) => {
    files.set(file, { bytes: expectedBytes.get(file.key) ?? UNKNOWN_FILE_BYTES, fraction: 0 });
  };
  let shown = 0;
  const update = (file: Loader.File, fraction: number) => {
    const progress = files.get(file);
    if (progress === undefined) {
      return;
    }
    progress.fraction = fraction;
    if (!expectedBytes.has(file.key) && file.bytesTotal > 0) {
      progress.bytes = file.bytesTotal;
    }
    shown = Math.max(shown, byteFraction([...files.values()]));
    report(shown);
  };
  scene.load.list.forEach(track);
  scene.load.on("addfile", (_key: string, _type: string, _loader: unknown, file: Loader.File) =>
    track(file),
  );
  scene.load.on("fileprogress", (file: Loader.File, fraction: number) => update(file, fraction));
  scene.load.on("load", (file: Loader.File) => update(file, 1));
  scene.load.on("loaderror", (file: Loader.File) => update(file, 1));
}
