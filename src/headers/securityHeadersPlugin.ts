import type { Plugin } from "vite";

import {
  cspHash,
  headersFile,
  type HeadersRule,
  type HtmlPage,
  injectedStyles,
  inlineBlocks,
  type PageNeeds,
  pageRules,
  scriptSources,
  servedPath,
} from "./securityHeaders";
import { BASE_DIRECTIVES, COMMON_RULE, PAGE_RULES } from "./securityPolicy";

const HEADERS_FILE_NAME = "_headers";
// A stand-in origin for resolving a page's script src to a path on this site.
const SAME_ORIGIN = "https://site.invalid";
const HEADING =
  "Written by the build from src/headers/securityPolicy.ts and the hashes of each page's inline " +
  "blocks.";

// Writes dist/_headers: the common headers on every path and a Content-Security-Policy per
// page rule, with the hashes of every inline <script> and <style> in the built pages and the
// pages copied from public/, and of each <style> a same-origin script those pages load injects.
export function securityHeadersPlugin(): Plugin {
  let publicDir = "";
  return {
    apply: "build",
    configResolved(config) {
      ({ publicDir } = config);
    },
    enforce: "post",
    generateBundle: {
      async handler(_options, bundle) {
        const decoder = new TextDecoder();
        const readPublic = async (path: string): Promise<string> =>
          decoder.decode(await this.fs.readFile(`${publicDir}/${path}`));

        const publicHtml = async (dir: string): Promise<string[]> => {
          const entries = await this.fs.readdir(`${publicDir}/${dir}`, { withFileTypes: true });
          const nested = await Promise.all(
            entries.map(async (entry) => {
              const path = dir === "" ? entry.name : `${dir}/${entry.name}`;
              if (entry.isDirectory()) {
                return publicHtml(path);
              }
              return entry.isFile() && path.endsWith(".html") ? [path] : [];
            }),
          );
          return nested.flat();
        };

        const pages: HtmlPage[] = [
          ...Object.values(bundle).flatMap((file) =>
            file.type === "asset" &&
            file.fileName.endsWith(".html") &&
            typeof file.source === "string"
              ? [{ fileName: file.fileName, html: file.source }]
              : [],
          ),
          ...(await Promise.all(
            (await publicHtml("")).map(async (fileName) => ({
              fileName,
              html: await readPublic(fileName),
            })),
          )),
        ];

        // Scripts copied from public/, such as nav.js. Bundled code is left out: Phaser's CSS
        // file loader injects a <style> whose text is only known at run time, and the game does
        // not use it.
        const injectedStyleHashes = async (pageFile: string, src: string): Promise<string[]> => {
          const url = new URL(src, `${SAME_ORIGIN}/${pageFile}`);
          const name = url.pathname.slice(1);
          if (url.origin !== SAME_ORIGIN || name in bundle) {
            return [];
          }
          const script = await readPublic(name).catch(() =>
            this.error(`security headers: ${pageFile} loads ${src}, which is not in ${publicDir}`),
          );
          return Promise.all(injectedStyles(`/${name}`, script).map(cspHash));
        };

        const needs = new Map<string, PageNeeds>(
          await Promise.all(
            pages.map(async ({ fileName, html }) => {
              const { scripts, styles } = inlineBlocks(html);
              const injected = await Promise.all(
                scriptSources(html).map((src) => injectedStyleHashes(fileName, src)),
              );
              const pageNeeds: PageNeeds = {
                scriptHashes: await Promise.all(scripts.map(cspHash)),
                styleHashes: [...(await Promise.all(styles.map(cspHash))), ...injected.flat()],
              };
              return [servedPath(fileName), pageNeeds] as const;
            }),
          ),
        );

        let rules: HeadersRule[] = [];
        try {
          rules = pageRules(BASE_DIRECTIVES, PAGE_RULES, needs);
        } catch (error) {
          this.error(`security headers: ${(error as Error).message}`);
        }
        this.emitFile({
          fileName: HEADERS_FILE_NAME,
          source: headersFile(HEADING, [COMMON_RULE, ...rules]),
          type: "asset",
        });
      },
      order: "post",
    },
    name: "dog-walker-security-headers",
  };
}
