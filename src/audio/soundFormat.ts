// Which of a sound's two files this browser loads. No Phaser here: BootScene loads the chosen
// file, and the page passes the same choice to the service worker, which precaches only it.

const SOUND_FORMATS = ["ogg", "m4a"] as const;
export type SoundFormat = (typeof SOUND_FORMATS)[number];

// The types Phaser's device check asks canPlayType about for each extension, so Phaser's loader
// accepts the URL chosen here.
export const SOUND_FORMAT_MIME_TYPES: Readonly<Record<SoundFormat, string>> = {
  m4a: "audio/x-m4a",
  ogg: 'audio/ogg; codecs="vorbis"',
};

// The first format in SOUND_FORMATS the browser can play, or undefined for none. canPlayType is
// an audio element's: it answers "probably", "maybe" or "" (older browsers "no").
export function chooseSoundFormat(
  canPlayType: (mimeType: string) => string,
): SoundFormat | undefined {
  return SOUND_FORMATS.find((format) => {
    const answer = canPlayType(SOUND_FORMAT_MIME_TYPES[format]);
    return answer !== "" && answer !== "no";
  });
}
