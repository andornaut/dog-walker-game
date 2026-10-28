"""The Beaches walk music: a breezy calypso on the boardwalk in F major at 110 BPM.

16 bars: a hook phrase over F Dm Bb C, the same hook answered and resolved, a bridge that steps down over
Bb Am Gm C, and the hook again with a climb to F6 and a turnaround that leads back to the top. A steel
pan lead (a triangle struck with a quick attack and a long fall, a softened triangle octave that fades
first, and a short pulse ping for the stick), a bouncing triangle bass on the calypso dotted rhythm, plucked
pulse chords on the offbeat eighths, a soft kick, hand drum taps and a band-limited shaker on the eighths.
"""

from sounds import hz, mix, n, parse, tone, voice

# One sixteenth at about 110 BPM. 6012 is a multiple of 4, so the 256 sixteenths of the loop fill whole
# 1024-sample AAC frames.
STEP = 6012

# Notes are "name:sixteenths"; "-" is a rest. A# is B flat. Four bars to a phrase.
LEAD = """
A5:3 C6:3 A5:2 F5:2 G5:2 A5:4 | F5:3 A5:3 F5:2 D5:4 -:2 C5:2 |
D5:3 F5:3 A#5:2 A5:2 G5:2 F5:4 | E5:3 G5:3 C6:4 -:2 G5:2 A#5:2
A5:3 C6:3 A5:2 F5:2 G5:2 A5:4 | D6:3 C6:3 A5:2 F5:4 -:2 D5:2 |
D5:2 F5:2 A#5:4 C6:2 A#5:2 G5:4 | A5:6 G5:2 F5:4 -:4
D6:6 C6:2 A#5:4 F5:4 | C6:6 A#5:2 A5:4 E5:4 |
A#5:3 A5:3 G5:2 D5:2 F5:2 A#5:4 | C6:3 A#5:3 G5:2 E5:4 -:2 G5:2
A5:3 C6:3 A5:2 F5:2 G5:2 A5:4 | F5:3 A5:3 F5:2 D5:4 -:2 C5:2 |
D5:2 F5:2 A#5:4 C6:2 D6:2 E6:4 | F6:6 C6:2 E5:2 G5:2 -:2 G5:2
"""
BASS = """
F2:6 C3:2 F3:4 C3:4 | D3:6 A2:2 D3:4 A2:4 | A#2:6 F2:2 A#2:4 D3:4 | C3:6 G2:2 C3:4 E3:4
F2:6 C3:2 F3:4 C3:4 | D3:6 A2:2 D3:4 F3:4 | A#2:4 D3:4 C3:4 E3:4 | F2:6 C3:2 F3:4 A2:4
A#2:6 F2:2 A#2:4 D3:4 | A2:6 E3:2 A2:4 C3:4 | G2:6 D3:2 G2:4 A#2:4 | C3:6 G2:2 C3:4 E3:4
F2:6 C3:2 F3:4 C3:4 | D3:6 A2:2 D3:4 A2:4 | A#2:4 F2:4 C3:4 G2:4 | F2:4 A2:4 C3:4 E2:4
"""
# One chord per bar, or two joined by "+" for a half bar each.
CHORDS = "F Dm Bb C F Dm Bb+C F Bb Am Gm C7 F Dm Bb+C F+C7"
VOICINGS = {
    "Am": "A3 C4 E4", "Bb": "A#3 D4 F4", "C": "G3 C4 E4", "C7": "A#3 C4 E4", "Dm": "A3 D4 F4", "F": "A3 C4 F4",
    "Gm": "G3 A#3 D4",
}


def chord_score(part):
    """One voice of the offbeat stabs: chord tone part (0 is the lowest) on each offbeat eighth."""
    notes = []
    for bar in CHORDS.split():
        halves = bar.split("+")
        for beat in range(4):
            chord = halves[beat * len(halves) // 4]
            notes += [("-", 2), (VOICINGS[chord].split()[part], 2)]
    return notes


def drum_score():
    """Kick on 1 and 3, a high hand drum on the "and" of 2 and 4, a low one just before beat 4."""
    bar = [("kick", 6), ("hi", 2), ("kick", 3), ("lo", 3), ("hi", 2)]
    return bar * 16


def shaker_score():
    """A shake on every eighth, leaning on the offbeats."""
    return [(accent, 2) for _ in range(16 * 4) for accent in ("soft", "loud")]


def lead_body(path, length, note):
    """The pan's body: a struck triangle that fades through the note, rolled on the long notes."""
    roll = ("tremolo", "11", "35") if length >= 6 * STEP else ()
    tone(path, length, "triangle", note, vol=0.9, attack=0.003, release=0.97, shape="q", fx=roll)


def lead_octave(path, length, note):
    """The bright overtone: a triangle an octave up, low-passed near its fundamental, that fades before the body
    does."""
    ring = min(length, n(0.22))
    tone(path, ring, "triangle", 2 * hz(note), vol=0.35, low=3000, attack=0.008, release=0.9, shape="t",
         tail=length - ring)


def lead_ping(path, length, note):
    """The stick: a short, soft pulse at the note's pitch."""
    ring = min(length, n(0.05))
    tone(path, ring, "square", note, vol=0.15, duty=25, low=3000, attack=0.001, release=0.9, tail=length - ring)


def bass(path, length, note):
    """A bouncing triangle that lets go before the next note."""
    tone(path, length, "triangle", note, vol=0.9, attack=0.006, release=0.5, shape="q")


def stab(part):
    """A plucked chord tone that rings for about a sixteenth, each higher tone a little later, like a strum."""
    delay = part * n(0.012)

    def play(path, length, note):
        ring = min(length - delay, n(0.16))
        tone(path, ring, "square", note, vol=0.5, duty=30, low=1500, attack=0.008, release=0.8, start=delay,
             tail=length - ring - delay)

    return play


def drum(path, length, kind):
    if kind == "kick":
        ring = n(0.11)
        tone(path, ring, "triangle", (130, 45), vol=0.4, attack=0.002, release=0.9, tail=length - ring)
    else:
        ring = n(0.09)
        freq = (420, 330) if kind == "hi" else (300, 230)
        tone(path, ring, "triangle", freq, vol=0.35, attack=0.002, release=0.9, tail=length - ring)


def shake(path, length, accent):
    ring = n(0.06)
    tone(path, ring, "pinknoise", None, vol=1 if accent == "loud" else 0.5, high=2200, low=4200, attack=0.015,
         release=0.7, shape="h", tail=length - ring)


def music(tmp, out):
    layers = [
        (voice(tmp, "pan", parse(LEAD), lead_body, step=STEP), 0.6),
        (voice(tmp, "pan-octave", parse(LEAD), lead_octave, step=STEP), 0.8),
        (voice(tmp, "pan-ping", parse(LEAD), lead_ping, step=STEP), 0.5),
        (voice(tmp, "bass", parse(BASS), bass, step=STEP), 0.6),
        *((voice(tmp, f"chord{part}", chord_score(part), stab(part), step=STEP), 0.3) for part in range(3)),
        (voice(tmp, "drums", drum_score(), drum, step=STEP), 0.5),
        (voice(tmp, "shaker", shaker_score(), shake, step=STEP), 0.7),
    ]
    mix(layers, out)
