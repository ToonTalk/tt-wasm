/* dunzdll.h -- DynaZip (unzip side) shim for the ToonTalk WASM port (phase 0).
 *
 * STUB for the proprietary DynaZip Max 5.0 DLL header (see dzipdll.h). zip.cpp
 * drives the dunzip() command interface to read .cty save files. Phase-0
 * contract: types + declarations so zip.cpp COMPILES; bodies unresolved. */
#ifndef _DUNZDLL_SHIM_H_
#define _DUNZDLL_SHIM_H_

#include <windows.h>

/* per-member info returned by the GETZIPINFO functions. */
typedef struct tagZIPINFOEX {
    DWORD ulSize;
    DWORD ulindex;
    DWORD uloSizeLowPart;
    DWORD uloSizeHighPart;
    WORD  wcOption;
    char  szFileName[MAX_PATH];
} ZIPINFOEX, *LPZIPINFOEX;

/* unzip command block (only the fields zip.cpp touches). */
typedef struct tagUNZIPCMDSTRUCT {
    DWORD       unzipStructSize;
    int         function;
    LPSTR       lpszZIPFile;
    LPSTR       lpszFilespec;
    LPSTR       lpszDestination;
    DWORD       index;
    long        lStartingOffset;
    LONG        returnCount;
    BOOL        quietFlag;
    BOOL        recurseFlag;
    BOOL        noDirectoryNamesFlag;
    BOOL        noDirectoryItemsFlag;
    BOOL        overWriteFlag;
    BOOL        updateFlag;
    LPZIPINFOEX pZinfoEx;
    void       *lpMemBlock;
    long        lMemBlockSize;
} UNZIPCMDSTRUCT, *LPUNZIPCMDSTRUCT;

/* unzip "function" selectors. */
#define UNZIP_EXTRACT                1
#define UNZIP_FILETOMEM              2
#define UNZIP_COUNTALLZIPMEMBERS     3
#define UNZIP_COUNTNAMEDZIPMEMBERS   4
#define UNZIP_GETNEXTNAMEDZIPINFO    5
#define UNZIP_GETINDEXEDZIPINFO      6

/* unzip error returns. */
#define UE_OK      0
#define UE_NOFILE  1
#define UE_SKIP    2
#define UE_BORED   3
#define UE_OUTPUT  4
#define UE_MEM     8

#ifdef __cplusplus
extern "C" {
#endif
int FAR PASCAL dunzip(LPUNZIPCMDSTRUCT lpUCS);
#ifdef __cplusplus
}
#endif

#endif /* _DUNZDLL_SHIM_H_ */
