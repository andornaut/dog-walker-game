// The site navigation bar: Home, Play, Data, the art gallery, each mock listed in
// /art/mocks/index.json, and the art docs. A page loads it with
// <link rel="stylesheet" href="/nav.css"> and <script src="/nav.js" defer></script> in its head
// and adds nothing else. The page links the stylesheet, rather than this script injecting it, so
// the bar's style blocks the first paint and the CSP's 'self' covers it. On /play/ the bar is one
// slim row that scrolls sideways, so the game keeps the height. On /play/ in the installed app
// (fullscreen or standalone display mode, or iOS's navigator.standalone) there is no bar, so no
// link leaves the app and the game takes the full height.
(() => {
  "use strict";
  const DOCS = "https://github.com/andornaut/dog-walker-game/blob/main/art/";
  // Cloudflare serves /x.html as /x and /dir/index.html as /dir/, so compare without either.
  const norm = (path) => path.replace(/(index)?\.html$/, "").replace(/\/$/, "");
  const here = norm(location.pathname);

  const nav = document.createElement("nav");
  nav.className = here === "/play" ? "art-nav slim" : "art-nav";
  nav.setAttribute("aria-label", "Site");
  const ul = document.createElement("ul");
  nav.append(ul);

  const item = (text, href) => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.textContent = text;
    a.href = href;
    if (norm(href) === here) a.setAttribute("aria-current", "page");
    li.append(a);
    return li;
  };

  const mocksAt = document.createElement("li");
  mocksAt.hidden = true;
  ul.append(
    item("Home", "/"),
    item("Play", "/play/"),
    item("Data", "/data/"),
    item("Gallery", "/art/"),
    mocksAt,
    item("Inventory", DOCS + "inventory.md"),
    item("Style guide", DOCS + "style-guide.md"),
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

  // The mocks list and pages are not precached, so offline the request would only log a
  // failed fetch and the links would lead nowhere.
  if (navigator.onLine) {
    fetch("/art/mocks/index.json", { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : []))
      .then((mocks) =>
        mocksAt.replaceWith(...mocks.map((m) => item(m.title, "/art/mocks/" + m.path))),
      )
      .catch(() => {});
  }
})();
