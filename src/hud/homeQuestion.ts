import type { GameData } from "../data/types";
import { dollarText } from "../home/home";
import { fillLine } from "../lib/lines";
import { currentZone, walkLength } from "../rules/route";
import { payZone } from "../rules/run";
import { cents } from "../rules/units";
import { packDogs } from "../state/pack";
import type { RunState } from "../state/runState";
import { RUN_TEXT_FIELDS } from "./runText";

// One line of the Home question's note, by what it says: lose (drawn red) or zonesLeft.
export interface HomeNoteLine {
  readonly kind: "lose" | "zonesLeft";
  readonly text: string;
}

// What heading home now gives up: the current zone's pay for the dogs still walking, and the
// Full pack bonus while no owner has fired you; at a fork, with no zone picked yet, the bonus
// alone. Then the zones left after this one, when any are.
export function homeQuestionNote(
  data: Pick<GameData, "runText" | "tuning" | "world">,
  run: RunState,
): HomeNoteLine[] {
  const fields = RUN_TEXT_FIELDS.homeQuestion;
  const words = data.runText.homeQuestion;
  const atFork = run.route.length <= run.zoneIndex;
  const bonus = packDogs(run).length === run.pack.length;
  const left = walkLength(data) - run.zoneIndex - (atFork ? 0 : 1);
  const lines: HomeNoteLine[] = [];
  if (atFork) {
    if (bonus) {
      lines.push({ kind: "lose", text: fillLine(fields, words, "loseBonus", {}) });
    }
  } else {
    const fees = cents(payZone(data, run).changes.reduce((sum, change) => sum + change.amount, 0));
    const named = { fees: dollarText(fees), zone: currentZone(data, run).name };
    const line = bonus ? "loseWithBonus" : "lose";
    lines.push({ kind: "lose", text: fillLine(fields, words, line, named) });
  }
  if (left > 0) {
    lines.push({
      kind: "zonesLeft",
      text: fillLine(fields, words, "zonesLeft", { count: String(left) }),
    });
  }
  return lines;
}
