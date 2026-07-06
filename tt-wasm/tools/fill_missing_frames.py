#!/usr/bin/env python3
"""M25 (the 640x480 art) ships an INCOMPLETE frame set — many .tts-referenced animation frames
are absent. Fill each gap with the best available real art, writing into assets/pics (the
preloaded picture dir), in priority order:

  1. native M25 frame            (already copied by stage_assets.sh — nothing to do)
  2. M22 frame upscaled 2x       (M22 is the same sprites/poses/palette at half resolution;
                                  nearest-neighbour 2x ~ matches M25 size, correct pose)
  3. nearest present frame       (substitute a same-sprite frame — correct size, wrong pose)

All three share ONE palette (the shipped ToonTalk palette baked into m25.us1), and the engine
renders BMP indices through that palette, so mixing native + upscaled + substitute is colour-safe.
Reports the mix; substitutes are the placeholders to replace when complete art surfaces.
"""
import os, re, glob, shutil
from PIL import Image

DEV = r"C:\Users\toont\dev"
M25 = os.path.join(DEV, "M25")
M22 = os.path.join(DEV, "M22")
PICS = os.path.join(DEV, r"tt-wasm\assets\pics")

def refs_of(tts_path):
    names = []
    with open(tts_path, 'r', errors='ignore') as f:
        for line in f:
            t = line.split()
            if len(t) == 3 and t[1].isdigit() and not t[0][0].isdigit():
                names.append(t[0].lower())
    return names

def split_num(name):
    m = re.match(r'^(.*?)(\d+)$', name)
    return (m.group(1), int(m.group(2))) if m else (name, -1)

def best_substitute(missing, present):
    mp, mn = split_num(missing)
    def score(p):
        pp, pn = split_num(p)
        pref = sum(1 for x, y in zip(missing, p) if x == y)
        return (-pref, abs(pn - mn) if (mn >= 0 and pn >= 0) else 9999, len(p))
    return min(present, key=score)

def upscale_m22(name, dst):
    """2x nearest-neighbour upscale of the M22 (half-res) frame, preserving palette indices."""
    im = Image.open(os.path.join(M22, name.upper() + ".BMP"))
    if im.mode != 'P':
        im = im.convert('P')
    im.resize((im.width * 2, im.height * 2), Image.NEAREST).save(dst, "BMP")

def main():
    native = 0; upscaled = 0; substituted = 0; unfillable = []
    for tts in sorted(glob.glob(os.path.join(M25, "*.TTS"))):
        refs = list(dict.fromkeys(refs_of(tts)))  # de-dup, keep order
        present = [r for r in refs if os.path.exists(os.path.join(M25, r.upper() + ".BMP"))]
        native += len(present)
        for r in refs:
            if r in present:
                continue
            dst = os.path.join(PICS, r + ".bmp")
            if os.path.exists(os.path.join(M22, r.upper() + ".BMP")):
                upscale_m22(r, dst); upscaled += 1
            elif present:
                shutil.copyfile(os.path.join(M25, best_substitute(r, present).upper() + ".BMP"), dst)
                substituted += 1
            else:
                unfillable.append(r)
    print("frame sources:")
    print("  native M25 (640):      %d" % native)
    print("  upscaled from M22 2x:  %d" % upscaled)
    print("  substituted (placeholder): %d" % substituted)
    if unfillable:
        print("  unfillable (no art anywhere): %d  e.g. %s" % (len(unfillable), ", ".join(unfillable[:8])))

if __name__ == '__main__':
    main()
