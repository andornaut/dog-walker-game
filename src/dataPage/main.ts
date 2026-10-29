import "./main.css";

import { keysOf } from "@andornaut/game-kit/records";

import { badgeKey } from "../assets/spriteKeys";
import { gameData, onGameDataChange } from "../data";
import type {
  GameData,
  HintTrigger,
  Modifier,
  PackSize,
  QuipMoment,
  Unlock,
  Zone,
} from "../data/types";
import { achievementConditionText } from "../rules/achievements";
import { maxHearts, sizeHearts } from "../rules/dogs";
import {
  agilityPercent,
  capitalize,
  debuffText,
  effectText,
  formatDollars,
  perkEffect,
  SIZE_NAMES,
} from "../rules/effectText";
import { modifiersOf } from "../rules/modifiers";
import { firstZoneId, walkLength, zoneById } from "../rules/route";
import { price, unlockPrice } from "../rules/shop";
import { zoneStats } from "../rules/zones";
import {
  activeValues,
  type Cell,
  clearFilter,
  facetKey,
  facetStates,
  type FacetValue,
  filterRows,
  type Filters,
  parseFilters,
  type Row,
  serializeFilters,
  slug,
  TABLES_KEY,
  toggleFilter,
} from "./filters";

interface Section {
  // The headers of the columns a reader can filter the rows by, one row of pills each.
  readonly facets?: readonly string[];
  // A row whose first cell is "" continues the row above, and leaves this many cells blank.
  readonly groupedColumns?: number;
  readonly headers: readonly string[];
  readonly note?: string;
  readonly rows: readonly Row[];
  readonly title: string;
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}

function pill(key: string, label: string, pressed: boolean, value: string): HTMLButtonElement {
  const button = element("button", label);
  button.type = "button";
  button.className = "pill";
  button.dataset.key = key;
  button.dataset.value = value;
  button.setAttribute("aria-pressed", String(pressed));
  return button;
}

// A labelled row of toggle pills, led by All, which is pressed while none of the others is.
function pillRow(
  key: string,
  label: string,
  active: ReadonlySet<string>,
  values: readonly FacetValue[],
): HTMLElement {
  const row = element("div");
  row.className = "pills";
  row.setAttribute("role", "group");
  const name = element("span", label);
  name.className = "pills-label";
  name.id = `pills-${key}`;
  row.setAttribute("aria-labelledby", name.id);
  row.append(
    name,
    pill(key, "All", active.size === 0, ""),
    ...values.map((value) => pill(key, value.label, active.has(value.id), value.id)),
  );
  return row;
}

function renderSection(filters: Filters, shown: boolean, section: Section): HTMLElement {
  const { groupedColumns = 0, headers, note, title } = section;
  const facets = facetStates(
    (section.facets ?? []).map((header) => ({
      column: headers.indexOf(header),
      key: facetKey(header, title),
    })),
    filters,
    groupedColumns,
    section.rows,
  );
  const rows = filterRows(facets, groupedColumns, section.rows);
  const node = element("section");
  node.id = slug(title);
  node.hidden = !shown;
  node.append(element("h2", title));
  if (note !== undefined) {
    node.append(element("p", note));
  }
  for (const [i, { active, key, values }] of facets.entries()) {
    node.append(pillRow(key, section.facets?.[i] ?? "", active, values));
  }
  if (rows.length < section.rows.length) {
    const count = element("p", `Showing ${rows.length} of ${section.rows.length} rows.`);
    count.className = "count";
    node.append(count);
  }
  const table = element("table");
  const headRow = element("tr");
  headRow.append(...headers.map((header) => element("th", header)));
  table.append(element("thead"), element("tbody"));
  table.tHead?.append(headRow);
  for (const row of rows) {
    const tableRow = element("tr");
    for (const cell of row) {
      const td = element("td", String(cell));
      if (typeof cell === "number") {
        td.className = "number";
      }
      tableRow.append(td);
    }
    table.tBodies[0]?.append(tableRow);
  }
  const scroll = element("div");
  scroll.className = "scroll";
  scroll.append(table);
  node.append(scroll);
  return node;
}

function priceText(data: GameData, item: Unlock): string {
  return item.unlock === "start" ? "Start" : formatDollars(unlockPrice(data.tuning, item));
}

const PACK_SIZES: readonly PackSize[] = [1, 2, 3];

// A value for each pack size, leading 1, 2 and 3 dogs.
function byPackSize(value: (size: PackSize) => number): string {
  return PACK_SIZES.map(value).join(" / ");
}

function dogsSection(data: GameData): Section {
  const { tuning } = data;
  const luckyCollar: readonly Modifier[] = modifiersOf(data.shopGear.luckyCollar.effects);
  return {
    facets: ["Size"],
    headers: [
      "Dog",
      "Breed",
      "Size",
      "Owner",
      "♥ by size",
      "Max ♥ leading 1 / 2 / 3",
      "With Lucky collar",
      "Unlock",
    ],
    rows: Object.values(data.dogs).map((dog) => [
      dog.name,
      dog.breed,
      capitalize(SIZE_NAMES[dog.size]),
      `${dog.owner.name}, ${dog.owner.role}`,
      sizeHearts(tuning, dog),
      byPackSize((size) => maxHearts(tuning, [], { lead: true, size }, dog)),
      byPackSize((size) => maxHearts(tuning, luckyCollar, { lead: true, size }, dog)),
      priceText(data, dog),
    ]),
    title: "Dogs",
  };
}

const QUIP_MOMENTS: readonly QuipMoment[] = ["happier", "upset", "fired", "parting"];

function quipsSection(data: GameData): Section {
  return {
    facets: ["Moment"],
    groupedColumns: 2,
    headers: ["Dog", "Owner", "Moment", "Lines"],
    note: "Parting lines show when the player picks the dog on the home screen.",
    rows: keysOf(data.dogs).flatMap((id) => {
      const dog = data.dogs[id];
      return QUIP_MOMENTS.map((moment, i) => [
        i === 0 ? dog.name : "",
        i === 0 ? dog.owner.name : "",
        moment,
        data.quips[id][moment].join(" / "),
      ]);
    }),
    title: "Owner quips",
  };
}

function hintsSection(data: GameData): Section {
  const triggerText = (trigger: HintTrigger): string => {
    if (trigger.kind === "encounter") {
      return `first ${data.encounters[trigger.encounter].name}`;
    }
    return `first ${trigger.kind}`;
  };
  return {
    headers: ["Hint", "Trigger", "Text"],
    note: "Each shows once, the first time its trigger happens.",
    rows: Object.entries(data.hints).map(([id, hint]) => [
      id,
      triggerText(hint.trigger),
      hint.text,
    ]),
    title: "First-time hints",
  };
}

function encountersSection(data: GameData): Section {
  const rows = Object.values(data.encounters).flatMap((encounter): Cell[][] => {
    const head = [encounter.name, encounter.kind];
    const { resolution } = encounter;
    if (resolution.kind === "instant") {
      return [[...head, "Instant", effectText(data, resolution.effects), resolution.art]];
    }
    if (resolution.kind === "contact") {
      return [[...head, "On contact", effectText(data, resolution.effects), ""]];
    }
    if (resolution.kind === "pull") {
      return [[...head, "Pulls only", "dogs pull toward it", ""]];
    }
    return resolution.options.map((option, i) => [
      ...(i === 0 ? head : head.map(() => "")),
      option.name,
      effectText(data, option.effects),
      option.art,
    ]);
  });
  return {
    facets: ["Kind"],
    groupedColumns: 2,
    headers: ["Encounter", "Kind", "Option", "Effect", "Art"],
    note: "A lucky find opens no card: it applies on contact, with a popup.",
    rows,
    title: "Encounters",
  };
}

function upgradesSection(data: GameData): Section {
  return {
    facets: ["Kind"],
    headers: ["Upgrade", "Kind", "Effect", "Art"],
    rows: Object.values(data.upgrades).map((upgrade) => [
      upgrade.name,
      upgrade.kind === "tradeOff" ? "trade-off" : "boost",
      effectText(data, upgrade.effects),
      upgrade.art,
    ]),
    title: "Upgrades",
  };
}

function shopSection(data: GameData): Section {
  const gearRows = Object.values(data.shopGear).map((gear) => [
    gear.name,
    formatDollars(price(data.tuning, gear.price)),
    effectText(data, gear.effects),
  ]);
  const dogRows = Object.values(data.dogs)
    .filter((dog) => dog.unlock === "shop")
    .map((dog) => [dog.name, priceText(data, dog), "Unlocks the dog"]);
  return { headers: ["Item", "Price", "Effect"], rows: [...gearRows, ...dogRows], title: "Shop" };
}

function dogSlotsSection(data: GameData): Section {
  return {
    headers: ["Slot", "Price"],
    note: "A run takes at most one dog per owned slot. Slots can be bought at any time.",
    rows: data.dogSlots.map((slot, i) => [i + 1, priceText(data, slot)]),
    title: "Dog slots",
  };
}

function walkersSection(data: GameData): Section {
  return {
    headers: ["Walker", "Agility", "Perk", "Effect", "Unlock", "Sprite", "Portrait"],
    note:
      "A new player starts with the default walker. The others unlock the first time a walk " +
      "finishes with at least their dogs still walking at the end.",
    rows: keysOf(data.walkers).map((id) => {
      const walker = data.walkers[id];
      const name = id === data.defaultWalker ? `${walker.name} (default)` : walker.name;
      return [
        name,
        `${agilityPercent(walker.agility) ?? "Base"} (${walker.agility})`,
        data.walkerPerks[walker.perk].name,
        perkEffect(data.tuning, data.walkerPerks[walker.perk]),
        walker.unlock === "start"
          ? "Start"
          : `Finish a walk with ${walker.dogs} ${walker.dogs === 1 ? "dog" : "dogs"}`,
        walker.spriteKey,
        walker.portraitKey,
      ];
    }),
    title: "Walkers",
  };
}

function debuffsSection(data: GameData): Section {
  return {
    headers: ["Debuff", "Effect"],
    rows: Object.values(data.debuffs).map((debuff) => [debuff.name, debuffText(data, debuff)]),
    title: "Debuffs",
  };
}

// The kinds a zone's weights keep out of it.
function neverIn(zone: Zone): string {
  const groups = Object.values(zone.weights) as Readonly<Record<string, number>>[];
  const never = groups.flatMap((weights) => Object.keys(weights).filter((id) => weights[id] === 0));
  return never.length === 0 ? "-" : never.join(", ");
}

function zonesSection(data: GameData): Section {
  return {
    headers: [
      "Zone",
      "Difficulty",
      "Speed",
      "Movers",
      "Minutes",
      "Speed (px/s)",
      "Obstacles",
      "Tips",
      "Treats",
      "Lucky",
      "Never here",
    ],
    note:
      `World: ${data.world.name}. A walk is ${walkLength(data)} zones, starting in ` +
      `${zoneById(data, firstZoneId(data)).name}; the rest are picked at forks, easiest ` +
      "first in this table. Minutes, speed and counts are for the zone walked second, at " +
      "base speed and before upgrades.",
    rows: data.world.zones.map((zone) => {
      const stats = zoneStats(data.tuning, zone, 1);
      return [
        zone.name,
        `${zone.difficultyName} (${zone.difficulty})`,
        `×${zone.speed}`,
        `${Math.round(zone.moverShare * 100)}%`,
        Math.round((stats.duration / 60) * 10) / 10,
        Math.round(stats.scrollSpeed),
        stats.obstacles,
        stats.tips,
        stats.treats,
        Math.round(Object.values(stats.luckyFinds).reduce((sum, n) => sum + n, 0) * 100) / 100,
        neverIn(zone),
      ];
    }),
    title: "Zones",
  };
}

function achievementsSection(data: GameData): Section {
  return {
    headers: ["Badge", "Goal", "Line", "Earned when", "Art"],
    note: "In badge wall order. Every condition must hold; celebration only, no reward.",
    rows: data.achievements.map((achievement) => [
      achievement.name,
      achievement.goal,
      achievement.badgeLine,
      achievement.conditions
        .map((condition) => achievementConditionText(data, condition))
        .join(" and "),
      badgeKey(achievement.id),
    ]),
    title: "Achievements",
  };
}

function helpSection(data: GameData): Section {
  return {
    headers: ["Page", "Title", "Body", "Art"],
    note: "The How to walk screen, in page order. Art is a manifest image key.",
    rows: data.help.map((page, i) => [i + 1, page.title, page.body, page.art]),
    title: "Help",
  };
}

// One row per number, nested tables flattened to group.table.row.
function tuningSection(data: GameData): Section {
  const rows: Cell[][] = [];
  for (const [group, values] of Object.entries(data.tuning)) {
    for (const [key, value] of Object.entries(values)) {
      if (typeof value === "number") {
        rows.push([group, key, value]);
      } else {
        for (const [row, rowValue] of Object.entries(value as Readonly<Record<string, number>>)) {
          rows.push([group, `${key}.${row}`, rowValue]);
        }
      }
    }
  }
  return {
    facets: ["Group"],
    headers: ["Group", "Key", "Value"],
    note: "Money is in dollars, times in seconds, speeds in pixels per second.",
    rows,
    title: "Tuning",
  };
}

let filters: Filters = parseFilters(globalThis.location.search);
// Every table, in page order, and the element each renders to.
let sections: Section[] = [];
let sectionNodes: HTMLElement[] = [];
let tablesRow: HTMLElement = element("div");

function sectionShown(section: Section): boolean {
  const shown = activeValues(
    TABLES_KEY,
    sections.map((each) => slug(each.title)),
    filters,
  );
  return shown.size === 0 || shown.has(slug(section.title));
}

function renderTablesRow(): HTMLElement {
  const values = sections.map(({ title }) => ({ id: slug(title), label: title }));
  const active = activeValues(
    TABLES_KEY,
    values.map((value) => value.id),
    filters,
  );
  return pillRow(TABLES_KEY, "Tables", active, values);
}

// Runs update, then focuses the pill that had focus before it, which update replaced.
function keepingFocus(update: () => void): void {
  const focused = document.activeElement;
  const { key, value } = focused instanceof HTMLElement ? focused.dataset : {};
  update();
  if (key !== undefined && value !== undefined) {
    document
      .querySelector<HTMLElement>(
        `button.pill[data-key="${CSS.escape(key)}"][data-value="${CSS.escape(value)}"]`,
      )
      ?.focus();
  }
}

function redraw(): void {
  keepingFocus(() => {
    const next = renderTablesRow();
    tablesRow.replaceWith(next);
    tablesRow = next;
    sectionNodes = sectionNodes.map((node, i) => {
      const section = sections[i];
      if (section === undefined) {
        return node;
      }
      const replacement = renderSection(filters, sectionShown(section), section);
      node.replaceWith(replacement);
      return replacement;
    });
  });
}

function onPillClick(event: MouseEvent): void {
  const button = event.target instanceof Element ? event.target.closest("button.pill") : null;
  if (!(button instanceof HTMLElement)) {
    return;
  }
  const { key, value } = button.dataset;
  if (key === undefined || value === undefined) {
    return;
  }
  filters = value === "" ? clearFilter(key, filters) : toggleFilter(key, value, filters);
  const { hash, pathname } = globalThis.location;
  globalThis.history.replaceState(
    globalThis.history.state,
    "",
    `${pathname}${serializeFilters(filters)}${hash}`,
  );
  redraw();
}

function render(): void {
  const root = document.getElementById("data");
  if (root === null) {
    return;
  }
  const data = gameData;
  sections = [
    dogsSection,
    encountersSection,
    upgradesSection,
    shopSection,
    dogSlotsSection,
    walkersSection,
    quipsSection,
    hintsSection,
    debuffsSection,
    zonesSection,
    achievementsSection,
    helpSection,
    tuningSection,
  ].map((section) => section(data));
  tablesRow = renderTablesRow();
  sectionNodes = sections.map((section) => renderSection(filters, sectionShown(section), section));
  root.replaceChildren(
    element("h1", "Game data"),
    element("p", "Every table the game reads, with card text generated from the live values."),
    tablesRow,
    ...sectionNodes,
  );
}

document.getElementById("data")?.addEventListener("click", onPillClick);
render();
onGameDataChange(render);
