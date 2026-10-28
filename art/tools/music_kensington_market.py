"""Kensington Market's walk music: a Pedestrian Sunday hand-drum groove at about 112 BPM in D mixolydian.

16 bars: a phrase over D C G D, its answer over D C G C, a bridge over Am D Am C with the A dorian colour of the
same notes, then the phrase again, closing on G C so the loop falls back onto D. A reedy accordion of two
detuned squares calls and a triangle marimba answers, bar by bar in the phrases and half bar by half bar in the
bridge, and they play the closing riff together. Under them: a bouncy tresillo bass with offbeat octaves, offbeat
chord stabs, low conga and high bongo hits with a slap's skin noise, a soft shaker on the eighths and a light
kick.
"""

from sounds import PEAK_DB, RATE, hz, mix, n, parse, sox, tone, voice

# One sixteenth at about 112 BPM. 5908 is a multiple of 4, so the 256 sixteenths of the loop fill whole
# 1024-sample AAC frames.
STEP = 5908
SQUEEZE_DB = -14  # the compressor's threshold, with the summed layers peaking at PEAK_DB
LOOKAHEAD = 132  # samples

# Notes are "name:sixteenths"; "-" is a rest. One bar per group between bars.
ACCORDION = """
A5:3 F#5:3 A5:2 C6:2 B5:1 A5:2 F#5:1 -:2 | -:16 | B5:3 G5:3 B5:2 D6:2 C6:1 B5:2 G5:1 -:2 | -:16
A5:3 F#5:3 A5:2 C6:2 B5:1 A5:2 F#5:1 -:2 | -:16 | D6:3 B5:3 D6:2 E6:2 D6:1 B5:2 A5:1 -:2 | -:16
-:8 C6:2 A5:1 F#5:2 E5:1 -:2 | -:8 A5:2 F#5:1 E5:2 D5:1 -:2 | -:8 E6:2 C6:1 A5:2 G5:1 -:2
G5:3 E5:3 G5:2 A5:1 B5:1 C6:2 B5:1 G5:1 -:2
A5:3 F#5:3 A5:2 C6:2 B5:1 A5:2 F#5:1 -:2 | -:16 | B5:3 G5:3 B5:2 D6:2 C6:1 B5:2 G5:1 -:2
B5:2 A5:1 G5:2 A5:1 B5:2 C6:2 B5:1 G5:1 E5:2 G5:2
"""
MARIMBA = """
-:16 | -:2 G4:1 C5:2 D5:1 E5:2 G5:2 E5:1 D5:1 C5:2 -:2 | -:16 | -:2 A4:1 D5:2 E5:1 F#5:2 A5:2 F#5:1 E5:1 D5:2 -:2
-:16 | -:2 G4:1 C5:2 D5:1 E5:2 G5:2 A5:1 G5:1 E5:2 -:2 | -:16 | -:2 G4:1 C5:2 E5:1 G5:2 E5:2 D5:1 C5:1 B4:2 -:2
A4:1 C5:1 E5:2 F#5:1 E5:2 -:1 -:8 | F#4:1 A4:1 D5:2 E5:1 F#5:2 -:1 -:8 | A4:1 C5:1 E5:2 G5:1 E5:2 -:1 -:8
-:8 E4:1 G4:1 C5:2 D5:2 -:2
-:16 | -:2 G4:1 C5:2 D5:1 E5:2 G5:2 E5:1 D5:1 C5:2 -:2 | -:16
B4:2 A4:1 G4:2 A4:1 B4:2 C5:2 B4:1 G4:1 E4:2 G4:2
"""
# Tresillo roots, offbeat octaves, then the fifth and a step into the next bar's root.
BASS = """
D3:3 D3:2 -:1 D4:2 -:2 D4:2 A3:2 B2:2 | C3:3 C3:2 -:1 C4:2 -:2 C4:2 G3:2 A2:2
G2:3 G2:2 -:1 G3:2 -:2 G3:2 D3:2 C3:2 | D3:3 D3:2 -:1 D4:2 -:2 D4:2 A3:2 F#3:2
D3:3 D3:2 -:1 D4:2 -:2 D4:2 A3:2 B2:2 | C3:3 C3:2 -:1 C4:2 -:2 C4:2 G3:2 A2:2
G2:3 G2:2 -:1 G3:2 -:2 G3:2 D3:2 B2:2 | C3:3 C3:2 -:1 C4:2 -:2 C4:2 G3:2 B2:2
A2:3 A2:2 -:1 A3:2 -:2 G3:2 F#3:2 E3:2 | D3:3 D3:2 -:1 D4:2 -:2 C4:2 A3:2 B2:2
A2:3 A2:2 -:1 A3:2 -:2 G3:2 E3:2 B2:2 | C3:3 C3:2 -:1 C4:2 -:2 C4:2 G3:2 E3:2
D3:3 D3:2 -:1 D4:2 -:2 D4:2 A3:2 B2:2 | C3:3 C3:2 -:1 C4:2 -:2 C4:2 G3:2 A2:2
G2:3 G2:2 -:1 G3:2 -:2 G3:2 D3:2 A2:2 | G2:3 G2:2 -:1 G3:2 C3:2 C4:2 G3:2 E3:2
"""
# One chord per half bar, stabbed on its two offbeat eighths.
CHORDS = "D D C C G G D D D D C C G G C C Am Am D7 D7 Am Am C C D D C C G G G C"
VOICINGS = {"Am": "E4 A4 C5", "C": "E4 G4 C5", "D": "F#4 A4 D5", "D7": "F#4 A4 C5", "G": "D4 G4 B4"}

# Hand drums, one character per sixteenth: L open low conga, H high bongo, S slap. The fourth bar of each phrase
# ends in a bongo run.
GROOVE = "...HS.L...HLS.LL"
FILL = "...HS.L.L.HLHHLL"
KICK = "k.......k......."
SHAKER = "m.a.m.a.m.a.m.a."  # eighths, accented on the offbeats

CONGA = {  # kind: (from Hz, to Hz, seconds, volume)
    "L": (262, 220, 0.2, 0.9),
    "H": (680, 587, 0.12, 0.6),
    "S": (700, 587, 0.06, 0.7),
}
SKIN = {"L": (0.012, 0.2), "H": (0.01, 0.2), "S": (0.035, 0.7)}
SHAKE = {"a": 0.5, "m": 0.3}


def hits(bars):
    """A drum pattern as (kind, sixteenths): each hit lasts until the next."""
    score = []
    for c in "".join(bars):
        if c != "." or not score:
            score.append([c if c != "." else "-", 1])
        else:
            score[-1][1] += 1
    return [tuple(hit) for hit in score]


def capped(seconds, play):
    """Sound play(path, samples) for at most seconds, then silence to fill the slot."""
    def render(path, length, note):
        sound = min(length, n(seconds))
        play(path, sound, note, length - sound)
    return render


def comp_score(i):
    """The ith note of each chord's voicing, on the offbeat eighths of its half bar."""
    score = []
    for chord in CHORDS.split():
        note = VOICINGS[chord].split()[i]
        score += [("-", 2), (note, 2), ("-", 2), (note, 2)]
    return score


def reed(cents):
    """One accordion reed, cents sharp. A sharp reed starts half a cycle late, so the pair begins out of
    phase instead of doubling the onset's peak."""
    def play(path, length, note):
        freq = hz(note) * 2 ** (cents / 1200)
        late = round(RATE / freq / 2) if cents else 0
        tone(path, length - late, "square", freq, vol=0.5, duty=35, low=2200, attack=0.02, release=0.3,
             shape="h", start=late)
    return play


def music(tmp, out):
    def v(name, score, play):
        return voice(tmp, name, score, play, step=STEP)

    phrase = [GROOVE, GROOVE, GROOVE, FILL]
    drums = hits(phrase * 4)

    reeds = [v(f"km-reed{i}", parse(ACCORDION), reed(cents)) for i, cents in enumerate((0, 6))]
    marimba = v("km-marimba", parse(MARIMBA), capped(0.32, lambda p, s, note, tail: tone(
        p, s, "triangle", note, attack=0.002, release=0.97, shape="q", tail=tail)))
    mallet = v("km-mallet", parse(MARIMBA), capped(0.05, lambda p, s, note, tail: tone(
        p, s, "triangle", hz(note) * 4, vol=0.25, low=3500, attack=0.001, release=0.95, tail=tail)))
    bass = v("km-bass", parse(BASS), capped(0.36, lambda p, s, note, tail: tone(
        p, s, "triangle", note, attack=0.004, release=0.5, tail=tail)))
    # A quiet filtered square on the bass line, so it still carries on a phone speaker.
    growl = v("km-growl", parse(BASS), capped(0.2, lambda p, s, note, tail: tone(
        p, s, "square", note, vol=0.5, duty=25, low=500, attack=0.004, release=0.7, tail=tail)))
    comp = [v(f"km-comp{i}", comp_score(i), lambda p, length, note: tone(
        p, length, "square", note, low=1200, attack=0.01, release=0.5, shape="h")) for i in range(3)]
    congas = v("km-conga", drums, lambda p, length, kind: tone(
        p, min(length, n(CONGA[kind][2])), "triangle", CONGA[kind][:2], vol=CONGA[kind][3], attack=0.002,
        release=0.9, tail=length - min(length, n(CONGA[kind][2]))))
    skin = v("km-skin", drums, lambda p, length, kind: tone(
        p, n(SKIN[kind][0]), "pinknoise", None, vol=SKIN[kind][1], high=900, low=3500, attack=0.001,
        release=0.8, tail=length - n(SKIN[kind][0])))
    kick = v("km-kick", hits([KICK] * 16), lambda p, length, kind: tone(
        p, n(0.12), "triangle", (150, 45), attack=0.002, release=0.9, tail=length - n(0.12)))
    shaker = v("km-shaker", hits([SHAKER] * 16), lambda p, length, kind: tone(
        p, n(0.05), "pinknoise", None, vol=SHAKE[kind], high=2000, low=4500, attack=0.015, release=0.6,
        shape="h", tail=length - n(0.05)))
    summed = f"{tmp}/km-mix.wav"
    mix([(reeds[0], 0.96), (reeds[1], 0.4), (marimba, 0.48), (mallet, 0.48), (bass, 0.36), (growl, 0.24),
         *((c, 0.1) for c in comp), (congas, 0.24), (skin, 0.48), (kick, 0.2),
         (shaker, 0.64)], summed)
    squeeze(summed, out)


def squeeze(path, out):
    """Compress 4:1 above SQUEEZE_DB with a short look-ahead, holding down the onsets where the voices coincide,
    then normalize the peak to PEAK_DB. It runs over three copies of the loop and keeps the middle one, so the
    compressor's state at the end flows into the start."""
    length = 16 * 16 * STEP
    sox(path, path, path, out, "compand", "0.001,0.08", f"6:-70,-70,{SQUEEZE_DB},{SQUEEZE_DB},0,{SQUEEZE_DB * 3 / 4}",
        "0", "0", f"{LOOKAHEAD / RATE:.6f}", "trim", f"{length}s", f"{length}s", "gain", "-n",
        str(PEAK_DB))
