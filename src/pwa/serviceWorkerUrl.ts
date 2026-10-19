import type { SoundFormat } from "../audio/soundFormat";

// The query parameter on /sw.js that names the sound format the page loads, so the service worker
// precaches that format alone (a worker has no canPlayType to choose with). serviceWorker.ts
// imports only its type, so the worker still builds with no imports.
export const SOUND_FORMAT_PARAM = "sound";
export type SoundFormatParam = typeof SOUND_FORMAT_PARAM;

export function serviceWorkerUrl(scriptUrl: string, soundFormat: SoundFormat | undefined): string {
  return soundFormat === undefined
    ? scriptUrl
    : `${scriptUrl}?${SOUND_FORMAT_PARAM}=${soundFormat}`;
}
