// A text line with {name}s that code fills in, and the tables that list the names each line
// may use. A table mirrors its text's shape: a list of names for a line, a nested table for a
// group of lines. A line a table leaves out may use no names.

export interface FieldTable {
  readonly [key: string]: FieldTable | readonly string[];
}

type FlatFieldTable = Readonly<Record<string, readonly string[]>>;

// The {name}s in a line, in order of appearance.
export function placeholders(line: string): string[] {
  return [...line.matchAll(/\{(\w+)\}/g)].map((match) => match[1] ?? "");
}

// Every name, wherever it appears, is replaced by its value; an unknown name is left as is.
export function fillNames(line: string, values: Readonly<Record<string, string>>): string {
  return line.replace(/\{(\w+)\}/g, (match, name: string) => values[name] ?? match);
}

// The line at key in a group, with the names its table lists filled in.
export function fillLine<Table extends FlatFieldTable, K extends keyof Table & string>(
  table: Table,
  lines: Readonly<Record<NoInfer<K>, string>>,
  key: K,
  fields: Readonly<Record<Table[K][number], string>>,
): string {
  return fillNames(lines[key], fields);
}

function isTable(entry: FieldTable | readonly string[] | undefined): entry is FieldTable {
  return entry !== undefined && !Array.isArray(entry);
}

// Each "path: {name}" in text whose line uses a name its table does not list for it.
export function strayNames(table: FieldTable, text: object, path = ""): string[] {
  return Object.entries(text).flatMap(([key, value]: [string, unknown]) => {
    const at = path === "" ? key : `${path}.${key}`;
    const entry = table[key];
    if (typeof value === "string") {
      const allowed: readonly string[] = Array.isArray(entry) ? entry : [];
      return placeholders(value)
        .filter((name) => !allowed.includes(name))
        .map((name) => `${at}: {${name}}`);
    }
    if (typeof value === "object" && value !== null) {
      return strayNames(isTable(entry) ? entry : {}, value, at);
    }
    return [];
  });
}
