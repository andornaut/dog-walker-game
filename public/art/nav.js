// The navigation bar every art page shows: Home, the gallery, each mock listed
// in mocks/index.json, and the art docs. Load it with
// <script src="/art/nav.js" defer></script> and add nothing else.
(() => {
  "use strict";
  const DOCS = "https://github.com/andornaut/dog-walker-game/blob/main/art/";
  const here = location.pathname.replace(/index\.html$/, "");

  const style = document.createElement("style");
  style.textContent = `
.art-nav { background: #181425; border-bottom: 1px solid #3a4466; font: 14px/1.4 "Atkinson Hyperlegible", system-ui, sans-serif; }
.art-nav ul {
  list-style: none; margin: 0 auto; max-width: 1240px; display: flex; flex-wrap: wrap; gap: 4px 18px; align-items: center;
  padding-block: 10px;
  padding-left: max(16px, env(safe-area-inset-left, 0px));
  padding-right: max(16px, env(safe-area-inset-right, 0px));
}
.art-nav li.sep { width: 1px; height: 16px; background: #3a4466; }
.art-nav a { color: #c0cbdc; text-decoration: none; }
.art-nav a:hover { color: #feae34; }
.art-nav a[aria-current="page"] { color: #feae34; font-weight: 700; }
.art-nav a:focus-visible { outline: 2px solid #feae34; outline-offset: 2px; }
.art-nav .label { font-family: "Silkscreen", ui-monospace, monospace; color: #8b9bb4; font-size: 12px; letter-spacing: 0.06em; }`;
  document.head.append(style);

  const nav = document.createElement("nav");
  nav.className = "art-nav";
  nav.setAttribute("aria-label", "Art");
  const ul = document.createElement("ul");
  nav.append(ul);

  const item = (text, href) => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.textContent = text;
    a.href = href;
    if (href === here) a.setAttribute("aria-current", "page");
    li.append(a);
    return li;
  };
  const sep = () => Object.assign(document.createElement("li"), { className: "sep", ariaHidden: "true" });
  const label = (text) => Object.assign(document.createElement("li"), { className: "label", textContent: text });

  const mocksAt = document.createElement("li");
  mocksAt.hidden = true;
  ul.append(item("Home", "/"), sep(), label("Art"), item("Gallery", "/art/"), mocksAt, sep(),
    item("Inventory", DOCS + "inventory.md"), item("Style guide", DOCS + "style-guide.md"));

  const mount = () => document.body.prepend(nav);
  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);

  fetch("/art/mocks/index.json", { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : []))
    .then((mocks) => mocksAt.replaceWith(...mocks.map((m) => item(m.title, "/art/mocks/" + m.path))))
    .catch(() => {});
})();
