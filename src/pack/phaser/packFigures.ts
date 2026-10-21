import type { GameObjects, Scene } from "phaser";

import { dogSpriteKey } from "../../assets/spriteKeys";
import { gameData } from "../../data";
import type { DogId } from "../../data/types";
import type { DepthDraw } from "../../layout/depthScale";
import { PACK_DEPTH, tautLeashLine } from "../../layout/packFormation";
import { drawPixelLine } from "../../scenes/draw";
import { PALETTE } from "../../scenes/palette";
import type { Shadow } from "../../scenes/run/stage";
import { addStandingSprite, playTag, showAtDepth } from "../../scenes/sprites";
import { type Feet, type LeashLine, leashLine, packLayers, type StandingDog } from "../packDraw";

// The leashes' colour off the road, at the start screen's gate and on the end screen's walk
// home; on the road each zone sets its own.
export const YARD_LEASH_COLOR = PALETTE.darkRed;

export interface Figure {
  key: string;
  sprite: GameObjects.Sprite;
}

// The leashes' colour, and the dog whose leash is taut, highlighted along its upper-left side.
export interface LeashLook {
  color: number;
  taut: DogId | null;
}

// A walker or dog sprite of the pack, playing tag; still holds the tag's first frame.
export function addFigure(scene: Scene, still: boolean, tag: string, key: string): Figure {
  const sprite = addStandingSprite(scene, key, 0, 0);
  playTag(sprite, key, tag, still);
  return { key, sprite };
}

// The pack's sprites and its leashes, stood by stand(), which every screen that shows the pack
// draws it through. walker is undefined while none is picked: the dogs stand without leashes.
export class PackFigures {
  readonly dogs: ReadonlyMap<DogId, GameObjects.Sprite>;
  // What the leashes were last drawn as, so an unchanged frame skips them.
  private drawnLeash = "";
  private readonly leash: GameObjects.Graphics;
  readonly walker: Figure | undefined;

  constructor(
    scene: Scene,
    pose: { still: boolean; tag: string },
    walker: string | undefined,
    dogs: readonly DogId[],
  ) {
    const { still, tag } = pose;
    this.leash = scene.add.graphics();
    this.dogs = new Map(
      dogs.map((dog) => [dog, addFigure(scene, still, tag, dogSpriteKey(gameData, dog)).sprite]),
    );
    this.walker = walker === undefined ? undefined : addFigure(scene, still, tag, walker);
  }

  // Every sprite and the leashes, back to front as stand() last layered them, for a container,
  // which draws its children in the order they were added rather than by depth.
  layers(): (GameObjects.Graphics | GameObjects.Sprite)[] {
    return [
      ...this.dogs.values(),
      this.leash,
      ...(this.walker === undefined ? [] : [this.walker.sprite]),
    ].sort((a, b) => a.depth - b.depth);
  }

  // Plays tag on every figure; still holds its first frame.
  play(still: boolean, tag: string): void {
    for (const [dog, sprite] of this.dogs) {
      playTag(sprite, dogSpriteKey(gameData, dog), tag, still);
    }
    if (this.walker !== undefined) {
      playTag(this.walker.sprite, this.walker.key, tag, still);
    }
  }

  // Stands the walker on its feet and each dog given on its own, at full size, each over its
  // shadow, layered over base by packLayers, with a leash from the walker's hand to each dog's
  // collar. Returns how each dog is drawn.
  stand(
    base: number,
    shadow: Shadow,
    look: LeashLook,
    stand: { dogs: readonly StandingDog[]; walker: Feet },
  ): Map<DogId, DepthDraw> {
    const { leash, walker } = this;
    const depths = new Map(
      packLayers(stand.walker, stand.dogs).map(({ depth, layer }) => [
        layer.kind === "dog" ? layer.dog : layer.kind,
        base + depth,
      ]),
    );
    const drawn = new Map<DogId, DepthDraw>();
    const lines: { dog: DogId; line: LeashLine }[] = [];
    for (const standing of stand.dogs) {
      const { dog, feet } = standing;
      const sprite = this.dogs.get(dog);
      if (sprite === undefined) {
        continue;
      }
      const key = dogSpriteKey(gameData, dog);
      const shown = showAtDepth(sprite, key, PACK_DEPTH);
      drawn.set(dog, shown);
      sprite.setPosition(feet.x, feet.footY).setDepth(depths.get(dog) ?? base);
      shadow(key, shown.depth, feet.x, feet.footY);
      lines.push({ dog, line: leashLine(stand.walker, shown.depth, standing) });
    }
    if (walker !== undefined) {
      walker.sprite
        .setPosition(stand.walker.x, stand.walker.footY)
        .setDepth(depths.get("walker") ?? base);
      leash.setDepth(depths.get("leash") ?? base);
      this.drawLeashes(look, lines);
      shadow(walker.key, 1, stand.walker.x, stand.walker.footY);
    }
    return drawn;
  }

  private drawLeashes(look: LeashLook, lines: readonly { dog: DogId; line: LeashLine }[]): void {
    const key = JSON.stringify([look, lines]);
    if (key === this.drawnLeash) {
      return;
    }
    this.drawnLeash = key;
    const { leash } = this;
    leash.clear();
    for (const { dog, line } of lines) {
      drawPixelLine(leash, look.color, line.from, line.to);
      if (dog === look.taut) {
        const taut = tautLeashLine(line.from, line.to);
        drawPixelLine(leash, PALETTE.yellow, taut.from, taut.to);
      }
    }
  }
}
