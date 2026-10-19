// The parts of an Aseprite "hash" JSON export the animation builder reads.
export interface AsepriteSheet {
  frames: Record<string, { duration: number }>;
  meta: { frameTags?: AsepriteTag[] };
}

export interface AsepriteTag {
  direction: string;
  from: number;
  name: string;
  to: number;
}

export interface AnimationFrame {
  duration: number;
  frame: string;
}

export interface AnimationSpec {
  frames: AnimationFrame[];
  key: string;
}

// Tag names repeat across sprites (every dog has walk), and Phaser animation keys are
// global, so each key carries its texture key.
export function animationKey(textureKey: string, tagName: string): string {
  return `${textureKey}:${tagName}`;
}

function frameIndexes(tag: AsepriteTag): number[] {
  const forward = Array.from({ length: tag.to - tag.from + 1 }, (_, i) => tag.from + i);
  switch (tag.direction) {
    case "reverse":
      return forward.reverse();
    case "pingpong":
      return [...forward, ...forward.slice(1, -1).reverse()];
    default:
      return forward;
  }
}

// Frame names are the keys of the exported frames object, in export order, which is
// how Phaser's Aseprite loader names the texture's frames.
export function animationSpecs(textureKey: string, sheet: AsepriteSheet): AnimationSpec[] {
  const frameNames = Object.keys(sheet.frames);
  return (sheet.meta.frameTags ?? []).map((tag) => ({
    frames: frameIndexes(tag).map((index) => {
      const frame = frameNames[index];
      const frameData = frame === undefined ? undefined : sheet.frames[frame];
      if (frame === undefined || frameData === undefined) {
        throw new Error(`${textureKey} tag "${tag.name}" refers to missing frame ${index}`);
      }
      return { duration: frameData.duration, frame };
    }),
    key: animationKey(textureKey, tag.name),
  }));
}
