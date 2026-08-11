/* gdi_impl.cpp — a minimal GDI rasterizer for the ToonTalk WASM port.
 *
 * ToonTalk draws the city ground/streets/shapes with GDI (Rectangle/Ellipse/LineTo/PatBlt/
 * BitBlt) on a device context obtained from the DirectDraw back surface (get_device_context ->
 * back_surface->GetDC). The DDraw shim (ddraw_impl.cpp) routes GetDC/ReleaseDC here so those
 * GDI calls actually rasterize onto the surface's 8bpp buffer.
 *
 * Orientation: surface memory is TOP-DOWN (row 0 = top scanline), exactly like real DirectDraw
 * surfaces — the engine's y-up code builds its own bottom-up view over it at Lock time
 * (lock_back_surface: "tt_destination_width = -lPitch // -1 since upside down"), and
 * blt_to_back_surface pre-flips y-up marks into top-down rects. GDI coords are top-down, so
 * pixel (x,y) -> buf[y*w + x] with no flip; the canvas present copies rows straight. Colours:
 * COLORREF -> palette index is nearest-colour against the real DAT palette (gdi_set_palette);
 * luminance is only the pre-palette fallback. Sprite/DIB blits carry palette indices directly. */
#include "windows.h"
#include <cstdlib>
#include <cstring>
#include <cstdio>
#include <cmath>   /* sqrt, for the ellipse/rounded-rect rasterisers */
#include "gdi_font.h"   /* fallback bitmap font for TextOut (tools/make_font.py) */
#include <emscripten.h>

#ifndef NULL_PEN
#define WHITE_BRUSH 0
#define LTGRAY_BRUSH 1
#define GRAY_BRUSH 2
#define DKGRAY_BRUSH 3
#define BLACK_BRUSH 4
#define NULL_BRUSH 5
#define WHITE_PEN 6
#define BLACK_PEN 7
#define NULL_PEN 8
#endif
#ifndef SRCCOPY
#define SRCCOPY 0x00CC0020
#endif
#ifndef PS_NULL
#define PS_NULL 5
#endif

namespace {

enum ObjKind { OBJ_BRUSH, OBJ_PEN, OBJ_BITMAP, OBJ_REGION, OBJ_FONT };

struct GdiObj {
    ObjKind kind;
    /* brush */
    bool pattern;                 /* true = 8x8 index pattern, false = solid */
    unsigned char fill;           /* solid fill index */
    unsigned char pat[64];        /* 8x8 pattern indices */
    bool hollow;                  /* NULL_BRUSH: no fill */
    /* pen */
    unsigned char pen_index;
    bool pen_null;
    /* bitmap */
    unsigned char *bits; int bw, bh; bool owns;
    /* region */
    RECT rgn;
    /* font */
    int font_w, font_h;
    bool font_fixed;              /* FIXED_PITCH: every glyph advances exactly font_w */
};

struct GdiDC {
    unsigned char *pixels; int w, h;   /* target (surface, or a selected bitmap for a memory DC) */
    bool owns_surface_ref;             /* surface DC: don't free pixels */
    GdiObj *brush, *pen, *bitmap, *font;
    int cur_x, cur_y;                  /* MoveToEx */
    int brush_org_x, brush_org_y;
    RECT clip; bool has_clip;
    unsigned char text_index, bk_index; int bk_mode;
};

static GdiObj *g_stock[9];
static bool g_stock_init = false;

static GdiObj *make_solid(unsigned char idx) {
    GdiObj *o = new GdiObj(); memset(o, 0, sizeof(*o));
    o->kind = OBJ_BRUSH; o->fill = idx; return o;
}
static void init_stock() {
    if (g_stock_init) return; g_stock_init = true;
    g_stock[WHITE_BRUSH] = make_solid(255);
    g_stock[LTGRAY_BRUSH] = make_solid(192);
    g_stock[GRAY_BRUSH] = make_solid(128);
    g_stock[DKGRAY_BRUSH] = make_solid(64);
    g_stock[BLACK_BRUSH] = make_solid(0);
    GdiObj *nb = make_solid(0); nb->hollow = true; g_stock[NULL_BRUSH] = nb;
    GdiObj *wp = new GdiObj(); memset(wp, 0, sizeof(*wp)); wp->kind = OBJ_PEN; wp->pen_index = 255; g_stock[WHITE_PEN] = wp;
    GdiObj *bp = new GdiObj(); memset(bp, 0, sizeof(*bp)); bp->kind = OBJ_PEN; bp->pen_index = 0;   g_stock[BLACK_PEN] = bp;
    GdiObj *np = new GdiObj(); memset(np, 0, sizeof(*np)); np->kind = OBJ_PEN; np->pen_null = true;  g_stock[NULL_PEN] = np;
}

static inline unsigned char lum(COLORREF c) { return (unsigned char)(((c & 0xFF) + ((c >> 8) & 0xFF) + ((c >> 16) & 0xFF)) / 3); }

/* COLORREF -> palette index. The engine passes TRUE RGB colorrefs (tt_colors is built from the
 * DAT palette in initialize_palette), so the only faithful mapping is nearest-colour against the
 * REAL palette — the old luminance shortcut was only ever right for the grayscale dev palette
 * (it painted number pads black). ddraw_impl pushes the palette here whenever it is set. */
static unsigned char g_pal[256][3];
static bool g_pal_set = false;
static unsigned char nearest_index(int r, int g, int b) {
    int best = 0; long bestd = 0x7FFFFFFF;
    for (int i = 0; i < 256; i++) {
        int dr = r - g_pal[i][0], dg = g - g_pal[i][1], db = b - g_pal[i][2];
        long d = (long)dr*dr + (long)dg*dg + (long)db*db;
        if (d < bestd) { bestd = d; best = i; if (d == 0) break; }
    }
    return (unsigned char)best;
}
static unsigned char colorref_to_index(COLORREF c) {
    if ((c >> 24) == 1) return (unsigned char)(c & 0xFF);       /* PALETTEINDEX(i) */
    int r = c & 0xFF, g = (c >> 8) & 0xFF, b = (c >> 16) & 0xFF;
    if (!g_pal_set) return lum(c);
    static COLORREF last_c = 0xFFFFFFFF; static unsigned char last_i = 0;   /* 1-entry cache */
    if (c == last_c) return last_i;
    last_c = c; last_i = nearest_index(r, g, b);
    return last_i;
}

static inline void put(GdiDC *dc, int x, int y, unsigned char idx) {
    if (!dc->pixels || x < 0 || y < 0 || x >= dc->w || y >= dc->h) return;
    if (dc->has_clip && (x < dc->clip.left || x >= dc->clip.right || y < dc->clip.top || y >= dc->clip.bottom)) return;
    dc->pixels[y * dc->w + x] = idx;   /* top-down: surface row 0 = top scanline (matches DDraw + present) */
}
static inline unsigned char get(GdiDC *dc, int x, int y) {
    if (!dc->pixels || x < 0 || y < 0 || x >= dc->w || y >= dc->h) return 0;
    return dc->pixels[y * dc->w + x];
}
static void fill_rect(GdiDC *dc, int l, int t, int r, int b) {
    GdiObj *br = dc->brush;
    if (br && br->hollow) return;
    if (l > r) { int s = l; l = r; r = s; } if (t > b) { int s = t; t = b; b = s; }
    for (int y = t; y < b; y++)
        for (int x = l; x < r; x++) {
            unsigned char idx;
            if (br && br->pattern) {
                int px = ((x - dc->brush_org_x) & 7), py = ((y - dc->brush_org_y) & 7);
                idx = br->pat[py * 8 + px];
            } else idx = br ? br->fill : 0;
            put(dc, x, y, idx);
        }
}
static void draw_line(GdiDC *dc, int x0, int y0, int x1, int y1) {
    GdiObj *pen = dc->pen;
    if (pen && pen->pen_null) return;
    unsigned char c = pen ? pen->pen_index : 0;
    int dx = abs(x1 - x0), dy = -abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy;
    for (;;) { put(dc, x0, y0, c); if (x0 == x1 && y0 == y1) break; int e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
}

} /* namespace */

/* ---- entry points used by ddraw_impl for surface DCs ---- */
extern "C" void gdi_set_palette(const unsigned char *rgb_triples /* 256*3 */) {
    for (int i = 0; i < 256; i++) {
        g_pal[i][0] = rgb_triples[i * 3];
        g_pal[i][1] = rgb_triples[i * 3 + 1];
        g_pal[i][2] = rgb_triples[i * 3 + 2];
    }
    g_pal_set = true;
    /* retune the stock objects from fixed grayscale indices to the real palette */
    init_stock();
    g_stock[WHITE_BRUSH]->fill  = nearest_index(255, 255, 255);
    g_stock[LTGRAY_BRUSH]->fill = nearest_index(192, 192, 192);
    g_stock[GRAY_BRUSH]->fill   = nearest_index(128, 128, 128);
    g_stock[DKGRAY_BRUSH]->fill = nearest_index(64, 64, 64);
    g_stock[BLACK_BRUSH]->fill  = nearest_index(0, 0, 0);
    g_stock[WHITE_PEN]->pen_index = nearest_index(255, 255, 255);
    g_stock[BLACK_PEN]->pen_index = nearest_index(0, 0, 0);
}

extern "C" HDC gdi_create_surface_dc(unsigned char *pixels, int w, int h) {
    init_stock();
    GdiDC *dc = new GdiDC(); memset(dc, 0, sizeof(*dc));
    dc->pixels = pixels; dc->w = w; dc->h = h; dc->owns_surface_ref = true;
    dc->brush = g_stock[WHITE_BRUSH]; dc->pen = g_stock[BLACK_PEN];
    return (HDC)dc;
}
extern "C" void gdi_release_surface_dc(HDC hdc) { if (hdc) delete (GdiDC *)hdc; }

/* ---- GDI functions (names match shim/windows.h; extern "C" so unmangled) ---- */
extern "C" {

HDC CreateCompatibleDC(HDC) {
    init_stock();
    GdiDC *dc = new GdiDC(); memset(dc, 0, sizeof(*dc));
    dc->brush = g_stock[WHITE_BRUSH]; dc->pen = g_stock[BLACK_PEN];
    return (HDC)dc;
}
BOOL DeleteDC(HDC hdc) { if (hdc) delete (GdiDC *)hdc; return 1; }

HBITMAP CreateCompatibleBitmap(HDC, int w, int h) {
    GdiObj *o = new GdiObj(); memset(o, 0, sizeof(*o));
    o->kind = OBJ_BITMAP; o->bw = w > 0 ? w : 1; o->bh = h > 0 ? h : 1;
    o->bits = (unsigned char *)calloc((size_t)o->bw * o->bh, 1); o->owns = true;
    return (HBITMAP)o;
}
HBITMAP CreateDIBitmap(HDC, const BITMAPINFOHEADER *bmih, DWORD init, const void *bits, const BITMAPINFO *, UINT) {
    GdiObj *o = new GdiObj(); memset(o, 0, sizeof(*o));
    o->kind = OBJ_BITMAP;
    o->bw = bmih ? (int)bmih->biWidth : 1; o->bh = bmih ? (int)(bmih->biHeight < 0 ? -bmih->biHeight : bmih->biHeight) : 1;
    if (o->bw < 1) o->bw = 1; if (o->bh < 1) o->bh = 1;
    o->bits = (unsigned char *)calloc((size_t)o->bw * o->bh, 1); o->owns = true;
    if (init && bits) {                       /* CBM_INIT: 8bpp bottom-up rows padded to 4 bytes */
        int pitch = (o->bw + 3) & ~3;
        for (int y = 0; y < o->bh; y++) memcpy(o->bits + (size_t)y * o->bw, (const unsigned char *)bits + (size_t)y * pitch, o->bw);
    }
    return (HBITMAP)o;
}

HGDIOBJ GetStockObject(int i) { init_stock(); return (i >= 0 && i < 9) ? (HGDIOBJ)g_stock[i] : (HGDIOBJ)g_stock[NULL_BRUSH]; }
HBRUSH  CreateSolidBrush(COLORREF c) { return (HBRUSH)make_solid(colorref_to_index(c)); }
HPEN    CreatePen(int style, int, COLORREF c) { GdiObj *o = new GdiObj(); memset(o, 0, sizeof(*o)); o->kind = OBJ_PEN; o->pen_index = colorref_to_index(c); o->pen_null = (style == PS_NULL); return (HPEN)o; }
HBRUSH  CreateDIBPatternBrush(HGLOBAL packed, UINT) {
    GdiObj *o = new GdiObj(); memset(o, 0, sizeof(*o)); o->kind = OBJ_BRUSH; o->pattern = true;
    if (packed) { const unsigned char *p = (const unsigned char *)packed + 1064 /*dib_header_size*/; memcpy(o->pat, p, 64); }
    return (HBRUSH)o;
}

/* Text: rasterize with the embedded bitmap font, integer-scaled toward the requested LOGFONT
 * height (balloons/pads/labels are legible without a real font engine). Colour comes from
 * SetTextColor via the same luminance mapping the brushes use. */
/* Three Arial-Bold base sizes (8x12, 16x24, 32x48). The requested LOGFONT width AND height are
 * honored EXACTLY by resampling the best base glyph to the target cell (nearest neighbor).
 * Integer height-only scaling made every drawn size a lie: the engine's fit-text-to-pad math
 * (correct_font_size, get_extent_size, the shrink-and-grow gate that checks whether the fitted
 * font got skinny) computes exact sizes and expects the font to draw at them — quantized cells
 * overflowed pads and kept the shrinking-digits path from ever triggering. */
struct FontPick { int base; int cw, ch; int fx; };
static FontPick pick_font(GdiDC *dc) {
    int h = (dc && dc->font && dc->font->font_h > 0) ? dc->font->font_h : TT_FONT8_H;
    int w = (dc && dc->font && dc->font->font_w > 0) ? dc->font->font_w : (h * 2) / 3;
    if (h < 2) h = 2; if (h > 600) h = 600;
    if (w < 1) w = 1; if (w > 600) w = 600;
    FontPick p; p.cw = w; p.ch = h;
    p.fx = (dc && dc->font && dc->font->font_fixed) ? 1 : 0;
    p.base = (h >= TT_FONT32_H) ? 2 : (h >= TT_FONT16_H) ? 1 : 0;
    return p;
}
/* ---- real text: rasterize with the BROWSER's font engine -------------------------------------
 * The three embedded 1-bit bitmaps below are a stopgap: point-sampling an 8x12/16x24/32x48 glyph
 * up to an arbitrary cell gives jagged edges, and drawing every character on the same fixed-width
 * cell makes proportional text monospace (Ken's screenshot: the port reads "^ 1 0" where the
 * original reads "^10"). It also has no descent allowance, which is why subtitle descenders were
 * clipped. So ask the browser to draw the run with a real typeface at the exact requested size,
 * and blend the coverage it returns into the palette.
 *
 * GDI's lfWidth semantics: a non-zero average character width means the face is scaled so its
 * AVERAGE character comes out that wide -- per-character widths stay proportional. The first
 * version instead stretched every RUN to exactly len*cw, and the extent functions reported the
 * same len*cw without looking at the string. Self-consistent, but every string measured as if
 * monospaced: lowercase-heavy text reported far wider than it renders, the engine broke lines
 * early, and the mission story needed four lines where the original needs three -- the last one
 * fell off the screen (Ken: "One of them has the text truncated"). Both sides now use the same
 * honest rule: width(s) = measureText(s) * (cw / natural average character width). */
/* The GDI-faithful pixel width of a run: measureText * the lfWidth scale. fixed selects the
 * monospace face, as GDI's FIXED_PITCH does -- there every advance IS the average, so the scale
 * rule makes each glyph exactly cell_w wide, the original's fit guarantee for button letters. */
EM_JS(int, tt_text_hwidth, (const unsigned short *text, int len, int cell_h, int cell_w, int fixed), {
  try {
    if (len <= 0) return 0;
    var s = '';
    for (var i = 0; i < len; i++) s += String.fromCharCode(HEAPU16[(text >> 1) + i]);
    var g = Module.TT_txt;
    if (!g) {
      g = Module.TT_txt = {};
      g.cv = document.createElement('canvas');
      g.cx = g.cv.getContext('2d', { willReadFrequently: true });
      g.avg = {};
    }
    var cx = g.cx, px = cell_h;
    var fam = fixed ? '"Courier New", "Consolas", monospace'
                    : '"Arial", "Helvetica", "Liberation Sans", sans-serif';
    cx.font = 'bold ' + px + 'px ' + fam;
    var mm = cx.measureText(s);
    /* Shrink to avoid clipping EXACTLY as tt_text_raster does. It reduces px when the real
     * ascent+descent overflows the cell, then draws at the smaller size -- and this function used
     * to measure at the unreduced size, so whenever that shrink fired the text was DRAWN narrower
     * than it was MEASURED. Anything positioned from the measurement then sat too far right: Ken's
     * puzzle 1 goal, which should cover "#######", started a character late. Puzzles 2 and 3 were
     * fine because their cells are shallower relative to the glyphs and the shrink never fired. */
    var asc0 = mm.actualBoundingBoxAscent, desc0 = mm.actualBoundingBoxDescent;
    if (!(asc0 > 0)) asc0 = px * 0.75;
    if (!(desc0 >= 0)) desc0 = px * 0.25;
    if (asc0 + desc0 > cell_h && asc0 + desc0 > 0) {
      px = Math.max(1, Math.floor(px * cell_h / (asc0 + desc0)));
      cx.font = 'bold ' + px + 'px ' + fam;
      mm = cx.measureText(s);
    }
    var natural = mm.width;
    var sx = 1;
    if (cell_w > 0) {
      var k = px + (fixed ? 'f' : 'p');
      var a = g.avg[k];
      if (!a) {
        a = cx.measureText('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ').width / 52;
        if (!(a > 0)) a = px * 0.55;
        g.avg[k] = a;
      }
      sx = cell_w / a;
    }
    return Math.ceil(natural * sx);
  } catch (e) { return len * (cell_w > 0 ? cell_w : cell_h); }
});

EM_JS(int, tt_text_raster, (const unsigned short *text, int len, int cell_h, int cell_w,
                            unsigned char *out, int out_w, int out_h, int fixed), {
  try {
    if (len <= 0 || out_w <= 0 || out_h <= 0) return 0;
    var s = '';
    for (var i = 0; i < len; i++) s += String.fromCharCode(HEAPU16[(text >> 1) + i]);
    var g = Module.TT_txt;
    if (!g) {
      g = Module.TT_txt = {};
      g.cv = document.createElement('canvas');
      g.cx = g.cv.getContext('2d', { willReadFrequently: true });
      g.avg = {};
    }
    if (g.cv.width < out_w || g.cv.height < out_h) {
      g.cv.width = Math.max(g.cv.width, out_w);
      g.cv.height = Math.max(g.cv.height, out_h);
    }
    var cx = g.cx;
    var fam = fixed ? '"Courier New", "Consolas", monospace'
                    : '"Arial", "Helvetica", "Liberation Sans", sans-serif';
    var px = cell_h;
    cx.font = 'bold ' + px + 'px ' + fam;
    var m = cx.measureText(s);
    var asc = m.actualBoundingBoxAscent, desc = m.actualBoundingBoxDescent;
    if (!(asc > 0)) asc = px * 0.75;
    if (!(desc >= 0)) desc = px * 0.25;
    if (asc + desc > cell_h && asc + desc > 0) {          /* shrink only to avoid clipping */
      px = Math.max(1, Math.floor(px * cell_h / (asc + desc)));
      cx.font = 'bold ' + px + 'px ' + fam;
      m = cx.measureText(s);
      asc = m.actualBoundingBoxAscent; if (!(asc > 0)) asc = px * 0.75;
      desc = m.actualBoundingBoxDescent; if (!(desc >= 0)) desc = px * 0.25;
    }
    if (!(m.width > 0)) return 0;
    /* lfWidth as GDI means it: scale so the AVERAGE character is cell_w wide. The same factor the
     * extent functions report, so drawn width == measured width for every string. */
    var sx = 1;
    if (cell_w > 0) {
      var k2 = px + (fixed ? 'f' : 'p');
      var a = g.avg[k2];
      if (!a) {
        a = cx.measureText('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ').width / 52;
        if (!(a > 0)) a = px * 0.55;
        g.avg[k2] = a;
      }
      sx = cell_w / a;
    }
    /* Vertical: ink centred in the cell (measured on the pads and approved). Horizontal: runs
     * draw at the origin as GDI does -- line breaking is the engine's job and extents are honest
     * now -- but a SINGLE character keeps the ink-centring in its cw cell: the number display
     * lays digits on its own fixed cell grid (number.cpp places each digit at i*character_width),
     * and drawing a lone digit at the origin of that cell put it back 10px left of centre. */
    /* GDI TA_TOP geometry, NOT ink-centring: the baseline hangs tmAscent (4/5 of the
     * cell, exactly what GetTextMetricsA reports) below the cell top. Low-ink glyphs
     * are why this matters: number.cpp draws the fraction bar as '_' IN THE NUMERATOR'S
     * OWN CELL, relying on underscore ink living in the descent zone BELOW the digits;
     * centring floated the bar to mid-cell (striking through the numerator) and slid
     * digit ink down enough that stacked numerator/denominator overlapped (Ken's 3/2
     * screenshots). Full-height glyphs move barely at all, so pad digits stay put. */
    var base = cell_h * 0.9;   /* Arial's real ascent is 0.905em: 0.8 sat the ink ~10% high
                                  in every cell, shaving the fraction's top margin (Ken's
                                  side-by-side with the retail original) */
    if (base < asc) base = asc;
    if (base + desc > cell_h) base = cell_h - desc;
    var originX = 0;
    if (len === 1 && cell_w > 0) {
      var inkL = m.actualBoundingBoxLeft, inkR = m.actualBoundingBoxRight;
      if (!isFinite(inkL) || !isFinite(inkR)) { inkL = 0; inkR = m.width; }
      originX = cell_w / (2 * sx) - (inkR - inkL) / 2;   /* ink centred in the digit cell */
    }
    cx.setTransform(1, 0, 0, 1, 0, 0);
    cx.clearRect(0, 0, out_w, out_h);
    cx.fillStyle = '#fff';
    cx.textBaseline = 'alphabetic';
    cx.setTransform(sx, 0, 0, 1, 0, 0);
    cx.fillText(s, originX, base);
    cx.setTransform(1, 0, 0, 1, 0, 0);
    var img = cx.getImageData(0, 0, out_w, out_h).data;
    for (var k = 0, n = out_w * out_h; k < n; k++) HEAPU8[out + k] = img[k * 4 + 3];  /* alpha */
    return 1;
  } catch (e) { return 0; }
});

static unsigned char *g_txt_buf = 0;
static int g_txt_cap = 0;
static unsigned char *txt_buf(int need) {
    if (need > g_txt_cap) {
        unsigned char *p = (unsigned char *)realloc(g_txt_buf, need);
        if (!p) return 0;
        g_txt_buf = p; g_txt_cap = need;
    }
    return g_txt_buf;
}

/* Blend ink over what is already there, by coverage, then snap to the palette. The original ran
 * this text through GDI on whatever depth the machine had; anti-aliasing within the 256 entries
 * is as close as an 8-bit surface gets. */
static void blend_put(GdiDC *dc, int x, int y, int ir, int ig, int ib, int a) {
    if (a <= 8) return;
    if (a >= 248 || !g_pal_set) { put(dc, x, y, dc->text_index); return; }
    unsigned char d = get(dc, x, y);
    int dr = g_pal[d][0], dg = g_pal[d][1], db = g_pal[d][2];
    int r = (ir * a + dr * (255 - a)) / 255;
    int g = (ig * a + dg * (255 - a)) / 255;
    int b = (ib * a + db * (255 - a)) / 255;
    put(dc, x, y, nearest_index(r, g, b));
}

/* Returns false if the browser could not draw it, so the caller falls back to the bitmap font. */
static bool draw_text_run(GdiDC *dc, int x, int y, const unsigned short *u16, int len, const FontPick &p) {
    if (len <= 0) return true;
    /* the buffer must fit the HONEST width -- the same number the extent functions report --
     * and for a lone digit the whole cw cell, since the glyph is centred within it */
    int w = tt_text_hwidth(u16, len, p.ch, p.cw, p.fx) + 2, h = p.ch;
    if (len == 1 && p.cw + 2 > w) w = p.cw + 2;
    if (w <= 2) return true;                    /* nothing to draw (spaces measure fine) */
    if (h <= 0 || w > 4096 || h > 1024) return false;
    unsigned char *cov = txt_buf(w * h);
    if (!cov) return false;
    if (!tt_text_raster(u16, len, p.ch, p.cw, cov, w, h, p.fx)) return false;
    int ir = g_pal_set ? g_pal[dc->text_index][0] : 255;
    int ig = g_pal_set ? g_pal[dc->text_index][1] : 255;
    int ib = g_pal_set ? g_pal[dc->text_index][2] : 255;
    for (int ty = 0; ty < h; ty++)
        for (int tx = 0; tx < w; tx++) {
            int a = cov[ty * w + tx];
            if (a) blend_put(dc, x + tx, y + ty, ir, ig, ib, a);
        }
    return true;
}

static void draw_glyph(GdiDC *dc, int x, int y, unsigned int ch, const FontPick &p, unsigned char color) {
    if (ch < 32 || ch > 255) {
        if (ch == 0 || ch == '\r' || ch == '\n') return;
        /* Ken 2026-07-22: a held long pad rendered as all '?'s — every substitution here means
         * the caller handed us a bogus code unit (dangling/misread string). Log the raw value
         * so the next occurrence identifies the call site and pattern. */
        { static int qm_log = 0;
          if (qm_log < 40) { qm_log++;
            printf("[tt] glyph?: ch=0x%x cw=%d chh=%d at(%d,%d)\n", ch, p.cw, p.ch, x, y);
            fflush(stdout); } }
        ch = '?';
    }   /* Latin-1 coverage */
    int i = (int)ch - 32;
    int bw = (p.base == 2) ? TT_FONT32_W : (p.base == 1) ? TT_FONT16_W : TT_FONT8_W;
    int bh = (p.base == 2) ? TT_FONT32_H : (p.base == 1) ? TT_FONT16_H : TT_FONT8_H;
    unsigned int top = 1u << (bw - 1);
    for (int ty = 0; ty < p.ch; ty++) {
        int gy = (ty * bh) / p.ch;
        unsigned int bits = (p.base == 2) ? tt_font32[i][gy] : (p.base == 1) ? (unsigned int)tt_font16[i][gy] : (unsigned int)tt_font8[i][gy];
        if (!bits) continue;
        for (int tx = 0; tx < p.cw; tx++) {
            int gx = (tx * bw) / p.cw;
            if (bits & (top >> gx)) put(dc, x + tx, y + ty, color);
        }
    }
}

/* Fonts: we don't rasterize vector glyphs, but MainWindow::set_font reads back the metrics
 * (character_width = tmAveCharWidth) and place_text divides max_width by them — so track the
 * requested size and report non-zero metrics, or text layout divides by zero. */
HFONT CreateFontIndirectA(const LOGFONTA *lf) {
    GdiObj *o = new GdiObj(); memset(o, 0, sizeof(*o)); o->kind = OBJ_FONT;
    int h = lf ? (lf->lfHeight < 0 ? -lf->lfHeight : lf->lfHeight) : 0;
    int w = lf ? (lf->lfWidth  < 0 ? -lf->lfWidth  : lf->lfWidth ) : 0;
    /* lfHeight is in LOGICAL UNITS -- pixels under MM_TEXT -- not points. The engine's
     * set_font (winmain.cpp:5548) multiplies its pixel cell by -72/96 believing it is
     * converting to points, so on real Windows every font came out 3/4 of the layout
     * cell and EVERYTHING was tuned around that: number.cpp measures the digit extent
     * and derives digit_height_to_character_height (~0.75) from it, and the stacked
     * fraction pitch (0.6ch numerator step... the whole constant zoo) only clears when
     * the glyphs really are that size. This shim used to "correct" the units back
     * (x96/72), drawing 4/3-size glyphs whose measured extents made dh2ch=1.0 -- single
     * lines self-compensated through the measure-fit loops, but the fraction stack
     * overlapped exactly as Ken's 3/2 screenshots show (36px cells on a 22px pitch).
     * Report and draw what GDI would: |lfHeight| pixels. */
    o->font_h = h; if (o->font_h < 1) o->font_h = 12;
    o->font_w = w; if (o->font_w < 1) o->font_w = o->font_h / 2;
    /* FIXED_PITCH is how the original GUARANTEES a fit: set_font(width,height,TRUE,TRUE) sizes a
     * monospace face so every glyph -- W included -- advances exactly lfWidth, and place_character
     * hands it the whole button box. Rendering everything proportional made W ~1.7x the average
     * width and it overflowed Pumpy's keycap (Ken item 1). */
    o->font_fixed = lf && ((lf->lfPitchAndFamily & 0x3) == FIXED_PITCH);
    return (HFONT)o;
}
BOOL GetTextMetricsA(HDC hdc, LPTEXTMETRICA tm) {
    GdiDC *dc = (GdiDC *)hdc;
    FontPick p = pick_font(dc);              /* report what TextOut actually draws */
    if (tm) { memset(tm, 0, sizeof(*tm));
        tm->tmHeight = p.ch; tm->tmAscent = (p.ch * 9) / 10;   /* Arial: ascent 0.905em */
        tm->tmDescent = p.ch - tm->tmAscent;
        tm->tmAveCharWidth = p.cw; tm->tmMaxCharWidth = p.cw; }
    return 1;
}

BOOL TextOutA(HDC hdc, int x, int y, LPCSTR str, int len) {
    GdiDC *dc = (GdiDC *)hdc; if (!dc || !str) return 0;
    FontPick p = pick_font(dc);
    {   /* widen to UTF-16 for the browser rasterizer; Latin-1 maps straight across */
        unsigned short stack[128];
        unsigned short *u = (len <= 128) ? stack : (unsigned short *)malloc(len * sizeof(unsigned short));
        if (u) {
            for (int i = 0; i < len; i++) u[i] = (unsigned char)str[i];
            bool ok = draw_text_run(dc, x, y, u, len, p);
            if (u != stack) free(u);
            if (ok) return 1;
        }
    }
    for (int i = 0; i < len; i++)     /* fallback: the embedded bitmap font */
        draw_glyph(dc, x + i * p.cw, y, (unsigned char)str[i], p, dc->text_index);
    return 1;
}
BOOL TextOutW(HDC hdc, int x, int y, const wchar_t *str, int len) {
    GdiDC *dc = (GdiDC *)hdc; if (!dc || !str) return 0;
    FontPick p = pick_font(dc);
    {
        unsigned short stack[128];
        unsigned short *u = (len <= 128) ? stack : (unsigned short *)malloc(len * sizeof(unsigned short));
        if (u) {
            for (int i = 0; i < len; i++) u[i] = (unsigned short)str[i];
            bool ok = draw_text_run(dc, x, y, u, len, p);
            if (u != stack) free(u);
            if (ok) return 1;
        }
    }
    for (int i = 0; i < len; i++)     /* fallback: the embedded bitmap font */
        draw_glyph(dc, x + i * p.cw, y, (unsigned int)str[i], p, dc->text_index);
    return 1;
}
LONG TabbedTextOutA(HDC hdc, int x, int y, LPCSTR str, int len, int, const INT *, int) {
    TextOutA(hdc, x, y, str, len); return 0;
}
LONG TabbedTextOutW(HDC hdc, int x, int y, const wchar_t *str, int len, int, const INT *, int) {
    TextOutW(hdc, x, y, str, len); return 0;
}
/* Extents MEASURE THE STRING now. The old len*cw answer treated every font as monospace, so
 * lowercase-heavy text reported far wider than it renders; the engine broke lines early and the
 * mission story lost its last line off the bottom of the screen. */
BOOL GetTextExtentPoint32A(HDC hdc, LPCSTR str, int len, LPSIZE sz) {
    FontPick p = pick_font((GdiDC *)hdc);
    if (!sz) return 1;
    sz->cx = len * p.cw; sz->cy = p.ch;          /* fallback if there is nothing to measure */
    if (str && len > 0 && len <= 4096) {
        unsigned short stack[256];
        unsigned short *u = (len <= 256) ? stack : (unsigned short *)malloc(len * sizeof(unsigned short));
        if (u) {
            for (int i = 0; i < len; i++) u[i] = (unsigned char)str[i];
            sz->cx = tt_text_hwidth(u, len, p.ch, p.cw, p.fx);
            if (u != stack) free(u);
        }
    }
    return 1;
}
BOOL GetTextExtentPoint32W(HDC hdc, const wchar_t *str, int len, LPSIZE sz) {
    FontPick p = pick_font((GdiDC *)hdc);
    if (!sz) return 1;
    sz->cx = len * p.cw; sz->cy = p.ch;
    if (str && len > 0 && len <= 4096) {
        unsigned short stack[256];
        unsigned short *u = (len <= 256) ? stack : (unsigned short *)malloc(len * sizeof(unsigned short));
        if (u) {
            for (int i = 0; i < len; i++) u[i] = (unsigned short)str[i];
            sz->cx = tt_text_hwidth(u, len, p.ch, p.cw, p.fx);
            if (u != stack) free(u);
        }
    }
    return 1;
}
UINT SetTextAlign(HDC, UINT) { return 0; }

HGDIOBJ SelectObject(HDC hdc, HGDIOBJ obj) {
    GdiDC *dc = (GdiDC *)hdc; GdiObj *o = (GdiObj *)obj; if (!dc || !o) return NULL;
    GdiObj *prev = NULL;
    switch (o->kind) {
        case OBJ_BRUSH:  prev = dc->brush; dc->brush = o; break;
        case OBJ_PEN:    prev = dc->pen;   dc->pen = o;   break;
        case OBJ_BITMAP: prev = dc->bitmap; dc->bitmap = o; dc->pixels = o->bits; dc->w = o->bw; dc->h = o->bh; break;
        case OBJ_FONT:   prev = dc->font;  dc->font = o;   break;
        case OBJ_REGION: break;
    }
    return (HGDIOBJ)prev;
}
BOOL DeleteObject(HGDIOBJ obj) {
    GdiObj *o = (GdiObj *)obj; if (!o) return 0;
    for (int i = 0; i < 9; i++) if (g_stock[i] == o) return 1;   /* never delete stock */
    if (o->kind == OBJ_BITMAP && o->owns) free(o->bits);
    delete o; return 1;
}

BOOL Rectangle(HDC hdc, int l, int t, int r, int b) {
    GdiDC *dc = (GdiDC *)hdc; if (!dc) return 0;
    fill_rect(dc, l, t, r, b);
    /* outline with pen */
    draw_line(dc, l, t, r - 1, t); draw_line(dc, l, b - 1, r - 1, b - 1);
    draw_line(dc, l, t, l, b - 1); draw_line(dc, r - 1, t, r - 1, b - 1);
    return 1;
}
/* Real ellipses and rounded rectangles. These were both "filled bounding box (good enough for boot
 * visuals)" -- fine while nothing but the boot screen used them, but the Pictures notebook's first
 * page is SYNTHETIC SHAPES, drawn with exactly these calls, so every circle and rounded rectangle
 * came out a hard black box (Ken). Scanline fill from the ellipse equation, then an outline pass
 * so the pen still shows, matching Rectangle's fill-then-outline order above. */
static void ellipse_spans(GdiDC *dc, int l, int t, int r, int b, bool outline_only) {
    GdiObj *br = dc->brush, *pn = dc->pen;
    if (!outline_only && br && br->hollow) return;
    if (outline_only && pn && pn->pen_null) return;
    unsigned char fill_c = br ? br->fill : 0;
    unsigned char pen_c = pn ? pn->pen_index : 0;
    int w = r - l, h = b - t;
    if (w <= 0 || h <= 0) return;
    double cx = l + w / 2.0, cy = t + h / 2.0;
    double rx = w / 2.0, ry = h / 2.0;
    if (rx < 0.5 || ry < 0.5) return;
    int prev_x0 = -1, prev_x1 = -1;
    for (int y = t; y < b; y++) {
        double dy = (y + 0.5 - cy) / ry;
        double s = 1.0 - dy * dy;
        if (s <= 0.0) continue;
        double dx = rx * sqrt(s);
        int x0 = (int)(cx - dx + 0.5), x1 = (int)(cx + dx + 0.5);
        if (x1 <= x0) x1 = x0 + 1;
        if (!outline_only) {
            for (int x = x0; x < x1; x++) put(dc, x, y, fill_c);
        } else {
            /* edge pixels of this row, plus the horizontal run needed to close the gap against
             * the previous row so steep top/bottom arcs do not come out dotted */
            put(dc, x0, y, pen_c);
            put(dc, x1 - 1, y, pen_c);
            if (prev_x0 >= 0) {
                for (int x = (x0 < prev_x0 ? x0 : prev_x0); x < (x0 > prev_x0 ? x0 : prev_x0); x++)
                    put(dc, x, y, pen_c);
                for (int x = (x1 < prev_x1 ? x1 : prev_x1); x < (x1 > prev_x1 ? x1 : prev_x1); x++)
                    put(dc, x - 1, y, pen_c);
            }
        }
        prev_x0 = x0; prev_x1 = x1;
    }
}

BOOL Ellipse(HDC hdc, int l, int t, int r, int b) {
    GdiDC *dc = (GdiDC *)hdc; if (!dc) return 0;
    ellipse_spans(dc, l, t, r, b, false);
    ellipse_spans(dc, l, t, r, b, true);
    return 1;
}

BOOL RoundRect(HDC hdc, int l, int t, int r, int b, int ew, int eh) {
    GdiDC *dc = (GdiDC *)hdc; if (!dc) return 0;
    GdiObj *br = dc->brush, *pn = dc->pen;
    unsigned char fill_c = br ? br->fill : 0;
    unsigned char pen_c = pn ? pn->pen_index : 0;
    int w = r - l, h = b - t;
    if (w <= 0 || h <= 0) return 1;
    if (ew < 0) ew = 0; if (eh < 0) eh = 0;
    if (ew > w) ew = w; if (eh > h) eh = h;
    if (ew < 2 || eh < 2) return Rectangle(hdc, l, t, r, b);   /* corners too small to round */
    int rx = ew / 2, ry = eh / 2;
    /* body: the cross of two rectangles, then the four corner quadrants from the ellipse fill.
     * NULL_BRUSH must skip all of it -- fill_rect already returns early for a hollow brush, and
     * the corner loop below has to do the same or it paints index 0 into each corner, which is
     * exactly the "extra black areas" Ken saw on the rounded-rectangle page. */
    bool hollow = (br && br->hollow);
    if (!hollow) {
        fill_rect(dc, l + rx, t, r - rx, b);
        fill_rect(dc, l, t + ry, r, b - ry);
    }
    for (int y = 0; !hollow && y < ry; y++) {
        double dy = (ry - y - 0.5) / (double)ry;
        double s = 1.0 - dy * dy;
        if (s <= 0.0) continue;
        int dx = (int)(rx * sqrt(s) + 0.5);
        for (int x = l + rx - dx; x < l + rx; x++) { put(dc, x, t + y, fill_c); put(dc, x, b - 1 - y, fill_c); }
        for (int x = r - rx; x < r - rx + dx; x++) { put(dc, x, t + y, fill_c); put(dc, x, b - 1 - y, fill_c); }
    }
    /* outline: straight runs plus the corner arcs */
    draw_line(dc, l + rx, t, r - rx - 1, t);
    draw_line(dc, l + rx, b - 1, r - rx - 1, b - 1);
    draw_line(dc, l, t + ry, l, b - ry - 1);
    draw_line(dc, r - 1, t + ry, r - 1, b - ry - 1);
    for (int y = 0; y < ry; y++) {
        double dy = (ry - y - 0.5) / (double)ry;
        double s = 1.0 - dy * dy;
        if (s <= 0.0) continue;
        int dx = (int)(rx * sqrt(s) + 0.5);
        put(dc, l + rx - dx, t + y, pen_c);
        put(dc, r - rx + dx - 1, t + y, pen_c);
        put(dc, l + rx - dx, b - 1 - y, pen_c);
        put(dc, r - rx + dx - 1, b - 1 - y, pen_c);
    }
    return 1;
}
BOOL MoveToEx(HDC hdc, int x, int y, LPPOINT pt) { GdiDC *dc = (GdiDC *)hdc; if (!dc) return 0; if (pt) { pt->x = dc->cur_x; pt->y = dc->cur_y; } dc->cur_x = x; dc->cur_y = y; return 1; }
BOOL LineTo(HDC hdc, int x, int y) { GdiDC *dc = (GdiDC *)hdc; if (!dc) return 0; draw_line(dc, dc->cur_x, dc->cur_y, x, y); dc->cur_x = x; dc->cur_y = y; return 1; }

COLORREF SetPixel(HDC hdc, int x, int y, COLORREF c) { GdiDC *dc = (GdiDC *)hdc; if (dc) put(dc, x, y, lum(c)); return c; }
COLORREF GetPixel(HDC hdc, int x, int y) { GdiDC *dc = (GdiDC *)hdc; unsigned char v = dc ? get(dc, x, y) : 0; return RGB(v, v, v); }

BOOL BitBlt(HDC hdcD, int x, int y, int cx, int cy, HDC hdcS, int x1, int y1, DWORD rop) {
    GdiDC *d = (GdiDC *)hdcD, *s = (GdiDC *)hdcS; if (!d) return 0;
    if (rop == 0x00000042 /*BLACKNESS*/ || !s || !s->pixels) { for (int j = 0; j < cy; j++) for (int i = 0; i < cx; i++) put(d, x + i, y + j, 0); return 1; }
    for (int j = 0; j < cy; j++) for (int i = 0; i < cx; i++) put(d, x + i, y + j, get(s, x1 + i, y1 + j));   /* SRCCOPY */
    return 1;
}

COLORREF SetBkColor(HDC hdc, COLORREF c) { GdiDC *dc = (GdiDC *)hdc; unsigned char p = dc ? dc->bk_index : 0; if (dc) dc->bk_index = colorref_to_index(c); return RGB(p, p, p); }
int      SetBkMode(HDC hdc, int m) { GdiDC *dc = (GdiDC *)hdc; int p = dc ? dc->bk_mode : 0; if (dc) dc->bk_mode = m; return p; }
COLORREF SetTextColor(HDC hdc, COLORREF c) { GdiDC *dc = (GdiDC *)hdc; unsigned char p = dc ? dc->text_index : 0; if (dc) dc->text_index = colorref_to_index(c); return RGB(p, p, p); }
BOOL     SetBrushOrgEx(HDC hdc, int x, int y, LPPOINT pt) { GdiDC *dc = (GdiDC *)hdc; if (!dc) return 0; if (pt) { pt->x = dc->brush_org_x; pt->y = dc->brush_org_y; } dc->brush_org_x = x; dc->brush_org_y = y; return 1; }

HRGN CreateRectRgn(int l, int t, int r, int b) { GdiObj *o = new GdiObj(); memset(o, 0, sizeof(*o)); o->kind = OBJ_REGION; o->rgn.left = l; o->rgn.top = t; o->rgn.right = r; o->rgn.bottom = b; return (HRGN)o; }
int  SelectClipRgn(HDC hdc, HRGN hrgn) { GdiDC *dc = (GdiDC *)hdc; if (!dc) return 0; GdiObj *o = (GdiObj *)hrgn; if (o) { dc->clip = o->rgn; dc->has_clip = true; } else dc->has_clip = false; return 1; }

UINT     RealizePalette(HDC) { return 0; }
HPALETTE SelectPalette(HDC, HPALETTE, BOOL) { return (HPALETTE)0; }

} /* extern "C" */
