/* CRT-compat shim for the ToonTalk WASM port (phase 0).
 *
 * The old MSVC C runtime exposed a handful of non-standard helpers that
 * libc++/musl (what emcc ships) either renames or omits. ToonTalk calls a few
 * of them in hot paths. We provide behaviour-identical inline definitions /
 * forwarders so the fork compiles unchanged. windows.h pulls this in, so every
 * translation unit that includes <windows.h> sees them.
 *
 *   itoa / ultoa  -> not in musl; small standard radix-to-string conversions.
 *   stricmp/strnicmp -> case-insensitive compare == POSIX strcasecmp/strncasecmp.
 */
#ifndef _CRTCOMPAT_SHIM_H_
#define _CRTCOMPAT_SHIM_H_

#include <string.h>
#include <stddef.h>
#include <ctype.h>
#include <stdlib.h>   /* ecvt/fcvt/gcvt live here in musl */
#include <wchar.h>    /* wcslen / wcscmp / wide-char helpers */
#include <wctype.h>   /* towlower for the wide case-insensitive compares */
#include <float.h>    /* DBL_DIG, DBL_MAX, FLT_* -- MSVC code expects <cfloat> contents */
#include <math.h>     /* isfinite / isnan that _finite / _isnan forward to */
#include <fcntl.h>    /* open + O_* flags for the _lopen/_lcreat family */
#include <unistd.h>   /* read/write/lseek/close for the _lread/_lwrite/... family */

/* MSVC <stdlib.h> path-length macros (mdump.cpp sizes char buffers with these).
 * Values per the CRT: _MAX_PATH == 260, matching MAX_PATH. */
#ifndef _MAX_PATH
#define _MAX_PATH   260
#define _MAX_DRIVE  3
#define _MAX_DIR    256
#define _MAX_FNAME  256
#define _MAX_EXT    256
#endif

#ifdef __cplusplus
extern "C" {
#endif

/* Case-insensitive string compares: identical semantics to MSVC's _stricmp /
 * _strnicmp. POSIX strcasecmp/strncasecmp are gated behind feature-test macros
 * in musl, so implement them self-contained to avoid depending on those. */
#ifndef stricmp
static inline int stricmp(const char *a, const char *b) {
    unsigned char ca, cb;
    do {
        ca = (unsigned char) tolower((unsigned char) *a++);
        cb = (unsigned char) tolower((unsigned char) *b++);
    } while (ca == cb && ca != '\0');
    return (int) ca - (int) cb;
}
#endif
#ifndef strnicmp
static inline int strnicmp(const char *a, const char *b, size_t n) {
    unsigned char ca = 0, cb = 0;
    while (n-- > 0) {
        ca = (unsigned char) tolower((unsigned char) *a++);
        cb = (unsigned char) tolower((unsigned char) *b++);
        if (ca != cb || ca == '\0') return (int) ca - (int) cb;
    }
    return 0;
}
#endif

/* MSVC case-insensitive compare spellings: _stricmp/_strnicmp (underscore) and
 * strcmpi/_strcmpi (the old POSIX-ish name) all alias the implementations above.
 * (utils.cpp uses strcmpi; log.cpp uses _strnicmp.) */
#ifndef _stricmp
#define _stricmp   stricmp
#define _strnicmp  strnicmp
#define strcmpi    stricmp
#define _strcmpi   stricmp
#endif

/* MSVC underscore-prefixed CRT aliases that map onto the unprefixed musl names. */
#ifndef _ecvt
#define _ecvt ecvt
#endif
#ifndef _fcvt
#define _fcvt fcvt
#endif
#ifndef _gcvt
#define _gcvt gcvt
#endif

/* itoa: MSVC signature `char *itoa(int value, char *str, int radix)`.
 * Matches MSVC behaviour: radix 2..36; for radix 10 a negative value gets a
 * leading '-'; for other radixes the value is treated as unsigned (this is the
 * documented CRT behaviour and what ToonTalk relies on -- it switched to ultoa
 * specifically when it wanted the unsigned-for-base-10 behaviour). */
#ifndef itoa
static inline char *itoa(int value, char *str, int radix) {
    char *p = str;
    char *start;
    char tmp;
    unsigned int uvalue;
    if (radix == 10 && value < 0) {
        *p++ = '-';
        uvalue = (unsigned int)(-(long)value);
    } else {
        uvalue = (unsigned int)value;
    }
    start = p;
    do {
        unsigned int digit = uvalue % (unsigned int)radix;
        *p++ = (char)(digit < 10 ? '0' + digit : 'a' + (digit - 10));
        uvalue /= (unsigned int)radix;
    } while (uvalue);
    *p = '\0';
    /* reverse the digits written after any sign */
    for (--p; start < p; ++start, --p) {
        tmp = *start; *start = *p; *p = tmp;
    }
    return str;
}
#endif

/* ultoa: MSVC `char *ultoa(unsigned long value, char *str, int radix)`. */
#ifndef ultoa
static inline char *ultoa(unsigned long value, char *str, int radix) {
    char *p = str;
    char *start = str;
    char tmp;
    do {
        unsigned long digit = value % (unsigned long)radix;
        *p++ = (char)(digit < 10 ? '0' + digit : 'a' + (digit - 10));
        value /= (unsigned long)radix;
    } while (value);
    *p = '\0';
    for (--p; start < p; ++start, --p) {
        tmp = *start; *start = *p; *p = tmp;
    }
    return str;
}
#endif

/* ltoa: MSVC `char *ltoa(long value, char *str, int radix)`. Same sign rule as
 * itoa -- a leading '-' only for radix 10. (Starttt.cpp formats a status long.) */
#ifndef ltoa
static inline char *ltoa(long value, char *str, int radix) {
    char *p = str, *start, tmp;
    unsigned long uvalue;
    if (radix == 10 && value < 0) {
        *p++ = '-';
        uvalue = (unsigned long)(-(long long)value);
    } else {
        uvalue = (unsigned long)value;
    }
    start = p;
    do {
        unsigned long digit = uvalue % (unsigned long)radix;
        *p++ = (char)(digit < 10 ? '0' + digit : 'a' + (digit - 10));
        uvalue /= (unsigned long)radix;
    } while (uvalue);
    *p = '\0';
    for (--p; start < p; ++start, --p) { tmp = *start; *start = *p; *p = tmp; }
    return str;
}
#endif

/* MSVC floating-point classification helpers. In MSVC these are functions in
 * <float.h>; standard C/C++ spell them isfinite/isnan (macros). Map them. */
#ifndef _finite
#define _finite(x) isfinite(x)
#endif
#ifndef _isnan
#define _isnan(x)  isnan(x)
#endif
#ifndef _isinf
#define _isinf(x)  isinf(x)
#endif

/* Win32 lstrcmp/lstrcmpi: ANSI variants are byte-for-byte strcmp / case-insensitive
 * compare. (picture.cpp compares file names / strings through these.) */
#ifndef lstrcmpA
static inline int lstrcmpA(const char *a, const char *b)  { return strcmp(a, b); }
static inline int lstrcmpiA(const char *a, const char *b) { return stricmp(a, b); }
#endif
#ifndef lstrcmp
#define lstrcmp   lstrcmpA
#define lstrcmpi  lstrcmpiA
#endif
/* lstrlen / lstrcpy / lstrcat (narrow) */
#ifndef lstrlen
#define lstrlen   (int)strlen
#define lstrlenA  (int)strlen
#define lstrcpy   strcpy
#define lstrcpyA  strcpy
#define lstrcat   strcat
#define lstrcatA  strcat
#endif

/* hmemcpy: legacy Win16 "huge" memcpy. On Win32 it is a plain memcpy with a
 * (DWORD) length. (wingutil.cpp copies DIB scanlines through it.) */
#ifndef hmemcpy
#define hmemcpy(d, s, n)  memcpy((d), (s), (size_t)(n))
#endif

/* Case-insensitive wide compares: MSVC _wcsicmp / _wcsnicmp (and the
 * non-underscore wcsnicmp the code uses directly). musl lacks them. */
#ifndef _wcsnicmp
static inline int _wcsicmp(const wchar_t *a, const wchar_t *b) {
    wchar_t ca, cb;
    do {
        ca = (wchar_t) towlower(*a++);
        cb = (wchar_t) towlower(*b++);
    } while (ca == cb && ca != L'\0');
    return (int) ca - (int) cb;
}
static inline int _wcsnicmp(const wchar_t *a, const wchar_t *b, size_t n) {
    wchar_t ca = 0, cb = 0;
    while (n-- > 0) {
        ca = (wchar_t) towlower(*a++);
        cb = (wchar_t) towlower(*b++);
        if (ca != cb || ca == L'\0') return (int) ca - (int) cb;
    }
    return 0;
}
#endif
#ifndef wcsnicmp
#define wcsnicmp  _wcsnicmp
#define wcsicmp   _wcsicmp
#endif

/* MSVC wide radix-to-string + parse helpers (event.cpp builds/parses path
 * segments as wide strings). _itow/_ltow/_ultow write base-`radix` digits;
 * _wtoi/_wtol parse a leading signed decimal. */
#ifndef _itow
static inline wchar_t *_ultow(unsigned long value, wchar_t *str, int radix) {
    wchar_t *p = str, *start = str, tmp;
    do {
        unsigned long digit = value % (unsigned long) radix;
        *p++ = (wchar_t)(digit < 10 ? L'0' + digit : L'a' + (digit - 10));
        value /= (unsigned long) radix;
    } while (value);
    *p = L'\0';
    for (--p; start < p; ++start, --p) { tmp = *start; *start = *p; *p = tmp; }
    return str;
}
static inline wchar_t *_itow(int value, wchar_t *str, int radix) {
    wchar_t *p = str;
    if (radix == 10 && value < 0) {
        *p++ = L'-';
        _ultow((unsigned long)(-(long) value), p, radix);
        return str;
    }
    return _ultow((unsigned long) value, str, radix);
}
static inline wchar_t *_ltow(long value, wchar_t *str, int radix) {
    return _itow((int) value, str, radix);
}
static inline int _wtoi(const wchar_t *s) {
    int sign = 1; long v = 0;
    while (*s == L' ' || *s == L'\t') ++s;
    if (*s == L'-') { sign = -1; ++s; } else if (*s == L'+') ++s;
    while (*s >= L'0' && *s <= L'9') v = v * 10 + (*s++ - L'0');
    return (int)(sign * v);
}
static inline long _wtol(const wchar_t *s) { return _wtoi(s); }
#endif

/* 64-bit wide radix-to-string (xml.cpp serializes LONGLONG attributes). */
#ifndef _i64tow
static inline wchar_t *_ui64tow(unsigned long long value, wchar_t *str, int radix) {
    wchar_t *p = str, *start = str, tmp;
    do {
        unsigned long long digit = value % (unsigned long long) radix;
        *p++ = (wchar_t)(digit < 10 ? L'0' + digit : L'a' + (digit - 10));
        value /= (unsigned long long) radix;
    } while (value);
    *p = L'\0';
    for (--p; start < p; ++start, --p) { tmp = *start; *start = *p; *p = tmp; }
    return str;
}
static inline wchar_t *_i64tow(long long value, wchar_t *str, int radix) {
    wchar_t *p = str;
    if (radix == 10 && value < 0) {
        *p++ = L'-';
        _ui64tow((unsigned long long)(-value), p, radix);
        return str;
    }
    return _ui64tow((unsigned long long) value, str, radix);
}
#endif

/* narrow 64-bit radix-to-string (numvalue.cpp formats a bit count). */
#ifndef _ui64toa
static inline char *_ui64toa(unsigned long long value, char *str, int radix) {
    char *p = str, *start = str, tmp;
    do {
        unsigned long long digit = value % (unsigned long long) radix;
        *p++ = (char)(digit < 10 ? '0' + digit : 'a' + (digit - 10));
        value /= (unsigned long long) radix;
    } while (value);
    *p = '\0';
    for (--p; start < p; ++start, --p) { tmp = *start; *start = *p; *p = tmp; }
    return str;
}
static inline char *_i64toa(long long value, char *str, int radix) {
    char *p = str;
    if (radix == 10 && value < 0) { *p++ = '-'; _ui64toa((unsigned long long)(-value), p, radix); return str; }
    return _ui64toa((unsigned long long) value, str, radix);
}
#endif

/* wide parse helpers: _wtoi64 (-> 64-bit) and _wtof (-> double). */
#ifndef _wtoi64
static inline long long _wtoi64(const wchar_t *s) {
    int sign = 1; long long v = 0;
    while (*s == L' ' || *s == L'\t') ++s;
    if (*s == L'-') { sign = -1; ++s; } else if (*s == L'+') ++s;
    while (*s >= L'0' && *s <= L'9') v = v * 10 + (*s++ - L'0');
    return sign * v;
}
#endif
#ifndef _wtof
static inline double _wtof(const wchar_t *s) {
    /* convert the (ASCII-range) wide string to narrow, then strtod. */
    char buf[64]; int i = 0;
    while (s[i] && i < 63) { buf[i] = (char) s[i]; ++i; }
    buf[i] = '\0';
    return strtod(buf, (char **)0);
}
#endif

/* Win32 wide string length/copy (clickme.cpp measures/copies BSTRs). */
#ifndef lstrlenW
static inline int lstrlenW(const wchar_t *s) { return (int) wcslen(s); }
static inline wchar_t *lstrcpyW(wchar_t *d, const wchar_t *s) { return wcscpy(d, s); }
static inline wchar_t *lstrcpynW(wchar_t *d, const wchar_t *s, int n) { return wcsncpy(d, s, (size_t)(n > 0 ? n - 1 : 0)); }
#endif
#ifndef lstrcpyn
#define lstrcpyn  strncpy
#define lstrcpynA strncpy
#endif

/* MSVC legacy 16-bit-era low-level file API (_lopen/_lread/...). These predate
 * _open and map onto the POSIX descriptors; log.cpp / sprite.cpp still use them.
 * _hread/_hwrite are the "huge" (>64K) variants -- same thing on a flat heap.
 * (POSIX open/read/write/lseek/close are declared in <fcntl.h>/<unistd.h>,
 * included at the top of this header.) */
#ifndef _lopen
static inline int _lopen(const char *path, int mode) {
    /* mode is an OF_* style flag; the low 2 bits match O_RDONLY/WRONLY/RDWR. */
    return open(path, (mode & 3));
}
static inline int _lcreat(const char *path, int attr) { (void) attr; return open(path, O_CREAT | O_TRUNC | O_WRONLY, 0644); }
static inline int _lclose(int fd) { return close(fd); }
static inline long _lread(int fd, void *buf, unsigned int count)  { return (long) read(fd, buf, count); }
static inline long _lwrite(int fd, const void *buf, unsigned int count) { return (long) write(fd, buf, count); }
static inline long _hread(int fd, void *buf, long count)  { return (long) read(fd, buf, (size_t) count); }
static inline long _hwrite(int fd, const void *buf, long count) { return (long) write(fd, buf, (size_t) count); }
static inline long _llseek(int fd, long offset, int origin) { return (long) lseek(fd, offset, origin); }
#endif

/* filelength: MSVC `long filelength(int fd)` -- size of an open file by
 * descriptor. Implement via lseek (save/seek-end/restore). log.cpp sizes the
 * pre-recorded speech .wav files with it. */
#ifndef filelength
static inline long filelength(int fd) {
    long cur = (long) lseek(fd, 0, SEEK_CUR);
    long end = (long) lseek(fd, 0, SEEK_END);
    lseek(fd, cur, SEEK_SET);
    return end;
}
#define _filelength filelength
#endif

#ifdef __cplusplus
}
#endif

#endif /* _CRTCOMPAT_SHIM_H_ */
