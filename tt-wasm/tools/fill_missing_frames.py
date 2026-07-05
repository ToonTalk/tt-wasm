#!/usr/bin/env python3
"""The M25 art set is partial: each animated sprite is missing some frames (e.g. HOUSEBT
references hsbtop20 but only hsbtop05/hsbtop12 ship). A missing frame makes retrieve_image
fall through to a non-BMP path and the sprite draws blank. Until the complete art is
available, fill every referenced-but-missing frame by copying the closest PRESENT frame of
the same sprite (longest shared prefix, then numerically nearest). Everything then renders;
substitutes are reversible (delete the copies and re-stage when real art arrives).

Writes copies into assets/pics/ (the preloaded picture dir). Reports the substitutions.
"""
import os, re, glob, shutil

M25 = r"C:\Users\toont\dev\M25"
PICS = r"C:\Users\toont\dev\tt-wasm\assets\pics"

def refs_of(tts_path):
    names = []
    with open(tts_path, 'r', errors='ignore') as f:
        for line in f:
            t = line.split()
            # file-list lines: "name resid flag" — name non-numeric, resid integer
            if len(t) == 3 and t[1].isdigit() and not t[0][0].isdigit():
                names.append(t[0].lower())
    return names

def split_num(name):
    m = re.match(r'^(.*?)(\d+)$', name)
    if m:
        return m.group(1), int(m.group(2))
    return name, -1

def common_prefix_len(a, b):
    n = 0
    for x, y in zip(a, b):
        if x != y:
            break
        n += 1
    return n

def best_substitute(missing, present):
    """Pick the present frame closest to `missing`: longest shared prefix, then nearest number."""
    mp, mn = split_num(missing)
    def score(p):
        pp, pn = split_num(p)
        pref = common_prefix_len(missing, p)
        numdist = abs(pn - mn) if (mn >= 0 and pn >= 0) else 9999
        return (-pref, numdist, len(p))  # more prefix better, then nearer number
    return min(present, key=score)

def main():
    made, families_empty = 0, []
    for tts in sorted(glob.glob(os.path.join(M25, "*.TTS"))):
        refs = refs_of(tts)
        present = [r for r in refs if os.path.exists(os.path.join(PICS, r + ".bmp"))]
        missing = [r for r in refs if not os.path.exists(os.path.join(PICS, r + ".bmp"))]
        if not missing:
            continue
        if not present:
            families_empty.append(os.path.basename(tts))
            continue
        for m in missing:
            src = best_substitute(m, present)
            shutil.copyfile(os.path.join(PICS, src + ".bmp"), os.path.join(PICS, m + ".bmp"))
            made += 1
        print(f"  {os.path.basename(tts):14s} filled {len(missing):2d} missing (had {len(present)} present)")
    print(f"\nfilled {made} frames by substitution")
    if families_empty:
        print(f"NO present frames (cannot fill): {', '.join(families_empty)}")

if __name__ == '__main__':
    main()
