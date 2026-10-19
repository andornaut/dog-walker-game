// Placeholder sprites drawn in code, shared by the mocks and the home page.
// Every colour is from Endesga 32. Real art replaces these as it is exported.
window.DWGPlaceholder = (() => {
"use strict";

// ---------- Palette ----------
const PAL = "be4a2f d77643 ead4aa e4a672 b86f50 733e39 3e2731 a22633 e43b44 f77622 feae34 fee761 63c74d 3e8948 265c42 193c3e 124e89 0099db 2ce8f5 ffffff c0cbdc 8b9bb4 5a6988 3a4466 262b44 181425 ff0044 68386c b55088 f6757a e8b796 c28569".split(" ");
const DARK = {};
"be4a2f:733e39 d77643:be4a2f ead4aa:e4a672 e4a672:b86f50 b86f50:733e39 733e39:3e2731 3e2731:181425 a22633:3e2731 e43b44:a22633 f77622:be4a2f feae34:f77622 fee761:feae34 63c74d:3e8948 3e8948:265c42 265c42:193c3e 193c3e:181425 124e89:262b44 0099db:124e89 2ce8f5:0099db ffffff:c0cbdc c0cbdc:8b9bb4 8b9bb4:5a6988 5a6988:3a4466 3a4466:262b44 262b44:181425 181425:181425 ff0044:a22633 68386c:3e2731 b55088:68386c f6757a:b55088 e8b796:c28569 c28569:b86f50"
  .split(" ").forEach(p => { const [a, b] = p.split(":"); DARK["#" + a] = "#" + b; });
const dark = c => DARK[c] || c;
const K = {
  rust: "#be4a2f", ochre: "#d77643", cream: "#ead4aa", tan: "#e4a672", brown: "#b86f50", dbrown: "#733e39", plum: "#3e2731",
  dred: "#a22633", red: "#e43b44", orange: "#f77622", amber: "#feae34", yellow: "#fee761", green: "#63c74d", dgreen: "#3e8948",
  forest: "#265c42", teal: "#193c3e", blue: "#124e89", sky: "#0099db", cyan: "#2ce8f5", white: "#ffffff", lgrey: "#c0cbdc",
  grey: "#8b9bb4", slate: "#5a6988", dslate: "#3a4466", navy: "#262b44", ink: "#181425", hot: "#ff0044", purple: "#68386c",
  mauve: "#b55088", pink: "#f6757a", skin1: "#e8b796", skin2: "#c28569",
};

// ---------- Pixel font (3x5, plus a 5-wide heart) ----------
const G = {
  A:"010101111101101",B:"110101110101110",C:"011100100100011",D:"110101101101110",E:"111100110100111",F:"111100110100100",
  G:"011100101101011",H:"101101111101101",I:"111010010010111",J:"001001001101010",K:"101101110101101",L:"100100100100111",
  M:"101111111101101",N:"110101101101101",O:"010101101101010",P:"110101110100100",Q:"010101101110011",R:"110101110101101",
  S:"011100010001110",T:"111010010010010",U:"101101101101111",V:"101101101101010",W:"101101111111101",X:"101101010101101",
  Y:"101101010010010",Z:"111001010100111","0":"111101101101111","1":"010110010010111","2":"110001010100111",
  "3":"110001010001110","4":"101101111001001","5":"111100110001110","6":"011100111101111","7":"111001010010010",
  "8":"111101111101111","9":"111101111001110",$:"011110111011110","+":"000010111010000","-":"000000111000000",
  "/":"001001010100100",":":"000010000010000",".":"000000000000010","!":"010010010000010","?":"110001010000010",
  "'":"010010000000000",",":"000000000010100","%":"101001010100101",
};
const HEART5 = "0101011111111110111000100";
const glyph = ch => ch === "♥" ? { w: 5, b: HEART5 } : { w: 3, b: G[ch] || null };
function textW(s, sc = 1) { let w = 0; for (const ch of s) w += (glyph(ch).w + 1) * sc; return Math.max(0, w - sc); }
function text(c, s, x, y, col, sc = 1, acc = {}) {
  let cx = x;
  for (const ch of s) {
    const g = glyph(ch);
    if (g.b) {
      c.fillStyle = acc[ch] || col;
      for (let r = 0; r < 5; r++) for (let k = 0; k < g.w; k++) if (g.b[r * g.w + k] === "1") c.fillRect(cx + k * sc, y + r * sc, sc, sc);
    }
    cx += (g.w + 1) * sc;
  }
}
const textC = (c, s, mid, y, col, sc = 1, acc) => text(c, s, Math.round(mid - textW(s, sc) / 2), y, col, sc, acc);

// ---------- Sprite grids ----------
const mk = (w, h) => ({ w, h, px: new Array(w * h).fill(null), decal: false });
function P(g, x, y, c) { x = Math.floor(x); y = Math.floor(y); if (x >= 0 && y >= 0 && x < g.w && y < g.h) g.px[y * g.w + x] = c; }
function E(g, cx, cy, rx, ry, c, sh, li) {
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
    if (dx * dx + dy * dy <= 1) { const d = 0.7 * (dx + dy); P(g, x, y, sh && d > 0.45 ? sh : li && d < -0.55 ? li : c); }
  }
}
function R(g, x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) P(g, x + i, y + j, c); }
function T(g, ax, ay, bx, by, cx, cy, c) {
  const s = (px, py, x1, y1, x2, y2) => (px - x2) * (y1 - y2) - (x1 - x2) * (py - y2);
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    const px = x + 0.5, py = y + 0.5;
    const d1 = s(px, py, ax, ay, bx, by), d2 = s(px, py, bx, by, cx, cy), d3 = s(px, py, cx, cy, ax, ay);
    if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) P(g, x, y, c);
  }
}
function finish(g, mode) {
  const { w, h, px } = g, out = px.slice();
  if (mode !== "none" && !g.decal) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (px[y * w + x]) continue;
      let n = null;
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < w && yy < h && px[yy * w + xx]) { n = px[yy * w + xx]; break; }
      }
      if (n) out[y * w + x] = mode === "black" ? K.ink : dark(dark(n));
    }
  }
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const c = cv.getContext("2d");
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = out[y * w + x]; if (v) { c.fillStyle = v; c.fillRect(x, y, 1, 1); } }
  return cv;
}

// ---------- Road sprites (seen from above and behind) ----------
function husky(f) {
  const g = mk(26, 34), a = f ? 1 : -1;
  R(g, 6, 12 + a, 3, 4, K.lgrey); R(g, 17, 12 - a, 3, 4, K.lgrey); R(g, 6, 23 - a, 3, 4, K.lgrey); R(g, 17, 23 + a, 3, 4, K.lgrey);
  E(g, 13, 19, 7.5, 10, K.lgrey, K.grey, K.white);
  E(g, 13, 18, 4.5, 7, K.slate, null, K.grey);
  E(g, 13 + (f ? 1 : 0), 29.5, 3.5, 3, K.lgrey, K.grey, K.white); P(g, 13 + (f ? 1 : 0), 29, K.grey);
  T(g, 8, 8, 8, 1, 12, 5, K.dslate); T(g, 18, 8, 18, 1, 14, 5, K.dslate); P(g, 9, 4, K.pink); P(g, 16, 4, K.pink);
  E(g, 13, 8, 5.5, 4.5, K.slate, K.dslate, K.grey);
  R(g, 10, 12, 6, 1, K.red);
  return g;
}
function lab(f) {
  const g = mk(22, 28), a = f ? 1 : -1;
  R(g, 4, 9 + a, 2, 3, K.skin2); R(g, 16, 9 - a, 2, 3, K.skin2); R(g, 4, 18 - a, 2, 3, K.skin2); R(g, 16, 18 + a, 2, 3, K.skin2);
  E(g, 11, 15, 6.5, 8, K.tan, K.skin2, K.cream);
  E(g, 11, 7, 4.5, 4, K.tan, K.skin2, K.cream);
  E(g, 6.5, 8, 1.6, 3, K.skin2); E(g, 15.5, 8, 1.6, 3, K.skin2);
  R(g, 8, 10, 6, 1, K.sky);
  R(g, 10 + (f ? 1 : -1), 22, 2, 4, K.skin2);
  return g;
}
function chi(f) {
  const g = mk(16, 22), a = f ? 1 : -1;
  R(g, 3, 9 + a, 1, 2, K.skin1); R(g, 12, 9 - a, 1, 2, K.skin1); R(g, 3, 14 - a, 1, 2, K.skin1); R(g, 12, 14 + a, 1, 2, K.skin1);
  E(g, 8, 12, 4.5, 5.5, K.mauve, K.purple, K.pink);
  T(g, 4.5, 6, 2, 1, 7, 4, K.skin1); T(g, 11.5, 6, 14, 1, 9, 4, K.skin1); P(g, 4, 4, K.pink); P(g, 11, 4, K.pink);
  E(g, 8, 6, 3.5, 3, K.skin1, K.skin2);
  P(g, 8, 18, K.skin2); P(g, 8, 19, K.skin2); P(g, 8 + (f ? 1 : -1), 20, K.skin2);
  return g;
}
function walker(f) {
  const g = mk(20, 32), L = f ? 6 : 7, Rl = f ? 7 : 6;
  R(g, 6, 22, 3, L, K.dslate); R(g, 11, 22, 3, Rl, K.dslate); R(g, 13, 22, 1, Rl, K.navy);
  R(g, 6, 22 + L, 3, 2, K.dbrown); R(g, 11, 22 + Rl, 3, 2, K.dbrown);
  const la = f ? 1 : 0, ra = f ? 0 : 1;
  R(g, 2, 13 + la, 2, 7, K.sky); R(g, 16, 13 + ra, 2, 7, K.blue);
  R(g, 2, 20 + la, 2, 2, K.skin2); R(g, 16, 20 + ra, 2, 2, K.skin2);
  R(g, 4, 12, 12, 10, K.sky); R(g, 14, 12, 2, 10, K.blue); R(g, 4, 12, 1, 9, K.cyan);
  P(g, 4, 12, null); P(g, 15, 12, null);
  R(g, 7, 20, 6, 2, K.amber); R(g, 12, 20, 1, 2, K.orange);
  R(g, 8, 11, 4, 1, K.skin2);
  E(g, 10, 7, 5.5, 5.5, K.dbrown, K.plum, K.brown);
  P(g, 4, 8, K.skin2); P(g, 15, 8, K.skin2);
  return g;
}
function skunk(f) {
  const g = mk(18, 24), s = f ? 1 : 0;
  E(g, 9 + s, 5.5, 5, 4.5, K.navy, K.ink, K.dslate); E(g, 9 + s, 4.5, 2.5, 2, K.white, K.lgrey);
  E(g, 9, 13, 5, 5.5, K.navy, K.ink, K.dslate); R(g, 8, 9, 2, 8, K.white); R(g, 9, 9, 1, 8, K.lgrey);
  E(g, 9, 19, 3.5, 3, K.navy, K.ink, K.dslate); R(g, 8, 16, 2, 2, K.white);
  P(g, 7, 19, K.white); P(g, 10, 19, K.white); P(g, 8, 21, K.pink); P(g, 9, 21, K.pink);
  return g;
}
function squirrel(f) {
  const g = mk(14, 19), s = f ? 1 : -1;
  E(g, 7 + s * 0.5, 5.5, 4.5, 4.5, K.ochre, K.rust, K.tan);
  E(g, 7, 11.5, 3, 3.5, K.ochre, K.rust, K.tan);
  E(g, 7, 15, 2.5, 2, K.ochre, K.rust, K.tan);
  P(g, 5, 13, K.rust); P(g, 8, 13, K.rust); P(g, 6, 15, K.ink); P(g, 7, 15, K.ink);
  return g;
}
function corgi(f) {
  const g = mk(20, 25), a = f ? 1 : -1;
  R(g, 5, 9 + a, 2, 2, K.ochre); R(g, 13, 9 - a, 2, 2, K.ochre); R(g, 5, 15 - a, 2, 2, K.ochre); R(g, 13, 15 + a, 2, 2, K.ochre);
  E(g, 10, 11, 5, 6.5, K.ochre, K.rust, K.tan);
  T(g, 6, 19, 5, 13, 9, 16, K.ochre); T(g, 14, 19, 15, 13, 11, 16, K.ochre); P(g, 6, 16, K.pink); P(g, 13, 16, K.pink);
  E(g, 10, 19.5, 4.5, 3.5, K.ochre, K.rust, K.tan);
  E(g, 10, 21, 2.2, 1.6, K.cream);
  R(g, 7, 16, 6, 1, K.amber);
  P(g, 8, 19, K.ink); P(g, 11, 19, K.ink); P(g, 9, 21, K.ink); P(g, 10, 21, K.ink);
  return g;
}
function puddle(f) {
  const g = mk(32, 16); g.decal = true;
  E(g, 16, 8, 14, 6, K.blue); E(g, 16, 8.5, 13, 5, K.sky);
  const s = f ? 1 : 0;
  R(g, 9 + s, 5, 4, 1, K.cyan); R(g, 19 - s, 9, 5, 1, K.cyan); R(g, 13 + s, 11, 2, 1, K.cyan);
  return g;
}
function bone() {
  const g = mk(16, 11);
  R(g, 4, 4, 8, 3, K.cream);
  E(g, 3.5, 4, 1.8, 1.8, K.cream); E(g, 3.5, 7, 1.8, 1.8, K.cream); E(g, 12.5, 4, 1.8, 1.8, K.cream); E(g, 12.5, 7, 1.8, 1.8, K.cream);
  R(g, 4, 6, 8, 1, K.tan); P(g, 5, 4, K.white); P(g, 3, 3, K.white);
  return g;
}
function coin(f) {
  const g = mk(13, 13);
  if (f) E(g, 6.5, 6.5, 2.5, 4.5, K.amber, K.orange, K.yellow);
  else E(g, 6.5, 6.5, 4.5, 4.5, K.amber, K.orange, K.yellow);
  R(g, 6, 4, 1, 5, K.orange);
  return g;
}
function stinkBadge() {
  const g = mk(12, 9);
  E(g, 4, 5, 3, 3, K.green, K.dgreen); E(g, 7.5, 4, 3.5, 3, K.green, K.dgreen, K.yellow); E(g, 8, 6, 3, 2, K.green, K.dgreen);
  return g;
}

// ---------- Faces (front view, dog column) ----------
const OWNERS = [
  { skin: K.skin1, skinSh: K.skin2, hair: K.lgrey, hairSh: K.grey, hairLi: K.white, shirt: K.green, feat: K.plum, cheek: K.pink, bun: true },
  { skin: K.dbrown, skinSh: K.plum, hair: K.plum, hairSh: K.ink, hairLi: K.dbrown, shirt: K.mauve, feat: K.ink, cheek: K.rust, bun: false },
  { skin: K.skin2, skinSh: K.brown, hair: K.amber, hairSh: K.orange, hairLi: K.yellow, shirt: K.sky, feat: K.plum, cheek: K.pink, bun: false },
];
function ownerFace(o, mood) {
  const g = mk(32, 32);
  E(g, 16, 15, 11, 11, o.hair, o.hairSh);
  if (o.bun) E(g, 16, 4, 4, 3, o.hair, o.hairSh, o.hairLi);
  R(g, 8, 28, 16, 3, o.shirt); R(g, 6, 29, 20, 2, o.shirt);
  R(g, 13, 25, 6, 3, o.skinSh);
  E(g, 16, 17, 8.5, 9.5, o.skin, o.skinSh);
  E(g, 16, 9, 9.5, 4.5, o.hair, o.hairSh, o.hairLi);
  R(g, 12, 18, 1, 2, o.feat); R(g, 19, 18, 1, 2, o.feat);
  if (mood === "happy") {
    P(g, 10, 21, o.cheek); P(g, 11, 21, o.cheek); P(g, 20, 21, o.cheek); P(g, 21, 21, o.cheek);
    P(g, 14, 23, o.feat); P(g, 17, 23, o.feat); R(g, 15, 24, 2, 1, o.feat);
  } else if (mood === "neutral") {
    R(g, 14, 24, 4, 1, o.feat);
  } else {
    P(g, 14, 25, o.feat); P(g, 17, 25, o.feat); R(g, 15, 24, 2, 1, o.feat);
    P(g, 11, 16, o.feat); P(g, 12, 15, o.feat); P(g, 19, 15, o.feat); P(g, 20, 16, o.feat);
  }
  return g;
}
const DOGS = [
  { name: "PIP", fee: "$10", trait: "FANCY", traitC: K.mauve, hp: 6, fur: K.skin1, furSh: K.skin2, furLi: K.cream, ear: "big", earC: K.skin1, muzzle: K.cream, collar: K.mauve, road: "chi" },
  { name: "MAPLE", fee: "$20", trait: "FOOD", traitC: K.orange, hp: 4, fur: K.tan, furSh: K.skin2, furLi: K.cream, ear: "floppy", earC: K.skin2, muzzle: K.cream, collar: K.sky, road: "lab" },
  { name: "KODA", fee: "$30", trait: "CHASER", traitC: K.blue, hp: 2, fur: K.slate, furSh: K.dslate, furLi: K.grey, ear: "pointy", earC: K.dslate, muzzle: K.lgrey, mask: K.lgrey, collar: K.red, road: "husky" },
];
function dogFace(d) {
  const g = mk(32, 32);
  if (d.ear === "pointy") { T(g, 7, 13, 8, 2, 14, 8, d.earC); T(g, 25, 13, 24, 2, 18, 8, d.earC); }
  if (d.ear === "big") { T(g, 9, 13, 2, 3, 14, 8, d.earC); T(g, 23, 13, 30, 3, 18, 8, d.earC); T(g, 8, 11, 4, 5, 11, 8, K.pink); T(g, 24, 11, 28, 5, 21, 8, K.pink); }
  E(g, 16, 17, 9.5, 8.5, d.fur, d.furSh, d.furLi);
  if (d.mask) { R(g, 15, 9, 2, 7, d.mask); E(g, 16, 21, 6, 4, d.mask); R(g, 11, 13, 2, 1, d.mask); R(g, 19, 13, 2, 1, d.mask); }
  if (d.ear === "floppy") { E(g, 7, 17, 3, 6, d.earC); E(g, 25, 17, 3, 6, d.earC); }
  E(g, 16, 21, 4.5, 3, d.muzzle);
  R(g, 15, 19, 2, 2, K.ink);
  R(g, 11, 15, 2, 2, K.ink); R(g, 19, 15, 2, 2, K.ink); P(g, 11, 15, K.white); P(g, 19, 15, K.white);
  R(g, 15, 23, 2, 2, K.pink);
  R(g, 9, 26, 14, 2, d.collar);
  return g;
}
const mood = hp => hp >= 6 ? "happy" : hp >= 3 ? "neutral" : "upset";

function build(mode) {
  const two = fn => [finish(fn(0), mode), finish(fn(1), mode)];
  return {
    husky: two(husky), lab: two(lab), chi: two(chi), walker: two(walker), skunk: two(skunk), squirrel: two(squirrel),
    corgi: two(corgi), puddle: two(puddle), treat: [finish(bone(), mode), finish(bone(), mode)], tip: two(coin),
    stink: finish(stinkBadge(), mode),
    dogFace: DOGS.map(d => finish(dogFace(d), mode)),
    ownerFace: OWNERS.map(o => ({ happy: finish(ownerFace(o, "happy"), mode), neutral: finish(ownerFace(o, "neutral"), mode), upset: finish(ownerFace(o, "upset"), mode) })),
  };
}

// ---------- Road tiles (280x64, seamless vertically) ----------
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const ZONES = {
  street: { name: "STREET", base: K.dslate },
  park: { name: "PARK", base: K.tan },
  shops: { name: "SHOPS", base: K.lgrey },
  home: { name: "HOME STRETCH", base: K.skin2 },
};
const ZONE_ORDER = ["street", "park", "shops", "home"];
function roadTile(zone) {
  const cv = document.createElement("canvas"); cv.width = 280; cv.height = 64;
  const c = cv.getContext("2d"), r = rng(zone.length * 97 + 13);
  const f = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
  const speck = (n, col) => { for (let i = 0; i < n; i++) f(Math.floor(r() * 280), Math.floor(r() * 64), 1, 1, col); };
  const lanes = (fn) => { for (let k = 1; k < 5; k++) fn(k * 56 - 1); };
  if (zone === "street") {
    f(0, 0, 280, 64, K.dslate); speck(110, K.slate); speck(70, K.navy);
    f(0, 0, 3, 64, K.grey); f(277, 0, 3, 64, K.grey);
    for (let y = 0; y < 64; y += 16) { f(0, y, 3, 1, K.slate); f(277, y, 3, 1, K.slate); }
    lanes(x => { f(x, 8, 2, 12, K.lgrey); f(x, 40, 2, 12, K.lgrey); });
  } else if (zone === "park") {
    f(0, 0, 280, 64, K.tan); speck(90, K.brown); speck(40, K.cream);
    f(0, 0, 7, 64, K.green); f(273, 0, 7, 64, K.green);
    for (let y = 2; y < 64; y += 6) { f(5 + (y % 4 ? 0 : 1), y, 1, 2, K.dgreen); f(2, y + 3, 1, 2, K.dgreen); f(274 - (y % 4 ? 0 : 1), y, 1, 2, K.dgreen); f(277, y + 3, 1, 2, K.dgreen); }
    lanes(x => { for (let y = 4; y < 64; y += 16) f(x, y, 2, 6, K.brown); });
  } else if (zone === "shops") {
    f(0, 0, 280, 64, K.lgrey); speck(40, K.white);
    for (let x = 27; x < 280; x += 28) f(x, 0, 1, 64, K.grey);
    f(0, 0, 280, 1, K.grey); f(0, 32, 280, 1, K.grey);
    lanes(x => f(x, 0, 2, 64, K.slate));
  } else {
    f(0, 0, 280, 64, K.skin2);
    for (let row = 0; row < 8; row++) {
      const y = row * 8, off = row % 2 ? 7 : 0;
      f(0, y + 7, 280, 1, K.brown);
      for (let x = off; x < 280 + 14; x += 14) {
        f(x - 1, y, 1, 7, K.brown);
        if (r() < 0.3) f(x, y, 13, 1, K.skin1);
      }
    }
    lanes(x => { f(x, 6, 2, 10, K.cream); f(x, 38, 2, 10, K.cream); });
  }
  return cv;
}

return { PAL, DARK, dark, K, textW, text, textC, DOGS, OWNERS, mood, build, ZONES, ZONE_ORDER, roadTile };
})();
