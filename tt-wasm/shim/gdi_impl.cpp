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
#include "gdi_font.h"   /* tiny bitmap font for TextOut (tools/make_font.py) */

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
static int glyph_scale(GdiDC *dc) {
    int h = (dc && dc->font && dc->font->font_h > 0) ? dc->font->font_h : TT_FONT_H;
    int s = h / TT_FONT_H; if (s < 1) s = 1; if (s > 4) s = 4;
    return s;
}
static void draw_glyph(GdiDC *dc, int x, int y, unsigned int ch, int s, unsigned char color) {
    if (ch < 32 || ch > 126) { if (ch == 0 || ch == '\r' || ch == '\n') return; ch = '?'; }
    const unsigned char *rows = tt_font[ch - 32];
    for (int gy = 0; gy < TT_FONT_H; gy++) {
        unsigned char bits = rows[gy];
        if (!bits) continue;
        for (int gx = 0; gx < TT_FONT_W; gx++) {
            if (!(bits & (0x80 >> gx))) continue;
            for (int sy = 0; sy < s; sy++)
                for (int sx = 0; sx < s; sx++)
                    put(dc, x + gx * s + sx, y + gy * s + sy, color);
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
    o->font_h = (h * 96 + 36) / 72; if (o->font_h < 1) o->font_h = 12;   /* LOGFONT points -> ~pixels */
    o->font_w = (w * 96 + 36) / 72; if (o->font_w < 1) o->font_w = o->font_h / 2;
    return (HFONT)o;
}
BOOL GetTextMetricsA(HDC hdc, LPTEXTMETRICA tm) {
    GdiDC *dc = (GdiDC *)hdc;
    int s = glyph_scale(dc);                 /* report what TextOut actually draws */
    if (tm) { memset(tm, 0, sizeof(*tm));
        tm->tmHeight = TT_FONT_H * s; tm->tmAscent = (TT_FONT_H * s * 4) / 5;
        tm->tmDescent = TT_FONT_H * s - tm->tmAscent;
        tm->tmAveCharWidth = TT_FONT_W * s; tm->tmMaxCharWidth = TT_FONT_W * s; }
    return 1;
}

BOOL TextOutA(HDC hdc, int x, int y, LPCSTR str, int len) {
    GdiDC *dc = (GdiDC *)hdc; if (!dc || !str) return 0;
    int s = glyph_scale(dc);
    for (int i = 0; i < len; i++)
        draw_glyph(dc, x + i * TT_FONT_W * s, y, (unsigned char)str[i], s, dc->text_index);
    return 1;
}
BOOL TextOutW(HDC hdc, int x, int y, const wchar_t *str, int len) {
    GdiDC *dc = (GdiDC *)hdc; if (!dc || !str) return 0;
    int s = glyph_scale(dc);
    for (int i = 0; i < len; i++)
        draw_glyph(dc, x + i * TT_FONT_W * s, y, (unsigned int)str[i], s, dc->text_index);
    return 1;
}
LONG TabbedTextOutA(HDC hdc, int x, int y, LPCSTR str, int len, int, const INT *, int) {
    TextOutA(hdc, x, y, str, len); return 0;
}
LONG TabbedTextOutW(HDC hdc, int x, int y, const wchar_t *str, int len, int, const INT *, int) {
    TextOutW(hdc, x, y, str, len); return 0;
}
BOOL GetTextExtentPoint32A(HDC hdc, LPCSTR, int len, LPSIZE sz) {
    int s = glyph_scale((GdiDC *)hdc);
    if (sz) { sz->cx = len * TT_FONT_W * s; sz->cy = TT_FONT_H * s; }
    return 1;
}
BOOL GetTextExtentPoint32W(HDC hdc, const wchar_t *, int len, LPSIZE sz) {
    int s = glyph_scale((GdiDC *)hdc);
    if (sz) { sz->cx = len * TT_FONT_W * s; sz->cy = TT_FONT_H * s; }
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
BOOL Ellipse(HDC hdc, int l, int t, int r, int b) {  /* approx: filled bounding box (good enough for boot visuals) */
    return Rectangle(hdc, l, t, r, b);
}
BOOL RoundRect(HDC hdc, int l, int t, int r, int b, int, int) { return Rectangle(hdc, l, t, r, b); }
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
