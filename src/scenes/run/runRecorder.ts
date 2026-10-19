import type { Game } from "phaser";

import { gameData } from "../../data";
import { DEV_STATE_EVENT, type DevState } from "../../dev/devOverlay";
import { DEV_LAST_LOG_KEY, DEV_REPLAY_KEY } from "../../dev/devPanelModel";
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
import { type Walk, walkScrollSpeed, zoneLength } from "../../runner/walk";
import type { PendingInput } from "./runInput";

// The run's dev hooks: the input log it records, the replay that drives it, and the state the
// dev overlay shows.
export class RunRecorder {
  private inputLog: InputLog | undefined;
  private replay: { events: InputEvent[]; next: number } | undefined;

  // A replay log waiting in the session starts the run from its setup and drives its inputs;
  // otherwise the page's URL sets the run up.
  setup(): RunSetup {
    const raw = sessionRead(DEV_REPLAY_KEY);
    if (raw !== null) {
      sessionRemove(DEV_REPLAY_KEY);
      const decoded = decodeInputLog(runSetupLimitsFor(gameData), raw);
      if (decoded.ok) {
        this.replay = { events: [...replayInputs(decoded.log)], next: 0 };
        return decoded.log.setup;
      }
      console.warn("Replay log rejected:", decoded.errors.join("; "));
    }
    return pageRunSetup().setup;
  }

  start(setup: RunSetup): void {
    this.inputLog = startInputLog(setup);
  }

  replaying(): boolean {
    return this.replay !== undefined;
  }

  // The replayed step inputs due by timeMs, or undefined when the run is played live.
  due(timeMs: number): PendingInput[] | undefined {
    const replay = this.replay;
    if (replay === undefined) {
      return undefined;
    }
    const { due, next } = takeDueInputs(replay.events, replay.next, timeMs);
    replay.next = next;
    return due;
  }

  // The next replayed card choice, if a replay is driving the run.
  cardChoice(): CardChoice | undefined {
    const replay = this.replay;
    if (replay === undefined) {
      return undefined;
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

  // The finished run's log, for the dev panel to offer.
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
  const scrollSpeed = walkScrollSpeed(gameData, walk.run) * walk.road.speedFactor;
  const state: DevState = {
    run: walk.run,
    scrollSpeed,
    setup,
    time: {
      clocks,
      expectedRoadMs: expectedRoadMs(zoneLength(gameData, walk.run), scrollSpeed),
    },
    zoneDistance: walk.run.zoneDistance,
    zoneIndex: walk.run.zoneIndex,
  };
  game.events.emit(DEV_STATE_EVENT, state);
}

// sessionStorage can be missing or throw (private browsing, blocked storage): the run goes on.
function sessionRead(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function sessionWrite(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // The dev panel then has no log to offer.
  }
}

function sessionRemove(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // A replay that cannot be cleared plays again on the next run.
  }
}
