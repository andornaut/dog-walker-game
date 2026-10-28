"""The Distillery District's walk music: a swung, brushed small-band tune in F for cobblestones and brick
warehouses at sunset.

16 bars at about 108 BPM in a 32-bar-song shape cut to four-bar sections, A A' B A'': a phrase over
Fmaj7 D7 Gm7 C7, its answer cadencing on F6, a bridge through Bbmaj7 and the minor iv (Bbm6) back to
Gm7 C7, and the phrase again with a turnaround into the top. A muted square lead with a late vibrato, a
triangle walking bass in quarters, rootless seventh chords comped in the Charleston rhythm, and brushes:
a swish on 2 and 4, a soft sweep on 1 and 3, a quiet ride and a feathered kick.

Scores count in triplet eighths: 3 to the beat and 12 to the bar, so a swung eighth pair is 2 + 1.
"""

from sounds import RATE, mix, n, parse, tone, voice

# A third of a beat at about 108 BPM. 16 bars of 12 make 192 steps, and 192 x 8160 samples is
# exactly 1530 AAC frames of 1024, so the loop ends on a frame boundary.
STEP = 8160

LEAD = """
A4:2 C5:1 E5:3 D5:2 C5:4 | -:2 D5:1 C5:2 A4:4 F#4:3 | G4:2 Bb4:1 D5:3 F5:2 E5:1 D5:3 | E5:5 D5:1 Bb4:3 -:3
A4:2 C5:1 E5:3 D5:2 C5:4 | -:2 D5:1 F#5:2 A5:4 F#5:3 | G5:3 F5:2 D5:1 E5:2 C5:1 Bb4:3 | A4:2 C5:1 D5:2 F5:7
F5:6 D5:2 C5:1 D5:3 | Db5:6 C5:2 Bb4:1 G4:3 | E5:3 G5:2 E5:1 F#5:3 A5:3 | G5:5 F5:1 E5:2 D5:1 Bb4:3
A4:2 C5:1 E5:3 D5:2 C5:4 | -:2 D5:1 C5:2 A4:4 F#4:3 | G4:2 Bb4:1 D5:3 F5:2 E5:1 C5:3 | F4:6 -:5 G4:1
"""
# Quarter notes, with chromatic and scale steps into each next chord's root.
BASS = """
F2:3 A2:3 C3:3 E3:3 | D3:3 C3:3 A2:3 F#2:3 | G2:3 Bb2:3 D3:3 Db3:3 | C3:3 Bb2:3 G2:3 E2:3
F2:3 A2:3 C3:3 E3:3 | D3:3 C3:3 A2:3 F#2:3 | G2:3 Bb2:3 C3:3 E2:3 | F2:3 C3:3 D3:3 A2:3
Bb2:3 C3:3 D3:3 F3:3 | Bb2:3 F2:3 G2:3 Ab2:3 | A2:3 C3:3 D3:3 F#2:3 | G2:3 Bb2:3 C3:3 E2:3
F2:3 A2:3 C3:3 E3:3 | D3:3 C3:3 A2:3 F#2:3 | G2:3 Bb2:3 C3:3 E2:3 | F2:3 A2:3 G2:3 E2:3
"""
# Each bar's chord on beat 1, then the chord pushed onto the swung "and" of 2.
CHORDS = """
Fmaj7 Fmaj7 | D7 D7 | Gm7 Gm7 | C7 C7 | Fmaj7 Fmaj7 | D7 D7 | Gm7 C7 | F6 F6
Bbmaj7 Bbmaj7 | Bbm6 Bbm6 | Am7 D7 | Gm7 C7 | Fmaj7 Fmaj7 | D7 D7 | Gm7 C7 | F6 C7
"""
BARS = [bar.split() for bar in CHORDS.replace("\n", "|").split("|") if bar.strip()]
# Rootless four-note voicings between F3 and A4, each a step or two from the next.
VOICINGS = {
    "Am7": "G3 A3 C4 E4",
    "Bbm6": "G3 Bb3 Db4 F4",
    "Bbmaj7": "A3 C4 D4 F4",
    "C7": "E3 A3 Bb3 D4",
    "D7": "F#3 A3 C4 E4",
    "F6": "A3 C4 D4 G4",
    "Fmaj7": "A3 C4 E4 G4",
    "Gm7": "F3 A3 Bb3 D4",
}
# hz() reads sharps only, so the scores' flats are respelled.
FLATS = {"Ab": "G#", "Bb": "A#", "Db": "C#", "Eb": "D#", "Gb": "F#"}


def sharp(note):
    """The sharp spelling of a flat note name such as "Bb4"; others pass through."""
    return FLATS.get(note[:2], note[:2]) + note[2:]


def score(text):
    return [(sharp(note), steps) for note, steps in parse(text)]


def comp_score(k):
    """The kth note of each voicing in the Charleston rhythm: 3 steps on, 2 off, 4 on, 3 off."""
    notes = []
    for first, second in BARS:
        notes += [(sharp(VOICINGS[first].split()[k]), 3), ("-", 2), (sharp(VOICINGS[second].split()[k]), 4), ("-", 3)]
    return notes


def vibrato(length, delay=0.22, rate=5.5, cents=12):
    """sox bend effects that hold the pitch for delay seconds, then wave it cents either side at rate Hz
    until the note's last 30 ms; none for a note too short to reach a full cycle."""
    half = 1 / rate / 2
    end = length / RATE - 0.03
    if end < delay + 2.5 * half:
        return ()
    bends, at, sign = [f"{delay:.3f},{cents},{half / 2:.4f}"], delay + half / 2, -1
    while at + half <= end:
        bends.append(f"0,{sign * 2 * cents},{half:.4f}")
        at, sign = at + half, -sign
    return ("bend", "-f", "80", *bends)


def lead(path, length, note):
    """A muted, clarinet-like square: odd harmonics only, darkened twice, with a breathy rise."""
    tone(path, length, "square", note, vol=0.5, low=1700, attack=0.03, release=0.4 if length <= 2 * STEP else 0.3,
         shape="q", fx=("lowpass", "2400", *vibrato(length)))


def bass(path, length, note):
    tone(path, length, "triangle", note, vol=0.9, attack=0.006, release=0.55)


def bass_edge(path, length, note):
    """A low square under the triangle, so the walking line carries on small speakers."""
    tone(path, length, "square", note, vol=0.2, low=420, attack=0.006, release=0.55)


def comp(k):
    """The kth voice of the comp: a soft mallet, a triangle that rings down, rolled upward 20 ms a voice."""
    roll = k * n(0.02)
    return lambda path, length, note: tone(path, length - roll, "triangle", note, vol=0.5, attack=0.02,
                                           release=0.85, start=roll)


# A second low-pass for the noise voices, so their hiss falls away steeply above 4 kHz.
DARK = ("lowpass", "3600")


def drum(path, length, kind):
    """One brush or cymbal hit, with silence to the end of its slot."""
    kinds = {
        # A swish across the snare head on 2 and 4.
        "swish": (0.24, dict(vol=0.9, low=3000, high=500, attack=0.035, release=0.75, shape="h", fx=DARK)),
        # A soft circular sweep on 1 and 3.
        "sweep": (0.5, dict(vol=0.45, low=1600, high=250, attack=0.22, release=0.55, shape="h")),
        # The ride's beat and its quieter swung skip note.
        "ride": (0.18, dict(vol=0.5, low=3600, high=1800, attack=0.002, release=0.9, fx=DARK)),
        "skip": (0.12, dict(vol=0.3, low=3600, high=1800, attack=0.002, release=0.9, fx=DARK)),
    }
    if kind == "kick":
        tone(path, n(0.14), "triangle", (110, 48), vol=0.8, attack=0.004, release=0.9, tail=length - n(0.14))
        return
    seconds, opts = kinds[kind]
    tone(path, n(seconds), "pinknoise", None, tail=length - n(seconds), **opts)


def music(tmp, out):
    bars = len(BARS)
    layers = [
        (voice(tmp, "dd-lead", score(LEAD), lead, step=STEP), 0.6),
        (voice(tmp, "dd-bass", score(BASS), bass, step=STEP), 0.45),
        (voice(tmp, "dd-bass-edge", score(BASS), bass_edge, step=STEP), 0.6),
        *((voice(tmp, f"dd-comp{k}", comp_score(k), comp(k), step=STEP), 0.34) for k in range(4)),
        (voice(tmp, "dd-brush", [(v, 3) for _ in range(bars) for v in ("sweep", "swish", "sweep", "swish")],
               drum, step=STEP), 1.65),
        (voice(tmp, "dd-ride", [(v, s) for _ in range(bars) for v, s in
                                (("ride", 3), ("ride", 2), ("skip", 1), ("ride", 3), ("ride", 2), ("skip", 1))],
               drum, step=STEP), 5),
        (voice(tmp, "dd-kick", [(v, 3) for _ in range(bars) for v in ("kick", "-", "kick", "-")],
               drum, step=STEP), 0.5),
    ]
    mix(layers, out)
