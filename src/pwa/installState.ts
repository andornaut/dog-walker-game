// Whether and how the game can be installed as an app on this device. Pure, so the game and the
// home page share it: installFlow.ts reads the facts from the browser.

// installed: running as the installed app, or installed during this visit. prompt: the browser
// handed over its install prompt (Android and desktop Chromium). iosSteps: iOS and not installed,
// where the only way is Share, then Add to Home Screen. unsupported: none of these, so nothing
// offers to install.
export type InstallState = "installed" | "iosSteps" | "prompt" | "unsupported";

export interface InstallFacts {
  // The browser reported installing the app during this visit (appinstalled, or an accepted
  // prompt).
  readonly appInstalled: boolean;
  // A display-mode media query for fullscreen or standalone matches.
  readonly displayModeInstalled: boolean;
  // A beforeinstallprompt event is held.
  readonly hasPrompt: boolean;
  readonly ios: boolean;
  // iOS's navigator.standalone: opened from the Home Screen.
  readonly iosStandalone: boolean;
}

export function installState(facts: InstallFacts): InstallState {
  if (facts.appInstalled || facts.displayModeInstalled || facts.iosStandalone) {
    return "installed";
  }
  if (facts.hasPrompt) {
    return "prompt";
  }
  return facts.ios ? "iosSteps" : "unsupported";
}

// Whether the state offers a way to install: the Settings row, the home page's button and the
// one-time suggestion show only then.
export function offersInstall(state: InstallState): boolean {
  return state === "prompt" || state === "iosSteps";
}

// An iPhone, iPod or iPad. iPadOS asks for desktop sites by default, naming itself a Mac, so a
// Mac with a touch screen counts too.
export function isIosDevice(userAgent: string, maxTouchPoints: number): boolean {
  return /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}
