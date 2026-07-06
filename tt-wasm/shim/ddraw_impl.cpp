/* ddraw_impl.cpp — headless DirectDraw for the ToonTalk WASM port.
 *
 * Implements the IDirectDraw / IDirectDrawSurface / IDirectDrawPalette /
 * IDirectDrawClipper interfaces declared in shim/ddraw.h (reconstructed from
 * ToonTalk's call sites) over plain malloc'd 8-bit surfaces:
 *   - Lock() hands out the real pixel buffer; pitch == width (contiguous),
 *     which is exactly what lock_back_surface assumes (it uses dwWidth as the
 *     stride and walks the buffer bottom-up).
 *   - Blt/BltFast really fill/copy (color key + nearest-neighbor stretch), so
 *     surface contents are true pixels — presenting the front surface to a
 *     canvas later is all Milestone 2 needs.
 *   - Flip swaps buffers with the attached back surface (exclusive mode).
 * No window/canvas here: boot (Milestone 1) is headless by design. */
#include "windows.h"
#include "objbase.h"
#include "ddraw.h"
#include <cstdlib>
#include <cstring>
#include <cstdio>
#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#endif

#ifndef S_OK
#define S_OK 0
#endif
#ifndef E_NOTIMPL
#define E_NOTIMPL ((HRESULT)0x80004001L)
#endif

namespace {

/* ------------------------------------------------------------- palette */
struct DDPalette : public IDirectDrawPalette {
    PALETTEENTRY entries[256];
    ULONG rc;
    DDPalette() : rc(1) { memset(entries, 0, sizeof(entries)); }
    HRESULT QueryInterface(REFIID, void **ppv) { *ppv = this; AddRef(); return S_OK; }
    ULONG   AddRef() { return ++rc; }
    ULONG   Release() { if (rc && --rc == 0) { delete this; return 0; } return rc; }
    HRESULT GetEntries(DWORD, DWORD base, DWORD n, LPPALETTEENTRY out) {
        if (!out) return DDERR_INVALIDPARAMS;
        for (DWORD i = 0; i < n && base + i < 256; i++) out[i] = entries[base + i];
        return DD_OK;
    }
    HRESULT SetEntries(DWORD, DWORD start, DWORD n, LPPALETTEENTRY in) {
        if (!in) return DDERR_INVALIDPARAMS;
        for (DWORD i = 0; i < n && start + i < 256; i++) entries[start + i] = in[i];
        return DD_OK;
    }
};

/* ------------------------------------------------------------- clipper */
struct DDClipper : public IDirectDrawClipper {
    ULONG rc;
    DDClipper() : rc(1) {}
    HRESULT QueryInterface(REFIID, void **ppv) { *ppv = this; AddRef(); return S_OK; }
    ULONG   AddRef() { return ++rc; }
    ULONG   Release() { if (rc && --rc == 0) { delete this; return 0; } return rc; }
    HRESULT SetHWnd(DWORD, HWND) { return DD_OK; }
    HRESULT SetClipList(LPRGNDATA, DWORD) { return DD_OK; }
};

/* ------------------------------------------------------------- surface */
struct DDSurface;
static DDSurface *g_primary = NULL;   /* the screen: presents to the canvas (TT_present in pre.js) */
static void tt_present_surface(DDSurface *s);
/* GDI rasterizer (shim/gdi_impl.cpp): a surface DC draws onto these 8bpp pixels. */
extern "C" HDC gdi_create_surface_dc(unsigned char *pixels, int w, int h);
extern "C" void gdi_release_surface_dc(HDC hdc);

struct DDSurface : public IDirectDrawSurface {
    DWORD w, h;
    unsigned char *pixels;          /* 8bpp, pitch == w, contiguous */
    DDCOLORKEY colorKey; boolean hasColorKey;
    DDPalette *palette;
    DDSurface *attachedBack;        /* flip chain (exclusive mode) */
    ULONG rc;

    DDSurface(DWORD w_, DWORD h_) : w(w_ ? w_ : 1), h(h_ ? h_ : 1),
        hasColorKey(0), palette(NULL), attachedBack(NULL), rc(1) {
        pixels = (unsigned char *)calloc((size_t)w * h, 1);
        colorKey.dwColorSpaceLowValue = colorKey.dwColorSpaceHighValue = 0;
    }
    ~DDSurface() {
        free(pixels);
        if (palette) palette->Release();
        if (attachedBack) attachedBack->Release();
    }

    HRESULT QueryInterface(REFIID, void **ppv) { *ppv = this; AddRef(); return S_OK; }
    ULONG   AddRef() { return ++rc; }
    /* Free on zero (the `rc &&` short-circuit no-ops an over-release when rc is already 0, so it
     * never double-decrements). Previously leaked to dodge an over-release crash seen only with
     * the synthetic zero-size art; the fly-in/land scene composites a fresh surface per frame, so
     * leaking there OOM-crashes the browser in ~10s — freeing is required. */
    ULONG   Release() { if (rc && --rc == 0) { delete this; return 0; } return rc; }

    HRESULT AddAttachedSurface(LPDIRECTDRAWSURFACE s) {
        if (attachedBack) attachedBack->Release();
        attachedBack = (DDSurface *)s; if (attachedBack) attachedBack->AddRef();
        return DD_OK;
    }

    /* clip [v0,v1) into [0,limit) shifting the paired source start too */
    static void clip_span(long &d0, long &d1, long limit, long &s0) {
        if (d0 < 0) { s0 -= d0; d0 = 0; }
        if (d1 > limit) d1 = limit;
    }

    HRESULT Blt(LPRECT dst, LPDIRECTDRAWSURFACE srcSurf, LPRECT src, DWORD flags, LPDDBLTFX fx) {
        long dx0 = dst ? dst->left : 0, dy0 = dst ? dst->top : 0;
        long dx1 = dst ? dst->right : (long)w, dy1 = dst ? dst->bottom : (long)h;
        if (dx1 > (long)w) dx1 = w; if (dy1 > (long)h) dy1 = h;
        if (dx0 < 0) dx0 = 0; if (dy0 < 0) dy0 = 0;
        if (dx0 >= dx1 || dy0 >= dy1) return DD_OK;
        if (flags & DDBLT_COLORFILL) {
            unsigned char c = (unsigned char)(fx ? fx->dwFillColor : 0);
            for (long y = dy0; y < dy1; y++) memset(pixels + y * w + dx0, c, (size_t)(dx1 - dx0));
            if (this == g_primary) tt_present_surface(this);
            return DD_OK;
        }
        DDSurface *s = (DDSurface *)srcSurf;
        if (!s) return DD_OK;
        long sx0 = src ? src->left : 0, sy0 = src ? src->top : 0;
        long sx1 = src ? src->right : (long)s->w, sy1 = src ? src->bottom : (long)s->h;
        long sw = sx1 - sx0, sh = sy1 - sy0, dw = dx1 - dx0, dh = dy1 - dy0;
        if (sw <= 0 || sh <= 0) return DD_OK;
        boolean keyed = (flags & DDBLT_KEYSRC) && s->hasColorKey;
        unsigned char key = (unsigned char)s->colorKey.dwColorSpaceLowValue;
        for (long y = 0; y < dh; y++) {
            long sy = sy0 + (dh == sh ? y : y * sh / dh);
            if (sy < 0 || sy >= (long)s->h) continue;
            for (long x = 0; x < dw; x++) {
                long sx = sx0 + (dw == sw ? x : x * sw / dw);
                if (sx < 0 || sx >= (long)s->w) continue;
                unsigned char p = s->pixels[sy * s->w + sx];
                if (keyed && p == key) continue;
                pixels[(dy0 + y) * w + (dx0 + x)] = p;
            }
        }
        if (this == g_primary) tt_present_surface(this);
        return DD_OK;
    }

    HRESULT BltFast(DWORD x, DWORD y, LPDIRECTDRAWSURFACE srcSurf, LPRECT src, DWORD trans) {
        DDSurface *s = (DDSurface *)srcSurf;
        if (!s) return DD_OK;
        long sx0 = src ? src->left : 0, sy0 = src ? src->top : 0;
        long sx1 = src ? src->right : (long)s->w, sy1 = src ? src->bottom : (long)s->h;
        boolean keyed = (trans & DDBLTFAST_SRCCOLORKEY) && s->hasColorKey;
        unsigned char key = (unsigned char)s->colorKey.dwColorSpaceLowValue;
        for (long sy = sy0; sy < sy1; sy++) {
            long dy = (long)y + (sy - sy0);
            if (sy < 0 || sy >= (long)s->h || dy < 0 || dy >= (long)h) continue;
            for (long sx = sx0; sx < sx1; sx++) {
                long dx = (long)x + (sx - sx0);
                if (sx < 0 || sx >= (long)s->w || dx < 0 || dx >= (long)w) continue;
                unsigned char p = s->pixels[sy * s->w + sx];
                if (keyed && p == key) continue;
                pixels[dy * w + dx] = p;
            }
        }
        if (this == g_primary) tt_present_surface(this);
        return DD_OK;
    }

    HRESULT Flip(LPDIRECTDRAWSURFACE, DWORD) {
        if (attachedBack) { unsigned char *t = pixels; pixels = attachedBack->pixels; attachedBack->pixels = t; }
        tt_present_surface(this);
        return DD_OK;
    }
    HRESULT FlipToGDISurface() { return DD_OK; }
    HRESULT GetAttachedSurface(LPDDSCAPS, LPDIRECTDRAWSURFACE *out) {
        *out = attachedBack;
        if (attachedBack) { attachedBack->AddRef(); return DD_OK; }
        return DDERR_NOTFOUND;
    }
    HRESULT GetCaps(LPDDSCAPS caps) { if (caps) caps->dwCaps = DDSCAPS_OFFSCREENPLAIN | DDSCAPS_SYSTEMMEMORY; return DD_OK; }
    HRESULT GetDC(HDC *lphDC) { if (lphDC) *lphDC = gdi_create_surface_dc(pixels, (int)w, (int)h); return DD_OK; }
    HRESULT GetPalette(LPDIRECTDRAWPALETTE *out) { *out = palette; if (palette) { palette->AddRef(); return DD_OK; } return DDERR_NOPALETTEATTACHED; }
    HRESULT GetPixelFormat(LPDDPIXELFORMAT pf) {
        if (pf) { memset(pf, 0, sizeof(*pf)); pf->dwSize = sizeof(*pf); pf->dwFlags = DDPF_RGB | DDPF_PALETTEINDEXED8; pf->dwRGBBitCount = 8; }
        return DD_OK;
    }
    HRESULT GetSurfaceDesc(LPDDSURFACEDESC d) { if (d) fill_desc(d); return DD_OK; }
    HRESULT IsLost() { return DD_OK; }
    HRESULT Lock(LPRECT, LPDDSURFACEDESC d, DWORD, HANDLE) { if (d) fill_desc(d); return DD_OK; }
    HRESULT ReleaseDC(HDC hdc) { gdi_release_surface_dc(hdc); if (this == g_primary) tt_present_surface(this); return DD_OK; }
    HRESULT Restore() { return DD_OK; }
#ifdef __EMSCRIPTEN__
    HRESULT Unlock(LPVOID) {
        static int n = 0;
        if (n < 6) { long nz = 0; long N = (long)w * h; for (long i = 0; i < N; i++) if (pixels[i]) nz++;
            printf("[tt] surface Unlock #%d %ux%u primary=%d nonzero=%ld\n", n, w, h, this == g_primary, nz); fflush(stdout); n++; }
        return DD_OK;
    }
    HRESULT SetClipper(LPDIRECTDRAWCLIPPER) { return DD_OK; }
#else
    HRESULT SetClipper(LPDIRECTDRAWCLIPPER) { return DD_OK; }
#endif
    HRESULT SetColorKey(DWORD, LPDDCOLORKEY k) { if (k) { colorKey = *k; hasColorKey = 1; } return DD_OK; }
    HRESULT SetPalette(LPDIRECTDRAWPALETTE p) {
        if (palette) palette->Release();
        palette = (DDPalette *)p; if (palette) palette->AddRef();
        return DD_OK;
    }
#ifndef __EMSCRIPTEN__
    HRESULT Unlock(LPVOID) { return DD_OK; }
#endif

    void fill_desc(LPDDSURFACEDESC d) {
        /* caller memset+dwSize'd it (or it's the reused global); refresh the live fields */
        d->dwFlags = DDSD_CAPS | DDSD_HEIGHT | DDSD_WIDTH | DDSD_PITCH;
        d->dwWidth = w;
        d->dwHeight = h;
        d->lPitch = (LONG)w;               /* 8bpp contiguous */
        d->lpSurface = pixels;
        d->ddpfPixelFormat.dwSize = sizeof(DDPIXELFORMAT);
        d->ddpfPixelFormat.dwFlags = DDPF_RGB | DDPF_PALETTEINDEXED8;
        d->ddpfPixelFormat.dwRGBBitCount = 8;
    }
};

/* ------------------------------------------------------------- direct draw */
struct DDraw : public IDirectDraw {
    DWORD modeW, modeH;
    ULONG rc;
    DDraw() : modeW(800), modeH(600), rc(1) {}
    HRESULT QueryInterface(REFIID, void **ppv) { *ppv = this; AddRef(); return S_OK; }
    ULONG   AddRef() { return ++rc; }
    ULONG   Release() { if (rc && --rc == 0) { delete this; return 0; } return rc; }

    HRESULT CreateClipper(DWORD, LPDIRECTDRAWCLIPPER *out, IUnknown *) { *out = new DDClipper(); return DD_OK; }
    HRESULT CreatePalette(DWORD, LPPALETTEENTRY entries, LPDIRECTDRAWPALETTE *out, IUnknown *) {
        DDPalette *p = new DDPalette();
        if (entries) p->SetEntries(0, 0, 256, entries);
        *out = p; return DD_OK;
    }
    HRESULT CreateSurface(LPDDSURFACEDESC d, LPDIRECTDRAWSURFACE *out, IUnknown *) {
        DWORD sw = (d && (d->dwWidth > 0)) ? d->dwWidth : modeW;
        DWORD sh = (d && (d->dwHeight > 0)) ? d->dwHeight : modeH;
        DDSurface *s = new DDSurface(sw, sh);
        /* flip chain requested (exclusive full-screen): attach a back buffer */
        if (d && (d->dwFlags & DDSD_BACKBUFFERCOUNT) && d->dwBackBufferCount > 0) {
            s->attachedBack = new DDSurface(sw, sh);
        }
        if (d && (d->ddsCaps.dwCaps & DDSCAPS_PRIMARYSURFACE)) g_primary = s;
        *out = s; return DD_OK;
    }
    HRESULT FlipToGDISurface() { return DD_OK; }
    HRESULT GetDisplayMode(LPDDSURFACEDESC d) {
        if (d) { d->dwWidth = modeW; d->dwHeight = modeH; d->lPitch = (LONG)modeW;
                 d->ddpfPixelFormat.dwRGBBitCount = 8; }
        return DD_OK;
    }
    HRESULT RestoreDisplayMode() { return DD_OK; }
    HRESULT SetCooperativeLevel(HWND, DWORD) { return DD_OK; }
    HRESULT SetDisplayMode(DWORD w_, DWORD h_, DWORD) { modeW = w_; modeH = h_; return DD_OK; }
};

/* Present the primary surface: hand pixels + palette to TT_present (pre.js), which paints
 * the canvas in a browser and just counts frames headless. The buffer is bottom-up
 * (lock_back_surface addresses it DIB-style); the JS side flips rows. */
static void tt_present_surface(DDSurface *s) {
#ifdef __EMSCRIPTEN__
    unsigned char *pal = s->palette ? (unsigned char *)s->palette->entries : (unsigned char *)0;
    EM_ASM({ if (typeof TT_present === 'function') TT_present($0, $1, $2, $3); },
           s->pixels, (int)s->w, (int)s->h, pal);
#endif
}

} /* namespace */

/* the one true creation entry point (C++-mangled import) */
HRESULT DirectDrawCreate(const GUID *, LPDIRECTDRAW *lplpDD, IUnknown *) {
    if (!lplpDD) return DDERR_INVALIDPARAMS;
    *lplpDD = new DDraw();
    return DD_OK;
}
