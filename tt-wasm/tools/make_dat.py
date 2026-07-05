#!/usr/bin/env python3
"""Synthesize minimal-but-valid ToonTalk art DAT files (path (a)) so open_images_file()
succeeds and the message loop can run. Real pixels come later (path (b)).

Format reverse-engineered from sprite.cpp:
  m25.us1 / m800.us1 (images file, read by open_images_file @ sprite.cpp:11212):
     "TT"                                  2 bytes  (cookie)
     BITMAPINFO                            1064     (40-byte BITMAPINFOHEADER + 256 RGBQUAD)  read_palette
     appearance_count+1                    2  (short)   -> tt_appearance_count = this-1 = 69
     sprite_offsets[appearance_count+1]    4*(N+1)   absolute file offsets to each sprite's text
     number_of_image_files                 2  (short)
     image_offsets[number_of_image_files]  4*M
     <sprite text blocks>                  each parsed by load_sprite_file_from_stream (text tokens)
  Each sprite text (load_sprite_file_from_stream @ sprite.cpp:704), single-digit tokens so char
  (boolean) and int reads both work:
     SpriteVersion 1 <rep> <fnDist> <prio> <sound=0> <file_count=1> <name> <resIdx=0> <mask=1>
     <param_count=1> <ignoreIdeal=0> <image_count=1>
     BMP <mirror=0> <dur=1> <w=1> <h=1> <xoff=0> <yoff=0> <imgOff=0> <imgSize=0> <compress=0> <fnameIdx=0>
  resind.us1 (resolution-independent file @ sprite.cpp:11339): "TT" + sound offsets + 14 brushes.
"""
import struct, os

SPRITE_CODES = 69          # SpriteCode enum TOOLBOX_SIDE_SPRITE(0)..BACKGROUND_SPRITE(68)
DIB_BRUSH_COUNT = 14
OUT_DIRS = [r"C:\Users\toont\dev\tt-wasm\assets\toontalk",
            r"C:\Users\toont\dev\tt-wasm\assets\toontalk\Java"]

def dib_header():
    bih = struct.pack('<IiiHHIIiiII', 40, 1, 1, 1, 8, 0, 0, 0, 0, 256, 0)
    pal = bytearray()
    for i in range(256):
        pal += bytes([i, i, i, 0])   # BGRA grayscale ramp
    return bih + bytes(pal)

def sprite_text(i):
    # Engine-imposed shapes: HIT_OR_MISS_SPRITE(53) is force-set to parameter_count=2
    # (sprite.cpp:773) so needs 2 param blocks; PERSON_WALKING_SPRITE(2) really has 9 cycles
    # (8 directions + the heads cycle, sprite.cpp:939) and swap_heads() indexes nth_image(1/2)
    # and saved_heads j=0..3, so give it 9 cycles x 4 images. Everything else: 1 cycle x 1 image.
    params = 2 if i == 53 else (9 if i == 2 else 1)
    images = 4 if i == 2 else 1
    s = f"SpriteVersion 1 0 0 0 0 1 img{i} 0 1 {params} "
    s += ("0 " + f"{images} " + "BMP 0 1 1 1 0 0 0 0 0 0 " * images) * params
    return s.encode('ascii')

def build_images_dat():
    out = bytearray()
    out += b"TT"
    out += dib_header()
    n = SPRITE_CODES
    out += struct.pack('<h', n + 1)                 # appearance_count+1 -> tt_appearance_count=69
    # reserve sprite_offsets[n+1] and image_offsets, then fill after we know positions
    sprite_offsets_pos = len(out)
    out += b'\x00' * (4 * (n + 1))
    num_image_files = 2                              # 1 image + 1 terminating offset
    out += struct.pack('<h', num_image_files)
    image_offsets_pos = len(out)
    out += b'\x00' * (4 * num_image_files)
    # sprite text blocks
    sprite_offsets = []
    for i in range(n):
        sprite_offsets.append(len(out))
        out += sprite_text(i)
    sprite_offsets.append(len(out))                  # terminating offset (end of last sprite)
    # a tiny image blob (unused: BMP imgSize=0, lazy) + image offsets
    image_blob_start = len(out)
    out += b'\x00' * 4
    image_offsets = [image_blob_start, len(out)]
    # patch the offset tables
    struct.pack_into('<%dl' % (n + 1), out, sprite_offsets_pos, *sprite_offsets)
    struct.pack_into('<%dl' % num_image_files, out, image_offsets_pos, *image_offsets)
    return bytes(out)

def build_resind_dat():
    out = bytearray()
    out += b"TT"
    out += struct.pack('<h', 1)                      # number_of_sound_files (1 -> becomes 0 after --)
    brush_start = 2 + 2 + 4 + 2                       # after cookie+count+sound_offsets[1]+num_brushes
    out += struct.pack('<l', brush_start)            # sound_offsets[0] -> where brushes start
    out += struct.pack('<h', DIB_BRUSH_COUNT)        # number_of_brushes
    # 8x8 brush patterns (palette indices). Not blank, so GDI-filled ground/streets are visible
    # against the grayscale DAT palette (real lawn/water textures need the shipped resind.us1).
    for i in range(DIB_BRUSH_COUNT):
        out += bytes([80 + i * 12] * 64)             # a distinct mid-gray per brush
    return bytes(out)

def main():
    images = build_images_dat()
    resind = build_resind_dat()
    for d in OUT_DIRS:
        os.makedirs(d, exist_ok=True)
        for name in ("m25.us1", "m800.us1"):
            with open(os.path.join(d, name), 'wb') as f:
                f.write(images)
        with open(os.path.join(d, "resind.us1"), 'wb') as f:
            f.write(resind)
    print(f"images DAT: {len(images)} bytes (appearance_count={SPRITE_CODES}) -> m25.us1, m800.us1")
    print(f"resind DAT: {len(resind)} bytes ({DIB_BRUSH_COUNT} brushes)")
    print(f"written to: {', '.join(OUT_DIRS)}")

if __name__ == '__main__':
    main()
