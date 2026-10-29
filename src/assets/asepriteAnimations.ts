import {
  type AnimationSpec,
  animationSpecs as sheetAnimations,
  ASEPRITE_DIRECTIONS,
} from "@andornaut/game-kit/art/aseprite";
import * as v from "valibot";

import { isPlainObject, objectMessage, parseOrThrow, record } from "./jsonSchema";

const frameIndex = v.pipe(
  v.number("must be a number"),
  v.integer("must be a whole number"),
  v.minValue(0, "must not be negative"),
);

const tagSchema = v.pipe(
  record({
    direction: v.picklist(
      ASEPRITE_DIRECTIONS,
      (issue) => `must be one of ${ASEPRITE_DIRECTIONS.join(", ")}, not ${issue.received}`,
    ),
    from: frameIndex,
    name: v.string("must be a string"),
    to: frameIndex,
  }),
  v.check(({ from, to }) => from <= to, "from must not be after to"),
);

// Aseprite's "array" export lists frames in an array, which v.record would accept.
const hashFrames = v.pipe(
  v.unknown(),
  v.check(isPlainObject, 'must be an object: export with the "hash" JSON format'),
  v.record(
    v.string(),
    v.object(
      { duration: v.pipe(v.number("must be a number"), v.gtValue(0, "must be positive")) },
      objectMessage,
    ),
  ),
);

const sheetSchema = record({
  frames: hashFrames,
  meta: record({ frameTags: v.optional(v.array(tagSchema, "must be an array")) }),
});

// The parts of an Aseprite "hash" JSON export the animation builder reads, validated: the kit's
// art/aseprite builds the animations from them.
export type AsepriteSheet = v.InferOutput<typeof sheetSchema>;

// Each tag's animation in the export json of the texture textureKey, keyed by the kit's
// animationKey. Throws, naming the texture, on json that is not an Aseprite hash export or a tag
// that names a frame the export lacks.
export function animationSpecs(textureKey: string, json: unknown): AnimationSpec[] {
  const sheet = parseOrThrow(`${textureKey} sheet`, sheetSchema, json);
  try {
    const frameTags = sheet.meta.frameTags ?? [];
    return sheetAnimations(textureKey, { frames: sheet.frames, meta: { frameTags } });
  } catch (error) {
    throw new Error(`${textureKey}: ${(error as Error).message}`, { cause: error });
  }
}
