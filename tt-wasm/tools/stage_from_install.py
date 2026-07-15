#!/usr/bin/env python3
"""Stage the REAL ToonTalk art from an original install (found 2026-07-07):
  - Downloads/M25.US1        : the real packed art DAT (68 sprites, references frames by name)
  - <install>/resind.us1     : real ground/brush textures
  - <install>/java/*.PNG      : the sprite frames as (anti-aliased, hi-res, RGB) PNGs

The engine is 8-bit single-palette, so quantize each PNG to the M25 palette -> 8-bit BMP that
DibOpenFile loads. Per frame, prefer the source in order: native dev/M25 BMP (true 8-bit) >
java PNG (quantized) > dev/M22 BMP (upscaled 2x). Writes assets/pics + assets/toontalk, and
removes the loose .tts so all 68 sprites load from the real DAT's descriptors.
"""
import struct, glob, os, shutil
from PIL import Image

INSTALL = r"C:\Program Files (x86)\Animated Programs\ToonTalk"
JAVA    = os.path.join(INSTALL, "java")
M25US1  = r"C:\Users\toont\Downloads\M25.US1"
DEVM25  = r"C:\Users\toont\dev\M25"
DEVM22  = r"C:\Users\toont\dev\M22"
ROOT    = r"C:\Users\toont\dev\tt-wasm\assets"
PICS    = os.path.join(ROOT, "pics")
TT      = os.path.join(ROOT, "toontalk")

try:    NONE = Image.Dither.NONE
except AttributeError: NONE = Image.NONE

def m25_palette():
    d = open(M25US1, "rb").read()
    pb = d[2+40 : 2+40+1024]                       # 256 RGBQUAD (B,G,R,x) after the 40-byte header
    rgb = []
    for i in range(256):
        rgb += [pb[i*4+2], pb[i*4+1], pb[i*4]]     # -> R,G,B
    p = Image.new("P", (1, 1)); p.putpalette(rgb)
    return p

def referenced_names():
    """every image name the real DAT's sprite descriptors reference (lowercased)."""
    d = open(M25US1, "rb").read()
    off = 2 + 1064
    (n1,) = struct.unpack_from("<h", d, off); off += 2
    offs = struct.unpack_from("<%dl" % n1, d, off)
    names = set()
    for i in range(n1 - 1):
        blk = d[offs[i]:offs[i+1]].split(b"\x00")[0].decode("latin1")
        toks = blk.split()
        # file-list lines are "name resid flag"; grab name tokens (non-numeric first token)
        for j in range(len(toks) - 2):
            if toks[j+1].isdigit() and toks[j+2] in ("0", "1") and not toks[j][0].isdigit():
                names.add(toks[j].lower())
    return names

def fix_pad_template(name, im):
    """The java export's PAD faces are chroma-key TEMPLATES — number pads solid green-family,
    text pads magenta-family, with the 3D shading encoded as key-shade variation (the Java
    runtime recolored them). The C++ engine expects real white pads, so untranslated templates
    color-key away to black boxes. Rebuild the classic white pad: map each key pixel's shade to
    a neutral gray/white, leave non-key pixels (digits, borders drawn in real colors) alone."""
    if not (name.startswith("numb") or name.startswith("text")):
        return im
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b = px[x, y]
            # Loose gates on purpose: the saturated frame greens/magentas AND the PALE face
            # centers (e.g. mint ~(185,255,185), pink ~(255,185,255)) are all key pixels — the
            # first version's tight gates (+80 channel spread) missed the pale faces, leaving
            # green number pads and pink text pads in the game ("the pads are still wrong").
            if name.startswith("numb") and g > 150 and g > r + 30 and g > b + 20:
                v = min(255, 140 + r)                    # R carries the shading (0=border..~112=face)
                px[x, y] = (v, v, v)
            elif name.startswith("text") and r > 150 and r > g + 30 and b > g + 20:
                v = min(255, 120 + (g * 85) // 100)      # G carries the shading (40..152)
                px[x, y] = (v, v, v)
    return im

def pad4(im):
    # DWORD-align the WIDTH by replicating the right edge. The engine composites loose BMPs with
    # an UNPADDED source pitch in places (TTImage::display_on head-onto-body); retail art was
    # authored 4-aligned so it never mattered there, but arbitrary-width frames shear (the
    # indoor person's head rendered as diagonal slices).
    w, h = im.size
    pad = (-w) % 4
    if not pad: return im
    out = Image.new(im.mode, (w + pad, h))
    if im.mode == "P":
        p = im.getpalette()
        if p: out.putpalette(p)
    out.paste(im, (0, 0))
    edge = im.crop((w - 1, 0, w, h))
    for i in range(pad): out.paste(edge, (w + i, 0))
    return out

def main():
    pal = m25_palette()
    want = referenced_names()
    print("DAT references %d distinct frame names" % len(want))
    for f in glob.glob(os.path.join(PICS, "*.bmp")): os.remove(f)
    for f in glob.glob(os.path.join(PICS, "*.tts")): os.remove(f)  # use the DAT's descriptors

    native = upscaled = quantized = missing = 0
    # 1. native dev/M25 (true 8-bit) — highest quality
    have = {}
    for bmp in glob.glob(os.path.join(DEVM25, "*.BMP")):
        name = os.path.basename(bmp)[:-4].lower()
        im = Image.open(bmp)
        if im.width % 4:
            pad4(im).save(os.path.join(PICS, name + ".bmp"), "BMP")
        else:
            shutil.copyfile(bmp, os.path.join(PICS, name + ".bmp"))  # aligned: keep bytes identical
        have[name] = 1; native += 1
    # 2. java PNGs -> quantized, for names not already native
    for png in glob.glob(os.path.join(JAVA, "*.PNG")):
        name = os.path.basename(png)[:-4].lower()
        if name in have: continue
        try:
            im = fix_pad_template(name, Image.open(png).convert("RGB")).quantize(palette=pal, dither=NONE)
            pad4(im).save(os.path.join(PICS, name + ".bmp"), "BMP"); have[name] = 1; quantized += 1
        except Exception as e:
            print("  png fail", name, e)
    # 3. dev/M22 upscaled, for anything still missing that the DAT wants
    for name in want:
        if name in have: continue
        m22 = os.path.join(DEVM22, name.upper() + ".BMP")
        if os.path.exists(m22):
            im = Image.open(m22)
            if im.mode != "P": im = im.convert("P")
            pad4(im.resize((im.width*2, im.height*2), Image.NEAREST)).save(os.path.join(PICS, name+".bmp"), "BMP")
            have[name] = 1; upscaled += 1
        else:
            missing += 1
    print("frames: native(M25)=%d  quantized(java)=%d  upscaled(M22)=%d  still-missing=%d"
          % (native, quantized, upscaled, missing))

    # 4. the real DAT + brushes
    os.makedirs(os.path.join(TT, "Java"), exist_ok=True)
    for d in (TT, os.path.join(TT, "Java")):
        shutil.copyfile(M25US1, os.path.join(d, "m25.us1"))
        # deliberately NO m800.us1: the engine must fall back to m25 and set the art scale to
        # 640x480 (open_images_file does this) — shipping m25 AS m800 made all sprite-offset
        # math run at 800/640 scale (arm attached at a finger, toolbox contents misplaced).
        shutil.copyfile(os.path.join(INSTALL, "resind.us1"), os.path.join(d, "resind.us1"))
    print("staged real m25.us1 (%d KB) + resind.us1 (%d KB)"
          % (os.path.getsize(M25US1)//1024, os.path.getsize(os.path.join(INSTALL, "resind.us1"))//1024))

if __name__ == "__main__":
    main()
