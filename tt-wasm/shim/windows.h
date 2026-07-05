/* Minimal Win32 compatibility shim for the Emscripten/WASM port of ToonTalk.
 *
 * Phase 0 goal: provide the TYPES + macros the ToonTalk headers reference so the
 * C++ parses under clang/emcc. Function *bodies* (CreateWindow, GetDC, …) are
 * implemented later in the shim .cpp (canvas / Web Audio / DOM). This header
 * grows as the compile-fix loop surfaces missing declarations. */
#ifndef _WINDOWS_SHIM_H_
#define _WINDOWS_SHIM_H_

#include <stdint.h>
#include <stddef.h>
#include "crtcompat.h"   /* itoa/ultoa/stricmp/strnicmp the old MSVC CRT had */

/* --- calling conventions / storage class (no-ops on wasm) --- */
#define WINAPI
#define APIENTRY
#define CALLBACK
#define PASCAL
#define WINAPIV
#define WINUSERAPI
#define WINBASEAPI
#define WINGDIAPI
#define EXPORT
#define FAR
#define NEAR
#define CONST const
#ifndef __declspec
#define __declspec(x)
#endif
#ifndef __stdcall
#define __stdcall
#endif
#ifndef __cdecl
#define __cdecl
#endif
#define _far
#define _near
#define huge

/* --- SAL parameter-annotation macros (no-ops). The old Platform SDK spelled
 * these IN / OUT / OPTIONAL in function prototypes (e.g. file.h's Read()).
 * They carry no semantics for the compiler. --- */
#ifndef IN
#define IN
#endif
#ifndef OUT
#define OUT
#endif
#ifndef OPTIONAL
#define OPTIONAL
#endif

/* --- primitive types --- */
typedef unsigned char BYTE, *LPBYTE, *PBYTE, UCHAR;
typedef unsigned short WORD, *LPWORD, USHORT;
typedef unsigned int UINT, *LPUINT;
typedef int INT, BOOL, *LPINT, *LPBOOL, *PINT;
typedef unsigned long DWORD, *LPDWORD, ULONG, *PULONG;
typedef long LONG, *LPLONG;
typedef float FLOAT;
typedef char CHAR, TCHAR, *PCHAR;
/* MSVC <tchar.h> string-literal macros. ToonTalk is an ANSI build (TCHAR=char),
 * so _T / _TEXT / TEXT are no-ops. (Restored — a prior edit dropped these, which
 * regressed every file using _T("...") via java.h etc.) */
#ifndef _T
#define _T(x)    x
#define _TEXT(x) x
#define __T(x)   x
#endif
#ifndef TEXT
#define TEXT(x)  x
#endif
typedef const char *LPCSTR, *LPCTSTR, *PCSTR, *LPCWSTR, *PCWSTR, *PCTSTR;
typedef char *LPSTR, *LPTSTR, *PSTR, *LPWSTR, *PWSTR, *PTSTR;
typedef void *LPVOID, *PVOID;
typedef const void *LPCVOID;
/* MSVC treats __int64 as a built-in keyword, so code writes `unsigned __int64`.
 * A typedef can't be prefixed with `unsigned`, so model it as a macro. */
#define __int64 long long
typedef int64_t LONGLONG, *PLONGLONG;
typedef uint64_t ULONGLONG, DWORDLONG;
typedef int32_t __int32;
typedef intptr_t INT_PTR, LONG_PTR;
typedef uintptr_t UINT_PTR, ULONG_PTR, DWORD_PTR;
typedef size_t SIZE_T;
typedef intptr_t SSIZE_T;
typedef long LRESULT, LPARAM;
typedef UINT_PTR WPARAM;
typedef long HRESULT, SCODE;
typedef unsigned long COLORREF, *LPCOLORREF;
typedef WORD ATOM;
typedef short SHORT;
typedef unsigned long LCID;
typedef DWORD LANGID;
typedef double DOUBLE;
typedef long long LONG64;
typedef unsigned long long ULONG64, QWORD;
/* fixed-width Win32 aliases */
typedef int8_t   INT8;
typedef int16_t  INT16;
typedef int32_t  INT32;
typedef int64_t  INT64;
typedef uint8_t  UINT8;
typedef uint16_t UINT16;
typedef uint32_t UINT32, DWORD32;
typedef uint64_t UINT64, DWORD64;

/* --- handles (all opaque pointers) --- */
typedef void *HANDLE, *PHANDLE, *LPHANDLE;
typedef HANDLE HWND, HDC, HINSTANCE, HMODULE, HBITMAP, HPALETTE, HFONT, HGDIOBJ,
    HMENU, HCURSOR, HICON, HBRUSH, HPEN, HRGN, HGLOBAL, HLOCAL, HKEY, HRSRC,
    HACCEL, HENHMETAFILE, HMETAFILE, HDROP, HIMC, HWINSTA, HDESK, HMONITOR;
/* HFILE is the legacy C-runtime file handle (an int), NOT a kernel HANDLE:
 * OpenFile returns it and the code initializes it to -1 (HFILE_ERROR). */
typedef int HFILE;
#ifndef HFILE_ERROR
#define HFILE_ERROR ((HFILE)-1)
#endif

/* --- common constants --- */
#ifndef TRUE
#define TRUE 1
#endif
#ifndef FALSE
#define FALSE 0
#endif
#ifndef NULL
#define NULL 0
#endif
#define VOID void
#define MAX_PATH 260
#define INVALID_HANDLE_VALUE ((HANDLE)(LONG_PTR)-1)

/* boolean: the Win32 SDK (rpcndr.h / wtypes.h) defines this as unsigned char.
 * defs.h relies on it being supplied externally when TT_32 is set. */
#ifndef _BOOLEAN_DEFINED
#define _BOOLEAN_DEFINED
typedef unsigned char boolean;
#endif
/* byte: rpcndr.h defines this; defs.h assumes it exists when TT_32 is set. */
#ifndef _BYTE_DEFINED
#define _BYTE_DEFINED
typedef unsigned char byte;
#endif

/* --- word/dword field extraction + composition (windef.h) --- */
#ifndef LOWORD
#define LOWORD(l)      ((WORD)(((DWORD_PTR)(l)) & 0xffff))
#define HIWORD(l)      ((WORD)((((DWORD_PTR)(l)) >> 16) & 0xffff))
#define LOBYTE(w)      ((BYTE)(((DWORD_PTR)(w)) & 0xff))
#define HIBYTE(w)      ((BYTE)((((DWORD_PTR)(w)) >> 8) & 0xff))
#define MAKEWORD(a, b) ((WORD)(((BYTE)(a)) | (((WORD)((BYTE)(b))) << 8)))
#define MAKELONG(a, b) ((LONG)(((WORD)(a)) | (((DWORD)((WORD)(b))) << 16)))
#endif

/* --- COLORREF helpers --- */
#define RGB(r, g, b) ((COLORREF)(((BYTE)(r)) | (((WORD)((BYTE)(g))) << 8) | (((DWORD)((BYTE)(b))) << 16)))
#define GetRValue(c) ((BYTE)(c))
#define GetGValue(c) ((BYTE)(((WORD)(c)) >> 8))
#define GetBValue(c) ((BYTE)((c) >> 16))
#define PALETTERGB(r, g, b) (0x02000000 | RGB(r, g, b))
#define RGB_(r, g, b) RGB(r, g, b)

/* --- structs --- */
typedef struct tagPOINT { LONG x, y; } POINT, *LPPOINT, *PPOINT;
typedef struct tagPOINTS { SHORT x, y; } POINTS;
typedef struct _POINTL { LONG x, y; } POINTL, *PPOINTL;
/* RPC "far pointer" annotation (no-op on a flat address space). */
#ifndef __RPC_FAR
#define __RPC_FAR
#endif
#ifndef __RPC__out
#define __RPC__out
#define __RPC__in
#endif
typedef struct tagRECT { LONG left, top, right, bottom; } RECT, *LPRECT, *PRECT;
typedef const RECT *LPCRECT;
typedef struct tagSIZE { LONG cx, cy; } SIZE, *LPSIZE;
typedef struct tagMSG { HWND hwnd; UINT message; WPARAM wParam; LPARAM lParam; DWORD time; POINT pt; } MSG, *LPMSG, *PMSG;
typedef struct tagPALETTEENTRY { BYTE peRed, peGreen, peBlue, peFlags; } PALETTEENTRY, *LPPALETTEENTRY;
typedef struct tagRGBQUAD { BYTE rgbBlue, rgbGreen, rgbRed, rgbReserved; } RGBQUAD, *LPRGBQUAD;
typedef struct tagRGBTRIPLE { BYTE rgbtBlue, rgbtGreen, rgbtRed; } RGBTRIPLE, *LPRGBTRIPLE;
typedef struct _RGNDATA { char _opaque; } RGNDATA, *LPRGNDATA;
typedef struct _SYSTEMTIME { WORD wYear, wMonth, wDayOfWeek, wDay, wHour, wMinute, wSecond, wMilliseconds; } SYSTEMTIME, *LPSYSTEMTIME;
typedef struct _FILETIME { DWORD dwLowDateTime, dwHighDateTime; } FILETIME, *LPFILETIME;
typedef struct _SECURITY_ATTRIBUTES { DWORD nLength; LPVOID lpSecurityDescriptor; BOOL bInheritHandle; } SECURITY_ATTRIBUTES, *LPSECURITY_ATTRIBUTES, *PSECURITY_ATTRIBUTES;

/* --- GDI bitmap / DIB structures --- */
#pragma pack(push, 1)
typedef struct tagBITMAPFILEHEADER {
    WORD  bfType;
    DWORD bfSize;
    WORD  bfReserved1, bfReserved2;
    DWORD bfOffBits;
} BITMAPFILEHEADER, *LPBITMAPFILEHEADER, *PBITMAPFILEHEADER;
#pragma pack(pop)

typedef struct tagBITMAPINFOHEADER {
    DWORD biSize;
    LONG  biWidth, biHeight;
    WORD  biPlanes, biBitCount;
    DWORD biCompression, biSizeImage;
    LONG  biXPelsPerMeter, biYPelsPerMeter;
    DWORD biClrUsed, biClrImportant;
} BITMAPINFOHEADER, *LPBITMAPINFOHEADER, *PBITMAPINFOHEADER;

typedef struct tagBITMAPINFO {
    BITMAPINFOHEADER bmiHeader;
    RGBQUAD          bmiColors[1];
} BITMAPINFO, *LPBITMAPINFO, *PBITMAPINFO;

typedef struct tagBITMAP {
    LONG  bmType, bmWidth, bmHeight, bmWidthBytes;
    WORD  bmPlanes, bmBitsPixel;
    LPVOID bmBits;
} BITMAP, *LPBITMAP, *PBITMAP;

typedef struct tagLOGPALETTE {
    WORD palVersion, palNumEntries;
    PALETTEENTRY palPalEntry[1];
} LOGPALETTE, *LPLOGPALETTE;

/* DIB compression + color-table constants */
#define BI_RGB        0
#define BI_RLE8       1
#define BI_RLE4       2
#define BI_BITFIELDS  3
#define DIB_RGB_COLORS  0
#define DIB_PAL_COLORS  1

/* --- COM / GUID (DirectX uses these) --- */
typedef struct _GUID { DWORD Data1; WORD Data2, Data3; BYTE Data4[8]; } GUID, IID, CLSID;
typedef GUID *LPGUID, *LPCLSID, *LPIID;
typedef const GUID &REFGUID;
typedef const GUID &REFIID;
typedef const GUID &REFCLSID;
typedef long (*FARPROC)(void);

/* GUID comparison (real windows.h provides this as an inline). */
#ifdef __cplusplus
inline int IsEqualGUID(REFGUID a, REFGUID b) {
    return a.Data1 == b.Data1 && a.Data2 == b.Data2 && a.Data3 == b.Data3 &&
           a.Data4[0] == b.Data4[0] && a.Data4[1] == b.Data4[1] &&
           a.Data4[2] == b.Data4[2] && a.Data4[3] == b.Data4[3] &&
           a.Data4[4] == b.Data4[4] && a.Data4[5] == b.Data4[5] &&
           a.Data4[6] == b.Data4[6] && a.Data4[7] == b.Data4[7];
}
#define IsEqualIID(a, b)   IsEqualGUID(a, b)
#define IsEqualCLSID(a, b) IsEqualGUID(a, b)
#endif

/* DEFINE_GUID: in the real SDK this declares an extern const GUID (and, where
 * INITGUID is set, defines it). Compile-only here, so always declare; the
 * actual constants are linked later. */
#ifndef DEFINE_GUID
#define DEFINE_GUID(name, l, w1, w2, b1, b2, b3, b4, b5, b6, b7, b8) \
    extern const GUID name
#endif

/* min/max macros from windef.h (absent only when NOMINMAX is defined). */
#ifndef NOMINMAX
#ifndef max
#define max(a, b) (((a) > (b)) ? (a) : (b))
#endif
#ifndef min
#define min(a, b) (((a) < (b)) ? (a) : (b))
#endif
#endif

/* ---------------------------------------------------------------------------
 * Win32 USER32 / GDI32 free functions called from ToonTalk header inline
 * methods (and bodies). Declarations only -- bodies are linked later (phase 1
 * maps the ones that matter onto canvas/DOM; the rest are stubbed). The real
 * <windows.h> provides all of these.
 * ------------------------------------------------------------------------- */
#ifdef __cplusplus
extern "C" {
#endif

/* window state / focus */
BOOL  ShowWindow(HWND hWnd, int nCmdShow);
BOOL  UpdateWindow(HWND hWnd);
BOOL  CloseWindow(HWND hWnd);
BOOL  OpenIcon(HWND hWnd);
HWND  SetFocus(HWND hWnd);
BOOL  DestroyWindow(HWND hWnd);

/* device contexts */
HDC   GetDC(HWND hWnd);
int   ReleaseDC(HWND hWnd, HDC hDC);

/* GDI object lifetime / selection */
BOOL     DeleteObject(HGDIOBJ hObject);
HGDIOBJ  SelectObject(HDC hdc, HGDIOBJ hgdiobj);
HGDIOBJ  GetStockObject(int fnObject);

/* character classification (USER32). The W variants take a wide char; WCHAR is
 * only typedef'd later (objbase.h), so spell it wchar_t here. */
BOOL  IsCharAlphaA(CHAR ch);
BOOL  IsCharAlphaW(wchar_t ch);
BOOL  IsCharAlphaNumericA(CHAR ch);
BOOL  IsCharAlphaNumericW(wchar_t ch);

/* case conversion in place (USER32). AnsiUpper/AnsiLower are the legacy names
 * for CharUpper/CharLower; they upcase a whole LPSTR (or a single char packed
 * in the low byte). ToonTalk's upper_case/lower_case macros resolve to these. */
LPSTR    AnsiUpperA(LPSTR lpsz);
LPSTR    AnsiLowerA(LPSTR lpsz);
LPSTR    CharUpperA(LPSTR lpsz);
LPSTR    CharLowerA(LPSTR lpsz);
LPWSTR   CharUpperW(LPWSTR lpsz);
LPWSTR   CharLowerW(LPWSTR lpsz);
#ifndef AnsiUpper
#define AnsiUpper  AnsiUpperA
#define AnsiLower  AnsiLowerA
#define CharUpper  CharUpperA
#define CharLower  CharLowerA
#endif

/* drawing primitive used directly in number.cpp */
BOOL  Arc(HDC hdc, int nLeftRect, int nTopRect, int nRightRect, int nBottomRect,
          int nXStartArc, int nYStartArc, int nXEndArc, int nYEndArc);

/* ANSI<->wide conversion (common.cpp / text.cpp). NB: the wide buffers are
 * spelled wchar_t* here, NOT LPWSTR -- in this shim LPWSTR is char* (the SDK's
 * UNICODE=0 narrow alias), but ToonTalk's wide_character == WCHAR == wchar_t and
 * the real API takes WCHAR*. Matching wchar_t* lets text.cpp:1182 type-check. */
int   MultiByteToWideChar(UINT CodePage, DWORD dwFlags, LPCSTR lpMultiByteStr,
                          int cbMultiByte, wchar_t *lpWideCharStr, int cchWideChar);
int   WideCharToMultiByte(UINT CodePage, DWORD dwFlags, const wchar_t *lpWideCharStr,
                          int cchWideChar, LPSTR lpMultiByteStr, int cbMultiByte,
                          LPCSTR lpDefaultChar, LPBOOL lpUsedDefaultChar);

/* KERNEL32 file / directory helpers */
DWORD GetShortPathNameA(LPCSTR lpszLongPath, LPSTR lpszShortPath, DWORD cchBuffer);
DWORD GetLongPathNameA(LPCSTR lpszShortPath, LPSTR lpszLongPath, DWORD cchBuffer);
DWORD GetFullPathNameA(LPCSTR lpFileName, DWORD nBufferLength, LPSTR lpBuffer, LPSTR *lpFilePart);
BOOL  CreateDirectoryA(LPCSTR lpPathName, LPSECURITY_ATTRIBUTES lpSecurityAttributes);
BOOL  RemoveDirectoryA(LPCSTR lpPathName);
BOOL  DeleteFileA(LPCSTR lpFileName);
BOOL  MoveFileA(LPCSTR lpExistingFileName, LPCSTR lpNewFileName);
BOOL  CopyFileA(LPCSTR lpExistingFileName, LPCSTR lpNewFileName, BOOL bFailIfExists);
DWORD GetFileAttributesA(LPCSTR lpFileName);
UINT  GetPrivateProfileIntA(LPCSTR lpAppName, LPCSTR lpKeyName, INT nDefault, LPCSTR lpFileName);

/* KERNEL32 global/local heap (legacy clipboard / DDE style allocation) */
HGLOBAL GlobalAlloc(UINT uFlags, SIZE_T dwBytes);
HGLOBAL GlobalReAlloc(HGLOBAL hMem, SIZE_T dwBytes, UINT uFlags);
HGLOBAL GlobalFree(HGLOBAL hMem);
LPVOID  GlobalLock(HGLOBAL hMem);
BOOL    GlobalUnlock(HGLOBAL hMem);
SIZE_T  GlobalSize(HGLOBAL hMem);
HLOCAL  LocalAlloc(UINT uFlags, SIZE_T uBytes);
HLOCAL  LocalFree(HLOCAL hMem);

/* KERNEL32 process heap (genpalet.cpp's octree quantizer allocates via these). */
HANDLE  GetProcessHeap(void);
LPVOID  HeapAlloc(HANDLE hHeap, DWORD dwFlags, SIZE_T dwBytes);
BOOL    HeapFree(HANDLE hHeap, DWORD dwFlags, LPVOID lpMem);
LPVOID  HeapReAlloc(HANDLE hHeap, DWORD dwFlags, LPVOID lpMem, SIZE_T dwBytes);

/* KERNEL32 dynamic library loading (bird.cpp/input.cpp probe optional DLLs). */
HMODULE LoadLibraryA(LPCSTR lpLibFileName);
HMODULE LoadLibraryW(LPCWSTR lpLibFileName);
FARPROC GetProcAddress(HMODULE hModule, LPCSTR lpProcName);
BOOL    FreeLibrary(HMODULE hLibModule);

/* KERNEL32 misc */
DWORD GetLastError(void);
void  SetLastError(DWORD dwErrCode);
void  Sleep(DWORD dwMilliseconds);
DWORD GetFileSize(HANDLE hFile, LPDWORD lpFileSizeHigh);

/* KERNEL32 file I/O (file.cpp / wingutil.cpp read bitmaps + save data). */
HANDLE CreateFileA(LPCSTR lpFileName, DWORD dwDesiredAccess, DWORD dwShareMode,
                   LPSECURITY_ATTRIBUTES lpSecurityAttributes, DWORD dwCreationDisposition,
                   DWORD dwFlagsAndAttributes, HANDLE hTemplateFile);
BOOL  ReadFile(HANDLE hFile, LPVOID lpBuffer, DWORD nNumberOfBytesToRead,
               LPDWORD lpNumberOfBytesRead, LPVOID lpOverlapped);
BOOL  WriteFile(HANDLE hFile, LPCVOID lpBuffer, DWORD nNumberOfBytesToWrite,
                LPDWORD lpNumberOfBytesWritten, LPVOID lpOverlapped);
BOOL  CloseHandle(HANDLE hObject);
DWORD SetFilePointer(HANDLE hFile, LONG lDistanceToMove, LONG *lpDistanceToMoveHigh, DWORD dwMoveMethod);
BOOL  SetEndOfFile(HANDLE hFile);
BOOL  FlushFileBuffers(HANDLE hFile);
HINSTANCE GetModuleHandleA(LPCSTR lpModuleName);

/* legacy OpenFile + OFSTRUCT (still referenced behind commented-out lines and as
 * a declared local in wingutil.cpp). */
typedef struct _OFSTRUCT {
    BYTE cBytes, fFixedDisk;
    WORD nErrCode;
    WORD Reserved1, Reserved2;
    CHAR szPathName[128];
} OFSTRUCT, *LPOFSTRUCT, *POFSTRUCT;
HFILE OpenFile(LPCSTR lpFileName, LPOFSTRUCT lpReOpenBuff, UINT uStyle);

/* legacy 16-bit-style resource access used by wingutil.cpp's bitmap loader. */
HGLOBAL AccessResource(HINSTANCE hInst, HRSRC hRsrc);

/* USER32 string-resource + INI helpers. */
int   LoadStringA(HINSTANCE hInstance, UINT uID, LPSTR lpBuffer, int cchBufferMax);
DWORD GetPrivateProfileStringA(LPCSTR lpAppName, LPCSTR lpKeyName, LPCSTR lpDefault,
                               LPSTR lpReturnedString, DWORD nSize, LPCSTR lpFileName);
BOOL  WritePrivateProfileStringA(LPCSTR lpAppName, LPCSTR lpKeyName, LPCSTR lpString, LPCSTR lpFileName);
DWORD GetProfileStringA(LPCSTR lpAppName, LPCSTR lpKeyName, LPCSTR lpDefault, LPSTR lpReturnedString, DWORD nSize);

/* KERNEL32 time. */
void  GetLocalTime(LPSYSTEMTIME lpSystemTime);
void  GetSystemTime(LPSYSTEMTIME lpSystemTime);
BOOL  SystemTimeToFileTime(const SYSTEMTIME *lpSystemTime, LPFILETIME lpFileTime);
BOOL  FileTimeToSystemTime(const FILETIME *lpFileTime, LPSYSTEMTIME lpSystemTime);
BOOL  FileTimeToLocalFileTime(const FILETIME *lpFileTime, LPFILETIME lpLocalFileTime);
LONG  CompareFileTime(const FILETIME *lpFileTime1, const FILETIME *lpFileTime2);
BOOL  GetFileTime(HANDLE hFile, LPFILETIME lpCreationTime, LPFILETIME lpLastAccessTime, LPFILETIME lpLastWriteTime);

/* KERNEL32 FormatMessage (ttfile.cpp turns a GetLastError code into text). */
DWORD FormatMessageA(DWORD dwFlags, LPCVOID lpSource, DWORD dwMessageId, DWORD dwLanguageId,
                     LPSTR lpBuffer, DWORD nSize, void *Arguments);

/* KERNEL32 time-zone + locale-aware date/time formatting (log.cpp timestamps
 * each narration entry in the user's locale). */
typedef struct _TIME_ZONE_INFORMATION {
    LONG       Bias;
    wchar_t    StandardName[32];   /* WCHAR isn't typedef'd until objbase.h; use wchar_t */
    SYSTEMTIME StandardDate;
    LONG       StandardBias;
    wchar_t    DaylightName[32];
    SYSTEMTIME DaylightDate;
    LONG       DaylightBias;
} TIME_ZONE_INFORMATION, *LPTIME_ZONE_INFORMATION, *PTIME_ZONE_INFORMATION;
DWORD GetTimeZoneInformation(LPTIME_ZONE_INFORMATION lpTimeZoneInformation);
BOOL  SystemTimeToTzSpecificLocalTime(const TIME_ZONE_INFORMATION *lpTimeZone, const SYSTEMTIME *lpUniversalTime, LPSYSTEMTIME lpLocalTime);
int   GetDateFormatA(LCID Locale, DWORD dwFlags, const SYSTEMTIME *lpDate, LPCSTR lpFormat, LPSTR lpDateStr, int cchDate);
int   GetTimeFormatA(LCID Locale, DWORD dwFlags, const SYSTEMTIME *lpTime, LPCSTR lpFormat, LPSTR lpTimeStr, int cchTime);
int   GetLocaleInfoA(LCID Locale, DWORD LCType, LPSTR lpLCData, int cchData);

/* version + SEH (mdump.cpp). */
typedef struct _OSVERSIONINFOA {
    DWORD dwOSVersionInfoSize;
    DWORD dwMajorVersion, dwMinorVersion, dwBuildNumber, dwPlatformId;
    CHAR  szCSDVersion[128];
} OSVERSIONINFOA, *LPOSVERSIONINFOA, OSVERSIONINFO, *LPOSVERSIONINFO;
BOOL  GetVersionExA(LPOSVERSIONINFOA lpVersionInformation);
struct _EXCEPTION_POINTERS;
typedef LONG (WINAPI *LPTOP_LEVEL_EXCEPTION_FILTER)(struct _EXCEPTION_POINTERS *);
LPTOP_LEVEL_EXCEPTION_FILTER SetUnhandledExceptionFilter(LPTOP_LEVEL_EXCEPTION_FILTER lpTopLevelExceptionFilter);
LONG  UnhandledExceptionFilter(struct _EXCEPTION_POINTERS *ExceptionInfo);

/* GDI palette objects (wingutil.cpp builds/reads logical palettes). */
HPALETTE CreatePalette(const LOGPALETTE *lplpal);
UINT     GetPaletteEntries(HPALETTE hpal, UINT iStartIndex, UINT nEntries, LPPALETTEENTRY lppe);
UINT     SetPaletteEntries(HPALETTE hpal, UINT iStart, UINT cEntries, const PALETTEENTRY *lppe);
UINT     GetSystemPaletteEntries(HDC hdc, UINT iStart, UINT cEntries, LPPALETTEENTRY lppe);
int      GetDIBits(HDC hdc, HBITMAP hbmp, UINT uStartScan, UINT cScanLines, LPVOID lpvBits, LPBITMAPINFO lpbi, UINT uUsage);
int      SetDIBits(HDC hdc, HBITMAP hbmp, UINT uStartScan, UINT cScanLines, const VOID *lpvBits, const BITMAPINFO *lpbi, UINT fuColorUse);

/* KERNEL32 resource access (pad.cpp reads embedded help pages from resources). */
HRSRC   FindResourceA(HMODULE hModule, LPCSTR lpName, LPCSTR lpType);
HGLOBAL LoadResource(HMODULE hModule, HRSRC hResInfo);
LPVOID  LockResource(HGLOBAL hResData);
BOOL    UnlockResource(HGLOBAL hResData);
BOOL    FreeResource(HGLOBAL hResData);
DWORD   SizeofResource(HMODULE hModule, HRSRC hResInfo);

/* USER32 window / message helpers */
HWND  FindWindowA(LPCSTR lpClassName, LPCSTR lpWindowName);
void  PostQuitMessage(int nExitCode);
int   MessageBoxA(HWND hWnd, LPCSTR lpText, LPCSTR lpCaption, UINT uType);
/* wide MessageBox: xml.cpp shows a BSTR / L"..." debug dump through it. The W
 * args are true wide strings, not this shim's narrow LPCWSTR alias. */
int   MessageBoxW(HWND hWnd, const wchar_t *lpText, const wchar_t *lpCaption, UINT uType);
LRESULT SendMessageA(HWND hWnd, UINT Msg, WPARAM wParam, LPARAM lParam);
BOOL    PostMessageA(HWND hWnd, UINT Msg, WPARAM wParam, LPARAM lParam);
LRESULT SendDlgItemMessageA(HWND hDlg, int nIDDlgItem, UINT Msg, WPARAM wParam, LPARAM lParam);

/* GDI/USER palette management (cleanup.cpp resets the system palette on exit). */
UINT  SetSystemPaletteUse(HDC hdc, UINT uUsage);
UINT  GetSystemPaletteUse(HDC hdc);
UINT  RealizePalette(HDC hdc);
HPALETTE SelectPalette(HDC hdc, HPALETTE hpal, BOOL bForceBackground);
int   GetSystemMetrics(int nIndex);

/* USER32 keyboard state */
SHORT GetAsyncKeyState(int vKey);
SHORT GetKeyState(int nVirtKey);
BOOL  IsCharUpperA(CHAR ch);
BOOL  IsCharLowerA(CHAR ch);

/* GDI32 drawing primitives (screen.cpp clears/fills via these). */
HBRUSH CreateSolidBrush(COLORREF crColor);
HPEN   CreatePen(int fnPenStyle, int nWidth, COLORREF crColor);
BOOL   Rectangle(HDC hdc, int l, int t, int r, int b);
BOOL   Ellipse(HDC hdc, int l, int t, int r, int b);
BOOL   Polygon(HDC hdc, const POINT *lpPoints, int nCount);
BOOL   MoveToEx(HDC hdc, int X, int Y, LPPOINT lpPoint);
BOOL   LineTo(HDC hdc, int nXEnd, int nYEnd);
COLORREF SetBkColor(HDC hdc, COLORREF crColor);
int    SetBkMode(HDC hdc, int iBkMode);
COLORREF SetTextColor(HDC hdc, COLORREF crColor);
HDC    CreateCompatibleDC(HDC hdc);
HBITMAP CreateCompatibleBitmap(HDC hdc, int nWidth, int nHeight);
BOOL   StretchBlt(HDC dst, int xd, int yd, int wd, int hd, HDC src, int xs, int ys, int ws, int hs, DWORD rop);
int    GetObjectA(HGDIOBJ hgdiobj, int cbBuffer, LPVOID lpvObject);

/* GDI device-caps + nearest-palette lookup (wingutil.cpp builds colour-translation
 * tables; common.cpp queries the screen resolution for the HTML dialog). */
int    GetDeviceCaps(HDC hdc, int nIndex);
UINT   GetNearestPaletteIndex(HPALETTE hpal, COLORREF crColor);

/* USER32 coordinate mapping + mouse capture / foreground (dragdrop.cpp converts
 * drop points to client space; input.cpp grabs the mouse for the joystick path). */
BOOL  ScreenToClient(HWND hWnd, LPPOINT lpPoint);
BOOL  ClientToScreen(HWND hWnd, LPPOINT lpPoint);
HWND  SetCapture(HWND hWnd);
BOOL  ReleaseCapture(void);
BOOL  SetForegroundWindow(HWND hWnd);
HWND  GetForegroundWindow(void);

/* KERNEL32 current-directory / module path / temp path (Starttt.cpp + mdump.cpp
 * locate the log file, the running .exe and the crash-dump directory). */
DWORD GetCurrentDirectoryA(DWORD nBufferLength, LPSTR lpBuffer);
BOOL  SetCurrentDirectoryA(LPCSTR lpPathName);
DWORD GetModuleFileNameA(HMODULE hModule, LPSTR lpFilename, DWORD nSize);
DWORD GetTempPathA(DWORD nBufferLength, LPSTR lpBuffer);
BOOL  SetFileAttributesA(LPCSTR lpFileName, DWORD dwFileAttributes);

/* KERNEL32 process / thread identity (mdump.cpp tags the minidump). */
HANDLE GetCurrentProcess(void);
DWORD  GetCurrentProcessId(void);
DWORD  GetCurrentThreadId(void);

/* KERNEL32 directory enumeration (utils.cpp walks a folder to delete it, and
 * resolves shortcuts). WIN32_FIND_DATA layout from winbase.h. */
#ifndef _WIN32_FIND_DATA_DEFINED
#define _WIN32_FIND_DATA_DEFINED
typedef struct _WIN32_FIND_DATAA {
    DWORD    dwFileAttributes;
    FILETIME ftCreationTime;
    FILETIME ftLastAccessTime;
    FILETIME ftLastWriteTime;
    DWORD    nFileSizeHigh;
    DWORD    nFileSizeLow;
    DWORD    dwReserved0;
    DWORD    dwReserved1;
    CHAR     cFileName[MAX_PATH];
    CHAR     cAlternateFileName[14];
} WIN32_FIND_DATAA, *PWIN32_FIND_DATAA, *LPWIN32_FIND_DATAA;
typedef WIN32_FIND_DATAA WIN32_FIND_DATA, *PWIN32_FIND_DATA, *LPWIN32_FIND_DATA;
#endif
HANDLE FindFirstFileA(LPCSTR lpFileName, LPWIN32_FIND_DATAA lpFindFileData);
BOOL   FindNextFileA(HANDLE hFindFile, LPWIN32_FIND_DATAA lpFindFileData);
BOOL   FindClose(HANDLE hFindFile);

/* KERNEL32 global-memory status (utils.cpp reports free RAM). */
#ifndef _MEMORYSTATUS_DEFINED
#define _MEMORYSTATUS_DEFINED
typedef struct _MEMORYSTATUS {
    DWORD  dwLength;
    DWORD  dwMemoryLoad;
    SIZE_T dwTotalPhys;
    SIZE_T dwAvailPhys;
    SIZE_T dwTotalPageFile;
    SIZE_T dwAvailPageFile;
    SIZE_T dwTotalVirtual;
    SIZE_T dwAvailVirtual;
} MEMORYSTATUS, *LPMEMORYSTATUS;
#endif
void GlobalMemoryStatus(LPMEMORYSTATUS lpBuffer);

/* KERNEL32 serial-comms (ttfile.cpp lets a ToonTalk "file" be a COM port: it
 * parses a mode string into a DCB and applies it). No web analogue; declarations
 * only. DCB layout is the winbase.h one so BuildCommDCB can fill it. */
#ifndef _DCB_DEFINED
#define _DCB_DEFINED
typedef struct _DCB {
    DWORD DCBlength;
    DWORD BaudRate;
    DWORD fBinary           : 1;
    DWORD fParity           : 1;
    DWORD fOutxCtsFlow      : 1;
    DWORD fOutxDsrFlow      : 1;
    DWORD fDtrControl       : 2;
    DWORD fDsrSensitivity   : 1;
    DWORD fTXContinueOnXoff : 1;
    DWORD fOutX             : 1;
    DWORD fInX              : 1;
    DWORD fErrorChar        : 1;
    DWORD fNull             : 1;
    DWORD fRtsControl       : 2;
    DWORD fAbortOnError     : 1;
    DWORD fDummy2           : 17;
    WORD  wReserved;
    WORD  XonLim;
    WORD  XoffLim;
    BYTE  ByteSize;
    BYTE  Parity;
    BYTE  StopBits;
    char  XonChar;
    char  XoffChar;
    char  ErrorChar;
    char  EofChar;
    char  EvtChar;
    WORD  wReserved1;
} DCB, *LPDCB;
#endif
BOOL BuildCommDCBA(LPCSTR lpDef, DCB *lpDCB);
BOOL SetCommState(HANDLE hFile, DCB *lpDCB);
BOOL GetCommState(HANDLE hFile, DCB *lpDCB);

#ifdef __cplusplus
}
#endif

#ifndef GMEM_FIXED
#define GMEM_FIXED          0x0000
#define GMEM_MOVEABLE       0x0002
#define GMEM_ZEROINIT       0x0040
#define GHND                (GMEM_MOVEABLE | GMEM_ZEROINIT)
#define GPTR                (GMEM_FIXED | GMEM_ZEROINIT)
#endif

#ifndef GetShortPathName
#define GetShortPathName    GetShortPathNameA
#define GetLongPathName     GetLongPathNameA
#define GetFullPathName     GetFullPathNameA
#define CreateDirectory     CreateDirectoryA
#define RemoveDirectory     RemoveDirectoryA
#define DeleteFile          DeleteFileA
#define MoveFile            MoveFileA
#define CopyFile            CopyFileA
#define GetFileAttributes   GetFileAttributesA
#define GetPrivateProfileInt GetPrivateProfileIntA
#endif

#ifndef IsCharAlpha
#define IsCharAlpha        IsCharAlphaA
#define IsCharAlphaNumeric IsCharAlphaNumericA
#endif

/* A/W -> bare name aliases for the functions added above (ANSI build). */
#ifndef LoadLibrary
#define LoadLibrary    LoadLibraryA
#endif
#ifndef CreateFile
#define CreateFile     CreateFileA
#define GetModuleHandle GetModuleHandleA
#endif
#ifndef SendMessage
#define SendMessage         SendMessageA
#define PostMessage         PostMessageA
#define SendDlgItemMessage  SendDlgItemMessageA
#endif
#ifndef LoadString
#define LoadString             LoadStringA
#define GetPrivateProfileString GetPrivateProfileStringA
#define WritePrivateProfileString WritePrivateProfileStringA
#define GetProfileString       GetProfileStringA
#define FormatMessage          FormatMessageA
#define GetVersionEx           GetVersionExA
#endif

/* TEXT()/_TEXT() string-literal decoration (UNICODE off -> narrow). */
#ifndef TEXT
#define TEXT(q)  q
#define _TEXT(q) q
#endif

/* a subset of Win32 error codes referenced directly. */
#ifndef ERROR_SUCCESS
#define ERROR_SUCCESS              0L
#define ERROR_FILE_NOT_FOUND       2L
#define ERROR_PATH_NOT_FOUND       3L
#define ERROR_ACCESS_DENIED        5L
#define ERROR_INVALID_HANDLE       6L
#define ERROR_NOT_ENOUGH_MEMORY    8L
#define ERROR_NO_MORE_FILES        18L
#define ERROR_INVALID_PARAMETER    87L
#define ERROR_INSUFFICIENT_BUFFER  122L
#define ERROR_ALREADY_EXISTS       183L
#define ERROR_MORE_DATA            234L
#define ERROR_NO_MORE_ITEMS        259L
#endif

/* FormatMessage dwFlags + language-id helpers. */
#ifndef FORMAT_MESSAGE_ALLOCATE_BUFFER
#define FORMAT_MESSAGE_ALLOCATE_BUFFER 0x00000100
#define FORMAT_MESSAGE_IGNORE_INSERTS  0x00000200
#define FORMAT_MESSAGE_FROM_STRING     0x00000400
#define FORMAT_MESSAGE_FROM_HMODULE    0x00000800
#define FORMAT_MESSAGE_FROM_SYSTEM     0x00001000
#define FORMAT_MESSAGE_ARGUMENT_ARRAY  0x00002000
#define FORMAT_MESSAGE_MAX_WIDTH_MASK  0x000000FF
#endif
#ifndef LANG_NEUTRAL
#define LANG_NEUTRAL      0x00
#define SUBLANG_DEFAULT   0x01
#define MAKELANGID(p, s)  ((((WORD)(s)) << 10) | (WORD)(p))
#endif

/* GetVersionEx platform ids. */
#ifndef VER_PLATFORM_WIN32_NT
#define VER_PLATFORM_WIN32s        0
#define VER_PLATFORM_WIN32_WINDOWS 1
#define VER_PLATFORM_WIN32_NT      2
#endif

/* palette-entry peFlags (CreatePalette / animation). */
#ifndef PC_RESERVED
#define PC_RESERVED   0x01
#define PC_EXPLICIT   0x02
#define PC_NOCOLLAPSE 0x04
#endif

/* RGNDATAHEADER + the RGNDATA already declared opaquely above; winmain.cpp names
 * the header to build clipping regions. */
#ifndef _RGNDATAHEADER_DEFINED
#define _RGNDATAHEADER_DEFINED
typedef struct _RGNDATAHEADER {
    DWORD dwSize, iType, nCount, nRgnSize;
    RECT  rcBound;
} RGNDATAHEADER, *PRGNDATAHEADER;
#endif
#ifndef RDH_RECTANGLES
#define RDH_RECTANGLES 1
#endif

/* SetFilePointer dwMoveMethod origins. */
#ifndef FILE_BEGIN
#define FILE_BEGIN    0
#define FILE_CURRENT  1
#define FILE_END      2
#endif
#ifndef INVALID_SET_FILE_POINTER
#define INVALID_SET_FILE_POINTER ((DWORD)-1)
#endif

/* resource-type pseudo-handles (MAKEINTRESOURCE) for FindResource / LoadResource. */
#ifndef MAKEINTRESOURCE
#define MAKEINTRESOURCE(i) ((LPSTR)((ULONG_PTR)((WORD)(i))))
#endif
#ifndef RT_BITMAP
#define RT_CURSOR       MAKEINTRESOURCE(1)
#define RT_BITMAP       MAKEINTRESOURCE(2)
#define RT_ICON         MAKEINTRESOURCE(3)
#define RT_MENU         MAKEINTRESOURCE(4)
#define RT_DIALOG       MAKEINTRESOURCE(5)
#define RT_STRING       MAKEINTRESOURCE(6)
#define RT_RCDATA       MAKEINTRESOURCE(10)
#define RT_GROUP_CURSOR MAKEINTRESOURCE(12)
#define RT_GROUP_ICON   MAKEINTRESOURCE(14)
#define RT_VERSION      MAKEINTRESOURCE(16)
#endif

/* OS/2-style DIB header (wingutil.cpp distinguishes it from BITMAPINFOHEADER). */
#ifndef _BITMAPCOREHEADER_DEFINED
#define _BITMAPCOREHEADER_DEFINED
typedef struct tagBITMAPCOREHEADER {
    DWORD bcSize;
    WORD  bcWidth, bcHeight, bcPlanes, bcBitCount;
} BITMAPCOREHEADER, *LPBITMAPCOREHEADER, *PBITMAPCOREHEADER;
typedef struct tagBITMAPCOREINFO {
    BITMAPCOREHEADER bmciHeader;
    RGBTRIPLE        bmciColors[1];
} BITMAPCOREINFO, *LPBITMAPCOREINFO, *PBITMAPCOREINFO;
#endif
#ifndef FindResource
#define FindResource   FindResourceA
#define FindWindow     FindWindowA
#define MessageBox     MessageBoxA
#define IsCharUpper    IsCharUpperA
#define IsCharLower    IsCharLowerA
#define GetObject      GetObjectA
#endif

/* ZeroMemory / CopyMemory / FillMemory: the SDK defines these as memset/memcpy
 * wrappers in winbase.h. */
#ifndef ZeroMemory
#define ZeroMemory(d, l) memset((d), 0, (l))
#define CopyMemory(d, s, l) memcpy((d), (s), (l))
#define MoveMemory(d, s, l) memmove((d), (s), (l))
#define FillMemory(d, l, f) memset((d), (f), (l))
#endif

/* HeapAlloc flags */
#ifndef HEAP_ZERO_MEMORY
#define HEAP_NO_SERIALIZE          0x00000001
#define HEAP_GENERATE_EXCEPTIONS   0x00000004
#define HEAP_ZERO_MEMORY           0x00000008
#endif

/* CreateFile access / share / disposition / attribute flags + INFINITE. */
#ifndef GENERIC_READ
#define GENERIC_READ        0x80000000U
#define GENERIC_WRITE       0x40000000U
#define GENERIC_EXECUTE     0x20000000U
#define GENERIC_ALL         0x10000000U
#endif
#ifndef FILE_SHARE_READ
#define FILE_SHARE_READ     0x00000001
#define FILE_SHARE_WRITE    0x00000002
#define FILE_SHARE_DELETE   0x00000004
#endif
#ifndef CREATE_NEW
#define CREATE_NEW          1
#define CREATE_ALWAYS       2
#define OPEN_EXISTING       3
#define OPEN_ALWAYS         4
#define TRUNCATE_EXISTING   5
#endif
#ifndef FILE_ATTRIBUTE_NORMAL
#define FILE_ATTRIBUTE_READONLY   0x00000001
#define FILE_ATTRIBUTE_HIDDEN     0x00000002
#define FILE_ATTRIBUTE_SYSTEM     0x00000004
#define FILE_ATTRIBUTE_DIRECTORY  0x00000010
#define FILE_ATTRIBUTE_ARCHIVE    0x00000020
#define FILE_ATTRIBUTE_NORMAL     0x00000080
#endif
#ifndef INVALID_FILE_ATTRIBUTES
#define INVALID_FILE_ATTRIBUTES   ((DWORD)-1)
#endif
#ifndef INFINITE
#define INFINITE            0xFFFFFFFF
#endif

/* OpenFile (legacy) action flags (file.cpp / ttfile probing). */
#ifndef OF_READ
#define OF_READ             0x00000000
#define OF_WRITE            0x00000001
#define OF_READWRITE        0x00000002
#define OF_SHARE_DENY_NONE  0x00000040
#define OF_DELETE           0x00000200
#define OF_EXIST            0x00004000
#endif

/* pen styles (CreatePen) */
#ifndef PS_SOLID
#define PS_SOLID       0
#define PS_DASH        1
#define PS_DOT         2
#define PS_DASHDOT     3
#define PS_DASHDOTDOT  4
#define PS_NULL        5
#define PS_INSIDEFRAME 6
#endif

/* SetBkMode modes */
#ifndef TRANSPARENT
#define TRANSPARENT 1
#define OPAQUE      2
#endif

/* SetSystemPaletteUse value (cleanup.cpp). */
#ifndef SYSPAL_STATIC
#define SYSPAL_ERROR   0
#define SYSPAL_STATIC  1
#define SYSPAL_NOSTATIC 2
#endif

/* StretchBlt raster-op (only SRCCOPY is referenced). */
#ifndef SRCCOPY
#define SRCCOPY     (DWORD)0x00CC0020
#endif

/* extra virtual-key codes beyond the VK_F1..F12 block above (help.cpp uses F16). */
#ifndef VK_F13
#define VK_F13 0x7C
#define VK_F14 0x7D
#define VK_F15 0x7E
#define VK_F16 0x7F
#define VK_F17 0x80
#define VK_F18 0x81
#define VK_F19 0x82
#define VK_F20 0x83
#endif

/* Window messages. The WndProc in winmain.cpp / clickme.cpp switches on the full
 * set; values are the fixed winuser.h ones. */
#ifndef WM_DESTROY
#define WM_CREATE       0x0001
#define WM_DESTROY      0x0002
#define WM_MOVE         0x0003
#define WM_SIZE         0x0005
#define WM_SETFOCUS     0x0007
#define WM_KILLFOCUS    0x0008
#define WM_PAINT        0x000F
#define WM_CLOSE        0x0010
#define WM_QUIT         0x0012
#define WM_QUERYOPEN    0x0013
#define WM_GETMINMAXINFO 0x0024
#define WM_COMPACTING   0x0041
#define WM_COPYDATA     0x004A
#define WM_KEYFIRST     0x0100
#define WM_KEYDOWN      0x0100
#define WM_KEYUP        0x0101
#define WM_CHAR         0x0102
#define WM_SYSKEYDOWN   0x0104
#define WM_SYSKEYUP     0x0105
#define WM_KEYLAST      0x0108
#define WM_IME_STARTCOMPOSITION 0x010D
#define WM_IME_ENDCOMPOSITION   0x010E
#define WM_IME_COMPOSITION      0x010F
#define WM_INITDIALOG   0x0110
#define WM_COMMAND      0x0111
#define WM_SYSCOMMAND   0x0112
#define WM_TIMER        0x0113
#define WM_SETFONT      0x0030
#define WM_GETFONT      0x0031
#define WM_QUERYNEWPALETTE 0x030F
#define WM_PALETTECHANGED  0x0311
#define WM_IME_NOTIFY   0x0282
#define WM_IME_CHAR     0x0286
#define WM_MOUSEFIRST   0x0200
#define WM_MOUSEMOVE    0x0200
#define WM_LBUTTONDOWN  0x0201
#define WM_LBUTTONUP    0x0202
#define WM_RBUTTONDOWN  0x0204
#define WM_RBUTTONUP    0x0205
#define WM_MBUTTONDOWN  0x0207
#define WM_MBUTTONUP    0x0208
#define WM_DROPFILES    0x0233
#define WM_USER         0x0400
#endif

/* window styles (CreateWindow / MCIWndCreate dwStyle). */
#ifndef WS_OVERLAPPED
#define WS_OVERLAPPED   0x00000000L
#define WS_POPUP        0x80000000L
#define WS_CHILD        0x40000000L
#define WS_MINIMIZE     0x20000000L
#define WS_VISIBLE      0x10000000L
#define WS_DISABLED     0x08000000L
#define WS_CLIPSIBLINGS 0x04000000L
#define WS_CLIPCHILDREN 0x02000000L
#define WS_MAXIMIZE     0x01000000L
#define WS_CAPTION      0x00C00000L
#define WS_BORDER       0x00800000L
#define WS_DLGFRAME     0x00400000L
#define WS_VSCROLL      0x00200000L
#define WS_HSCROLL      0x00100000L
#define WS_SYSMENU      0x00080000L
#define WS_THICKFRAME   0x00040000L
#define WS_GROUP        0x00020000L
#define WS_TABSTOP      0x00010000L
#define WS_MINIMIZEBOX  0x00020000L
#define WS_MAXIMIZEBOX  0x00010000L
#define WS_OVERLAPPEDWINDOW (WS_OVERLAPPED|WS_CAPTION|WS_SYSMENU|WS_THICKFRAME|WS_MINIMIZEBOX|WS_MAXIMIZEBOX)
#define WS_CHILDWINDOW  (WS_CHILD)
#endif

/* COPYDATASTRUCT (WM_COPYDATA payload -- Dispdib.h's window message helper). */
#ifndef _COPYDATASTRUCT_DEFINED
#define _COPYDATASTRUCT_DEFINED
typedef struct tagCOPYDATASTRUCT {
    ULONG_PTR dwData;
    DWORD     cbData;
    PVOID     lpData;
} COPYDATASTRUCT, *PCOPYDATASTRUCT;
#endif

/* --- GDI stock-object indices (GetStockObject) --- */
#ifndef WHITE_BRUSH
#define WHITE_BRUSH         0
#define LTGRAY_BRUSH        1
#define GRAY_BRUSH          2
#define DKGRAY_BRUSH        3
#define BLACK_BRUSH         4
#define NULL_BRUSH          5
#define HOLLOW_BRUSH        NULL_BRUSH
#define WHITE_PEN           6
#define BLACK_PEN           7
#define NULL_PEN            8
#define OEM_FIXED_FONT      10
#define ANSI_FIXED_FONT     11
#define ANSI_VAR_FONT       12
#define SYSTEM_FONT         13
#define DEVICE_DEFAULT_FONT 14
#define DEFAULT_PALETTE     15
#define SYSTEM_FIXED_FONT   16
#define DEFAULT_GUI_FONT    17
#endif

/* --- SetTextAlign / GetTextAlign flags --- */
#ifndef TA_LEFT
#define TA_NOUPDATECP  0
#define TA_UPDATECP    1
#define TA_LEFT        0
#define TA_RIGHT       2
#define TA_CENTER      6
#define TA_TOP         0
#define TA_BOTTOM      8
#define TA_BASELINE    24
#define TA_RTLREADING  256
#endif

/* --- code-page identifiers used by the ANSI<->wide conversions --- */
#ifndef CP_ACP
#define CP_ACP        0
#define CP_OEMCP      1
#define CP_MACCP      2
#define CP_THREAD_ACP 3
#define CP_SYMBOL     42
#define CP_UTF7       65000
#define CP_UTF8       65001
#endif

/* --- MessageBox button/icon/style flags (winuser.h) --- */
#ifndef MB_OK
#define MB_OK                0x00000000
#define MB_OKCANCEL          0x00000001
#define MB_ABORTRETRYIGNORE  0x00000002
#define MB_YESNOCANCEL       0x00000003
#define MB_YESNO             0x00000004
#define MB_RETRYCANCEL       0x00000005
#define MB_ICONHAND          0x00000010
#define MB_ICONSTOP          MB_ICONHAND
#define MB_ICONERROR         MB_ICONHAND
#define MB_ICONQUESTION      0x00000020
#define MB_ICONEXCLAMATION   0x00000030
#define MB_ICONWARNING       MB_ICONEXCLAMATION
#define MB_ICONASTERISK      0x00000040
#define MB_ICONINFORMATION   MB_ICONASTERISK
#define MB_DEFBUTTON1        0x00000000
#define MB_DEFBUTTON2        0x00000100
#define MB_DEFBUTTON3        0x00000200
#define MB_SYSTEMMODAL       0x00001000
#define MB_TASKMODAL         0x00002000
#define MB_SETFOREGROUND     0x00010000
#define MB_TOPMOST           0x00040000
#endif

/* --- MessageBox / dialog return values --- */
#ifndef IDOK
#define IDOK      1
#define IDCANCEL  2
#define IDABORT   3
#define IDRETRY   4
#define IDIGNORE  5
#define IDYES     6
#define IDNO      7
#endif

/* --- virtual-key codes (subset referenced by ToonTalk's key handling) --- */
#ifndef VK_LEFT
#define VK_BACK     0x08
#define VK_TAB      0x09
#define VK_RETURN   0x0D
#define VK_SHIFT    0x10
#define VK_CONTROL  0x11
#define VK_ESCAPE   0x1B
#define VK_SPACE    0x20
#define VK_PRIOR    0x21
#define VK_NEXT     0x22
#define VK_END      0x23
#define VK_HOME     0x24
#define VK_LEFT     0x25
#define VK_UP       0x26
#define VK_RIGHT    0x27
#define VK_DOWN     0x28
#define VK_INSERT   0x2D
#define VK_DELETE   0x2E
#define VK_F1       0x70
#define VK_F2       0x71
#define VK_F3       0x72
#define VK_F4       0x73
#define VK_F5       0x74
#define VK_F6       0x75
#define VK_F7       0x76
#define VK_F8       0x77
#define VK_F9       0x78
#define VK_F10      0x79
#define VK_F11      0x7A
#define VK_F12      0x7B
#endif

/* The real <windows.h> pulls in <shellapi.h> (ShellExecute + SW_* show codes)
 * unless WIN32_LEAN_AND_MEAN is set. ToonTalk relies on that transitive include
 * (e.g. robot.cpp calls ShellExecute/SW_SHOW with shellapi.h only #included
 * under a !TT_32 branch that is never taken). Mirror the SDK here. Placed at the
 * end so all the base types above are already visible. */
#include "shellapi.h"

/* The real <windows.h> also pulls in <commdlg.h> (the common-dialog boxes)
 * unless WIN32_LEAN_AND_MEAN is set. clickme.cpp relies on that transitive
 * include for GetSaveFileName / OPENFILENAME. */
#include "commdlg.h"

/* ---------------------------------------------------------------------------
 * Extra constants / types / operators surfaced by the platform + COM files
 * (Starttt, dragdrop, dsutil, file, ...). Declarations only; bodies linked later.
 * ------------------------------------------------------------------------- */
#ifdef __cplusplus
/* dragdrop.cpp compares IIDs/GUIDs with == (self-contained, no dependency). */
inline bool operator==(const GUID &a, const GUID &b) {
    return a.Data1 == b.Data1 && a.Data2 == b.Data2 && a.Data3 == b.Data3 &&
           a.Data4[0] == b.Data4[0] && a.Data4[1] == b.Data4[1] &&
           a.Data4[2] == b.Data4[2] && a.Data4[3] == b.Data4[3] &&
           a.Data4[4] == b.Data4[4] && a.Data4[5] == b.Data4[5] &&
           a.Data4[6] == b.Data4[6] && a.Data4[7] == b.Data4[7];
}
inline bool operator!=(const GUID &a, const GUID &b) { return !(a == b); }
#endif

/* 64-bit file offsets (file.cpp). Anonymous struct in a union = clang extension. */
typedef union _LARGE_INTEGER {
    struct { DWORD LowPart; LONG HighPart; };
    LONGLONG QuadPart;
} LARGE_INTEGER, *PLARGE_INTEGER;
typedef union _ULARGE_INTEGER {
    struct { DWORD LowPart; DWORD HighPart; };
    ULONGLONG QuadPart;
} ULARGE_INTEGER, *PULARGE_INTEGER;

/* Local/Global heap allocation flags (dsutil.cpp uses LPTR). */
#define LMEM_FIXED    0x0000
#define LMEM_MOVEABLE 0x0002
#define LMEM_ZEROINIT 0x0040
#define LPTR          (LMEM_FIXED | LMEM_ZEROINIT)
#define GMEM_FIXED    0x0000
#define GMEM_MOVEABLE 0x0002
#define GMEM_ZEROINIT 0x0040
#define GPTR          (GMEM_FIXED | GMEM_ZEROINIT)

/* Primary-language identifiers (Starttt.cpp maps the OS UI language onto
 * ToonTalk's localized resource sets). Values from winnt.h. */
#ifndef LANG_FRENCH
#define LANG_FRENCH         0x0c
#define LANG_GERMAN         0x07
#define LANG_ITALIAN        0x10
#define LANG_JAPANESE       0x11
#define LANG_PORTUGUESE     0x16
#define LANG_SPANISH        0x0a
#define LANG_SWEDISH        0x1d
#define LANG_TURKISH        0x1f
#endif
/* (LANG_NEUTRAL / LANG_ENGLISH / SUBLANG_DEFAULT / MAKELANGID / PRIMARYLANGID
 *  are defined just above; left in place for callers that include only this
 *  trailer region.) */
#ifndef LANG_ENGLISH
#define LANG_NEUTRAL        0x00
#define LANG_ENGLISH        0x09
#define SUBLANG_DEFAULT     0x01
#define MAKELANGID(p, s)    ((WORD)((((WORD)(s)) << 10) | (WORD)(p)))
#define PRIMARYLANGID(lgid) ((WORD)((lgid) & 0x3ff))
#endif

/* GetDeviceCaps indices (common.cpp reads screen resolution; wingutil queries
 * colour depth). Values from wingdi.h. */
#ifndef HORZRES
#define HORZRES        8
#define VERTRES        10
#define BITSPIXEL      12
#define PLANES         14
#define NUMCOLORS      24
#define RASTERCAPS     38
#define SIZEPALETTE    104
#endif

/* OpenFile additional action flag (Starttt.cpp creates the log via OF_CREATE). */
#ifndef OF_CREATE
#define OF_CREATE      0x00001000
#endif

/* Structured-exception filter dispositions (mdump.cpp's __except handler). */
#ifndef EXCEPTION_EXECUTE_HANDLER
#define EXCEPTION_EXECUTE_HANDLER     1
#define EXCEPTION_CONTINUE_SEARCH     0
#define EXCEPTION_CONTINUE_EXECUTION (-1)
#endif

/* Locale id + GetDateFormat flags (log.cpp). */
#ifndef LOCALE_USER_DEFAULT
#define LOCALE_USER_DEFAULT    0x0400
#define LOCALE_SYSTEM_DEFAULT  0x0800
#endif
#ifndef DATE_LONGDATE
#define DATE_SHORTDATE  0x00000001
#define DATE_LONGDATE   0x00000002
#define DATE_USE_ALT_CALENDAR 0x00000004
#endif

/* GetTimeZoneInformation return codes. */
#ifndef TIME_ZONE_ID_UNKNOWN
#define TIME_ZONE_ID_UNKNOWN   0
#define TIME_ZONE_ID_STANDARD  1
#define TIME_ZONE_ID_DAYLIGHT  2
#endif

/* Int32x32To64: MSVC winnt.h macro -- widening 32x32 multiply (log.cpp converts
 * a tick count to a 64-bit FILETIME). */
#ifndef Int32x32To64
#define Int32x32To64(a, b)  (((LONGLONG)(LONG)(a)) * ((LONGLONG)(LONG)(b)))
#define UInt32x32To64(a, b) (((ULONGLONG)(ULONG)(a)) * ((ULONGLONG)(ULONG)(b)))
#endif

/* A/W -> bare-name aliases for the functions added to the GDI/USER block. */
#ifndef GetCurrentDirectory
#define GetCurrentDirectory  GetCurrentDirectoryA
#define SetCurrentDirectory  SetCurrentDirectoryA
#define GetModuleFileName    GetModuleFileNameA
#define GetTempPath          GetTempPathA
#define SetFileAttributes    SetFileAttributesA
#define BuildCommDCB         BuildCommDCBA
#define GetDateFormat        GetDateFormatA
#define GetTimeFormat        GetTimeFormatA
#define GetLocaleInfo        GetLocaleInfoA
#define LoadBitmap           LoadBitmapA
#define FindFirstFile        FindFirstFileA
#define FindNextFile         FindNextFileA
#endif

/* MakeProcInstance / FreeProcInstance: 16-bit-era thunk helpers. On Win32 they
 * are no-ops -- MakeProcInstance just yields the function pointer, FreeProcInstance
 * does nothing. (Starttt.cpp wraps its dialog procs through them.) */
#ifndef MakeProcInstance
#define MakeProcInstance(proc, inst)  (proc)
#define FreeProcInstance(proc)        ((void)0)
#endif

/* ===========================================================================
 * USER32 windowing + message loop, clipboard, cursor, dialog, and the GDI text
 * / pixel / font primitives that the WndProc-owning translation units use
 * (winmain.cpp, clickme.cpp, Starttt.cpp). All standard winuser.h/wingdi.h
 * surface; declarations only -- phase 1 maps the live ones onto the canvas/DOM.
 * Placed last so every base type/handle above is already in scope.
 * ======================================================================== */

/* WndProc + window-class registration. */
#ifndef _WNDCLASS_DEFINED
#define _WNDCLASS_DEFINED
typedef LRESULT (CALLBACK *WNDPROC)(HWND, UINT, WPARAM, LPARAM);
typedef BOOL    (CALLBACK *DLGPROC)(HWND, UINT, WPARAM, LPARAM);
typedef VOID    (CALLBACK *TIMERPROC)(HWND, UINT, UINT_PTR, DWORD);
typedef struct tagWNDCLASSA {
    UINT      style;
    WNDPROC   lpfnWndProc;
    int       cbClsExtra;
    int       cbWndExtra;
    HINSTANCE hInstance;
    HICON     hIcon;
    HCURSOR   hCursor;
    HBRUSH    hbrBackground;
    LPCSTR    lpszMenuName;
    LPCSTR    lpszClassName;
} WNDCLASSA, *LPWNDCLASSA, *PWNDCLASSA;
typedef struct tagWNDCLASSEXA {
    UINT      cbSize;
    UINT      style;
    WNDPROC   lpfnWndProc;
    int       cbClsExtra;
    int       cbWndExtra;
    HINSTANCE hInstance;
    HICON     hIcon;
    HCURSOR   hCursor;
    HBRUSH    hbrBackground;
    LPCSTR    lpszMenuName;
    LPCSTR    lpszClassName;
    HICON     hIconSm;
} WNDCLASSEXA, *LPWNDCLASSEXA, *PWNDCLASSEXA;
typedef struct tagCREATESTRUCTA {
    LPVOID    lpCreateParams;
    HINSTANCE hInstance;
    HMENU     hMenu;
    HWND      hwndParent;
    int       cy, cx, y, x;
    LONG      style;
    LPCSTR    lpszName;
    LPCSTR    lpszClass;
    DWORD     dwExStyle;
} CREATESTRUCTA, *LPCREATESTRUCTA, *LPCREATESTRUCT;
typedef struct tagPAINTSTRUCT {
    HDC  hdc;
    BOOL fErase;
    RECT rcPaint;
    BOOL fRestore, fIncUpdate;
    BYTE rgbReserved[32];
} PAINTSTRUCT, *LPPAINTSTRUCT, *PPAINTSTRUCT;
typedef struct tagMINMAXINFO {
    POINT ptReserved, ptMaxSize, ptMaxPosition, ptMinTrackSize, ptMaxTrackSize;
} MINMAXINFO, *LPMINMAXINFO, *PMINMAXINFO;
typedef struct tagLOGFONTA {
    LONG lfHeight, lfWidth, lfEscapement, lfOrientation, lfWeight;
    BYTE lfItalic, lfUnderline, lfStrikeOut, lfCharSet, lfOutPrecision,
         lfClipPrecision, lfQuality, lfPitchAndFamily;
    CHAR lfFaceName[32];
} LOGFONTA, *LPLOGFONTA, *PLOGFONTA;
typedef struct tagTEXTMETRICA {
    LONG tmHeight, tmAscent, tmDescent, tmInternalLeading, tmExternalLeading,
         tmAveCharWidth, tmMaxCharWidth, tmWeight, tmOverhang,
         tmDigitizedAspectX, tmDigitizedAspectY;
    BYTE tmFirstChar, tmLastChar, tmDefaultChar, tmBreakChar, tmItalic,
         tmUnderlined, tmStruckOut, tmPitchAndFamily, tmCharSet;
} TEXTMETRICA, *LPTEXTMETRICA, *PTEXTMETRICA;
typedef LOGFONTA  LOGFONT;
typedef TEXTMETRICA TEXTMETRIC, *LPTEXTMETRIC;
/* bare (UNICODE-off) type-name aliases. */
typedef WNDCLASSA   WNDCLASS, *LPWNDCLASS, *PWNDCLASS;
typedef WNDCLASSEXA WNDCLASSEX, *LPWNDCLASSEX, *PWNDCLASSEX;
typedef CREATESTRUCTA CREATESTRUCT;
#endif

#ifdef __cplusplus
extern "C" {
#endif
/* class registration + window lifetime */
ATOM  RegisterClassA(const WNDCLASSA *lpWndClass);
ATOM  RegisterClassExA(const WNDCLASSEXA *lpWndClassEx);
BOOL  UnregisterClassA(LPCSTR lpClassName, HINSTANCE hInstance);
HWND  CreateWindowExA(DWORD dwExStyle, LPCSTR lpClassName, LPCSTR lpWindowName, DWORD dwStyle,
                      int X, int Y, int nWidth, int nHeight, HWND hWndParent, HMENU hMenu,
                      HINSTANCE hInstance, LPVOID lpParam);
LRESULT DefWindowProcA(HWND hWnd, UINT Msg, WPARAM wParam, LPARAM lParam);
LRESULT CallWindowProcA(WNDPROC lpPrevWndFunc, HWND hWnd, UINT Msg, WPARAM wParam, LPARAM lParam);
LONG  GetWindowLongA(HWND hWnd, int nIndex);
LONG  SetWindowLongA(HWND hWnd, int nIndex, LONG dwNewLong);
LONG_PTR GetWindowLongPtrA(HWND hWnd, int nIndex);
LONG_PTR SetWindowLongPtrA(HWND hWnd, int nIndex, LONG_PTR dwNewLong);

/* message loop */
BOOL  GetMessageA(LPMSG lpMsg, HWND hWnd, UINT wMsgFilterMin, UINT wMsgFilterMax);
BOOL  PeekMessageA(LPMSG lpMsg, HWND hWnd, UINT wMsgFilterMin, UINT wMsgFilterMax, UINT wRemoveMsg);
BOOL  TranslateMessage(const MSG *lpMsg);
LRESULT DispatchMessageA(const MSG *lpMsg);
LRESULT GetMessageTime(void);

/* timers */
UINT_PTR SetTimer(HWND hWnd, UINT_PTR nIDEvent, UINT uElapse, TIMERPROC lpTimerFunc);
BOOL     KillTimer(HWND hWnd, UINT_PTR uIDEvent);

/* window state / geometry / focus / z-order */
BOOL  IsIconic(HWND hWnd);
BOOL  IsZoomed(HWND hWnd);
HWND  SetActiveWindow(HWND hWnd);
HWND  GetActiveWindow(void);
HWND  GetFocus(void);
HWND  GetLastActivePopup(HWND hWnd);
BOOL  GetWindowRect(HWND hWnd, LPRECT lpRect);
BOOL  GetClientRect(HWND hWnd, LPRECT lpRect);
BOOL  MoveWindow(HWND hWnd, int X, int Y, int nWidth, int nHeight, BOOL bRepaint);
BOOL  SetWindowPos(HWND hWnd, HWND hWndInsertAfter, int X, int Y, int cx, int cy, UINT uFlags);
BOOL  SetWindowTextA(HWND hWnd, LPCSTR lpString);
int   GetWindowTextA(HWND hWnd, LPSTR lpString, int nMaxCount);
BOOL  InvalidateRect(HWND hWnd, const RECT *lpRect, BOOL bErase);
BOOL  RedrawWindow(HWND hWnd, const RECT *lpRectUpdate, HRGN hrgnUpdate, UINT flags);
BOOL  GetUpdateRect(HWND hWnd, LPRECT lpRect, BOOL bErase);

/* painting */
HDC   BeginPaint(HWND hWnd, LPPAINTSTRUCT lpPaint);
BOOL  EndPaint(HWND hWnd, const PAINTSTRUCT *lpPaint);
int   FillRect(HDC hDC, const RECT *lprc, HBRUSH hbr);

/* desktop window + beep + (legacy) message-queue sizing. */
HWND  GetDesktopWindow(void);
BOOL  MessageBeep(UINT uType);
int   SetMessageQueue(int cMessagesMax); /* 16-bit-era no-op on Win32 */

/* GDI bit-blit + DC teardown + bitmap-resource load (Starttt/clickme splash). */
BOOL    BitBlt(HDC hdcDest, int x, int y, int cx, int cy, HDC hdcSrc, int x1, int y1, DWORD rop);
BOOL    DeleteDC(HDC hdc);
HBITMAP LoadBitmapA(HINSTANCE hInstance, LPCSTR lpBitmapName);

/* cursor / mouse position */
HCURSOR LoadCursorA(HINSTANCE hInstance, LPCSTR lpCursorName);
HCURSOR SetCursor(HCURSOR hCursor);
int     ShowCursor(BOOL bShow);
BOOL    GetCursorPos(LPPOINT lpPoint);
BOOL    SetCursorPos(int X, int Y);
BOOL    ClipCursor(const RECT *lpRect);
HICON   LoadIconA(HINSTANCE hInstance, LPCSTR lpIconName);

/* accelerators + menus */
HACCEL  LoadAcceleratorsA(HINSTANCE hInstance, LPCSTR lpTableName);
int     TranslateAcceleratorA(HWND hWnd, HACCEL hAccTable, LPMSG lpMsg);
HMENU   GetSystemMenu(HWND hWnd, BOOL bRevert);
BOOL    EnableMenuItem(HMENU hMenu, UINT uIDEnableItem, UINT uEnable);

/* dialogs */
HWND  CreateDialogParamA(HINSTANCE hInstance, LPCSTR lpTemplateName, HWND hWndParent, DLGPROC lpDialogFunc, LPARAM dwInitParam);
INT_PTR DialogBoxParamA(HINSTANCE hInstance, LPCSTR lpTemplateName, HWND hWndParent, DLGPROC lpDialogFunc, LPARAM dwInitParam);
BOOL  EndDialog(HWND hDlg, INT_PTR nResult);
HWND  GetDlgItem(HWND hDlg, int nIDDlgItem);
UINT  GetDlgItemTextA(HWND hDlg, int nIDDlgItem, LPSTR lpString, int cchMax);
BOOL  SetDlgItemTextA(HWND hDlg, int nIDDlgItem, LPCSTR lpString);

/* system metrics / parameters */
BOOL  SystemParametersInfoA(UINT uiAction, UINT uiParam, PVOID pvParam, UINT fWinIni);

/* clipboard */
BOOL    OpenClipboard(HWND hWndNewOwner);
BOOL    CloseClipboard(void);
BOOL    EmptyClipboard(void);
HANDLE  GetClipboardData(UINT uFormat);
HANDLE  SetClipboardData(UINT uFormat, HANDLE hMem);
BOOL    IsClipboardFormatAvailable(UINT format);
UINT    RegisterClipboardFormatA(LPCSTR lpszFormat);

/* IME (winmain handles WM_IME_* to support CJK input). */
HIMC    ImmGetContext(HWND hWnd);
BOOL    ImmReleaseContext(HWND hWnd, HIMC hIMC);
LONG    ImmGetCompositionStringA(HIMC hIMC, DWORD dwIndex, LPVOID lpBuf, DWORD dwBufLen);
DWORD   ImmGetConversionStatus(HIMC hIMC, LPDWORD lpfdwConversion, LPDWORD lpfdwSentence);

/* GDI text + pixel + region + font (winmain draws labels / probes colours). */
/* The W variants take a *true* wide string (wchar_t*), NOT this shim's narrow
 * LPCWSTR alias -- winmain feeds them wide_string (== wchar_t*) built by
 * MultiByteToWideChar, exactly as on the real platform. */
BOOL     TextOutA(HDC hdc, int x, int y, LPCSTR lpString, int c);
BOOL     TextOutW(HDC hdc, int x, int y, const wchar_t *lpString, int c);
LONG     TabbedTextOutA(HDC hdc, int x, int y, LPCSTR lpString, int chCount, int nTabPositions, const INT *lpnTabStopPositions, int nTabOrigin);
LONG     TabbedTextOutW(HDC hdc, int x, int y, const wchar_t *lpString, int chCount, int nTabPositions, const INT *lpnTabStopPositions, int nTabOrigin);
BOOL     GetTextExtentPoint32A(HDC hdc, LPCSTR lpString, int c, LPSIZE lpSize);
BOOL     GetTextExtentPoint32W(HDC hdc, const wchar_t *lpString, int c, LPSIZE lpSize);
DWORD    GetTabbedTextExtentA(HDC hdc, LPCSTR lpString, int chCount, int nTabPositions, const INT *lpnTabStopPositions);
DWORD    GetTabbedTextExtentW(HDC hdc, const wchar_t *lpString, int chCount, int nTabPositions, const INT *lpnTabStopPositions);
UINT     SetTextAlign(HDC hdc, UINT fMode);
COLORREF SetPixel(HDC hdc, int x, int y, COLORREF crColor);
COLORREF GetPixel(HDC hdc, int x, int y);
BOOL     RoundRect(HDC hdc, int l, int t, int r, int b, int w, int h);
HRGN     CreateRectRgn(int x1, int y1, int x2, int y2);
int      SelectClipRgn(HDC hdc, HRGN hrgn);
BOOL     SetBrushOrgEx(HDC hdc, int x, int y, LPPOINT lppt);
HBITMAP  CreateDIBitmap(HDC hdc, const BITMAPINFOHEADER *lpbmih, DWORD fdwInit, const void *lpbInit, const BITMAPINFO *lpbmi, UINT fuUsage);
HBRUSH   CreateDIBPatternBrushPt(const void *lpPackedDIB, UINT iUsage);
HBRUSH   CreateDIBPatternBrush(HGLOBAL hglbDIBPacked, UINT fuColorSpec); /* legacy 16-bit-handle form (winmain) */
UINT     SetErrorMode(UINT uMode); /* Starttt suppresses the OS critical-error / open-file boxes */
HFONT    CreateFontIndirectA(const LOGFONTA *lplf);
HFONT    CreateFontA(int h, int w, int esc, int orient, int weight, DWORD italic, DWORD underline,
                     DWORD strikeout, DWORD charset, DWORD outprec, DWORD clipprec, DWORD quality,
                     DWORD pitchfam, LPCSTR face);
BOOL     GetTextMetricsA(HDC hdc, LPTEXTMETRICA lptm);
#ifdef __cplusplus
}
#endif

/* bare-name aliases (ANSI build). */
#ifndef RegisterClass
#define RegisterClass        RegisterClassA
#define RegisterClassEx      RegisterClassExA
#define UnregisterClass      UnregisterClassA
#define CreateWindowEx       CreateWindowExA
#define DefWindowProc        DefWindowProcA
#define CallWindowProc       CallWindowProcA
#define GetWindowLong        GetWindowLongA
#define SetWindowLong        SetWindowLongA
#define GetWindowLongPtr     GetWindowLongPtrA
#define SetWindowLongPtr     SetWindowLongPtrA
#define GetMessage           GetMessageA
#define PeekMessage          PeekMessageA
#define DispatchMessage      DispatchMessageA
#define SetWindowText        SetWindowTextA
#define GetWindowText        GetWindowTextA
#define LoadCursor           LoadCursorA
#define LoadIcon             LoadIconA
#define LoadAccelerators     LoadAcceleratorsA
#define TranslateAccelerator TranslateAcceleratorA
#define CreateDialogParam    CreateDialogParamA
#define DialogBoxParam       DialogBoxParamA
#define GetDlgItemText       GetDlgItemTextA
#define SetDlgItemText       SetDlgItemTextA
#define SystemParametersInfo SystemParametersInfoA
#define RegisterClipboardFormat RegisterClipboardFormatA
#define TextOut              TextOutA
#define GetTextExtentPoint32 GetTextExtentPoint32A
#define GetTabbedTextExtent  GetTabbedTextExtentA
#define TabbedTextOut        TabbedTextOutA
#define CreateFontIndirect   CreateFontIndirectA
#define CreateFont           CreateFontA
#define GetTextMetrics       GetTextMetricsA
#define ImmGetCompositionString ImmGetCompositionStringA
/* CreateWindow is the no-ex-style wrapper macro. */
#define CreateWindow(cls, name, style, x, y, w, h, parent, menu, inst, param) \
        CreateWindowExA(0, (cls), (name), (style), (x), (y), (w), (h), (parent), (menu), (inst), (param))
/* DialogBox / CreateDialog: template-name forms without the extra param. */
#define DialogBox(inst, tmpl, parent, proc)   DialogBoxParamA((inst), (tmpl), (parent), (proc), 0)
#define DialogBoxA(inst, tmpl, parent, proc)  DialogBoxParamA((inst), (tmpl), (parent), (proc), 0)
#define CreateDialog(inst, tmpl, parent, proc)  CreateDialogParamA((inst), (tmpl), (parent), (proc), 0)
#define CreateDialogA(inst, tmpl, parent, proc) CreateDialogParamA((inst), (tmpl), (parent), (proc), 0)
#endif

/* class styles (CS_*). */
#ifndef CS_VREDRAW
#define CS_VREDRAW   0x0001
#define CS_HREDRAW   0x0002
#define CS_DBLCLKS   0x0008
#define CS_OWNDC     0x0020
#define CS_CLASSDC   0x0040
#define CS_PARENTDC  0x0080
#define CS_SAVEBITS  0x0800
#define CS_NOCLOSE   0x0200
#endif

/* GetWindowLong indices + CreateWindow default position. */
#ifndef GWL_WNDPROC
#define GWL_WNDPROC    (-4)
#define GWL_HINSTANCE  (-6)
#define GWL_HWNDPARENT (-8)
#define GWL_ID         (-12)
#define GWL_STYLE      (-16)
#define GWL_EXSTYLE    (-20)
#define GWL_USERDATA   (-21)
#define GWLP_WNDPROC   (-4)
#define GWLP_USERDATA  (-21)
#endif
#ifndef CW_USEDEFAULT
#define CW_USEDEFAULT  ((int)0x80000000)
#endif

/* SetWindowPos flags + z-order pseudo-handles. */
#ifndef SWP_NOSIZE
#define SWP_NOSIZE     0x0001
#define SWP_NOMOVE     0x0002
#define SWP_NOZORDER   0x0004
#define SWP_NOACTIVATE 0x0010
#define SWP_SHOWWINDOW 0x0040
#define SWP_HIDEWINDOW 0x0080
#endif
#ifndef HWND_TOP
#define HWND_TOP       ((HWND)0)
#define HWND_BOTTOM    ((HWND)1)
#define HWND_TOPMOST   ((HWND)-1)
#define HWND_NOTOPMOST ((HWND)-2)
#endif

/* RedrawWindow flags. */
#ifndef RDW_INVALIDATE
#define RDW_INVALIDATE    0x0001
#define RDW_INTERNALPAINT 0x0002
#define RDW_ERASE         0x0004
#define RDW_UPDATENOW     0x0100
#define RDW_ERASENOW      0x0200
#define RDW_ALLCHILDREN   0x0080
#define RDW_NOCHILDREN    0x0040
#endif

/* system-command + screensaver wParam values (WM_SYSCOMMAND). */
#ifndef SC_CLOSE
#define SC_SIZE       0xF000
#define SC_MOVE       0xF010
#define SC_MINIMIZE   0xF020
#define SC_MAXIMIZE   0xF030
#define SC_KEYMENU    0xF100
#define SC_CLOSE      0xF060
#define SC_SCREENSAVE 0xF140
#define SC_MONITORPOWER 0xF170
#endif

/* GetSystemMetrics indices. */
#ifndef SM_CXSCREEN
#define SM_CXSCREEN   0
#define SM_CYSCREEN   1
#define SM_CYCAPTION  4
#define SM_CXBORDER   5
#define SM_CYBORDER   6
#define SM_CXFRAME    32
#define SM_CYFRAME    33
#define SM_CXFULLSCREEN 16
#define SM_CYFULLSCREEN 17
#endif

/* SystemParametersInfo actions. */
#ifndef SPI_GETWORKAREA
#define SPI_GETWORKAREA   48
#endif

/* PeekMessage wRemoveMsg flags. */
#ifndef PM_REMOVE
#define PM_NOREMOVE   0x0000
#define PM_REMOVE     0x0001
#define PM_NOYIELD    0x0002
#endif

/* button-control styles + messages (Starttt's dialog toggles a checkbox /
 * queries a push-button). */
#ifndef BS_PUSHBUTTON
#define BS_PUSHBUTTON     0x00000000L
#define BS_DEFPUSHBUTTON  0x00000001L
#define BS_CHECKBOX       0x00000002L
#define BS_AUTOCHECKBOX   0x00000003L
#define BS_RADIOBUTTON    0x00000004L
#define BS_GROUPBOX       0x00000007L
#endif
#ifndef BM_GETCHECK
#define BM_GETCHECK   0x00F0
#define BM_SETCHECK   0x00F1
#define BM_GETSTATE   0x00F2
#define BM_SETSTATE   0x00F3
#define BST_UNCHECKED 0x0000
#define BST_CHECKED   0x0001
#endif

/* standard cursor / icon resource ids (IDC_* / IDI_*). */
#ifndef IDC_ARROW
#define IDC_ARROW       MAKEINTRESOURCE(32512)
#define IDC_IBEAM       MAKEINTRESOURCE(32513)
#define IDC_WAIT        MAKEINTRESOURCE(32514)
#define IDC_CROSS       MAKEINTRESOURCE(32515)
#define IDC_SIZEALL     MAKEINTRESOURCE(32646)
#define IDC_HAND        MAKEINTRESOURCE(32649)
#define IDC_NO          MAKEINTRESOURCE(32648)
#endif
#ifndef IDI_APPLICATION
#define IDI_APPLICATION MAKEINTRESOURCE(32512)
#endif

/* system-colour indices (hbrBackground = (HBRUSH)(COLOR_WINDOW+1)). */
#ifndef COLOR_WINDOW
#define COLOR_SCROLLBAR     0
#define COLOR_BACKGROUND    1
#define COLOR_WINDOW        5
#define COLOR_WINDOWTEXT    8
#define COLOR_BTNFACE       15
#define COLOR_BTNTEXT       18
#endif

/* clipboard formats. */
#ifndef CF_TEXT
#define CF_TEXT         1
#define CF_BITMAP       2
#define CF_DIB          8
#define CF_UNICODETEXT  13
#define CF_HDROP        15
#endif

/* GDI text-alignment flags (SetTextAlign). */
#ifndef TA_LEFT
#define TA_LEFT     0
#define TA_RIGHT    2
#define TA_CENTER   6
#define TA_TOP      0
#define TA_BOTTOM   8
#define TA_BASELINE 24
#endif

/* CreateDIBitmap fdwInit + DIB colour-table usage. */
#ifndef CBM_INIT
#define CBM_INIT    0x04
#endif

/* CreateFont weight / charset / precision / quality / pitch+family
 * (winmain builds a logical font for on-screen text). */
#ifndef FW_NORMAL
#define FW_DONTCARE 0
#define FW_NORMAL   400
#define FW_BOLD     700
#endif
#ifndef DEFAULT_CHARSET
#define ANSI_CHARSET     0
#define DEFAULT_CHARSET  1
#define SHIFTJIS_CHARSET 128
#endif
#ifndef OUT_DEFAULT_PRECIS
#define OUT_DEFAULT_PRECIS  0
#define CLIP_DEFAULT_PRECIS 0
#define DEFAULT_QUALITY     0
#define DRAFT_QUALITY       1
#define PROOF_QUALITY       2
#endif
#ifndef DEFAULT_PITCH
#define DEFAULT_PITCH  0
#define FIXED_PITCH    1
#define VARIABLE_PITCH 2
#define FF_DONTCARE  (0<<4)
#define FF_ROMAN     (1<<4)
#define FF_SWISS     (2<<4)
#define FF_MODERN    (3<<4)
#define FF_SCRIPT    (4<<4)
#define FF_DECORATIVE (5<<4)
#endif

/* GDI error sentinels. */
#ifndef CLR_INVALID
#define CLR_INVALID 0xFFFFFFFF
#endif
#ifndef GDI_ERROR
#define GDI_ERROR   0xFFFFFFFF
#endif

/* GetDeviceCaps RASTERCAPS bits (winmain tests RC_PALETTE). */
#ifndef RC_PALETTE
#define RC_PALETTE  0x0100
#endif

/* IME conversion-string index flags + notify codes (WM_IME_*). */
#ifndef GCS_COMPSTR
#define GCS_COMPSTR        0x0008
#define GCS_RESULTSTR      0x0800
#define GCS_RESULTCLAUSE   0x1000
#endif
#ifndef IMN_SETCONVERSIONMODE
#define IMN_SETCONVERSIONMODE 0x0006
#endif

/* SetErrorMode flags (Starttt suppresses the OS open-file error box). */
#ifndef SEM_FAILCRITICALERRORS
#define SEM_FAILCRITICALERRORS  0x0001
#define SEM_NOOPENFILEERRORBOX  0x8000
#endif

/* a few more virtual-key codes the WndProc switches on (numpad + pause). */
#ifndef VK_PAUSE
#define VK_PAUSE    0x13
#endif
#ifndef VK_NUMPAD0
#define VK_NUMPAD0  0x60
#define VK_NUMPAD1  0x61
#define VK_NUMPAD2  0x62
#define VK_NUMPAD3  0x63
#define VK_NUMPAD4  0x64
#define VK_NUMPAD5  0x65
#define VK_NUMPAD6  0x66
#define VK_NUMPAD7  0x67
#define VK_NUMPAD8  0x68
#define VK_NUMPAD9  0x69
#endif

#endif /* _WINDOWS_SHIM_H_ */
