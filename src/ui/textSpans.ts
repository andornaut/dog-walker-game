// A run of a text drawn in its own colour: text[at, at + length).
export interface ColourSpan {
  readonly at: number;
  readonly colour: number;
  readonly length: number;
}

const SPACE = /\s/;

// The colour each character of each shown text takes from spans set on source, or undefined
// for the text's own colour, indexed by UTF-16 unit as Phaser indexes a label's text. The shown
// texts are source as drawn, in order: wrapped onto lines or split into runs, which changes only
// its spaces. Spans follow source's other characters, so wrapping never moves them; a space
// takes no colour, as it draws no ink.
export function shownSpanColours(
  source: string,
  spans: readonly ColourSpan[],
  shown: readonly string[],
): (number | undefined)[][] {
  const inked: (number | undefined)[] = [];
  source.split("").forEach((char, at) => {
    if (!SPACE.test(char)) {
      inked.push(spans.find((span) => at >= span.at && at < span.at + span.length)?.colour);
    }
  });
  let next = 0;
  return shown.map((text) =>
    text.split("").map((char) => (SPACE.test(char) ? undefined : inked[next++])),
  );
}
