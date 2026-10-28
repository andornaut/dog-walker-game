"""Yonge Street's walk music: 16 bars of driving chiptune house at about 132 BPM in D dorian.

A hook over Dm G C Am, the hook again climbing higher, a bridge over F C G A, then the hook
with a turnaround on A that leads back to the top. Four-on-the-floor kick, a noise snare on
2 and 4, a pulsing octave bass in eighths, offbeat chord stabs, and a pulse lead with a
dotted-eighth echo that wraps around the loop so its tail lands on the start.
"""

from sounds import concat, mix, n, parse, sox, tone, voice

# One sixteenth at about 132 BPM. 256 sixteenths of 5012 samples fill 1253 whole 1024-sample AAC frames.
STEP = 5012
BARS = 16

LEAD = """
D5:2 F5:2 A5:3 G5:3 F5:2 A5:4 | B5:3 A5:3 G5:2 D5:4 -:4 | E5:2 G5:2 C6:3 B5:3 G5:2 C6:4 | A5:3 G5:3 E5:2 A5:4 -:4
D5:2 F5:2 A5:3 G5:3 F5:2 A5:4 | B5:3 A5:3 G5:2 B5:2 D6:6 | E6:3 D6:3 C6:2 G5:2 C6:2 E6:4 | D6:3 C6:3 A5:2 E5:2 G5:2 A5:4
A5:4 C6:4 A5:2 G5:2 F5:4 | G5:4 E5:2 G5:2 C6:6 -:2 | B5:4 D6:4 B5:2 A5:2 G5:4 | A5:3 C#6:3 E6:2 C#6:2 A5:2 E5:4
D5:2 F5:2 A5:3 G5:3 F5:2 A5:4 | B5:3 A5:3 G5:2 D5:4 -:4 | E5:2 G5:2 C6:3 D6:3 E6:2 C6:4 | E6:3 D6:3 C#6:2 A5:3 E5:3 C#5:2
"""
# Eighths: the root jumping octaves, then two notes that walk into the next bar's root.
BASS = """
D2 D3 D2 D3 D2 D3 C3 A2 | G2 G3 G2 G3 G2 G3 D3 B1 | C2 C3 C2 C3 C2 C3 G2 B2 | A2 A3 A2 A3 A2 A3 G2 E2
D2 D3 D2 D3 D2 D3 C3 A2 | G2 G3 G2 G3 G2 G3 D3 B1 | C2 C3 C2 C3 C2 C3 G2 B2 | A2 A3 A2 A3 A2 A3 G2 E2
F2 F3 F2 F3 F2 F3 A2 B1 | C2 C3 C2 C3 C2 C3 E2 F#2 | G2 G3 G2 G3 G2 G3 D3 B2 | A2 A3 A2 A3 A2 A3 E2 C#2
D2 D3 D2 D3 D2 D3 C3 A2 | G2 G3 G2 G3 G2 G3 D3 B1 | C2 C3 C2 C3 C2 C3 G2 B2 | A2 A3 A2 A3 A2 G2 E2 C#2
"""
CHORDS = "Dm G C Am Dm G C Am F C G A Dm G C A"
STABS = {
    "Dm": "F4 A4 C5", "G": "D4 G4 B4", "C": "E4 G4 C5", "Am": "E4 A4 C5", "F": "F4 A4 C5", "A": "E4 A4 C#5",
}
ECHO = 3  # sixteenths: a dotted eighth
STRUM = 0.006  # seconds between a stab's notes, low to high


def bass_score():
    return [(note, 2) for note in BASS.split() if note != "|"]


def stab_score(index):
    """One note of each chord on the four offbeat eighths of its bar."""
    notes = []
    for chord in CHORDS.split():
        notes += [("-", 2), (STABS[chord].split()[index], 2)] * 4
    return notes


def stab(index):
    """A short pulse stab, each higher note a little later so the chord strums."""
    def play(path, length, note):
        offset = n(STRUM * index)
        tone(path, length - offset, "square", note, vol=0.5, duty=25, low=1800, attack=0.003, release=0.85,
             start=offset)
    return play


def kick_score():
    return [("kick", 4)] * (BARS * 4)


def snare_score():
    """Snare on 2 and 4, with a four-sixteenth roll closing bars 8 and 16."""
    bar = [("-", 4), ("snare", 4), ("-", 4), ("snare", 4)]
    roll = [("-", 4), ("snare", 4), ("-", 4), *[("snare", 1)] * 4]
    return [x for i in range(BARS) for x in (roll if i % 8 == 7 else bar)]


def kick(path, length, _):
    tone(path, n(0.11), "triangle", (165, 45), attack=0.002, release=0.9, tail=length - n(0.11))


def snare(path, length, _):
    """A burst of band-passed noise over a short falling triangle body."""
    size = min(n(0.09), length)
    body, hiss = f"{path}-body.wav", f"{path}-hiss.wav"
    tone(body, size, "triangle", (230, 150), attack=0.002, release=0.9)
    tone(hiss, size, "pinknoise", None, low=3000, high=450, attack=0.002, release=0.85)
    sox("-m", "-v", "0.45", body, "-v", "0.9", hiss, "-e", "floating-point", "-b", "32", path,
        "pad", "0", f"{length - size}s")


def rotate(tmp, name, path, samples):
    """Move the last samples of a loop to its start, so a delayed copy wraps around the seam."""
    total = BARS * 16 * STEP
    head, tail = f"{tmp}/{name}-head.wav", f"{tmp}/{name}-tail.wav"
    sox(path, tail, "trim", f"{total - samples}s")
    sox(path, head, "trim", "0", f"{total - samples}s")
    out = f"{tmp}/{name}.wav"
    concat([tail, head], out)
    return out


def music(tmp, out):
    lead = voice(tmp, "ys-lead", parse(LEAD), lambda p, length, note: tone(
        p, length, "square", note, vol=0.5, duty=30, low=2500, attack=0.006, release=0.5), step=STEP)
    body = voice(tmp, "ys-body", parse(LEAD), lambda p, length, note: tone(
        p, length, "triangle", note, vol=0.5, attack=0.006, release=0.5), step=STEP)
    echo = rotate(tmp, "ys-echo", voice(tmp, "ys-echo-dry", parse(LEAD), lambda p, length, note: tone(
        p, length, "square", note, vol=0.5, duty=30, low=1600, attack=0.01, release=0.7), step=STEP), ECHO * STEP)
    bass = voice(tmp, "ys-bass", bass_score(), lambda p, length, note: tone(
        p, length, "square", note, vol=0.8, low=800, attack=0.004, release=0.4), step=STEP)
    stabs = [voice(tmp, f"ys-stab{i}", stab_score(i), stab(i), step=STEP) for i in range(3)]
    kicks = voice(tmp, "ys-kick", kick_score(), kick, step=STEP)
    snares = voice(tmp, "ys-snare", snare_score(), snare, step=STEP)
    mix([(lead, 1.1), (body, 0.45), (echo, 0.35), (bass, 0.5), *[(s, 0.4) for s in stabs], (kicks, 0.5),
         (snares, 0.8)], out)
