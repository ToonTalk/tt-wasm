/* DirectDraw shim for the ToonTalk WASM port (phase 0, compile-only).
 *
 * ToonTalk builds with TT_DIRECT_DRAW7=0, so the live typedefs are the classic
 * IDirectDrawSurface / DDSURFACEDESC (the *7 names also appear in dead #if
 * branches, so we define both). Surfaces are opaque COM objects carrying just
 * the methods ToonTalk invokes (Lock/Unlock/Blt/BltFast/GetDC/...), so
 * draw_surface->Method(...) type-checks. Real pixels come from the Canvas/2D
 * shim in phase 1. */
#ifndef _DDRAW_SHIM_H_
#define _DDRAW_SHIM_H_

#include <windows.h>
#include <objbase.h>

/* --- error codes (HRESULTs) ---
 * The full DDERR_* set winmain.cpp's dderr() switch enumerates. Each is spelled
 * as a (HRESULT) cast (DirectDraw FACILITY is 0x8876....) so the high-bit codes
 * are valid `case` labels on an HRESULT (== long) without -Wc++11-narrowing.
 * MAKE_DDHRESULT(code) mirrors the SDK macro: 0x88760000 | (code). */
#define _MAKE_DDHRESULT(code) ((HRESULT)(0x88760000L | (long)(code)))
#define DD_OK                       ((HRESULT)0L)
#define DDERR_GENERIC               ((HRESULT)0x80004005L)
#define DDERR_OUTOFMEMORY           ((HRESULT)0x8007000EL)
#define DDERR_INVALIDPARAMS         ((HRESULT)0x80070057L)
#define DDERR_UNSUPPORTED           ((HRESULT)0x80004001L)
#define DDERR_ALREADYINITIALIZED       _MAKE_DDHRESULT(5)
#define DDERR_CANNOTATTACHSURFACE       _MAKE_DDHRESULT(10)
#define DDERR_CANNOTDETACHSURFACE       _MAKE_DDHRESULT(20)
#define DDERR_CURRENTLYNOTAVAIL         _MAKE_DDHRESULT(40)
#define DDERR_EXCEPTION                 _MAKE_DDHRESULT(55)
#define DDERR_HEIGHTALIGN               _MAKE_DDHRESULT(90)
#define DDERR_INCOMPATIBLEPRIMARY       _MAKE_DDHRESULT(95)
#define DDERR_INVALIDCAPS               _MAKE_DDHRESULT(100)
#define DDERR_INVALIDCLIPLIST           _MAKE_DDHRESULT(110)
#define DDERR_INVALIDMODE               _MAKE_DDHRESULT(120)
#define DDERR_INVALIDOBJECT             _MAKE_DDHRESULT(130)
#define DDERR_INVALIDPIXELFORMAT        _MAKE_DDHRESULT(145)
#define DDERR_INVALIDRECT               _MAKE_DDHRESULT(150)
#define DDERR_LOCKEDSURFACES            _MAKE_DDHRESULT(160)
#define DDERR_NO3D                      _MAKE_DDHRESULT(170)
#define DDERR_NOALPHAHW                 _MAKE_DDHRESULT(180)
#define DDERR_NOCLIPLIST                _MAKE_DDHRESULT(205)
#define DDERR_NOCOLORCONVHW             _MAKE_DDHRESULT(210)
#define DDERR_NOCOOPERATIVELEVELSET     _MAKE_DDHRESULT(212)
#define DDERR_NOCOLORKEY                _MAKE_DDHRESULT(215)
#define DDERR_NOCOLORKEYHW              _MAKE_DDHRESULT(220)
#define DDERR_NODIRECTDRAWSUPPORT       _MAKE_DDHRESULT(222)
#define DDERR_NOEXCLUSIVEMODE           _MAKE_DDHRESULT(225)
#define DDERR_NOFLIPHW                  _MAKE_DDHRESULT(230)
#define DDERR_NOGDI                     _MAKE_DDHRESULT(240)
#define DDERR_NOMIRRORHW                _MAKE_DDHRESULT(250)
#define DDERR_NOTFOUND                  _MAKE_DDHRESULT(255)
#define DDERR_NOOVERLAYHW               _MAKE_DDHRESULT(260)
#define DDERR_NORASTEROPHW              _MAKE_DDHRESULT(280)
#define DDERR_NOROTATIONHW              _MAKE_DDHRESULT(290)
#define DDERR_NOSTRETCHHW               _MAKE_DDHRESULT(310)
#define DDERR_NOT4BITCOLOR              _MAKE_DDHRESULT(316)
#define DDERR_NOT4BITCOLORINDEX         _MAKE_DDHRESULT(317)
#define DDERR_NOT8BITCOLOR              _MAKE_DDHRESULT(320)
#define DDERR_NOTEXTUREHW               _MAKE_DDHRESULT(330)
#define DDERR_NOVSYNCHW                 _MAKE_DDHRESULT(335)
#define DDERR_NOZBUFFERHW               _MAKE_DDHRESULT(340)
#define DDERR_NOZOVERLAYHW              _MAKE_DDHRESULT(350)
#define DDERR_OUTOFCAPS                 _MAKE_DDHRESULT(360)
#define DDERR_OUTOFVIDEOMEMORY          _MAKE_DDHRESULT(380)
#define DDERR_OVERLAYCANTCLIP           _MAKE_DDHRESULT(382)
#define DDERR_OVERLAYCOLORKEYONLYONEACTIVE _MAKE_DDHRESULT(384)
#define DDERR_PALETTEBUSY               _MAKE_DDHRESULT(387)
#define DDERR_COLORKEYNOTSET            _MAKE_DDHRESULT(400)
#define DDERR_SURFACEALREADYATTACHED    _MAKE_DDHRESULT(410)
#define DDERR_SURFACEALREADYDEPENDENT   _MAKE_DDHRESULT(420)
#define DDERR_SURFACEBUSY               _MAKE_DDHRESULT(430)
#define DDERR_CANTLOCKSURFACE           _MAKE_DDHRESULT(435)
#define DDERR_SURFACEISOBSCURED         _MAKE_DDHRESULT(440)
#define DDERR_SURFACELOST               _MAKE_DDHRESULT(450)
#define DDERR_SURFACENOTATTACHED        _MAKE_DDHRESULT(460)
#define DDERR_TOOBIGHEIGHT              _MAKE_DDHRESULT(470)
#define DDERR_TOOBIGSIZE                _MAKE_DDHRESULT(480)
#define DDERR_TOOBIGWIDTH               _MAKE_DDHRESULT(490)
#define DDERR_WRONGMODE                 _MAKE_DDHRESULT(510)
#define DDERR_XALIGN                    _MAKE_DDHRESULT(560)
#define DDERR_INVALIDDIRECTDRAWGUID     _MAKE_DDHRESULT(561)
#define DDERR_DIRECTDRAWALREADYCREATED  _MAKE_DDHRESULT(562)
#define DDERR_NODIRECTDRAWHW            _MAKE_DDHRESULT(563)
#define DDERR_PRIMARYSURFACEALREADYEXISTS _MAKE_DDHRESULT(564)
#define DDERR_NOEMULATION               _MAKE_DDHRESULT(565)
#define DDERR_REGIONTOOSMALL            _MAKE_DDHRESULT(566)
#define DDERR_CLIPPERISUSINGHWND        _MAKE_DDHRESULT(567)
#define DDERR_NOCLIPPERATTACHED         _MAKE_DDHRESULT(568)
#define DDERR_NOHWND                    _MAKE_DDHRESULT(569)
#define DDERR_HWNDSUBCLASSED            _MAKE_DDHRESULT(570)
#define DDERR_HWNDALREADYSET            _MAKE_DDHRESULT(571)
#define DDERR_NOPALETTEATTACHED         _MAKE_DDHRESULT(572)
#define DDERR_NOPALETTEHW               _MAKE_DDHRESULT(573)
#define DDERR_BLTFASTCANTCLIP           _MAKE_DDHRESULT(574)
#define DDERR_NOBLTHW                   _MAKE_DDHRESULT(575)
#define DDERR_NODDROPSHW                _MAKE_DDHRESULT(576)
#define DDERR_OVERLAYNOTVISIBLE         _MAKE_DDHRESULT(577)
#define DDERR_NOOVERLAYDEST             _MAKE_DDHRESULT(578)
#define DDERR_INVALIDPOSITION           _MAKE_DDHRESULT(579)
#define DDERR_NOTAOVERLAYSURFACE        _MAKE_DDHRESULT(580)
#define DDERR_EXCLUSIVEMODEALREADYSET   _MAKE_DDHRESULT(581)
#define DDERR_NOTFLIPPABLE              _MAKE_DDHRESULT(582)
#define DDERR_CANTDUPLICATE             _MAKE_DDHRESULT(583)
#define DDERR_NOTLOCKED                 _MAKE_DDHRESULT(584)
#define DDERR_CANTCREATEDC              _MAKE_DDHRESULT(585)
#define DDERR_NODC                      _MAKE_DDHRESULT(586)
#define DDERR_WRONGINCREMENT            _MAKE_DDHRESULT(587)
#define DDERR_DCALREADYCREATED          _MAKE_DDHRESULT(620)
#define DDERR_IMPLICITLYCREATED         _MAKE_DDHRESULT(630)
#define DDERR_NOTPALETTIZED             _MAKE_DDHRESULT(640)
#define DDERR_UNSUPPORTEDMODE           _MAKE_DDHRESULT(650)
#define DDERR_NOMIPMAPHW                _MAKE_DDHRESULT(660)
#define DDERR_INVALIDSURFACETYPE        _MAKE_DDHRESULT(670)
#define DDERR_NOTPAGELOCKED             _MAKE_DDHRESULT(710)
#define DDERR_CANTPAGELOCK              _MAKE_DDHRESULT(640)
#define DDERR_UNSUPPORTEDFORMAT         _MAKE_DDHRESULT(101)
#define DDERR_UNSUPPORTEDMASK           _MAKE_DDHRESULT(102)
#define DDERR_INVALIDPIXELFORMAT2       _MAKE_DDHRESULT(146)
#define DDERR_VERTICALBLANKINPROGRESS   _MAKE_DDHRESULT(537)
#define DDERR_WASSTILLDRAWING           _MAKE_DDHRESULT(540)
/* DDraw aliases the un-initialized-COM error to the OLE code (not _MAKE_DDHRESULT). */
#define DDERR_NOTINITIALIZED            ((HRESULT)0x800401F0L)

/* --- DDSURFACEDESC.dwFlags (DDSD_*) --- */
#define DDSD_CAPS               0x00000001
#define DDSD_HEIGHT             0x00000002
#define DDSD_WIDTH              0x00000004
#define DDSD_PITCH             0x00000008
#define DDSD_BACKBUFFERCOUNT    0x00000020
#define DDSD_PIXELFORMAT        0x00001000
#define DDSD_CKSRCBLT           0x00010000
#define DDSD_ALL                0x000FF9EE

/* --- DDSCAPS.dwCaps (DDSCAPS_*) --- */
#define DDSCAPS_BACKBUFFER      0x00000004
#define DDSCAPS_COMPLEX         0x00000008
#define DDSCAPS_FLIP            0x00000010
#define DDSCAPS_OFFSCREENPLAIN  0x00000040
#define DDSCAPS_PRIMARYSURFACE  0x00000200
#define DDSCAPS_SYSTEMMEMORY    0x00000800
#define DDSCAPS_VIDEOMEMORY     0x00004000
#define DDSCAPS_NONLOCALVIDMEM  0x00100000

/* --- DDPALETTECAPS (DDPCAPS_*) -- palette capabilities (winmain checks 8-bit). */
#define DDPCAPS_4BIT            0x00000001
#define DDPCAPS_8BITENTRIES     0x00000002
#define DDPCAPS_8BIT            0x00000004
#define DDPCAPS_INITIALIZE      0x00000008
#define DDPCAPS_PRIMARYSURFACE  0x00000010
#define DDPCAPS_ALLOW256        0x00000040
#define DDPCAPS_1BIT            0x00000200
#define DDPCAPS_2BIT            0x00000400

/* --- DDPIXELFORMAT.dwFlags (DDPF_*) --- */
#define DDPF_ALPHAPIXELS        0x00000001
#define DDPF_RGB                0x00000040
#define DDPF_PALETTEINDEXED8    0x00000020

/* --- Blt / BltFast / Lock / Flip / color-key / coop-level flags --- */
#define DDBLT_WAIT              0x01000000
#define DDBLT_KEYSRC            0x00008000
#define DDBLT_COLORFILL         0x00000400
#define DDBLT_ROP               0x00020000

#define DDBLTFAST_NOCOLORKEY    0x00000000
#define DDBLTFAST_SRCCOLORKEY   0x00000001
#define DDBLTFAST_WAIT          0x00000010

#define DDLOCK_WAIT             0x00000001
#define DDLOCK_READONLY         0x00000020
#define DDLOCK_WRITEONLY        0x00000040
#define DDLOCK_SURFACEMEMORYPTR 0x00000000

#define DDFLIP_WAIT             0x00000001

#define DDCKEY_SRCBLT           0x00000004
#define DDCKEY_DESTBLT          0x00000001

#define DDSCL_FULLSCREEN        0x00000001
#define DDSCL_ALLOWREBOOT       0x00000002
#define DDSCL_NORMAL            0x00000008
#define DDSCL_EXCLUSIVE         0x00000010
#define DDSCL_ALLOWMODEX        0x00000040

/* --- structs --- */
typedef struct _DDCOLORKEY {
    DWORD dwColorSpaceLowValue;
    DWORD dwColorSpaceHighValue;
} DDCOLORKEY, *LPDDCOLORKEY;

typedef struct _DDSCAPS  { DWORD dwCaps; } DDSCAPS, *LPDDSCAPS;
typedef struct _DDSCAPS2 { DWORD dwCaps, dwCaps2, dwCaps3, dwCaps4; } DDSCAPS2, *LPDDSCAPS2;

typedef struct _DDPIXELFORMAT {
    DWORD dwSize;
    DWORD dwFlags;
    DWORD dwFourCC;
    union { DWORD dwRGBBitCount; DWORD dwYUVBitCount; DWORD dwZBufferBitDepth; };
    union { DWORD dwRBitMask; DWORD dwYBitMask; };
    union { DWORD dwGBitMask; DWORD dwUBitMask; };
    union { DWORD dwBBitMask; DWORD dwVBitMask; };
    union { DWORD dwRGBAlphaBitMask; DWORD dwRGBZBitMask; };
} DDPIXELFORMAT, *LPDDPIXELFORMAT;

/* Forward decl so DDSURFACEDESC can mention the surface type. */
struct IDirectDrawSurface;

typedef struct _DDSURFACEDESC {
    DWORD         dwSize;
    DWORD         dwFlags;
    DWORD         dwHeight;
    DWORD         dwWidth;
    union { LONG lPitch; DWORD dwLinearSize; };
    DWORD         dwBackBufferCount;
    union { DWORD dwMipMapCount; DWORD dwZBufferBitDepth; DWORD dwRefreshRate; };
    DWORD         dwAlphaBitDepth;
    DWORD         dwReserved;
    LPVOID        lpSurface;
    DDCOLORKEY    ddckCKDestOverlay;
    DDCOLORKEY    ddckCKDestBlt;
    DDCOLORKEY    ddckCKSrcOverlay;
    DDCOLORKEY    ddckCKSrcBlt;
    DDPIXELFORMAT ddpfPixelFormat;
    DDSCAPS       ddsCaps;
} DDSURFACEDESC, *LPDDSURFACEDESC;

typedef struct _DDSURFACEDESC2 {
    DWORD         dwSize;
    DWORD         dwFlags;
    DWORD         dwHeight;
    DWORD         dwWidth;
    union { LONG lPitch; DWORD dwLinearSize; };
    union { DWORD dwBackBufferCount; DWORD dwDepth; };
    union { DWORD dwMipMapCount; DWORD dwRefreshRate; };
    DWORD         dwAlphaBitDepth;
    DWORD         dwReserved;
    LPVOID        lpSurface;
    DDCOLORKEY    ddckCKDestOverlay;
    DDCOLORKEY    ddckCKDestBlt;
    DDCOLORKEY    ddckCKSrcOverlay;
    DDCOLORKEY    ddckCKSrcBlt;
    DDPIXELFORMAT ddpfPixelFormat;
    DDSCAPS2      ddsCaps;
    DWORD         dwTextureStage;
} DDSURFACEDESC2, *LPDDSURFACEDESC2;

typedef struct _DDBLTFX {
    DWORD dwSize;
    DWORD dwDDFX;
    DWORD dwROP;
    DWORD dwDDROP;
    DWORD dwRotationAngle;
    DWORD dwZBufferOpCode;
    DWORD dwFillColor;
    DDCOLORKEY ddckDestColorkey;
    DDCOLORKEY ddckSrcColorkey;
} DDBLTFX, *LPDDBLTFX;

/* --- palette / clipper interfaces (opaque) --- */
struct IDirectDrawPalette;
typedef struct IDirectDrawPalette *LPDIRECTDRAWPALETTE;
struct IDirectDrawPalette : public IUnknown {
    virtual HRESULT GetEntries(DWORD dwFlags, DWORD dwBase, DWORD dwNumEntries, LPPALETTEENTRY lpEntries) = 0;
    virtual HRESULT SetEntries(DWORD dwFlags, DWORD dwStartingEntry, DWORD dwCount, LPPALETTEENTRY lpEntries) = 0;
};

struct IDirectDrawClipper;
typedef struct IDirectDrawClipper *LPDIRECTDRAWCLIPPER;
struct IDirectDrawClipper : public IUnknown {
    virtual HRESULT SetHWnd(DWORD dwFlags, HWND hWnd) = 0;
    virtual HRESULT SetClipList(LPRGNDATA lpClipList, DWORD dwFlags) = 0;
};

/* --- surface interface (opaque; classic + the *7 alias) --- */
typedef struct IDirectDrawSurface *LPDIRECTDRAWSURFACE;
typedef struct IDirectDrawSurface *LPDIRECTDRAWSURFACE7;

struct IDirectDrawSurface : public IUnknown {
    virtual HRESULT AddAttachedSurface(LPDIRECTDRAWSURFACE lpDDSAttachedSurface) = 0;
    virtual HRESULT Blt(LPRECT lpDestRect, LPDIRECTDRAWSURFACE lpDDSrcSurface,
                        LPRECT lpSrcRect, DWORD dwFlags, LPDDBLTFX lpDDBltFx) = 0;
    virtual HRESULT BltFast(DWORD dwX, DWORD dwY, LPDIRECTDRAWSURFACE lpDDSrcSurface,
                            LPRECT lpSrcRect, DWORD dwTrans) = 0;
    virtual HRESULT Flip(LPDIRECTDRAWSURFACE lpDDSurfaceTargetOverride, DWORD dwFlags) = 0;
    virtual HRESULT FlipToGDISurface() = 0;
    virtual HRESULT GetAttachedSurface(LPDDSCAPS lpDDSCaps, LPDIRECTDRAWSURFACE *lplpDDAttachedSurface) = 0;
    virtual HRESULT GetCaps(LPDDSCAPS lpDDSCaps) = 0;
    virtual HRESULT GetDC(HDC *lphDC) = 0;
    virtual HRESULT GetPalette(LPDIRECTDRAWPALETTE *lplpDDPalette) = 0;
    virtual HRESULT GetPixelFormat(LPDDPIXELFORMAT lpDDPixelFormat) = 0;
    virtual HRESULT GetSurfaceDesc(LPDDSURFACEDESC lpDDSurfaceDesc) = 0;
    virtual HRESULT IsLost() = 0;
    virtual HRESULT Lock(LPRECT lpDestRect, LPDDSURFACEDESC lpDDSurfaceDesc,
                         DWORD dwFlags, HANDLE hEvent) = 0;
    virtual HRESULT ReleaseDC(HDC hDC) = 0;
    virtual HRESULT Restore() = 0;
    virtual HRESULT SetClipper(LPDIRECTDRAWCLIPPER lpDDClipper) = 0;
    virtual HRESULT SetColorKey(DWORD dwFlags, LPDDCOLORKEY lpDDColorKey) = 0;
    virtual HRESULT SetPalette(LPDIRECTDRAWPALETTE lpDDPalette) = 0;
    virtual HRESULT Unlock(LPVOID lpSurfaceData) = 0;
};
/* The *7 surface shares the same opaque type in this shim. */
typedef struct IDirectDrawSurface IDirectDrawSurface7;

/* --- IDirectDraw (opaque; classic + 2/7 aliases) --- */
typedef struct IDirectDraw *LPDIRECTDRAW;
typedef struct IDirectDraw *LPDIRECTDRAW2;
typedef struct IDirectDraw *LPDIRECTDRAW7;

struct IDirectDraw : public IUnknown {
    virtual HRESULT CreateClipper(DWORD dwFlags, LPDIRECTDRAWCLIPPER *lplpDDClipper, IUnknown *pUnkOuter) = 0;
    virtual HRESULT CreatePalette(DWORD dwFlags, LPPALETTEENTRY lpColorTable,
                                  LPDIRECTDRAWPALETTE *lplpDDPalette, IUnknown *pUnkOuter) = 0;
    virtual HRESULT CreateSurface(LPDDSURFACEDESC lpDDSurfaceDesc,
                                  LPDIRECTDRAWSURFACE *lplpDDSurface, IUnknown *pUnkOuter) = 0;
    virtual HRESULT FlipToGDISurface() = 0;
    virtual HRESULT GetDisplayMode(LPDDSURFACEDESC lpDDSurfaceDesc) = 0;
    virtual HRESULT RestoreDisplayMode() = 0;
    virtual HRESULT SetCooperativeLevel(HWND hWnd, DWORD dwFlags) = 0;
    virtual HRESULT SetDisplayMode(DWORD dwWidth, DWORD dwHeight, DWORD dwBPP) = 0;
};
typedef struct IDirectDraw IDirectDraw7;

/* DirectDrawCreate: classic creation entry point. */
HRESULT DirectDrawCreate(const GUID *lpGUID, LPDIRECTDRAW *lplpDD, IUnknown *pUnkOuter);
HRESULT DirectDrawCreateEx(const GUID *lpGUID, LPVOID *lplpDD, REFIID iid, IUnknown *pUnkOuter);

#endif /* _DDRAW_SHIM_H_ */
