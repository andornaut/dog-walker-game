import { sessionRead, sessionRemove, sessionWrite } from "@andornaut/game-kit/sessionStore";
import type { Game } from "phaser";

import { gameData } from "../../data";
import { DEV_STATE_EVENT, type DevState } from "../../dev/devOverlay";
import { DEV_LAST_LOG_KEY, DEV_REPLAY_KEY } from "../../dev/devPanelModel";
import { devToolsOn } from "../../dev/devTools";
import {
  type CardChoice,
  decodeInputLog,
  encodeInputLog,
  type InputEvent,
  type InputLog,
  recordInput,
  replayInputs,
  startInputLog,
  takeCardChoice,
  takeDueInputs,
} from "../../dev/inputLog";
import { pageRunSetup, runSetupLimitsFor } from "../../dev/pageRunSetup";
import type { RunSetup } from "../../dev/runSetup";
import { expectedRoadMs, type ZoneClocks } from "../../dev/zoneClock";
import type { SessionInput } from "../../runner/session";
import { roadScrollSpeed, type Walk, zoneLength } from "../../runner/walk";

// How a run starts: its setup, and the inputs that drive it when it replays a log.
export interface RunStart {
  replay: readonly InputEvent[] | undefined;
  setup: RunSetup;
}

// A replay log waiting in the session starts the next run from its setup and drives its inputs;
// otherwise the page's URL sets the run up. Reading the log clears it. The installed app reads
// no log.
export function nextRunStart(): RunStart {
  const raw = devToolsOn() ? sessionRead(DEV_REPLAY_KEY) : null;
  if (raw !== null) {
    sessionRemove(DEV_REPLAY_KEY);
    const decoded = decodeInputLog(runSetupLimitsFor(gameData), raw);
    if (decoded.ok) {
      return { replay: [...replayInputs(decoded.log)], setup: decoded.log.setup };
    }
    console.warn("Replay log rejected:", decoded.errors.join("; "));
  }
  return { replay: undefined, setup: pageRunSetup().setup };
}

// The run's dev hooks: the input log it records, the replay that drives it, and the state the
// dev overlay shows.
export class RunRecorder {
  private inputLog: InputLog | undefined;
  private readonly replay: { events: readonly InputEvent[]; next: number } | undefined;

  constructor(replay: readonly InputEvent[] | undefined) {
    this.replay = replay === undefined ? undefined : { events: replay, next: 0 };
  }

  start(setup: RunSetup): void {
    this.inputLog = startInputLog(setup);
  }

  replaying(): boolean {
    return this.replay !== undefined;
  }

  // The replayed step inputs due by timeMs, or undefined when the run is played live.
  due(timeMs: number): SessionInput[] | undefined {
    const replay = this.replay;
    if (replay === undefined) {
      return undefined;
    }
    const { due, next } = takeDueInputs(replay.events, replay.next, timeMs);
    replay.next = next;
    return due;
  }

  // The next replayed card choice, if a replay is driving the run, or "home" when the player
  // headed home from the card, as a fork card's Return home or the pause menu over a card does.
  cardChoice(): CardChoice | "home" | undefined {
    const replay = this.replay;
    if (replay === undefined) {
      return undefined;
    }
    if (replay.events[replay.next]?.kind === "home") {
      replay.next += 1;
      return "home";
    }
    const { choice, next } = takeCardChoice(replay.events, replay.next);
    replay.next = next;
    return choice;
  }

  log(event: InputEvent): void {
    if (this.inputLog !== undefined) {
      this.inputLog = recordInput(event, this.inputLog);
    }
  }

  // The finished run's log, kept for the tab under DEV_LAST_LOG_KEY.
  save(): void {
    if (this.inputLog !== undefined) {
      sessionWrite(DEV_LAST_LOG_KEY, encodeInputLog(this.inputLog));
    }
  }
}

export function emitDevState(
  game: Game,
  setup: RunSetup | undefined,
  clocks: ZoneClocks,
  walk: Walk | undefined,
): void {
  if (walk === undefined || setup === undefined) {
    return;
  }
  const scrollSpeed = roadScrollSpeed(gameData, walk);
  const state: DevState = {
    run: walk.run,
    scrollSpeed,
    setup,
    time: {
      clocks,
      expectedRoadMs: expectedRoadMs(zoneLength(gameData), scrollSpeed),
    },
    zoneDistance: walk.run.zoneDistance,
    zoneIndex: walk.run.zoneIndex,
  };
  game.events.emit(DEV_STATE_EVENT, state);
}
