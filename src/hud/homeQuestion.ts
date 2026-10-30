import { fillLine } from "@andornaut/game-kit/lines";

import type { GameData } from "../data/types";
import { dollarText } from "../home/home";
import { MENU_TEXT_FIELDS } from "../home/menuText";
import { currentZone, walkLength } from "../rules/route";
import { payZone, walkEarnings } from "../rules/run";
import type { RunState } from "../state/runState";
import { addCents, type Cents } from "../units";
import { RUN_TEXT_FIELDS } from "./runText";

// One line of the Home question's note, by what it says: lose (drawn red) or zonesLeft.
export interface HomeNoteLine {
  readonly kind: "lose" | "zonesLeft";
  readonly text: string;
}

// Whether the run is at a fork, between a zone's end and the next zone's pick.
function atFork(run: Pick<RunState, "route" | "zoneIndex">): boolean {
  return run.route.length <= run.zoneIndex;
}

// What heading home now gives up: the cash the current zone has earned since its start, which
// walkEarnings loses, plus the zone's pay for the dogs still walking. Nothing at a fork, with no
// zone picked yet.
function headHomeLoss(data: Pick<GameData, "tuning">, run: RunState): Cents {
  const { lost } = walkEarnings("wentHome", run);
  const pay = atFork(run) ? [] : payZone(data, run).changes;
  return pay.reduce((sum, change) => addCents(sum, change.amount), lost);
}

// The pause menu's note: how much of the cash End walk keeps, or that it keeps all of it.
export function pauseNote(data: Pick<GameData, "menuText">, run: RunState): string {
  const fields = MENU_TEXT_FIELDS.pause;
  const words = data.menuText.pause;
  const { banked } = walkEarnings("wentHome", run);
  const cash = dollarText(run.money);
  return banked === run.money
    ? fillLine(fields, words, "noteAll", { cash })
    : fillLine(fields, words, "note", { cash, kept: dollarText(banked) });
}

// What heading home now gives up (headHomeLoss), with no line at a fork. Then the zones left
// after this one, when any are.
export function homeQuestionNote(
  data: Pick<GameData, "runText" | "tuning" | "world">,
  run: RunState,
): HomeNoteLine[] {
  const fields = RUN_TEXT_FIELDS.homeQuestion;
  const words = data.runText.homeQuestion;
  const fork = atFork(run);
  const left = walkLength(data) - run.zoneIndex - (fork ? 0 : 1);
  const lines: HomeNoteLine[] = [];
  if (!fork) {
    const named = { lost: dollarText(headHomeLoss(data, run)), zone: currentZone(data, run).name };
    lines.push({ kind: "lose", text: fillLine(fields, words, "lose", named) });
  }
  if (left > 0) {
    lines.push({
      kind: "zonesLeft",
      text: fillLine(fields, words, "zonesLeft", { count: String(left) }),
    });
  }
  return lines;
}
