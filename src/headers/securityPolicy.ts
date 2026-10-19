// The security headers the build writes to dist/_headers, which Cloudflare serves with every
// static asset. securityHeadersPlugin adds the hashes of each page's inline <script> and
// <style> blocks to its rule's policy, so this module names only the sources a page loads.

// Rendered in this order.
export const DIRECTIVE_NAMES = [
  "default-src",
  "script-src",
  "style-src",
  "style-src-attr",
  "font-src",
  "img-src",
  "media-src",
  "connect-src",
  "worker-src",
  "manifest-src",
  "object-src",
  "base-uri",
  "form-action",
  "frame-ancestors",
] as const;

export type DirectiveName = (typeof DIRECTIVE_NAMES)[number];

export type Directives = Readonly<Partial<Record<DirectiveName, readonly string[]>>>;

export type HeaderList = readonly (readonly [name: string, value: string])[];

// A group of pages that share one Content-Security-Policy.
export interface PageRule {
  // Written above the rule in _headers.
  readonly comment: string;
  // Sources added to BASE_DIRECTIVES for these pages.
  readonly directives: Directives;
  // A Cloudflare _headers path pattern: * matches any run of characters, including none.
  readonly path: string;
}

// On every response. No Cache-Control: every asset keeps the platform default (max-age=0,
// must-revalidate), which the service worker relies on to see a new /sw.js on the next launch.
export const COMMON_RULE = {
  comment:
    "Every response. The game requests fullscreen and a screen wake lock; the clipboard (dev " +
    "panel, art gallery) keeps its default of self.",
  headers: [
    ["X-Content-Type-Options", "nosniff"],
    ["Referrer-Policy", "strict-origin-when-cross-origin"],
    [
      "Permissions-Policy",
      "fullscreen=(self), screen-wake-lock=(self), camera=(), microphone=(), geolocation=(), " +
        "payment=(), usb=()",
    ],
  ] satisfies HeaderList,
  path: "/*",
} as const;

// Every page's policy before its rule's sources and hashes are added. Phaser loads images
// through blob: URLs and its default textures as data: URIs.
export const BASE_DIRECTIVES: Directives = {
  "base-uri": ["'self'"],
  "connect-src": ["'self'"],
  "default-src": ["'self'"],
  "font-src": ["'self'"],
  "form-action": ["'self'"],
  "frame-ancestors": ["'none'"],
  "img-src": ["'self'", "data:", "blob:"],
  "manifest-src": ["'self'"],
  "media-src": ["'self'", "blob:"],
  "object-src": ["'none'"],
  "script-src": ["'self'"],
  "style-src": ["'self'"],
  "worker-src": ["'self'"],
};

const GOOGLE_FONTS: Directives = {
  "font-src": ["https://fonts.gstatic.com"],
  "style-src": ["https://fonts.googleapis.com"],
};

// Each built or public HTML page must match exactly one of these, or the build fails: two
// matching policies would join into one header and the browser would enforce both.
export const PAGE_RULES: readonly PageRule[] = [
  { comment: "The home page.", directives: GOOGLE_FONTS, path: "/" },
  { comment: "The game.", directives: {}, path: "/play/*" },
  { comment: "The game data tables.", directives: {}, path: "/data/*" },
  {
    comment:
      "The art gallery and mocks. style-src-attr: run-screen-color-test.html writes a style " +
      "attribute per palette colour through innerHTML.",
    directives: { ...GOOGLE_FONTS, "style-src-attr": ["'unsafe-inline'"] },
    path: "/art/*",
  },
];
