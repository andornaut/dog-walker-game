import type { DogId, GameData } from "../data/types";
import type { FaceMood } from "../rules/treats";
import type { FontMetrics } from "../ui/fontMetrics";
import type { TextFitStyle } from "../ui/textFit";

// Walk text that names owners, each name drawn led by the owner's face: the face, then the
// name, then the rest of the line. A filled {owner} becomes a face and name token, which wraps
// as one word, so a name that wraps onto the next row takes its face with it.

// An owner's face, playing its mood's tag of face-owner-<art>-20: upset on a heart loss, happy
// on a gain, neutral otherwise.
export interface OwnerFace {
  readonly dog: DogId;
  readonly mood: FaceMood;
}

// An owner's name in a text: text[at, at + length), led by their face.
export interface FaceMark extends OwnerFace {
  readonly at: number;
  readonly length: number;
}

// A line of text and the owners' names in it, in order; a line with no marks is plain text.
export interface FaceText {
  readonly marks?: readonly FaceMark[];
  readonly text: string;
}

// The owner's 20x20 face (face-owner-<art>-20) at 1x in a 1px ink frame over tan, as the quip
// line's lead draws it, beside text at textScale. Its frame is centred on the row's capitals,
// and the name starts gap screen pixels past the frame, as the quip line's text starts past its
// lead. Beside text at any other scale the name shows alone: the face draws only at whole-number
// scales, and at 1x it is taller than a 1x row.
export const INLINE_FACE = { face: 20, gap: 4, textScale: 2 } as const;

// An inline face: the frame's side, the gap to the name, and how far the frame's top rises
// above the top of the row's capitals.
export interface FaceBox {
  readonly framed: number;
  readonly gap: number;
  readonly rise: number;
}

// The inline face beside text at textScale, or none where the name shows alone.
export function inlineFaceBox(body: FontMetrics, textScale: number): FaceBox | undefined {
  if (textScale !== INLINE_FACE.textScale) {
    return undefined;
  }
  const framed = INLINE_FACE.face + 2;
  return {
    framed,
    gap: INLINE_FACE.gap,
    rise: Math.floor((framed - body.capHeight * textScale) / 2),
  };
}

// The owner of dog's name, led by their face in mood.
export function ownerFaceText(data: Pick<GameData, "dogs">, mood: FaceMood, dog: DogId): FaceText {
  const text = data.dogs[dog].owner.name;
  return { marks: [{ at: 0, dog, length: text.length, mood }], text };
}

// Every {name} filled by its value, a text or a face text whose marks move with it; an unknown
// name is left as is.
export function fillFaceText(
  line: string,
  values: Readonly<Record<string, FaceText | string>>,
): FaceText {
  const marks: FaceMark[] = [];
  let text = "";
  let from = 0;
  for (const match of line.matchAll(/\{(\w+)\}/g)) {
    const value = values[match[1] ?? ""];
    if (value === undefined) {
      continue;
    }
    text += line.slice(from, match.index);
    const filled = typeof value === "string" ? { text: value } : value;
    marks.push(...(filled.marks ?? []).map((mark) => ({ ...mark, at: mark.at + text.length })));
    text += filled.text;
    from = match.index + match[0].length;
  }
  text += line.slice(from);
  return marks.length === 0 ? { text } : { marks, text };
}

// The line at key in a group, with the names its table lists filled in, as fillLine fills them,
// a face text's marks kept.
export function fillFaceLine<
  Table extends Readonly<Record<string, readonly string[]>>,
  K extends keyof Table & string,
>(
  table: Table,
  lines: Readonly<Record<NoInfer<K>, string>>,
  key: K,
  fields: Readonly<Record<Table[K][number], FaceText | string>>,
): FaceText {
  return fillFaceText(lines[key], fields);
}

// The text with the marks for dog left out, as a line led by that owner's own face shows it.
export function withoutFace(dog: DogId | undefined, line: FaceText): FaceText {
  const marks = (line.marks ?? []).filter((mark) => mark.dog !== dog);
  return marks.length === 0 ? { text: line.text } : { marks, text: line.text };
}

// A row's parts, from the row's left in screen pixels: its runs of text, and each face's frame.
export interface FaceRow {
  readonly faces: readonly (OwnerFace & { readonly x: number })[];
  readonly texts: readonly { readonly text: string; readonly x: number }[];
  // From the row's left to the end of its last text, as width measures it.
  readonly width: number;
}

// A word: its text runs, each but the first led by a face.
type Word = readonly { readonly face?: OwnerFace; readonly text: string }[];

// The line's words, split at spaces outside its names: a name, spaces and all, stays in one
// word, its face leading it.
function words(line: FaceText): Word[] {
  const marks = line.marks ?? [];
  const named = (i: number) => marks.some((mark) => i >= mark.at && i < mark.at + mark.length);
  const all: { face?: OwnerFace; text: string }[][] = [];
  let word: { face?: OwnerFace; text: string }[] = [];
  [...line.text].forEach((char, i) => {
    const mark = marks.find((candidate) => candidate.at === i);
    if (/\s/.test(char) && !named(i)) {
      if (word.length > 0) {
        all.push(word);
      }
      word = [];
      return;
    }
    if (mark !== undefined) {
      word.push({ face: { dog: mark.dog, mood: mark.mood }, text: char });
    } else if (word.length === 0) {
      word.push({ text: char });
    } else {
      const last = word[word.length - 1] as { text: string };
      last.text += char;
    }
  });
  return word.length > 0 ? [...all, word] : all;
}

// The words on one row, a space apart, laid out from its left; with no box, names show alone.
function rowOf(
  width: (text: string) => number,
  box: FaceBox | undefined,
  row: readonly Word[],
): FaceRow {
  const faces: (OwnerFace & { x: number })[] = [];
  const texts: { text: string; x: number }[] = [];
  let start = 0;
  let run = "";
  row.forEach((word, i) => {
    if (i > 0) {
      run += " ";
    }
    for (const part of word) {
      if (part.face !== undefined && box !== undefined) {
        const x = start + (run === "" ? 0 : width(run));
        if (run !== "") {
          texts.push({ text: run, x: start });
        }
        faces.push({ ...part.face, x });
        start = x + box.framed + box.gap;
        run = "";
      }
      run += part.text;
    }
  });
  if (run !== "") {
    texts.push({ text: run, x: start });
  }
  return { faces, texts, width: start + (run === "" ? 0 : width(run)) };
}

// The line broken at spaces outside its names into rows no wider than room, as width measures
// a run of text, each face box.framed wide and box.gap from its name, or each name alone with
// no box. A word wider than room gets a row of its own.
export function faceRows(
  width: (text: string) => number,
  box: FaceBox | undefined,
  room: number,
  line: FaceText,
): FaceRow[] {
  const rows: Word[][] = [];
  let row: Word[] = [];
  for (const word of words(line)) {
    const next = [...row, word];
    if (row.length > 0 && rowOf(width, box, next).width > room) {
      rows.push(row);
      row = [word];
    } else {
      row = next;
    }
  }
  if (row.length > 0) {
    rows.push(row);
  }
  return rows.map((words) => rowOf(width, box, words));
}

// The line's rows in the first of styles that sets it on at most the style's lines, each row
// no wider than room as width measures it at the style; else the last style on one row. A
// style on one line keeps the line whole.
export function fittingFaceRows(
  styles: readonly TextFitStyle[],
  width: (style: TextFitStyle, text: string) => number,
  box: (style: TextFitStyle) => FaceBox | undefined,
  room: number,
  line: FaceText,
): { rows: FaceRow[]; style: TextFitStyle } {
  const setIn = (style: TextFitStyle) => {
    const most = style.lines ?? 1;
    const measure = (text: string) => width(style, text);
    return faceRows(measure, box(style), most === 1 ? Infinity : room, line);
  };
  for (const style of styles) {
    const rows = setIn(style);
    if (rows.length <= (style.lines ?? 1) && rows.every((row) => row.width <= room)) {
      return { rows, style };
    }
  }
  const last = styles.at(-1) as TextFitStyle;
  return { rows: setIn({ ...last, lines: 1 }), style: last };
}
