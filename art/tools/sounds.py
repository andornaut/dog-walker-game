#!/usr/bin/env python3
"""Synthesize the sound effects and the walk's music loop with sox, and encode
them with ffmpeg. Soft chiptune: square and triangle waves through gentle
low-pass filters, short envelopes, and every note fading to silence in its slot.

sfx-tip            0.35s  coin chime: a square B5 hopping up to a ringing E6
sfx-treat          0.40s  bubbly triangle arpeggio up C6 E6 G6 C7
sfx-bump           0.30s  cushioned thud: a falling triangle with a puff of low noise
sfx-bark           0.18s  one "wuf": a falling square with a triangle body
sfx-card           0.44s  paper swish, then a triangle chime G5 D6
sfx-fired          1.80s  sad "wah wah wah waaah" down G4 F#4 F4 E4, muted square
sfx-hit-skunk      0.50s  spray hiss: pink noise stepping down three bands over a falling "pfff"
sfx-hit-puddle     0.50s  splash: a pink noise burst and low plop, then rising triangle bubbles
sfx-hit-thief      0.60s  coin scatter: seven fading triangle pings between F#6 and E7
sfx-hit-squirrel   0.40s  chitter: seven quick falling square chirps near 3kHz, three then four
sfx-hit-other-dog  0.40s  friendly woof: a soft low "boof", then a rising yip
sfx-hit-goose      0.48s  honk honk: two nasal square honks with a wobble, the second higher, over a hiss
sfx-badge          1.00s  jingle: square D6 F#6 A6 up to a ringing D7, then a sparkle A7 F#7 D7 A7
sfx-new-best       1.50s  fanfare: G4 C5 E5 G5, E5 G5 over a triangle bass, warm square
music-walk         28.77s 12 bars at about 100 BPM in C, loops seamlessly: square lead,
                          triangle walking bass, thin square arpeggio, soft kick and tick

Each sound ships as mono 44.1kHz Ogg Vorbis plus AAC (.m4a), since iOS Safari
cannot play Ogg.

Usage:
  sounds.py preview OUT_DIR   write the .ogg and .m4a files into OUT_DIR only
  sounds.py build             write public/art/sounds/*.ogg and *.m4a, and flag
                              the music as looping in public/art/manifest.extra.json

Run from the repository root. Needs sox and ffmpeg. Every run is identical:
sox runs in repeatable mode (fixed noise seed, no dither) and ffmpeg in
bitexact mode, so a rebuild only changes files when this script changes.
"""

import json
import os
import subprocess
import sys
import tempfile

RATE = 44100
PEAK_DB = -4  # leaves room for the lossy encoders to overshoot and still peak below -1 dBFS
# One sixteenth note at about 100 BPM. 6608 is a multiple of 16, so the 192
# sixteenths of the loop fill whole 1024-sample AAC frames and decoders that
# keep the encoder's end padding still loop without a gap.
STEP = 6608
NOTES = {"C": -9, "D": -7, "E": -5, "F": -4, "G": -2, "A": 0, "B": 2}


def hz(note):
    """Equal-tempered frequency of a note name such as "F#4"; a number passes through."""
    if not isinstance(note, str):
        return note
    semis = NOTES[note[0]] + note.count("#") + (int(note[-1]) - 4) * 12
    return 440 * 2 ** (semis / 12)


def n(seconds):
    return round(seconds * RATE)


def sox(*args):
    subprocess.run(["sox", "-R", "-D", *args], check=True)


def tone(path, length, wave, freq, vol=1.0, duty=50, low=None, high=None, attack=0.005, release=0.6,
         shape="l", start=0, tail=0, fx=()):
    """One enveloped note, length samples long, with start samples of silence
    before it and tail after.

    freq is a note name, a frequency, or (from, to) for an exponential sweep. The
    envelope rises over attack seconds and decays over the last release fraction
    of the note, then a last 64-sample linear fade lands it exactly on zero."""
    if wave.endswith("noise"):
        chain = ["synth", f"{length}s", wave]
    else:
        # "-" sweeps exponentially; sox's smoother "/" sweep outputs a flat line when the pitch falls.
        f = f"{hz(freq[0]):.3f}-{hz(freq[1]):.3f}" if isinstance(freq, tuple) else f"{hz(freq):.3f}"
        # sox's bias both shifts and shrinks the wave; this much centres a pulse of the given duty on zero.
        bias = 100 * (1 - duty / 50) / (2 - duty / 50) if wave == "square" else 0
        chain = ["synth", f"{length}s", wave, f, f"{bias:.4f}", "0", str(duty)]
    chain += ["vol", "0.5"]  # synth writes at full scale; filters overshoot it
    if high:
        chain += ["highpass", str(high)]
    if low:
        chain += ["lowpass", str(low)]
    chain += list(fx)
    chain += ["fade", shape, f"{max(1, n(attack))}s", f"{length}s", f"{int(length * release)}s"]
    chain += ["fade", "t", "0", f"{length}s", "64s", "vol", str(vol), "pad", f"{start}s", f"{tail}s"]
    sox("-r", str(RATE), "-c", "1", "-n", "-e", "floating-point", "-b", "32", path, *chain)


def rest(path, length):
    sox("-r", str(RATE), "-c", "1", "-n", "-e", "floating-point", "-b", "32", path, "trim", "0", f"{length}s")


def mix(layers, out):
    """Sum (path, volume) layers and normalize the peak to PEAK_DB."""
    inputs = [a for path, vol in layers for a in ("-v", f"{vol:.4f}", path)]
    sox(*(["-m"] if len(layers) > 1 else []), *inputs, "-e", "floating-point", "-b", "32", out,
        "gain", "-n", str(PEAK_DB))


def concat(paths, out):
    sox(*paths, out)


# Effects: each is a list of tone() calls, (wave, seconds, freq, start seconds, options).

EFFECTS = {
    "sfx-tip": [
        ("square", 0.08, "B5", 0, dict(vol=0.6, low=3500, release=0.3)),
        ("square", 0.27, "E6", 0.08, dict(vol=0.6, low=3500, release=0.9)),
        ("triangle", 0.27, "E5", 0.08, dict(vol=0.5, release=0.9)),
    ],
    "sfx-treat": [
        ("triangle", 0.07, "C6", 0, dict(release=0.4)),
        ("triangle", 0.07, "E6", 0.06, dict(release=0.4)),
        ("triangle", 0.07, "G6", 0.12, dict(release=0.4)),
        ("triangle", 0.22, "C7", 0.18, dict(release=0.9)),
        ("square", 0.22, "C6", 0.18, dict(vol=0.15, duty=25, low=2500, release=0.9)),
    ],
    "sfx-bump": [
        ("triangle", 0.3, (190, 55), 0, dict(attack=0.004, release=0.85)),
        ("square", 0.16, (120, 70), 0, dict(vol=0.25, low=500, attack=0.004, release=0.8)),
        ("pinknoise", 0.08, None, 0, dict(vol=0.35, low=900, attack=0.002, release=0.9)),
    ],
    "sfx-bark": [
        ("square", 0.16, (640, 260), 0.02, dict(vol=0.6, duty=35, low=1600, attack=0.012, release=0.7, shape="h")),
        ("triangle", 0.16, (320, 130), 0.02, dict(vol=0.8, attack=0.012, release=0.7, shape="h")),
        ("pinknoise", 0.05, None, 0.015, dict(vol=0.12, low=2500, high=600, attack=0.006, release=0.8)),
    ],
    "sfx-card": [
        ("pinknoise", 0.16, None, 0, dict(vol=0.3, low=3500, high=900, attack=0.07, release=0.55, shape="h")),
        ("triangle", 0.1, "G5", 0.1, dict(release=0.5)),
        ("triangle", 0.25, "D6", 0.19, dict(release=0.9)),
        ("square", 0.25, "D5", 0.19, dict(vol=0.12, duty=25, low=2000, release=0.9)),
    ],
    "sfx-fired": [
        ("square", 0.32, "G4", 0, dict(vol=0.5, low=1100, attack=0.03, release=0.5, shape="h")),
        ("square", 0.32, "F#4", 0.33, dict(vol=0.5, low=1100, attack=0.03, release=0.5, shape="h")),
        ("square", 0.32, "F4", 0.66, dict(vol=0.5, low=1100, attack=0.03, release=0.5, shape="h")),
        ("square", 0.81, ("E4", "D#4"), 0.99,
         dict(vol=0.5, low=1100, attack=0.03, release=0.6, shape="h", fx=("tremolo", "5", "45"))),
        ("triangle", 0.32, "G3", 0, dict(vol=0.6, attack=0.03, release=0.5, shape="h")),
        ("triangle", 0.32, "F#3", 0.33, dict(vol=0.6, attack=0.03, release=0.5, shape="h")),
        ("triangle", 0.32, "F3", 0.66, dict(vol=0.6, attack=0.03, release=0.5, shape="h")),
        ("triangle", 0.81, ("E3", "D#3"), 0.99, dict(vol=0.6, attack=0.03, release=0.6, shape="h")),
    ],
    # Each band of hiss is lower than the last, so the spray falls without a swept filter.
    "sfx-hit-skunk": [
        ("pinknoise", 0.22, None, 0, dict(vol=0.8, low=5000, high=2400, attack=0.02, release=0.5, shape="h")),
        ("pinknoise", 0.25, None, 0.12, dict(vol=0.8, low=3200, high=1200, attack=0.04, release=0.6, shape="h")),
        ("pinknoise", 0.3, None, 0.2, dict(vol=0.8, low=1800, high=500, attack=0.05, release=0.7, shape="h",
                                           fx=("tremolo", "18", "60"))),
        ("square", 0.42, (900, 220), 0.06, dict(vol=0.12, duty=25, low=1400, attack=0.03, release=0.7)),
    ],
    "sfx-hit-puddle": [
        ("pinknoise", 0.3, None, 0, dict(vol=0.9, low=3000, high=250, attack=0.004, release=0.85)),
        ("triangle", 0.3, (130, 60), 0, dict(vol=0.5, attack=0.004, release=0.8)),
        ("triangle", 0.05, (420, 900), 0.12, dict(vol=0.6, attack=0.003, release=0.6)),
        ("triangle", 0.05, (560, 1200), 0.19, dict(vol=0.5, attack=0.003, release=0.6)),
        ("triangle", 0.05, (360, 780), 0.26, dict(vol=0.5, attack=0.003, release=0.6)),
        ("triangle", 0.05, (640, 1350), 0.34, dict(vol=0.4, attack=0.003, release=0.6)),
        ("triangle", 0.06, (480, 1000), 0.44, dict(vol=0.3, attack=0.003, release=0.6)),
    ],
    # Coins bounce apart: uneven gaps and pitches, each ping quieter than the last.
    "sfx-hit-thief": [
        ("triangle", 0.12, "B6", 0, dict(release=0.9)),
        ("triangle", 0.12, "E7", 0.06, dict(vol=0.95, release=0.9)),
        ("triangle", 0.12, "G#6", 0.13, dict(vol=0.9, release=0.9)),
        ("triangle", 0.12, "D7", 0.19, dict(vol=0.85, release=0.9)),
        ("triangle", 0.12, "F#6", 0.28, dict(vol=0.75, release=0.9)),
        ("triangle", 0.12, "C#7", 0.36, dict(vol=0.65, release=0.9)),
        ("triangle", 0.12, "A6", 0.48, dict(vol=0.55, release=0.9)),
        ("square", 0.08, "B5", 0, dict(vol=0.3, duty=25, low=4000, release=0.9)),
        ("square", 0.08, "E6", 0.06, dict(vol=0.25, duty=25, low=4000, release=0.9)),
    ],
    "sfx-hit-squirrel": [
        ("square", 0.03, (3200, 2100), 0.01, dict(vol=0.6, duty=25, low=4500, attack=0.002, release=0.6)),
        ("square", 0.03, (3400, 2200), 0.055, dict(vol=0.6, duty=25, low=4500, attack=0.002, release=0.6)),
        ("square", 0.03, (3000, 2000), 0.1, dict(vol=0.6, duty=25, low=4500, attack=0.002, release=0.6)),
        ("square", 0.03, (3300, 2200), 0.2, dict(vol=0.6, duty=25, low=4500, attack=0.002, release=0.6)),
        ("square", 0.03, (3500, 2300), 0.245, dict(vol=0.6, duty=25, low=4500, attack=0.002, release=0.6)),
        ("square", 0.03, (3200, 2100), 0.29, dict(vol=0.6, duty=25, low=4500, attack=0.002, release=0.6)),
        ("square", 0.065, (3600, 2000), 0.335, dict(vol=0.6, duty=25, low=4500, attack=0.002, release=0.7)),
        ("pinknoise", 0.38, None, 0.01, dict(vol=0.25, low=6000, high=2500, attack=0.002, release=0.3,
                                             fx=("tremolo", "22", "100"))),
    ],
    "sfx-hit-other-dog": [
        ("triangle", 0.18, (240, 120), 0.01, dict(attack=0.02, release=0.7, shape="h")),
        ("square", 0.18, (240, 120), 0.01, dict(vol=0.35, low=700, attack=0.02, release=0.7, shape="h")),
        ("pinknoise", 0.08, None, 0.01, dict(vol=0.15, low=1200, high=200, attack=0.01, release=0.8)),
        ("square", 0.18, (700, 1400), 0.22, dict(vol=0.4, duty=35, low=2500, attack=0.01, release=0.6)),
        ("triangle", 0.18, (350, 700), 0.22, dict(vol=0.6, attack=0.01, release=0.6)),
    ],
    # A goose's honk is nasal: a narrow pulse with a fast wobble, low-passed so it stays soft.
    "sfx-hit-goose": [
        ("square", 0.18, (440, 400), 0.01, dict(vol=0.6, duty=20, low=1800, attack=0.01, release=0.5, shape="h",
                                                fx=("tremolo", "28", "35"))),
        ("triangle", 0.18, (220, 200), 0.01, dict(vol=0.5, attack=0.01, release=0.5, shape="h")),
        ("square", 0.25, (500, 430), 0.23, dict(vol=0.6, duty=20, low=1800, attack=0.01, release=0.6, shape="h",
                                                fx=("tremolo", "28", "35"))),
        ("triangle", 0.25, (250, 215), 0.23, dict(vol=0.5, attack=0.01, release=0.6, shape="h")),
        ("pinknoise", 0.12, None, 0, dict(vol=0.2, low=4000, high=1500, attack=0.01, release=0.8)),
    ],
    "sfx-badge": [
        ("square", 0.08, "D6", 0, dict(vol=0.5, duty=25, low=4000, release=0.4)),
        ("square", 0.08, "F#6", 0.08, dict(vol=0.5, duty=25, low=4000, release=0.4)),
        ("square", 0.08, "A6", 0.16, dict(vol=0.5, duty=25, low=4000, release=0.4)),
        ("square", 0.5, "D7", 0.24, dict(vol=0.45, duty=25, low=4000, release=0.9, fx=("tremolo", "9", "30"))),
        ("triangle", 0.5, "D5", 0.24, dict(vol=0.7, release=0.9)),
        ("triangle", 0.06, "A7", 0.5, dict(vol=0.35, attack=0.002, release=0.8)),
        ("triangle", 0.06, "F#7", 0.58, dict(vol=0.3, attack=0.002, release=0.8)),
        ("triangle", 0.06, "D7", 0.66, dict(vol=0.25, attack=0.002, release=0.8)),
        ("triangle", 0.26, "A7", 0.74, dict(vol=0.2, attack=0.002, release=0.9)),
    ],
    "sfx-new-best": [
        ("square", 0.1, "G4", 0, dict(vol=0.5, low=2200, attack=0.008, release=0.4)),
        ("square", 0.1, "C5", 0.11, dict(vol=0.5, low=2200, attack=0.008, release=0.4)),
        ("square", 0.1, "E5", 0.22, dict(vol=0.5, low=2200, attack=0.008, release=0.4)),
        ("square", 0.35, "G5", 0.33, dict(vol=0.5, low=2200, attack=0.008, release=0.5)),
        ("square", 0.12, "E5", 0.7, dict(vol=0.5, low=2200, attack=0.008, release=0.4)),
        ("square", 0.66, "G5", 0.84, dict(vol=0.5, low=2200, attack=0.008, release=0.8, fx=("tremolo", "6", "25"))),
        ("square", 0.66, "E5", 0.84, dict(vol=0.3, duty=25, low=1800, attack=0.008, release=0.8)),
        ("triangle", 0.33, "C4", 0, dict(vol=0.8, release=0.6)),
        ("triangle", 0.35, "E4", 0.33, dict(vol=0.8, release=0.6)),
        ("triangle", 0.12, "G3", 0.7, dict(vol=0.8, release=0.5)),
        ("triangle", 0.66, "C4", 0.84, dict(vol=0.8, release=0.8)),
    ],
}

# Music: 12 bars of 16 sixteenths. A phrase over C Am F G twice (the second
# resolving to C), then a bridge over F G Am G that turns back to the top.
# Notes are "name:sixteenths"; "-" is a rest.

LEAD = """
E5:2 G5:2 C6:4 B5:2 G5:2 E5:4 | A5:6 G5:2 E5:4 -:4 | F5:2 A5:2 C6:4 A5:2 F5:2 G5:4 | G5:6 A5:2 G5:4 -:4
E5:2 G5:2 C6:4 D6:2 C6:2 G5:4 | A5:2 C6:2 E6:4 D6:2 C6:2 A5:4 | F5:2 A5:2 C6:4 B5:2 A5:2 G5:2 D5:2 | C5:6 E5:2 C5:4 -:4
A5:4 C6:4 A5:2 G5:2 F5:4 | G5:4 B5:4 D6:4 B5:4 | C6:4 B5:2 A5:2 E5:4 A5:4 | G5:6 F5:2 D5:4 -:4
"""
BASS = """
C3:4 G3:4 E3:4 G3:4 | A2:4 E3:4 C3:4 E3:4 | F2:4 C3:4 A2:4 C3:4 | G2:4 D3:4 B2:4 D3:4
C3:4 G3:4 E3:4 G3:4 | A2:4 E3:4 C3:4 E3:4 | F2:4 C3:4 G2:4 D3:4 | C3:4 G2:4 C3:4 -:4
F2:4 C3:4 A2:4 C3:4 | G2:4 D3:4 B2:4 D3:4 | A2:4 E3:4 C3:4 E3:4 | G2:4 D3:4 B2:4 D3:4
"""
CHORDS = "C Am F G C Am FG C F G Am G"
ARPS = {"C": "C4 E4 G4 C5", "Am": "A3 C4 E4 A4", "F": "F3 A3 C4 F4", "G": "G3 B3 D4 G4"}


def parse(score):
    return [(t.split(":")[0], int(t.split(":")[1])) for t in score.split() if t != "|"]


def arp_score():
    notes = []
    for chord in CHORDS.split():
        for half in (["F", "G"] if chord == "FG" else [chord, chord]):
            a, b, c, d = ARPS[half].split()
            notes += [(x, 2) for x in (a, b, c, d)]
    return notes


def drum_score():
    """Kick on beats 1 and 3, tick on 2 and 4, as (voice, sixteenths)."""
    return [(v, 4) for _ in range(12) for v in ("kick", "tick", "kick", "tick")]


def voice(tmp, name, score, play):
    paths = []
    for i, (note, steps) in enumerate(score):
        path = f"{tmp}/{name}-{i:03}.wav"
        if note == "-":
            rest(path, steps * STEP)
        else:
            play(path, steps * STEP, note)
        paths.append(path)
    out = f"{tmp}/{name}.wav"
    concat(paths, out)
    return out


def drum(path, length, kind):
    if kind == "kick":
        tone(path, n(0.12), "triangle", (150, 45), attack=0.002, release=0.9, tail=length - n(0.12))
    else:
        tone(path, n(0.035), "pinknoise", None, vol=0.35, high=5000, attack=0.002, release=0.9,
             tail=length - n(0.035))


def music(tmp, out):
    lead = voice(tmp, "lead", parse(LEAD), lambda p, length, note: tone(
        p, length, "square", note, vol=0.45, low=3000, attack=0.008, release=0.7))
    bass = voice(tmp, "bass", parse(BASS), lambda p, length, note: tone(
        p, length, "triangle", note, vol=0.9, attack=0.006, release=0.5))
    arp = voice(tmp, "arp", arp_score(), lambda p, length, note: tone(
        p, length, "square", note, vol=0.14, duty=25, low=1800, attack=0.004, release=0.85))
    drums = voice(tmp, "drums", drum_score(), drum)
    mix([(lead, 1), (bass, 0.8), (arp, 1), (drums, 0.5)], out)


def effect(tmp, key, out):
    layers = []
    for i, (wave, seconds, freq, start, opts) in enumerate(EFFECTS[key]):
        path = f"{tmp}/{key}-{i}.wav"
        tone(path, n(seconds), wave, freq, start=n(start), **opts)
        layers.append(path)
    mix([(path, 1 / len(layers)) for path in layers], out)


def encode(wav, out_dir, key):
    """Ogg Vorbis and AAC, mono 44.1kHz, with no timestamps or random stream serials."""
    common = ["ffmpeg", "-v", "error", "-y", "-i", wav, "-ac", "1", "-ar", str(RATE), "-map_metadata", "-1",
              "-fflags", "+bitexact", "-flags:a", "+bitexact"]
    loop = key.startswith("music-")
    subprocess.run([*common, "-c:a", "libvorbis", "-q:a", "3" if loop else "2", f"{out_dir}/{key}.ogg"],
                   check=True)
    subprocess.run([*common, "-c:a", "aac", "-b:a", "64k" if loop else "96k", f"{out_dir}/{key}.m4a"],
                   check=True)


def render(out_dir):
    """Write every sound into out_dir as .ogg and .m4a; return the keys."""
    os.makedirs(out_dir, exist_ok=True)
    keys = [*EFFECTS, "music-walk"]
    with tempfile.TemporaryDirectory() as tmp:
        for key in keys:
            wav = f"{tmp}/{key}.wav"
            if key == "music-walk":
                music(tmp, wav)
            else:
                effect(tmp, key, wav)
            encode(wav, out_dir, key)
    return keys


def mark_loops(keys, path="public/art/manifest.extra.json"):
    """Flag each music key as looping in the manifest sidecar, keeping every other entry: the game
    build reads the flags from there, since a sound file cannot say it loops."""
    extra = {}
    if os.path.exists(path):
        with open(path) as f:
            extra = json.load(f)
    sounds = extra.setdefault("sounds", {})
    for key in keys:
        if key.startswith("music-"):
            sounds.setdefault(key, {})["loop"] = True
    with open(path, "w") as f:
        json.dump(extra, f, indent=2)
        f.write("\n")


def build():
    keys = render("public/art/sounds")
    mark_loops(keys)
    print("built", ", ".join(keys))


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "preview":
        print("wrote", ", ".join(render(sys.argv[2])))
    elif len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
    else:
        sys.exit(__doc__)
