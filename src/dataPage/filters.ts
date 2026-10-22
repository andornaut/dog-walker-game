// The data page's filters: which tables show, and which rows of a table, by the values of the
// columns it offers as facets. Kept in the query string as key=value,value, where every key and
// value is a slug, so a filtered view survives a reload and can be shared.

export type Cell = number | string;
export type Row = readonly Cell[];

// Each key's selected value slugs. A key with no selected values filters nothing.
export type Filters = ReadonlyMap<string, ReadonlySet<string>>;

export interface Facet {
  readonly column: number;
  readonly key: string;
}

export interface FacetValue {
  readonly id: string;
  readonly label: string;
}

// A facet with the values its column offers and, among them, the selected ones.
export interface FacetState extends Facet {
  readonly active: ReadonlySet<string>;
  readonly values: readonly FacetValue[];
}

// The key of the pills that pick which tables show.
export const TABLES_KEY = "tables";

// Lowercase letters and digits, with a single hyphen between runs of them.
export function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// A table's facet key: its title and the column's header, as slugs.
export function facetKey(header: string, title: string): string {
  return `${slug(title)}-${slug(header)}`;
}

export function parseFilters(search: string): Filters {
  const filters = new Map<string, ReadonlySet<string>>();
  for (const [key, value] of new URLSearchParams(search)) {
    const values = value.split(",").map(slug).filter(Boolean);
    if (slug(key) === key && key !== "" && values.length > 0) {
      filters.set(key, new Set([...(filters.get(key) ?? []), ...values]));
    }
  }
  return filters;
}

// "" with nothing selected, so the URL is bare. Keys and values are slugs and need no encoding.
export function serializeFilters(filters: Filters): string {
  const pairs = [...filters]
    .filter(([, values]) => values.size > 0)
    .map(([key, values]) => `${key}=${[...values].join(",")}`);
  return pairs.length === 0 ? "" : `?${pairs.join("&")}`;
}

export function toggleFilter(key: string, value: string, filters: Filters): Filters {
  const values = new Set(filters.get(key));
  if (!values.delete(value)) {
    values.add(value);
  }
  const next = new Map(filters);
  if (values.size === 0) {
    next.delete(key);
  } else {
    next.set(key, values);
  }
  return next;
}

export function clearFilter(key: string, filters: Filters): Filters {
  const next = new Map(filters);
  next.delete(key);
  return next;
}

// The selected values that are among those offered. With none, the key filters nothing.
export function activeValues(
  key: string,
  offered: readonly string[],
  filters: Filters,
): ReadonlySet<string> {
  const selected = filters.get(key);
  return new Set(offered.filter((id) => selected?.has(id) === true));
}

// A row whose first cell is "" continues the row above, and leaves its first groupedColumns
// cells blank. Each row with those cells taken from the head of its group.
function resolvedRows(groupedColumns: number, rows: readonly Row[]): Row[] {
  let head: Row = [];
  return rows.map((row) => {
    if (groupedColumns === 0 || row[0] !== "") {
      head = row;
      return row;
    }
    return row.map((cell, i) => (i < groupedColumns ? (head[i] ?? cell) : cell));
  });
}

// The distinct values of a column, sorted by label.
export function facetValues(
  column: number,
  groupedColumns: number,
  rows: readonly Row[],
): FacetValue[] {
  const labels = new Map<string, string>();
  for (const row of resolvedRows(groupedColumns, rows)) {
    const label = String(row[column] ?? "");
    if (slug(label) !== "" && !labels.has(slug(label))) {
      labels.set(slug(label), label);
    }
  }
  return [...labels]
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

// Each facet's values in rows and its selected ones.
export function facetStates(
  facets: readonly Facet[],
  filters: Filters,
  groupedColumns: number,
  rows: readonly Row[],
): FacetState[] {
  return facets.map((facet) => {
    const values = facetValues(facet.column, groupedColumns, rows);
    const ids = values.map((value) => value.id);
    return { ...facet, active: activeValues(facet.key, ids, filters), values };
  });
}

// The rows whose value in each facet's column is one of that facet's active values. A kept row
// that continues a group whose head was dropped gets the head's grouped cells, so it still says
// whose it is.
export function filterRows(
  facets: readonly Pick<FacetState, "active" | "column">[],
  groupedColumns: number,
  rows: readonly Row[],
): Row[] {
  const resolved = resolvedRows(groupedColumns, rows);
  const kept: Row[] = [];
  let previousKept = -1;
  resolved.forEach((row, i) => {
    const matches = facets.every(
      ({ active, column }) => active.size === 0 || active.has(slug(String(row[column] ?? ""))),
    );
    if (!matches) {
      return;
    }
    const continuesKept = rows[i]?.[0] === "" && previousKept === i - 1;
    kept.push(continuesKept ? (rows[i] ?? row) : row);
    previousKept = i;
  });
  return kept;
}
