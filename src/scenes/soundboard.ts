import { Core, type Game, type Scene, Sound } from "phaser";

import { shouldResumeAudio } from "../audio/resume";
import {
  admitPlay,
  advanceMusic,
  clampVolume,
  effectiveVolumes,
  INITIAL_MIX,
  type Mix,
  MUSIC_KEY,
  MUSIC_STOPPED,
  musicLevel,
  type MusicState,
  type RecentPlays,
  type SoundCue,
  soundKeyFor,
  soundKeysOf,
  startMusic,
  stopMusic,
  type Volumes,
} from "../audio/sound";
import { AUDIO_UNLOCK_EVENTS, PHONE_EVENTS } from "../pwa";

// Every concrete sound class (Web Audio, HTML5 audio, no audio) has setVolume; BaseSound does not.
type AdjustableSound = Sound.BaseSound & { setVolume(value: number): unknown };

// The game's one sound player, shared by every scene so the music outlives scene changes.
// A key that did not load is skipped and logged once; no method throws.
class Soundboard {
  private mix: Mix = INITIAL_MIX;
  private music: MusicState = MUSIC_STOPPED;
  private musicSound: AdjustableSound | undefined;
  private recentPlays: RecentPlays = {};
  private readonly reportedKeys = new Set<string>();

  constructor(private readonly game: Game) {
    game.events.on(Core.Events.STEP, (_time: number, delta: number) => this.step(delta));
    game.events.on(Core.Events.HIDDEN, () => this.setHidden(true));
    game.events.on(Core.Events.VISIBLE, () => this.setHidden(false));
    this.resumeWhenAllowed();
  }

  play(cue: SoundCue): void {
    this.guard(`play ${cue}`, () => {
      const volume = effectiveVolumes(this.mix).sfx;
      if (volume <= 0) {
        return;
      }
      const key = soundKeyFor((candidate) => this.game.cache.audio.exists(candidate), cue);
      if (key === undefined) {
        const keys = soundKeysOf(cue).join(" or ");
        this.reportOnce(cue, `Sound ${keys} did not load; playing nothing in its place.`);
        return;
      }
      const { admitted, recent } = admitPlay(this.recentPlays, cue, this.game.loop.now);
      this.recentPlays = recent;
      if (admitted) {
        this.game.sound.play(key, { volume });
      }
    });
  }

  startMusic(): void {
    this.guard("start music", () => {
      this.music = startMusic(this.music);
      const sound = this.ensureMusicSound();
      if (sound !== undefined && !sound.isPlaying) {
        sound.play({ loop: true, volume: 0 });
      }
      this.applyMusicVolume();
    });
  }

  stopMusic(): void {
    this.guard("stop music", () => {
      this.music = stopMusic(this.music);
      this.applyMusicVolume();
    });
  }

  setVolumes(volumes: Volumes): void {
    const clamped = { music: clampVolume(volumes.music), sfx: clampVolume(volumes.sfx) };
    this.updateMix({ volumes: clamped });
    this.resumeAudio();
  }

  private setHidden(hidden: boolean): void {
    this.updateMix({ hidden });
  }

  setMuted(muted: boolean): void {
    this.updateMix({ muted });
    this.resumeAudio();
  }

  setPaused(paused: boolean): void {
    this.updateMix({ paused });
  }

  private updateMix(change: Partial<Mix>): void {
    this.guard("update the mix", () => {
      this.mix = { ...this.mix, ...change };
      this.applyMusicVolume();
    });
  }

  private step(deltaMs: number): void {
    if (this.music.kind !== "fading") {
      return;
    }
    this.guard("fade music", () => {
      this.music = advanceMusic(this.music, deltaMs);
      this.applyMusicVolume();
      if (this.music.kind === "stopped") {
        this.musicSound?.stop();
      }
    });
  }

  private applyMusicVolume(): void {
    this.musicSound?.setVolume(effectiveVolumes(this.mix).music * musicLevel(this.music));
  }

  private ensureMusicSound(): AdjustableSound | undefined {
    if (this.musicSound === undefined && this.isLoaded(MUSIC_KEY)) {
      this.musicSound = this.game.sound.add(MUSIC_KEY) as AdjustableSound;
    }
    return this.musicSound;
  }

  private isLoaded(key: string): boolean {
    if (this.game.cache.audio.exists(key)) {
      return true;
    }
    this.reportOnce(key, `Sound ${key} did not load; playing nothing in its place.`);
    return false;
  }

  // Phaser unlocks Web Audio on the first gesture, but a phone can stop the context again (a
  // call, Siri, switching apps), and iOS can leave it interrupted after Phaser's own resume on
  // return. So each return to the foreground and each later gesture resume it too. iOS counts
  // touchend, not touchstart or pointerdown, as a gesture that may start audio.
  private resumeWhenAllowed(): void {
    window.addEventListener(PHONE_EVENTS.appVisible, () => this.resumeAudio());
    for (const type of AUDIO_UNLOCK_EVENTS) {
      window.addEventListener(type, () => this.resumeAudio(), { capture: true, passive: true });
    }
  }

  // Also called on unmute, which is a tap in the settings, so its gesture resumes a context
  // left stopped while muted.
  private resumeAudio(): void {
    const { sound } = this.game;
    if (
      !(sound instanceof Sound.WebAudioSoundManager) ||
      !shouldResumeAudio(this.mix, sound.context.state)
    ) {
      return;
    }
    sound.context.resume().catch((error: unknown) => {
      this.reportOnce("resume", "The audio context did not resume.", error);
    });
  }

  private guard(action: string, run: () => void): void {
    try {
      run();
    } catch (error) {
      this.reportOnce(action, `Sound failed to ${action}.`, error);
    }
  }

  private reportOnce(id: string, message: string, error?: unknown): void {
    if (this.reportedKeys.has(id)) {
      return;
    }
    this.reportedKeys.add(id);
    console.warn(message, ...(error === undefined ? [] : [error]));
  }
}

const soundboards = new WeakMap<Game, Soundboard>();

// The game's soundboard, made on first use.
export function soundboardOf(scene: Scene): Soundboard {
  const existing = soundboards.get(scene.game);
  if (existing !== undefined) {
    return existing;
  }
  const soundboard = new Soundboard(scene.game);
  soundboards.set(scene.game, soundboard);
  return soundboard;
}
