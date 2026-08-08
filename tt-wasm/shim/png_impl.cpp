/* png_impl.cpp — a minimal PNG reader for the ToonTalk WASM port.
 *
 * Why: user media (pictures made or imported by the player) lives inside notebook/city/demo
 * archives as Media/<hash>.png, and is extracted at RUNTIME -- so the build-time GIF->BMP
 * conversion that fixed the time-travel button art (tools/stage_from_install.py) cannot help.
 * The port decodes only BMP (wingutil.cpp DibReadBitmapInfoFromFileName); the GDI+ shim is
 * compile-only. Result: the Playground notebook opened with all 505 of its PNGs extracted and
 * every one of them blank (Ken: "many images are missing").
 *
 * Rather than teach the engine a second image format, decode to a BMP beside the PNG and let the
 * existing, proven BMP path do the rest -- the same shape as the .gif -> .bmp redirect in
 * picture.cpp.
 *
 * Scope is deliberately what the real files need, measured across every PNG in the retail
 * Playground archives (726 of them): bit depth 8, colour type 6 (RGBA, 620) or 3 (palette, 106),
 * no interlace. Colour types 0 (grey) and 2 (RGB) are handled too since they cost nothing.
 * Interlaced or 16-bit-per-channel PNGs are refused rather than decoded wrongly.
 *
 * Output is a 24-bit bottom-up BMP: this build is TT_32, where sprite.cpp's "must be 8-bit" check
 * is compiled out and winmain.cpp branches on biBitCount <= 8, so 24-bit is accepted. Alpha is
 * composited over white -- see the note at composite_over_white below.
 */
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <zlib.h>
#ifdef __EMSCRIPTEN__
#include <emscripten.h>   /* KEEPALIVE so the decoder can be exercised from the console */

/* Bump whenever the PNG -> 8-bit mapping changes, so twins already written regenerate.
 * 1 = first 8-bit twins; 2 = exact black maps to the transparency key index. */
#define TT_BMP_TWIN_VERSION 2u
#else
#define EMSCRIPTEN_KEEPALIVE
#endif

namespace {

unsigned rd32be(const unsigned char *p) {
    return ((unsigned)p[0] << 24) | ((unsigned)p[1] << 16) | ((unsigned)p[2] << 8) | (unsigned)p[3];
}

bool read_whole_file(const char *path, unsigned char *&buf, size_t &len) {
    buf = NULL; len = 0;
    FILE *f = fopen(path, "rb");
    if (!f) return false;
    fseek(f, 0, SEEK_END);
    long n = ftell(f);
    fseek(f, 0, SEEK_SET);
    if (n <= 0) { fclose(f); return false; }
    buf = (unsigned char *)malloc((size_t)n);
    if (!buf) { fclose(f); return false; }
    size_t got = fread(buf, 1, (size_t)n, f);
    fclose(f);
    if (got != (size_t)n) { free(buf); buf = NULL; return false; }
    len = got;
    return true;
}

int paeth(int a, int b, int c) {
    int p = a + b - c, pa = abs(p - a), pb = abs(p - b), pc = abs(p - c);
    if (pa <= pb && pa <= pc) return a;
    return (pb <= pc) ? b : c;
}

/* Undo the per-scanline filters in place over the raw inflate output. Each row is preceded by a
 * filter byte, so the stride below includes it. bpp is the byte step to the "same channel of the
 * previous pixel" (PNG defines it as bytes per pixel, minimum 1). */
bool unfilter(unsigned char *raw, unsigned rows, unsigned rowbytes, unsigned bpp) {
    unsigned char *prev = NULL;
    for (unsigned y = 0; y < rows; y++) {
        unsigned char *p = raw + (size_t)y * (rowbytes + 1);
        unsigned char ft = *p++;
        for (unsigned i = 0; i < rowbytes; i++) {
            int a = (i >= bpp) ? p[i - bpp] : 0;
            int b = prev ? prev[i] : 0;
            int c = (prev && i >= bpp) ? prev[i - bpp] : 0;
            int x = p[i];
            switch (ft) {
                case 0: break;
                case 1: x += a; break;
                case 2: x += b; break;
                case 3: x += (a + b) / 2; break;
                case 4: x += paeth(a, b, c); break;
                default: return false;
            }
            p[i] = (unsigned char)x;
        }
        prev = p;
    }
    return true;
}

/* Used for the semi-transparent case only. ToonTalk's transparency is a colour key (palette entry
 * 0), so fully transparent and solid-black pixels both go straight to index 0 in write_bmp8;
 * partial alpha has no equivalent in an 8-bit keyed BMP, and compositing it over WHITE keeps
 * drawings and photos looking right on the notebook's white pages. */
void composite_over_white(int r, int g, int b, int a, unsigned char *out_bgr) {
    if (a >= 255) { out_bgr[0] = (unsigned char)b; out_bgr[1] = (unsigned char)g; out_bgr[2] = (unsigned char)r; return; }
    out_bgr[0] = (unsigned char)((b * a + 255 * (255 - a)) / 255);
    out_bgr[1] = (unsigned char)((g * a + 255 * (255 - a)) / 255);
    out_bgr[2] = (unsigned char)((r * a + 255 * (255 - a)) / 255);
}

/* The engine is palettised: its own art is 8-bit throughout, and it carries an
 * IDS_USER_PICTURE_NOT_256_COLORS error for pictures that are not. A 24-bit BMP loads but is then
 * read as one byte per pixel, so each RGB triple becomes three random palette indices -- which is
 * precisely the coloured static Ken photographed. So emit 8-bit with the BMP's own colour table.
 *
 * The table is a fixed 6x6x6 colour cube plus a 40-step grey ramp (216+40 = 256). Fixed rather
 * than median-cut because it needs no second pass over the image and never depends on which
 * picture was decoded first; the cube is what web-era 256-colour art used and is a reasonable fit
 * for hand-drawn ToonTalk pictures. Photographs will band somewhat -- if that shows, median cut
 * per image is the upgrade. */
/* The engine does NOT use a BMP's own colour table for user pictures -- it treats the bytes as
 * indices into ITS palette (tt_colors). A self-describing table therefore produced right shapes in
 * wrong colours, which is what Ken saw. The engine hands its live palette in here at startup, and
 * quantisation targets that. Index 0 is the engine's transparency key, so it is excluded from
 * matching and reserved for genuinely transparent source pixels -- the same rule
 * tools/stage_from_install.py applies to the retail art (exact key -> 0; anything else -> never 0).
 * Falls back to the fixed cube below only if the engine never supplied a palette. */
unsigned char g_engine_pal[256][3];
bool g_have_engine_pal = false;

void build_palette(unsigned char pal[256][3]) {
    int i = 0;
    for (int r = 0; r < 6; r++)
        for (int g = 0; g < 6; g++)
            for (int b = 0; b < 6; b++, i++) {
                pal[i][0] = (unsigned char)(r * 51);
                pal[i][1] = (unsigned char)(g * 51);
                pal[i][2] = (unsigned char)(b * 51);
            }
    for (int k = 0; i < 256; i++, k++) {
        unsigned char v = (unsigned char)(k * 255 / 39);
        pal[i][0] = pal[i][1] = pal[i][2] = v;
    }
}

/* Direct-mapped memo of colour -> palette index. The search below is a linear scan of 255 entries
 * PER PIXEL, so an 800x600 picture costs ~122M distance computations -- about a second, measured,
 * and the Playground notebook decodes 362 pictures before it can show anything (Ken: "why it takes
 * 10 seconds... the notebook loads very fast in the original"). The original shipped its media as
 * BMPs and never did this work at all.
 *
 * The key is the FULL 24-bit colour and every hit is verified against it, so results are identical
 * to the scan -- this is purely a speed cache, not a quantisation. Artwork uses few distinct
 * colours and repeats them in runs, so the hit rate is high. Reset whenever the palette changes,
 * since the answers are only valid for the palette they were computed against. */
#define NI_CACHE_BITS 13
#define NI_CACHE_SIZE (1 << NI_CACHE_BITS)
static unsigned      g_ni_key[NI_CACHE_SIZE];   /* 0xFF000000 marks empty (never a real 24-bit key) */
static unsigned char g_ni_val[NI_CACHE_SIZE];
static bool          g_ni_ready = false;

void nearest_index_reset(void) {
    for (int i = 0; i < NI_CACHE_SIZE; i++) g_ni_key[i] = 0xFF000000u;
    g_ni_ready = true;
}

int nearest_index(const unsigned char pal[256][3], int r, int g, int b) {
    if (!g_ni_ready) nearest_index_reset();
    unsigned key = ((unsigned)r << 16) | ((unsigned)g << 8) | (unsigned)b;
    /* Knuth multiplicative hash, then fold to the table size. */
    unsigned slot = (key * 2654435761u) >> (32 - NI_CACHE_BITS);
    if (g_ni_key[slot] == key) return g_ni_val[slot];

    int best = 1; long bestd = 0x7fffffffL;
    for (int i = 1; i < 256; i++) {          /* never index 0: that is the transparency key */
        long dr = r - pal[i][0], dg = g - pal[i][1], db = b - pal[i][2];
        long d = dr * dr + dg * dg + db * db;
        if (d < bestd) { bestd = d; best = i; if (d == 0) break; }
    }
    g_ni_key[slot] = key; g_ni_val[slot] = (unsigned char)best;
    return best;
}

bool write_bmp8(const char *path, unsigned w, unsigned h, const unsigned char *rgb_topdown,
                const unsigned char *alpha_topdown) {
    unsigned char pal[256][3];
    if (g_have_engine_pal) memcpy(pal, g_engine_pal, sizeof pal); else build_palette(pal);
    unsigned stride = (w + 3) & ~3u;                /* 1 byte per pixel, rows 4-byte aligned */
    unsigned imgsize = stride * h;
    unsigned off = 54 + 256 * 4;
    unsigned char hdr[54];
    memset(hdr, 0, sizeof hdr);
    hdr[0] = 'B'; hdr[1] = 'M';
    unsigned filesize = off + imgsize;
    memcpy(hdr + 2, &filesize, 4);
    memcpy(hdr + 10, &off, 4);
    unsigned hsize = 40; memcpy(hdr + 14, &hsize, 4);
    memcpy(hdr + 18, &w, 4);
    memcpy(hdr + 22, &h, 4);                        /* positive => bottom-up */
    unsigned short planes = 1, bpp = 8;
    memcpy(hdr + 26, &planes, 2);
    memcpy(hdr + 28, &bpp, 2);
    memcpy(hdr + 34, &imgsize, 4);
    /* Twin format version, parked in biXPelsPerMeter (the engine's loader ignores it). Bumped when
     * the mapping changes so twins already on disk regenerate -- the palette comparison in
     * tt_bmp_twin_ok cannot see a rule change, only a palette change. 2 = exact black is keyed. */
    unsigned twin_version = TT_BMP_TWIN_VERSION;
    memcpy(hdr + 38, &twin_version, 4);
    unsigned clrs = 256;
    memcpy(hdr + 46, &clrs, 4);                     /* biClrUsed */
    memcpy(hdr + 50, &clrs, 4);                     /* biClrImportant */
    FILE *f = fopen(path, "wb");
    if (!f) return false;
    bool ok = (fwrite(hdr, 1, sizeof hdr, f) == sizeof hdr);
    for (int i = 0; i < 256 && ok; i++) {           /* RGBQUAD is B,G,R,reserved */
        unsigned char q[4] = { pal[i][2], pal[i][1], pal[i][0], 0 };
        ok = (fwrite(q, 1, 4, f) == 4);
    }
    unsigned char *row = (unsigned char *)calloc(stride, 1);
    if (!row) { fclose(f); return false; }
    for (unsigned y = 0; y < h && ok; y++) {        /* flip: BMP stores bottom row first */
        const unsigned char *src = rgb_topdown + (size_t)(h - 1 - y) * w * 3;
        const unsigned char *asrc = alpha_topdown ? alpha_topdown + (size_t)(h - 1 - y) * w : NULL;
        for (unsigned x = 0; x < w; x++) {
            if (asrc && asrc[x] < 128) { row[x] = 0; continue; }   /* transparent -> the key index */
            int r = src[x * 3], g = src[x * 3 + 1], b = src[x * 3 + 2];
            /* ToonTalk keys on a COLOUR, not on alpha: palette entry 0 is the transparency index
             * and initialize_palette sets it to black. The retail Playground pictures are saved as
             * fully opaque RGBA PNGs (0% of pixels have alpha < 255) whose background is solid
             * black -- that black IS the intended transparency, and with nearest_index refusing to
             * return 0 it could only come out as a black box. Exact black only: near-black artwork
             * still quantises to a real index, which is what nearest_index's rule was protecting
             * against when the palette it searched was the wrong one. */
            if (r == 0 && g == 0 && b == 0) { row[x] = 0; continue; }
            row[x] = (unsigned char)nearest_index(pal, r, g, b);
        }
        ok = (fwrite(row, 1, stride, f) == stride);
    }
    free(row);
    fclose(f);
    return ok;
}

bool write_bmp24(const char *path, unsigned w, unsigned h, const unsigned char *bgr_topdown) {
    unsigned stride = ((w * 3) + 3) & ~3u;          /* BMP rows are 4-byte aligned */
    unsigned imgsize = stride * h;
    unsigned char hdr[54];
    memset(hdr, 0, sizeof hdr);
    hdr[0] = 'B'; hdr[1] = 'M';
    unsigned filesize = 54 + imgsize;
    memcpy(hdr + 2, &filesize, 4);
    unsigned off = 54; memcpy(hdr + 10, &off, 4);
    unsigned hsize = 40; memcpy(hdr + 14, &hsize, 4);
    memcpy(hdr + 18, &w, 4);
    memcpy(hdr + 22, &h, 4);                        /* positive => bottom-up */
    unsigned short planes = 1, bpp = 24;
    memcpy(hdr + 26, &planes, 2);
    memcpy(hdr + 28, &bpp, 2);
    memcpy(hdr + 34, &imgsize, 4);
    FILE *f = fopen(path, "wb");
    if (!f) return false;
    if (fwrite(hdr, 1, sizeof hdr, f) != sizeof hdr) { fclose(f); return false; }
    unsigned char *row = (unsigned char *)calloc(stride, 1);
    if (!row) { fclose(f); return false; }
    bool ok = true;
    for (unsigned y = 0; y < h && ok; y++) {        /* flip: BMP stores bottom row first */
        memcpy(row, bgr_topdown + (size_t)(h - 1 - y) * w * 3, w * 3);
        ok = (fwrite(row, 1, stride, f) == stride);
    }
    free(row);
    fclose(f);
    return ok;
}

} // namespace

/* Called by the engine once its palette is built, so quantisation targets the colours the
 * blitter will actually use. COLORREF is 0x00BBGGRR. */
extern "C" EMSCRIPTEN_KEEPALIVE void tt_png_set_palette(const unsigned int *colorrefs, int count) {
    if (!colorrefs || count <= 0) return;
    if (count > 256) count = 256;
    for (int i = 0; i < count; i++) {
        unsigned int c = colorrefs[i];
        g_engine_pal[i][0] = (unsigned char)(c & 0xFF);           /* R */
        g_engine_pal[i][1] = (unsigned char)((c >> 8) & 0xFF);    /* G */
        g_engine_pal[i][2] = (unsigned char)((c >> 16) & 0xFF);   /* B */
    }
    for (int i = count; i < 256; i++) { g_engine_pal[i][0] = g_engine_pal[i][1] = g_engine_pal[i][2] = 0; }
    g_have_engine_pal = true;
    nearest_index_reset();   /* memoised answers belong to the OLD palette */
    { static int ap = 0; if (ap < 3) { ap++;   /* the engine re-runs palette init; say so once */
      printf("[tt] png: engine palette adopted (%d entries)\n", count); fflush(stdout); } }
}

/* Is an existing twin usable? Twins written before the 8-bit switch are 24-bit and render as
 * coloured static, so callers must treat those as stale and regenerate rather than reuse. */
extern "C" EMSCRIPTEN_KEEPALIVE int tt_bmp_twin_ok(const char *path) {
    FILE *f = fopen(path, "rb");
    if (!f) return 0;
    unsigned char hdr[54];
    size_t got = fread(hdr, 1, sizeof hdr, f);
    if (got < sizeof hdr || hdr[0] != 'B' || hdr[1] != 'M') { fclose(f); return 0; }
    int bpp = hdr[28] | (hdr[29] << 8);
    if (bpp != 8) { fclose(f); return 0; }        /* 24-bit twin from an older build */
    unsigned twin_version = (unsigned)hdr[38] | ((unsigned)hdr[39] << 8) |
                            ((unsigned)hdr[40] << 16) | ((unsigned)hdr[41] << 24);
    if (twin_version != TT_BMP_TWIN_VERSION) { fclose(f); return 0; }  /* built by an older rule */
    /* A twin also goes stale if it was quantised against a DIFFERENT palette -- the fixed cube
     * before the engine's own table was available, say. The table it carries is the one it was
     * built for, so compare a sample of it; any mismatch means regenerate. */
    if (g_have_engine_pal) {
        unsigned char tbl[256 * 4];
        size_t t = fread(tbl, 1, sizeof tbl, f);
        fclose(f);
        if (t < sizeof tbl) return 0;
        for (int i = 0; i < 256; i++) {
            if (tbl[i * 4 + 0] != g_engine_pal[i][2] ||   /* stored B,G,R */
                tbl[i * 4 + 1] != g_engine_pal[i][1] ||
                tbl[i * 4 + 2] != g_engine_pal[i][0]) return 0;
        }
        return 1;
    }
    fclose(f);
    return 1;
}

/* Decode png_path into a BMP at bmp_path. Returns 1 on success, 0 on any refusal --
 * callers treat 0 as "leave the PNG alone", which keeps an unsupported file merely blank rather
 * than breaking the load. */
extern "C" EMSCRIPTEN_KEEPALIVE int tt_png_to_bmp(const char *png_path, const char *bmp_path) {
    unsigned char *file = NULL; size_t flen = 0;
    if (!read_whole_file(png_path, file, flen)) return 0;
    static const unsigned char sig[8] = { 0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n' };
    if (flen < 8 + 25 || memcmp(file, sig, 8) != 0) { free(file); return 0; }

    unsigned w = 0, h = 0; int depth = 0, colour = -1, interlace = 0;
    unsigned char pal[256 * 3]; int pal_n = 0;
    unsigned char trns[256]; int trns_n = 0;
    unsigned char *idat = NULL; size_t idat_len = 0;

    size_t pos = 8;
    while (pos + 8 <= flen) {
        unsigned clen = rd32be(file + pos);
        const unsigned char *ctype = file + pos + 4;
        const unsigned char *cdata = file + pos + 8;
        if (pos + 12 + (size_t)clen > flen) break;
        if (!memcmp(ctype, "IHDR", 4) && clen >= 13) {
            w = rd32be(cdata); h = rd32be(cdata + 4);
            depth = cdata[8]; colour = cdata[9]; interlace = cdata[12];
        } else if (!memcmp(ctype, "PLTE", 4)) {
            pal_n = (int)(clen / 3); if (pal_n > 256) pal_n = 256;
            memcpy(pal, cdata, (size_t)pal_n * 3);
        } else if (!memcmp(ctype, "tRNS", 4)) {
            trns_n = (int)(clen > 256 ? 256 : clen);
            memcpy(trns, cdata, (size_t)trns_n);
        } else if (!memcmp(ctype, "IDAT", 4)) {
            unsigned char *g = (unsigned char *)realloc(idat, idat_len + clen);
            if (!g) { free(idat); free(file); return 0; }
            idat = g; memcpy(idat + idat_len, cdata, clen); idat_len += clen;
        } else if (!memcmp(ctype, "IEND", 4)) {
            break;
        }
        pos += 12 + (size_t)clen;                   /* length + type + data + CRC */
    }

    if (!idat || !w || !h || depth != 8 || interlace != 0 ||
        (colour != 0 && colour != 2 && colour != 3 && colour != 6)) {
        free(idat); free(file); return 0;
    }
    int channels = (colour == 0) ? 1 : (colour == 2) ? 3 : (colour == 3) ? 1 : 4;
    unsigned rowbytes = w * (unsigned)channels;
    size_t rawlen = (size_t)(rowbytes + 1) * h;
    unsigned char *raw = (unsigned char *)malloc(rawlen);
    if (!raw) { free(idat); free(file); return 0; }
    uLongf got = (uLongf)rawlen;
    int zr = uncompress(raw, &got, idat, (uLong)idat_len);
    free(idat);
    if (zr != Z_OK || got != rawlen || !unfilter(raw, h, rowbytes, (unsigned)channels)) {
        free(raw); free(file); return 0;
    }

    unsigned char *bgr = (unsigned char *)malloc((size_t)w * h * 3);
    unsigned char *alpha = (unsigned char *)malloc((size_t)w * h);
    if (!bgr || !alpha) { free(bgr); free(alpha); free(raw); free(file); return 0; }
    for (unsigned y = 0; y < h; y++) {
        const unsigned char *src = raw + (size_t)y * (rowbytes + 1) + 1;
        unsigned char *dst = bgr + (size_t)y * w * 3;
        for (unsigned x = 0; x < w; x++, dst += 3) {
            int r, g, b, a = 255;
            if (colour == 0)      { r = g = b = src[x]; }
            else if (colour == 2) { r = src[x * 3]; g = src[x * 3 + 1]; b = src[x * 3 + 2]; }
            else if (colour == 3) {
                int i = src[x];
                if (i < pal_n) { r = pal[i * 3]; g = pal[i * 3 + 1]; b = pal[i * 3 + 2]; }
                else           { r = g = b = 0; }
                if (i < trns_n) a = trns[i];
            } else {
                r = src[x * 4]; g = src[x * 4 + 1]; b = src[x * 4 + 2]; a = src[x * 4 + 3];
            }
            composite_over_white(r, g, b, a, dst);   /* writes B,G,R */
            alpha[(size_t)y * w + x] = (unsigned char)a;
        }
    }
    free(raw); free(file);
    /* write_bmp8 wants R,G,B order; the buffer above is B,G,R -- swap in place. */
    for (size_t i = 0; i + 2 < (size_t)w * h * 3; i += 3) {
        unsigned char t = bgr[i]; bgr[i] = bgr[i + 2]; bgr[i + 2] = t;
    }
    int ok = write_bmp8(bmp_path, w, h, bgr, alpha) ? 1 : 0;
    free(bgr); free(alpha);
    if (ok) { printf("[tt] png: decoded %ux%u colour=%d -> %s\n", w, h, colour, bmp_path); fflush(stdout); }
    return ok;
}
