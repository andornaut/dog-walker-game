// The site navigation bar: Home, Play, Data, the art gallery, each mock listed in
// /art/mocks/index.json, and the art docs. A page loads it with
// <script src="/nav.js" defer></script> and adds nothing else. On /play/ the bar is one slim
// row that scrolls sideways, so the game keeps the height.
(() => {
  "use strict";
  const DOCS = "https://github.com/andornaut/dog-walker-game/blob/main/art/";
  // Cloudflare serves /x.html as /x and /dir/index.html as /dir/, so compare without either.
  const norm = (path) => path.replace(/(index)?\.html$/, "").replace(/\/$/, "");
  const here = norm(location.pathname);

  const style = document.createElement("style");
  style.textContent = `
.art-nav { background: #181425; border-bottom: 1px solid #3a4466; font: 14px/1.4 "Atkinson Hyperlegible", system-ui, sans-serif; }
.art-nav ul {
  list-style: none; margin: 0 auto; max-width: 1240px; display: flex; flex-wrap: wrap; gap: 4px 0; align-items: center;
  padding-block: 10px;
  padding-left: max(16px, env(safe-area-inset-left, 0px));
  padding-right: max(16px, env(safe-area-inset-right, 0px));
}
.art-nav li + li::before { content: ""; display: inline-block; width: 1px; height: 14px; margin: 0 12px; vertical-align: -2px; background: #3a4466; }
.art-nav a { color: #c0cbdc; text-decoration: none; }
.art-nav a:hover { color: #feae34; }
/* The current page in the game's selected state: a yellow face with plum text, the ui-select
   frame (ink, a pulsing amber and orange band, ink) 3px outside its ink edge, lifted 2px onto
   a plum shadow, and the ui-check tick at its top-left corner. */
.art-nav a[aria-current="page"] {
  position: relative; top: -2px; padding: 1px 6px 1px 10px;
  color: #3e2731; background: #fee761; border: 1px solid #181425; font-weight: 700;
  box-shadow: 0 0 0 2px #feae34, 0 0 0 3px #181425, 0 2px 0 3px #3e2731;
  animation: art-nav-pulse 900ms steps(1) infinite;
}
.art-nav a[aria-current="page"]::before {
  content: ""; position: absolute; left: -7px; top: -8px; width: 16px; height: 16px;
  background: url("/art/sprites/ui-check.png") -48px 0 / 64px 16px; image-rendering: pixelated;
}
@keyframes art-nav-pulse {
  50% { box-shadow: 0 0 0 2px #f77622, 0 0 0 3px #181425, 0 2px 0 3px #3e2731; }
}
@media (prefers-reduced-motion: reduce) {
  .art-nav a[aria-current="page"] { animation: none; }
}
.art-nav a:focus-visible { outline: 2px solid #feae34; outline-offset: 2px; }
.art-nav.slim { font-size: 13px; line-height: 1; touch-action: pan-x; }
/* The extra top padding holds the current page's lift, frame and badge inside the scroller. */
.art-nav.slim ul { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; padding-block: 11px 7px; white-space: nowrap; }
.art-nav.slim ul::-webkit-scrollbar { display: none; }
.art-nav.slim li + li::before { height: 12px; margin: 0 10px; vertical-align: -1px; }
.art-nav.slim a:focus-visible { outline-offset: -2px; }`;
  document.head.append(style);

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

  const mount = () => document.body.prepend(nav);
  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);

  fetch("/art/mocks/index.json", { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : []))
    .then((mocks) =>
      mocksAt.replaceWith(...mocks.map((m) => item(m.title, "/art/mocks/" + m.path))),
    )
    .catch(() => {});
})();
