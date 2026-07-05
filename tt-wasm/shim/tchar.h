/* <tchar.h> shim for the ToonTalk WASM port (phase 0, compile-only).
 *
 * ToonTalk builds with TT_UNICODE=0, so the TCHAR family maps to the narrow
 * (char) variants. We provide the _t* aliases the code references. */
#ifndef _TCHAR_SHIM_H_
#define _TCHAR_SHIM_H_

#include <string.h>
#include <stdio.h>
#include <stdlib.h>
#include "crtcompat.h"   /* stricmp / strnicmp / itoa the _t* macros forward to */

#ifndef _TCHAR_DEFINED
#define _TCHAR_DEFINED
typedef char _TCHAR;
typedef char _TSCHAR;
typedef unsigned char _TUCHAR;
typedef char TCHAR_t;
#endif

#ifndef _TEXT
#define _T(x)    x
#define _TEXT(x) x
#endif

/* string.h / stdio.h narrow mappings */
#define _tcslen   strlen
#define _tcscpy   strcpy
#define _tcsncpy  strncpy
#define _tcscat   strcat
#define _tcscmp   strcmp
#define _tcsncmp  strncmp
#define _tcsicmp  stricmp
#define _tcsnicmp strnicmp
#define _tcschr   strchr
#define _tcsrchr  strrchr
#define _tcsstr   strstr
#define _tcstol   strtol
#define _tcstod   strtod
#define _tprintf  printf
#define _stprintf sprintf
#define _sntprintf snprintf
#define _ftprintf fprintf
#define _tfopen   fopen
#define _itot     itoa
#define _ttoi     atoi
#define _ttol     atol

#endif /* _TCHAR_SHIM_H_ */
