/* GDI+ shim for the ToonTalk WASM port (phase 0, compile-only).
 *
 * defs.h does `#include <gdiplus.h>` + `using namespace Gdiplus;` under
 * TT_GDIPLUS. ToonTalk uses GDI+ to load/convert image files (mostly in
 * winmain.cpp / icache.cpp, none of which are phase-0 targets). We provide the
 * Gdiplus namespace with the value types (Color/Size/Rect/Point), the Status
 * and PixelFormat enums, the ARGB helpers, the descriptor structs, and opaque
 * Image/Bitmap/Graphics/Font classes carrying the few methods that get called.
 * Verified there are no ToonTalk identifiers named Color/Size/Rect/etc., so
 * `using namespace Gdiplus` won't collide. Real decode via <canvas>/Image in
 * phase 1. */
#ifndef _GDIPLUS_SHIM_H_
#define _GDIPLUS_SHIM_H_

#include <windows.h>
#include <objbase.h>

namespace Gdiplus {

typedef DWORD ARGB;
typedef float REAL;
typedef DWORD_PTR ULONG_PTR_t;

enum Status {
    Ok = 0, GenericError, InvalidParameter, OutOfMemory, ObjectBusy,
    InsufficientBuffer, NotImplemented, Win32Error, WrongState, Aborted,
    FileNotFound, ValueOverflow, AccessDenied, UnknownImageFormat,
    FontFamilyNotFound, FontStyleNotFound, NotTrueTypeFont,
    UnsupportedGdiplusVersion, GdiplusNotInitialized, PropertyNotFound,
    PropertyNotSupported
};

/* PixelFormat is an int code in GDI+ (PixelFormatXXX constants). */
typedef int PixelFormat;
#define PixelFormatIndexed      0x00010000
#define PixelFormatGDI          0x00020000
#define PixelFormatAlpha        0x00040000
#define PixelFormatCanonical    0x00200000
#define PixelFormat8bppIndexed  (3 | (8  << 8) | PixelFormatIndexed | PixelFormatGDI)
#define PixelFormat8BPPIndexed  PixelFormat8bppIndexed
#define PixelFormat16bppRGB555  (5 | (16 << 8) | PixelFormatGDI)
#define PixelFormat16bppRGB565  (6 | (16 << 8) | PixelFormatGDI)
#define PixelFormat16bppARGB1555 (7 | (16 << 8) | PixelFormatAlpha | PixelFormatGDI)
#define PixelFormat24bppRGB     (8 | (24 << 8) | PixelFormatGDI)
#define PixelFormat32bppRGB     (9 | (32 << 8) | PixelFormatGDI)
#define PixelFormat32bppARGB    (10 | (32 << 8) | PixelFormatAlpha | PixelFormatGDI | PixelFormatCanonical)

enum ImageLockMode { ImageLockModeRead = 1, ImageLockModeWrite = 2, ImageLockModeUserInputBuf = 4 };

/* --- value types --- */
class Color {
public:
    ARGB argb;
    Color() : argb(0xFF000000) {}
    Color(ARGB a) : argb(a) {}
    Color(BYTE r, BYTE g, BYTE b) : argb(0xFF000000 | (r << 16) | (g << 8) | b) {}
    Color(BYTE a, BYTE r, BYTE g, BYTE b) : argb((a << 24) | (r << 16) | (g << 8) | b) {}
    ARGB GetValue() const { return argb; }
    void SetValue(ARGB a) { argb = a; }
    BYTE GetAlpha() const { return (BYTE)(argb >> 24); }
    BYTE GetRed()   const { return (BYTE)(argb >> 16); }
    BYTE GetGreen() const { return (BYTE)(argb >> 8); }
    BYTE GetBlue()  const { return (BYTE)(argb); }
    static ARGB MakeARGB(BYTE a, BYTE r, BYTE g, BYTE b) { return (a << 24) | (r << 16) | (g << 8) | b; }
    /* a few of the named ARGB colour constants GDI+ exposes as Color:: enumerators
     * (winmain.cpp compares against / assigns Color::Black). Full opaque alpha. */
    enum NamedColor { Black = 0xFF000000, White = 0xFFFFFFFF };
};

class Size  { public: INT Width, Height; Size() : Width(0), Height(0) {} Size(INT w, INT h) : Width(w), Height(h) {} };
class SizeF { public: REAL Width, Height; SizeF() : Width(0), Height(0) {} };
class Point { public: INT X, Y; Point() : X(0), Y(0) {} Point(INT x, INT y) : X(x), Y(y) {} };
class PointF { public: REAL X, Y; PointF() : X(0), Y(0) {} };
class Rect  { public: INT X, Y, Width, Height; Rect() : X(0), Y(0), Width(0), Height(0) {} Rect(INT x, INT y, INT w, INT h) : X(x), Y(y), Width(w), Height(h) {} };
class RectF { public: REAL X, Y, Width, Height; RectF() : X(0), Y(0), Width(0), Height(0) {} };

/* --- descriptor structs --- */
struct BitmapData {
    UINT   Width;
    UINT   Height;
    INT    Stride;
    PixelFormat PixelFormat;
    VOID  *Scan0;
    UINT_PTR Reserved;
};

struct ColorPalette {
    UINT Flags;
    UINT Count;
    ARGB Entries[1];
};

struct ImageCodecInfo {
    CLSID Clsid;
    GUID  FormatID;
    const WCHAR *CodecName;
    const WCHAR *DllName;
    const WCHAR *FormatDescription;
    const WCHAR *FilenameExtension;
    const WCHAR *MimeType;
    DWORD Flags;
    DWORD Version;
    DWORD SigCount;
    DWORD SigSize;
    BYTE *SigPattern;
    BYTE *SigMask;
};

struct EncoderParameter {
    GUID  Guid;
    ULONG NumberOfValues;
    ULONG Type;
    VOID *Value;
};
struct EncoderParameters {
    UINT Count;
    EncoderParameter Parameter[1];
};

/* --- GDI+ startup --- */
struct GdiplusStartupInput {
    UINT32 GdiplusVersion;
    VOID  *DebugEventCallback;
    BOOL   SuppressBackgroundThread;
    BOOL   SuppressExternalCodecs;
    GdiplusStartupInput() : GdiplusVersion(1), DebugEventCallback(0),
                            SuppressBackgroundThread(FALSE), SuppressExternalCodecs(FALSE) {}
};
struct GdiplusStartupOutput { VOID *NotificationHook; VOID *NotificationUnhook; };

Status GdiplusStartup(ULONG_PTR *token, const GdiplusStartupInput *input, GdiplusStartupOutput *output);
VOID   GdiplusShutdown(ULONG_PTR token);

/* --- opaque image classes (only the methods ToonTalk reaches) --- */
class Image {
public:
    virtual ~Image() {}
    UINT   GetWidth();
    UINT   GetHeight();
    Status GetLastStatus() const;
    PixelFormat GetPixelFormat();
    Status Save(const WCHAR *filename, const CLSID *clsidEncoder, const EncoderParameters *encoderParams = 0);
};

class Bitmap : public Image {
public:
    Bitmap(const WCHAR *filename, BOOL useEmbeddedColorManagement = FALSE);
    Bitmap(INT width, INT height, PixelFormat format);
    Bitmap(INT width, INT height, INT stride, PixelFormat format, BYTE *scan0);
    Status LockBits(const Rect *rect, UINT flags, PixelFormat format, BitmapData *lockedBitmapData);
    Status UnlockBits(BitmapData *lockedBitmapData);
    Status GetPixel(INT x, INT y, Color *color);
    Status SetPixel(INT x, INT y, const Color &color);
    static Bitmap *FromFile(const WCHAR *filename, BOOL useEmbeddedColorManagement = FALSE);
    /* palette access (winmain.cpp remaps an indexed bitmap's palette + alpha). */
    INT    GetPaletteSize();
    Status GetPalette(ColorPalette *palette, INT size);
    Status SetPalette(const ColorPalette *palette);
    UINT   GetFlags();
};

/* Image::GetFlags bits (winmain tests ImageFlagsHasAlpha). */
enum ImageFlags {
    ImageFlagsNone          = 0,
    ImageFlagsScalable      = 0x0001,
    ImageFlagsHasAlpha      = 0x0002,
    ImageFlagsHasTranslucent= 0x0004,
    ImageFlagsReadOnly      = 0x00010000,
    ImageFlagsCaching       = 0x00020000
};
/* ColorPalette::Flags bits (winmain sets PaletteFlagsHasAlpha). */
enum PaletteFlags {
    PaletteFlagsHasAlpha    = 0x0001,
    PaletteFlagsGrayScale   = 0x0002,
    PaletteFlagsHalftone    = 0x0004
};

/* codec enumeration (winmain finds the PNG encoder CLSID to save media). */
Status GetImageEncodersSize(UINT *numEncoders, UINT *size);
Status GetImageEncoders(UINT numEncoders, UINT size, ImageCodecInfo *encoders);

class Graphics {
public:
    Graphics(HDC hdc);
    Graphics(Image *image);
    ~Graphics() {}
    Status DrawImage(Image *image, INT x, INT y);
    Status Clear(const Color &color);
    Status GetLastStatus() const;
};

class Font {
public:
    Font(HDC hdc);
    Font(const WCHAR *familyName, REAL emSize);
    ~Font() {}
    Status GetLastStatus() const;
};

} /* namespace Gdiplus */

#endif /* _GDIPLUS_SHIM_H_ */
