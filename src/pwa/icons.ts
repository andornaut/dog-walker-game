// The game's icons, which a build names by their content (the kit's hashedIconsPlugin), so a
// redrawn icon reaches an installed app: the web app manifest's, and the favicons and
// apple-touch-icon the pages under pages/ link. icons.test.ts fails for one they name that this
// leaves out. public/art/index.html, which the build copies as is, keeps linking the plain
// favicons, which the build copies too.
export const HASHED_ICONS: readonly string[] = [
  "/art/favicon-16.png",
  "/art/favicon.png",
  "/icons/apple-touch-icon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
];
