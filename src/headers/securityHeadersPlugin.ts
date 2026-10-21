import type { Plugin } from "vite";

import {
  cspHash,
  headersFile,
  type HeadersRule,
  type HtmlPage,
  inlineBlocks,
  navWithoutStylesheet,
  type PageNeeds,
  pageRules,
  servedPath,
  unhashedAssets,
} from "./securityHeaders";
import { BASE_DIRECTIVES, COMMON_RULE, FILE_RULES, PAGE_RULES } from "./securityPolicy";

const HEADERS_FILE_NAME = "_headers";
const HEADING =
  "Written by the build from src/headers/securityPolicy.ts and the hashes of each page's inline " +
  "blocks.";

// Writes dist/_headers: the common headers on every path, the file rules (a year's caching for
// hashed build output, a type for font descriptors) and a Content-Security-Policy per page
// rule, with the hashes of every inline <script> and <style> in the built pages and the pages
// copied from public/. Fails the build for a page that loads nav.js without nav.css, and for an
// unhashed file under the hashed asset path.
export function securityHeadersPlugin(): Plugin {
  return {
    apply: "build",
    enforce: "post",
    generateBundle: {
      async handler(_options, bundle) {
        const { publicDir } = this.environment.config;
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

        for (const { fileName, html } of pages) {
          if (navWithoutStylesheet(html)) {
            this.error(
              `security headers: ${fileName} loads /nav.js but does not link /nav.css, so its ` +
                "nav bar would be unstyled",
            );
          }
        }

        const unhashed = unhashedAssets(Object.keys(bundle));
        if (unhashed.length > 0) {
          this.error(
            `security headers: ${unhashed.join(", ")} would be cached for a year, but its name ` +
              "has no content hash",
          );
        }

        const needs = new Map<string, PageNeeds>(
          await Promise.all(
            pages.map(async ({ fileName, html }) => {
              const { scripts, styles } = inlineBlocks(html);
              const pageNeeds: PageNeeds = {
                scriptHashes: await Promise.all(scripts.map(cspHash)),
                styleHashes: await Promise.all(styles.map(cspHash)),
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
          source: headersFile(HEADING, [COMMON_RULE, ...FILE_RULES, ...rules]),
          type: "asset",
        });
      },
      order: "post",
    },
    name: "dog-walker-security-headers",
  };
}
