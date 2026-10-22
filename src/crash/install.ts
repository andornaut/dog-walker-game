// Installs the page's crash screen. src/main.ts imports this module first: modules run in
// import order, so the crash screen listens before any game module runs, and an error thrown
// while one loads shows it rather than a blank page.
import { devInSearch } from "../dev/runSetup";
import { installCrashScreen } from "./crashScreen";

installCrashScreen(devInSearch(globalThis.location.search));
