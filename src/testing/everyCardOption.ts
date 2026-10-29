import { gameData } from "../data";
import type { ZoneId } from "../data/types";
import { largeBodyText } from "../hud/cardText";
import { keysOf } from "../lib/records";
import { cents } from "../lib/units";
import { cardFor, type OptionView } from "../rules/choices";
import { testState } from "./runState";

// Every card option the data can deal: each encounter's card for each dog alone and for the
// three longest-named dogs together, on their last heart (so options fire them) and on five,
// with the bank full and empty; and each zone's path card with each upgrade.
function everyOption(): OptionView[] {
  const dogs = keysOf(gameData.dogs);
  const longest = [...dogs]
    .sort((a, b) => gameData.dogs[b].name.length - gameData.dogs[a].name.length)
    .slice(0, 3);
  const packs = [...dogs.map((dog) => [dog]), longest];
  const states = packs.flatMap((pack) =>
    [1, 5].flatMap((hearts) =>
      [0, 10_000].map((money) =>
        testState(Object.fromEntries(pack.map((dog) => [dog, hearts])), { money: cents(money) }),
      ),
    ),
  );
  const encounters = keysOf(gameData.encounters).filter(
    (id) => gameData.encounters[id].resolution.kind === "card",
  );
  const zones = gameData.world.zones.map(({ id }) => id as ZoneId);
  const upgrades = keysOf(gameData.upgrades);
  const first = states[0] ?? testState({ kilo: 5 });
  return [
    ...states.flatMap((state) =>
      encounters.flatMap(
        (encounter) =>
          cardFor(gameData, state, {
            affected: state.pack.map(({ dog }) => dog),
            encounter,
            kind: "encounter",
          }).options,
      ),
    ),
    ...zones.flatMap((zone) =>
      upgrades.flatMap(
        (upgrade) =>
          cardFor(gameData, first, { kind: "fork", paths: [zone], upgrades: [upgrade] }).options,
      ),
    ),
  ];
}

// Each card option once, by what its card shows, named by its label and effect; and Skip, as
// undefined.
export function everyCardOption(): [string, OptionView | undefined][] {
  const options = new Map(
    everyOption().map((option) => [
      JSON.stringify([option.label, option.text, option.fires, largeBodyText(gameData, option)]),
      option,
    ]),
  );
  return [
    ["Skip", undefined],
    ...[...options.values()].map((option): [string, OptionView] => [
      `${option.label}: ${option.text}`,
      option,
    ]),
  ];
}
