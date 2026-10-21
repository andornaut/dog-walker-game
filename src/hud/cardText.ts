import type { GameData } from "../data/types";
import { boxStyles, CARD_LAYOUT, cardEffectBox, FIRES_FIT } from "../layout/cardLayout";
import { type FittedText, fittingText, type TextFitStyle } from "../layout/textFit";
import { firesText, type OptionView } from "../rules/choices";
import { formatDollars } from "../rules/effectText";
import { fillLine } from "../text/lines";
import type { FontMetrics } from "../ui/fontMetrics";
import { RUN_TEXT_FIELDS } from "./runText";

// What a card's plaque may say, longest first: the first that fits its room is shown. A path
// card's plaque shows its zone's pay multiplier instead of a cost, then how long its upgrade
// lasts, or the pay alone where both do not fit; another option's, its price, greyed with the
// card when the player cannot afford it; Skip's and a free option's, Free.
export function plaqueTexts(data: Pick<GameData, "runText">, option?: OptionView): string[] {
  const text = data.runText.card;
  if (option?.path !== undefined) {
    const pay = fillLine(RUN_TEXT_FIELDS.card, text, "forkFees", {
      fees: String(option.path.fees),
    });
    return option.duration === undefined
      ? [pay]
      : [`${pay} · ${text.upgradeDuration[option.duration]}`, pay];
  }
  if (option === undefined || option.cost === 0) {
    return [text.free];
  }
  return [fillLine(RUN_TEXT_FIELDS.card, text, "need", { amount: formatDollars(option.cost) })];
}

// The enlarged card's body: each change the option makes, cause by cause, a line each, or its
// effect where it names none; Skip's line for the skip card.
export function largeBodyText(
  data: Pick<GameData, "dogs" | "runText">,
  option?: OptionView,
): string {
  if (option === undefined) {
    return data.runText.card.skipHeld;
  }
  if (option.breakdown.length === 0) {
    return option.text;
  }
  return option.breakdown
    .map(({ dog, name, text }) =>
      [dog === null ? "" : `${data.dogs[dog].name}:`, text, name]
        .filter((part) => part !== "")
        .join(" "),
    )
    .join("\n");
}

// What a card's small effect may say, longest first: its effect, or for a path card its
// upgrade's name alone, which the enlarged card shows in full.
export function smallEffectTexts(
  data: Pick<GameData, "runText" | "upgrades">,
  option?: OptionView,
): string[] {
  if (option === undefined) {
    return [data.runText.card.skipEffect];
  }
  const upgrade = option.path?.upgrade;
  return upgrade === undefined ? [option.text] : [option.text, data.upgrades[upgrade].name];
}

// A small card's effect and firing warning, as inkWidth measures a line in the body font: the
// warning over the effect's foot with the first of smallEffectTexts that fits over it; else the
// first that fits the whole box with the warning left to the fires marker and the enlarged
// card; else the last text in the box's last style. The effect's top is box.y.
export function smallCardText(
  data: Pick<GameData, "dogs" | "runText" | "upgrades">,
  body: FontMetrics,
  inkWidth: (style: TextFitStyle, line: string) => number,
  option?: OptionView,
): { box: ReturnType<typeof cardEffectBox>; effect: FittedText; warning: FittedText | null } {
  const room = CARD_LAYOUT.effect.width;
  const fits = (fitted: FittedText) =>
    fitted.lines.length <= (fitted.style.lines ?? 1) &&
    fitted.lines.every((line) => inkWidth(fitted.style, line) <= room);
  const fires = option?.fires ?? [];
  const said =
    fires.length === 0
      ? null
      : fittingText(FIRES_FIT.small.styles, inkWidth, room, firesText(data, fires));
  const warnings = said !== null && fits(said) ? [said, null] : [null];
  const path = option?.path !== undefined;
  const texts = smallEffectTexts(data, option);
  for (const warning of warnings) {
    const box = cardEffectBox(body, { fireLines: warning?.lines.length ?? 0, path });
    for (const text of texts) {
      const effect = fittingText(boxStyles(body, box.height), inkWidth, room, text);
      if (fits(effect)) {
        return { box, effect, warning };
      }
    }
  }
  const box = cardEffectBox(body, { fireLines: 0, path });
  const effect = fittingText(boxStyles(body, box.height), inkWidth, room, texts.at(-1) ?? "");
  return { box, effect, warning: null };
}
