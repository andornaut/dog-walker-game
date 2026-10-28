"""High Park's walk music: a lilting 6/8 pastoral in F major for a leafy park with oaks and a pond.

24 bars at about 94 dotted-quarter beats a minute. A breathy triangle flute sings the tune (A), a
narrow-pulse oboe takes a contrasting phrase (B), and the flute returns over an oboe counter-line (A'),
closing on C so the loop turns back to the top. Under them a triangle harp rolls open and sus voicings in
eighths, an open-fifth pad holds the chord, a gentle triangle bass moves on the dotted quarters, and a soft
wooden tick keeps time. A few short birdsong trills and calls fill the held notes.

Notes are "name:sixteenths"; "-" is a rest, "Bb" spells a flat, and "G5>A5" plays a quick G5 grace into A5.
"""

import subprocess

from sounds import concat, mix, n, parse, rest, tone, voice

# One sixteenth in samples: 12 to the 6/8 bar, so a dotted quarter lasts 6 x 4704 samples, about 94 BPM.
# 4704 is a multiple of 32, so the 288 sixteenths of the loop fill whole 1024-sample AAC frames.
STEP = 4704
BARS = 24

FLUTE = """
F5:4 A5:2 C6:6 | Bb5:4 A5:2 G5:6 | G5>A5:4 F5:2 D5:4 F5:2 | F5:4 G5:2 E5:6
F5:4 A5:2 C6:4 D6:2 | G6>F6:4 D6:2 Bb5:6 | D6:4 C6:2 Bb5:2 A5:2 G5:2 | F5:8 -:4
-:12 | -:12 | -:12 | -:12
-:12 | -:12 | -:12 | -:12
F5:4 A5:2 C6:6 | Bb5:4 A5:2 G5:6 | G5>A5:4 F5:2 D5:4 F5:2 | F5:4 G5:2 E5:6
F5:4 A5:2 C6:4 D6:2 | G6>F6:4 D6:2 Bb5:6 | D6:4 C6:2 Bb5:2 A5:2 G5:2 | G5:4 F5:2 E5:4 C5:2
"""
OBOE = """
-:12 | -:12 | -:12 | -:12
-:12 | -:12 | -:12 | -:12
D5:6 C5:4 D5:2 | E5:6 G5:6 | G5:4 E5:2 C5:4 E5:2 | F5:4 E5:2 D5:6
Bb4:4 D5:2 F5:4 G5:2 | A5:4 B5:2 D6:6 | C6:4 Bb5:2 A5:4 G5:2 | F5:6 E5:6
-:12 | -:12 | -:12 | -:12
-:12 | -:12 | -:12 | -:12
"""
# The oboe's counter-line under the returning tune, quieter than its own phrase.
COUNTER = """
-:12 | -:12 | -:12 | -:12
-:12 | -:12 | -:12 | -:12
-:12 | -:12 | -:12 | -:12
-:12 | -:12 | -:12 | -:12
C5:12 | C5:6 Bb4:6 | A4:12 | G4:12
A4:12 | Bb4:6 D5:6 | Bb4:6 C5:6 | Bb4:6 G4:4 -:2
"""
BASS = """
F2:6 C3:6 | E2:6 G2:6 | D2:6 A2:6 | C3:6 G2:4 E2:2
F2:6 A2:6 | Bb2:6 F2:6 | G2:6 C3:6 | F2:6 C3:4 A2:2
Bb2:6 D3:6 | C3:6 G2:6 | A2:6 E2:6 | D2:6 F2:4 A2:2
G2:6 D3:6 | G2:6 B2:6 | Bb2:6 C3:6 | C3:6 G2:4 E2:2
F2:6 C3:6 | E2:6 G2:6 | D2:6 A2:6 | C3:6 G2:4 E2:2
F2:6 A2:6 | Bb2:6 F2:6 | G2:6 C3:6 | C3:6 G2:4 E2:2
"""
CHORDS = """
F:12 | C:12 | Dm:12 | Csus4:6 C:6 | F:12 | Bb:12 | Gm7:6 C:6 | F:12
Bb:12 | C:12 | Am:12 | Dm:12 | Gm7:12 | G:12 | Bb:6 C:6 | Csus4:6 C:6
F:12 | C:12 | Dm:12 | Csus4:6 C:6 | F:12 | Bb:12 | Gm7:6 C:6 | Csus4:6 C:6
"""
# Each chord's open voicing, low to high: root, fifth (the fourth in Csus4), then octave or seventh, then ninth.
VOICINGS = {
    "Am": "A3 E4 A4 B4",
    "Bb": "Bb3 F4 Bb4 C5",
    "C": "C4 G4 C5 D5",
    "Csus4": "C4 F4 G4 C5",
    "Dm": "D3 A3 D4 E4",
    "F": "F3 C4 F4 G4",
    "G": "G3 D4 G4 A4",
    "Gm7": "G3 D4 F4 A4",
}
# Birdsong, as (sixteenth it starts on, call, sixteenths): over the held notes at phrase ends.
BIRDS = [
    (42, "trill:D6:E6", 4),
    (89, "call:A6:E6", 6),
    (139, "chirp:G6", 4),
    (186, "call:G6:D6", 6),
    (234, "trill:C6:D6", 4),
]
# A soft thump on the downbeat, the wooden tick on the second dotted quarter, and a quieter tick before the bar.
DRUMS = [("thump", 6), ("tick", 4), ("ghost", 2)]


def score(text):
    """parse() with "Bb" spelled as the A# that hz() reads."""
    return [(note.replace("Bb", "A#"), steps) for note, steps in parse(text)]


def sox_mix(layers, out):
    """Sum (path, volume) layers of equal length into out, without normalizing."""
    inputs = [a for path, vol in layers for a in ("-v", f"{vol:.4f}", path)]
    subprocess.run(["sox", "-R", "-D", "-m", *inputs, "-e", "floating-point", "-b", "32", out], check=True)


def flute(path, length, note):
    """A breathy triangle: soft attack, a breath vibrato, and a puff of filtered noise at the onset."""
    if ">" in note:
        grace, note = note.split(">")
        glen = n(0.055)
        tone(f"{path}-g.wav", glen, "triangle", grace, low=3500, attack=0.006, release=0.5, shape="h")
        flute(f"{path}-m.wav", length - glen, note)
        concat([f"{path}-g.wav", f"{path}-m.wav"], path)
        return
    tone(f"{path}-t.wav", length, "triangle", note, low=3500, attack=0.035, release=0.45, shape="h",
         fx=("tremolo", "5.2", "14"))
    tone(f"{path}-n.wav", length, "pinknoise", None, low=3200, high=1400, attack=0.01, release=0.9, shape="h")
    sox_mix([(f"{path}-t.wav", 1), (f"{path}-n.wav", 0.18)], path)


def oboe(path, length, note):
    """A reedy narrow pulse, filtered soft, with a slow swell and a light vibrato."""
    tone(path, length, "square", note, duty=18, low=1900, high=200, attack=0.04, release=0.4, shape="h",
         fx=("tremolo", "4.8", "12"))


def bass(path, length, note):
    tone(path, length, "triangle", note, attack=0.012, release=0.55, shape="h")


def harp(path, length, note):
    """A plucked triangle that rings down within its eighth."""
    tone(path, length, "triangle", note, low=2500, attack=0.004, release=0.92, shape="q")


def pad(path, length, chord):
    """The chord's open fifth, held with a slow swell."""
    root, fifth = VOICINGS[chord].replace("Bb", "A#").split()[:2]
    tone(f"{path}-r.wav", length, "triangle", root, attack=0.18, release=0.5, shape="h")
    tone(f"{path}-f.wav", length, "square", fifth, duty=30, low=900, attack=0.22, release=0.5, shape="h")
    sox_mix([(f"{path}-r.wav", 1), (f"{path}-f.wav", 0.35)], path)


def harp_score():
    """Roll each chord in eighths: up and back over a whole bar, up over a half bar."""
    notes = []
    for chord, steps in parse(CHORDS):
        v = VOICINGS[chord].replace("Bb", "A#").split()
        order = (0, 1, 2, 3, 2, 1) if steps == 12 else (0, 1, 3)
        notes += [(v[i], 2) for i in order]
    return notes


def bird(path, length, call):
    """A short birdsong figure, quiet and filtered below 4 kHz, filling length samples."""
    kind, *notes = call.split(":")
    parts = []  # (start seconds, seconds, freq, volume)
    if kind == "trill":
        a, b = notes
        parts = [(i * 0.052, 0.05, (a, b)[i % 2], 1 - i * 0.07) for i in range(8)]
    elif kind == "call":
        hi, lo = notes
        parts = [(0, 0.09, (lo, hi), 1), (0.13, 0.26, (hi, lo), 0.85)]
    elif kind == "chirp":
        (hi,) = notes
        parts = [(i * 0.11, 0.07, (f"{hi[0]}{int(hi[-1]) - 1}", hi), 1 - i * 0.15) for i in range(3)]
    layers = []
    for i, (start, seconds, freq, vol) in enumerate(parts):
        p = f"{path}-{i}.wav"
        tone(p, n(seconds), "triangle", freq, vol=vol, low=4000, attack=0.006, release=0.6, start=n(start),
             tail=length - n(start) - n(seconds))
        layers.append((p, 1))
    sox_mix(layers, path)


def bird_score():
    notes, at = [], 0
    for start, call, steps in BIRDS:
        notes += [("-", start - at), (call, steps)]
        at = start + steps
    return notes + [("-", BARS * 12 - at)]


def drum(path, length, kind):
    if kind == "thump":
        tone(path, n(0.1), "triangle", (130, 55), vol=0.8, attack=0.003, release=0.9, tail=length - n(0.1))
    else:
        # A hollow wooden knock: a falling mid triangle and a short band of noise.
        vol = 1 if kind == "tick" else 0.55
        tone(f"{path}-k.wav", n(0.035), "triangle", (1150, 900), vol=vol, low=3000, attack=0.002, release=0.9,
             shape="q", tail=length - n(0.035))
        tone(f"{path}-n.wav", n(0.02), "pinknoise", None, vol=vol * 0.5, low=3000, high=1200, attack=0.002,
             release=0.9, tail=length - n(0.02))
        sox_mix([(f"{path}-k.wav", 1), (f"{path}-n.wav", 1)], path)


def music(tmp, out):
    # Volumes keep the sum below full scale, so sox never clips it before mix() normalizes the peak.
    layers = [
        (voice(tmp, "hp-flute", score(FLUTE), flute, step=STEP), 0.6),
        (voice(tmp, "hp-oboe", score(OBOE), oboe, step=STEP), 0.75),
        (voice(tmp, "hp-counter", score(COUNTER), oboe, step=STEP), 0.27),
        (voice(tmp, "hp-bass", score(BASS), bass, step=STEP), 0.42),
        (voice(tmp, "hp-harp", harp_score(), harp, step=STEP), 0.21),
        (voice(tmp, "hp-pad", parse(CHORDS), pad, step=STEP), 0.11),
        (voice(tmp, "hp-birds", bird_score(), bird, step=STEP), 0.18),
        (voice(tmp, "hp-drums", DRUMS * BARS, drum, step=STEP), 0.18),
    ]
    mix(layers, out)
