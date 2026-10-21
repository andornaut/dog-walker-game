import * as v from "valibot";

import { assertNever } from "../lib/assertNever";
import { isPlainObject, objectMessage, parseOrThrow, record } from "./jsonSchema";

const DIRECTIONS = ["forward", "reverse", "pingpong", "pingpong_reverse"] as const;

const frameIndex = v.pipe(
  v.number("must be a number"),
  v.integer("must be a whole number"),
  v.minValue(0, "must not be negative"),
);

const tagSchema = v.pipe(
  record({
    direction: v.picklist(
      DIRECTIONS,
      (issue) => `must be one of ${DIRECTIONS.join(", ")}, not ${issue.received}`,
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

// The parts of an Aseprite "hash" JSON export the animation builder reads.
export type AsepriteSheet = v.InferOutput<typeof sheetSchema>;
type AsepriteTag = v.InferOutput<typeof tagSchema>;

interface AnimationFrame {
  duration: number;
  frame: string;
}

interface AnimationSpec {
  frames: AnimationFrame[];
  key: string;
}

// Tag names repeat across sprites (every dog has walk), and Phaser animation keys are
// global, so each key carries its texture key.
export function animationKey(textureKey: string, tagName: string): string {
  return `${textureKey}:${tagName}`;
}

function pingpong(indexes: number[]): number[] {
  return [...indexes, ...indexes.slice(1, -1).reverse()];
}

function frameIndexes(tag: AsepriteTag): number[] {
  const forward = Array.from({ length: tag.to - tag.from + 1 }, (_, i) => tag.from + i);
  switch (tag.direction) {
    case "forward":
      return forward;
    case "reverse":
      return forward.reverse();
    case "pingpong":
      return pingpong(forward);
    // Starts on the last frame, as Aseprite plays it.
    case "pingpong_reverse":
      return pingpong(forward.reverse());
    default:
      return assertNever(tag.direction);
  }
}

function parseSheet(textureKey: string, value: unknown): AsepriteSheet {
  return parseOrThrow(`${textureKey} sheet`, sheetSchema, value);
}

// Frame names are the keys of the exported frames object, in export order, which is
// how Phaser's Aseprite loader names the texture's frames.
export function animationSpecs(textureKey: string, json: unknown): AnimationSpec[] {
  const sheet = parseSheet(textureKey, json);
  const frames = Object.entries(sheet.frames);
  return (sheet.meta.frameTags ?? []).map((tag) => ({
    frames: frameIndexes(tag).map((index) => {
      const entry = frames[index];
      if (entry === undefined) {
        throw new Error(`${textureKey} tag "${tag.name}" refers to missing frame ${index}`);
      }
      const [frame, { duration }] = entry;
      return { duration, frame };
    }),
    key: animationKey(textureKey, tag.name),
  }));
}
