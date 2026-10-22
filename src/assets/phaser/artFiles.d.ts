// The build's ArtFileMap (src/assets/artUrl.ts), which atlasPlugin writes: empty on the dev
// server and in tests.
declare module "virtual:art-files" {
  const artFiles: ReadonlyMap<string, string>;
  export default artFiles;
}
