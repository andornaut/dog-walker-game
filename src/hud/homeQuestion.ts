import type { GameData } from "../data/types";
import { dollarText } from "../home/home";
import { currentZone, walkLength } from "../rules/route";
import { payZoneFees } from "../rules/run";
import { cents } from "../rules/units";
import type { RunState } from "../state/runState";
import { fillLine } from "../text/lines";
import { RUN_TEXT_FIELDS } from "./runText";

// One line of the Home question's note, by what it says: keep (drawn green), lose (red) or
// zonesLeft.
export interface HomeNoteLine {
  readonly kind: "keep" | "lose" | "zonesLeft";
  readonly text: string;
}

// What heading home now keeps and gives up: the walk's money so far, and the fees the current
// zone would pay the dogs still walking, by the rule that pays them. Then the zones left after
// this one, when any are.
export function homeQuestionNote(
  data: Pick<GameData, "dogs" | "runText" | "tuning" | "world">,
  run: RunState,
): HomeNoteLine[] {
  const fields = RUN_TEXT_FIELDS.homeQuestion;
  const words = data.runText.homeQuestion;
  const fees = cents(payZoneFees(data, run).state.money - run.money);
  const zone = currentZone(data, run).name;
  const left = walkLength(data) - run.zoneIndex - 1;
  const lines: HomeNoteLine[] = [
    { kind: "keep", text: fillLine(fields, words, "keep", { money: dollarText(run.money) }) },
    { kind: "lose", text: fillLine(fields, words, "lose", { fees: dollarText(fees), zone }) },
  ];
  if (left > 0) {
    lines.push({
      kind: "zonesLeft",
      text: fillLine(fields, words, "zonesLeft", { count: String(left) }),
    });
  }
  return lines;
}
