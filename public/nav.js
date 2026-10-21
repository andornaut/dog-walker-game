// The site navigation bar: Home, Play, Data, the art gallery, the repository on GitHub and the
// project's Cloudflare dashboard. Every link is a page on this site, the root of an external
// site, or this project's dashboard. A page loads it with
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

  const item = (text, href) => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.textContent = text;
    a.href = href;
    if (norm(href) === here) a.setAttribute("aria-current", "page");
    li.append(a);
    return li;
  };

  ul.append(
    item("Home", "/"),
    item("Play", "/play/"),
    item("Data", "/data/"),
    item("Gallery", "/art/"),
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

  // A "scroll to top" button at the bottom right of a long page (more than LONG viewports tall),
  // shown once the page is scrolled down more than one viewport. A spacer as tall as the button
  // and its margin ends a long page, so its last controls can scroll clear of the button. The
  // game page has none.
  if (here === "/play") return;
  const LONG = 2;
  const toTop = document.createElement("button");
  toTop.type = "button";
  toTop.className = "to-top";
  toTop.hidden = true;
  toTop.setAttribute("aria-label", "Scroll to top");
  toTop.title = "Scroll to top";
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("aria-hidden", "true");
  const arrow = document.createElementNS("http://www.w3.org/2000/svg", "path");
  arrow.setAttribute("d", "M7 2h2v2h2v2h2v2H9v6H7V8H3V6h2V4h2z");
  svg.append(arrow);
  toTop.append(svg);
  const spacer = document.createElement("div");
  spacer.className = "to-top-spacer";
  spacer.setAttribute("aria-hidden", "true");

  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  toTop.addEventListener("click", () => {
    scrollTo({ top: 0, behavior: reduced.matches ? "auto" : "smooth" });
    // The button hides at the top, so focus moves to the first link in the bar.
    nav.querySelector("a")?.focus({ preventScroll: true });
  });

  let queued = false;
  const update = () => {
    queued = false;
    const view = innerHeight;
    const long = document.documentElement.scrollHeight - spacer.offsetHeight > view * LONG;
    if (long && !spacer.isConnected) document.body.append(spacer, toTop);
    else if (!long && spacer.isConnected) {
      spacer.remove();
      toTop.remove();
    }
    toTop.hidden = !long || scrollY < view;
  };
  const queue = () => {
    if (!queued) requestAnimationFrame(update);
    queued = true;
  };
  const watch = () => {
    addEventListener("scroll", queue, { passive: true });
    addEventListener("resize", queue);
    new ResizeObserver(queue).observe(document.body);
    queue();
  };
  if (document.body) watch();
  else document.addEventListener("DOMContentLoaded", watch);
})();
