import type { GameObjects, Scene, Time, Tweens, Types } from "phaser";

// Tweens, timers and sprite animations that stop and start together. What joins the group while
// it is held starts held.
export class TimedGroup {
  paused = false;
  private readonly sprites = new Set<GameObjects.Sprite>();
  private readonly timers = new Set<Time.TimerEvent>();
  private readonly tweens = new Set<Tweens.Tween>();

  hold(paused: boolean): void {
    if (paused === this.paused) {
      return;
    }
    this.paused = paused;
    // A tween removed before it completed, such as one cut short, leaves the group.
    for (const tween of this.tweens) {
      if (tween.isPendingRemove() || tween.isRemoved() || tween.isDestroyed()) {
        this.tweens.delete(tween);
      } else if (paused) {
        tween.pause();
      } else {
        tween.resume();
      }
    }
    this.timers.forEach((timer) => {
      timer.paused = paused;
    });
    this.sprites.forEach((sprite) => (paused ? sprite.anims.pause() : sprite.anims.resume()));
  }

  // A tween that holds with the group until it completes.
  tween(scene: Scene, config: Types.Tweens.TweenBuilderConfig): Tweens.Tween {
    return this.join(scene.tweens.add(config));
  }

  join(tween: Tweens.Tween): Tweens.Tween {
    this.tweens.add(tween);
    tween.once("complete", () => this.tweens.delete(tween));
    if (this.paused) {
      tween.pause();
    }
    return tween;
  }

  // A timer that holds with the group, calling callback once after ms.
  after(scene: Scene, ms: number, callback: () => void): void {
    const timer = scene.time.delayedCall(ms, () => {
      this.timers.delete(timer);
      callback();
    });
    this.timers.add(timer);
    timer.paused = this.paused;
  }

  // A timer that holds with the group, calling callback every ms, repeat more times after the
  // first.
  every(scene: Scene, ms: number, repeat: number, callback: () => void): void {
    const timer = scene.time.addEvent({
      callback: () => {
        if (timer.getOverallRemaining() <= 0) {
          this.timers.delete(timer);
        }
        callback();
      },
      delay: ms,
      repeat,
    });
    this.timers.add(timer);
    timer.paused = this.paused;
  }

  // A sprite whose animation holds with the group until it is destroyed. Call it again after
  // playing a new animation on the sprite, since a play starts unheld.
  animate<Sprite extends GameObjects.Sprite>(sprite: Sprite): Sprite {
    // A sprite destroyed as its play ended, such as one whose art is missing, has no scene.
    if ((sprite.scene as Scene | undefined) === undefined) {
      return sprite;
    }
    if (!this.sprites.has(sprite)) {
      this.sprites.add(sprite);
      sprite.once("destroy", () => this.sprites.delete(sprite));
    }
    if (this.paused) {
      sprite.anims.pause();
    }
    return sprite;
  }
}
