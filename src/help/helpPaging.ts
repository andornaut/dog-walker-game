import { clampIndex } from "../arrays";
import { assertNever } from "../rules/assertNever";

// "next" and "previous" turn one page and hold at the first and last pages, so a held
// arrow key cannot close the help. "advance" is the Next button: on the last page it
// reads GOT IT and closes. Pages are numbered from 0.
export type HelpAction =
  | { readonly kind: "advance" }
  | { readonly kind: "close" }
  | { readonly kind: "goTo"; readonly page: number }
  | { readonly kind: "next" }
  | { readonly kind: "previous" };

export type HelpOutcome =
  { readonly kind: "close" } | { readonly kind: "show"; readonly page: number };

export interface HelpButtons {
  readonly backEnabled: boolean;
  readonly nextLabel: "GOT IT" | "NEXT";
}

// Kept in range, so a page count that shrinks under a live edit still shows a page.
export function clampPage(pageCount: number, page: number): number {
  if (pageCount < 1) {
    throw new RangeError(`Help needs at least one page, got ${pageCount}`);
  }
  return clampIndex(pageCount, page);
}

export function applyHelpAction(pageCount: number, action: HelpAction, page: number): HelpOutcome {
  const current = clampPage(pageCount, page);
  switch (action.kind) {
    case "advance":
      return current === pageCount - 1 ? { kind: "close" } : { kind: "show", page: current + 1 };
    case "close":
      return { kind: "close" };
    case "goTo":
      return { kind: "show", page: clampPage(pageCount, action.page) };
    case "next":
      return { kind: "show", page: clampPage(pageCount, current + 1) };
    case "previous":
      return { kind: "show", page: clampPage(pageCount, current - 1) };
    default:
      return assertNever(action);
  }
}

export function helpButtons(pageCount: number, page: number): HelpButtons {
  const current = clampPage(pageCount, page);
  return { backEnabled: current > 0, nextLabel: current === pageCount - 1 ? "GOT IT" : "NEXT" };
}
