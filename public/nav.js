// The site navigation bar: Home, Play, Data, the art gallery, the open mocks (/art/mocks/, which
// lists each page in /art/mocks/index.json), the repository on GitHub and the project's Cloudflare dashboard. Every
// link is a page on this site, the root of an external site, or this project's dashboard. A page loads it with
// <link rel="stylesheet" href="/nav.css"> and <script src="/nav.js" defer></script> in its head
// and adds nothing else. The page links the stylesheet, rather than this script injecting it, so
// the bar's style blocks the first paint and the CSP's 'self' covers it. On /play/ the bar is one
// slim row that scrolls sideways, so the game keeps the height. On /play/ in the installed app
// (fullscreen or standalone display mode, or iOS's navigator.standalone) there is no bar, so no
// link leaves the app and the game takes the full height.
(() => {
  "use strict";
  const REPO = "https://github.com/andornaut/dog-walker-game";
  // /:account picks the signed-in account, so the URL names no account id.
  const DASHBOARD =
    "https://dash.cloudflare.com/?to=/:account/workers/services/view/dog-walker-game";
  // Cloudflare serves /x.html as /x and /dir/index.html as /dir/, so compare without either.
  const norm = (path) => path.replace(/(index)?\.html$/, "").replace(/\/$/, "");
  const here = norm(location.pathname);

  const nav = document.createElement("nav");
  nav.className = here === "/play" ? "art-nav slim" : "art-nav";
  nav.setAttribute("aria-label", "Site");
  const ul = document.createElement("ul");
  nav.append(ul);

  // within: also current on the pages under href, so Mocks stays marked on each mock.
  const item = (text, href, within = false) => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.textContent = text;
    a.href = href;
    const at = norm(href);
    if (at === here || (within && here.startsWith(at + "/")))
      a.setAttribute("aria-current", "page");
    li.append(a);
    return li;
  };

  ul.append(
    item("Home", "/"),
    item("Play", "/play/"),
    item("Data", "/data/"),
    item("Gallery", "/art/"),
    item("Mocks", "/art/mocks/", true),
    item("GitHub", REPO),
    item("Cloudflare", DASHBOARD),
  );

  const installed = matchMedia("(display-mode: fullscreen), (display-mode: standalone)");
  const hide = () => here === "/play" && (installed.matches || navigator.standalone === true);
  const mount = () => {
    if (hide()) nav.remove();
    else if (!nav.isConnected) document.body.prepend(nav);
  };
  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);
  installed.addEventListener("change", mount);
})();
