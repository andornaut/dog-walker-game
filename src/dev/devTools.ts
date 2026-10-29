// Whether the page offers the dev tools: the dev panel, its cheats and save edits, a replay log
// and a URL's run setup. Only a browser tab does; the installed app plays as shipped. Its
// display mode does not change while it runs, so the page is tested once, on first use.
import { pageRunsAsApp } from "../pwa/installFlow";

let on: boolean | undefined;

export function devToolsOn(): boolean {
  on ??= !pageRunsAsApp(globalThis.window);
  return on;
}

// The page's URL search as the game reads it: empty in the installed app, so no link sets a
// run up there.
export function pageSearch(): string {
  return devToolsOn() ? globalThis.location.search : "";
}
