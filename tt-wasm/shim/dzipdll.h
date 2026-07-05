/* dzipdll.h -- DynaZip (zip side) shim for the ToonTalk WASM port (phase 0).
 *
 * STUB for the proprietary DynaZip Max 5.0 DLL header, which the original build
 * #included by absolute path ("C:\Program Files\DynaZip Max 5.0\..."). Not
 * redistributable / not in the tree. zip.cpp drives the dzip() command interface
 * to write .cty save files. Phase-0 contract: types + function declarations so
 * zip.cpp COMPILES; the bodies are unresolved externals (zip/unzip will be
 * provided by a wasm zlib/JSZip path later).
 *
 * Struct layout + constants reconstructed from the member accesses in zip.cpp.
 * The exact numeric values of the command/error enums don't matter for a
 * compile-only build (no two are compared for a specific wire value), but they
 * are given plausible distinct values. */
#ifndef _DZIPDLL_SHIM_H_
#define _DZIPDLL_SHIM_H_

#include <windows.h>

/* zip "rename" callback payload. */
typedef struct tagDZRENAME {
    char  Name[MAX_PATH];
    char  NewName[MAX_PATH];
    DWORD dwSize;
} DZRENAME;

/* memory<->memory progress callback. */
typedef int (FAR PASCAL *PFNMEMTOMEMCALLBACK)(void *lpItem, void *lpUserData);
typedef struct tagCALLBACKSTRUCT {
    DWORD               dwSize;
    PFNMEMTOMEMCALLBACK lpMemToMemProc;
    void               *lpUserData;
} CALLBACKSTRUCT, *LPCALLBACKSTRUCT;

/* zip command block (only the fields zip.cpp touches). */
typedef struct tagZIPCMDSTRUCT {
    DWORD    zipStructSize;
    int      function;
    LPSTR    lpszZIPFile;
    LPSTR    lpszItemList;
    int      compFactor;
    BOOL     quietFlag;
    BOOL     bDiagnostic;
    BOOL     growExistingFlag;
    BOOL     recurseFlag;
    BOOL     noDirectoryNamesFlag;
    BOOL     dontCompressTheseSuffixesFlag;
    LPSTR    lpszStoreSuffixes;
    WORD     wZipSubOptions;
    BOOL     includeOnlyFollowingFlag;
    LPSTR    lpszIncludeFollowing;
    BOOL     deleteOriginalFlag;
    FARPROC  lpRenameProc;
    void    *lpRenameUserData;
    void    *lpMemBlock;
    long     lMemBlockSize;
    LPCALLBACKSTRUCT lpCallbackStruct;
} ZIPCMDSTRUCT, *LPZIPCMDSTRUCT;

/* zip "function" selectors. */
#define ZIP_ADD                 1
#define ZIP_DELETE              2
#define ZIP_MEMTOFILE           3
#define ZIP_MEMTOFILE_STREAM    4
#define ZIP_FRESHEN             5
#define ZIP_UPDATE              6

/* zip error returns. */
#define ZE_OK     0
#define ZE_NONE   0
#define ZE_EOF   -1
#define ZE_WRITE  4
#define ZE_MEM    8

/* memory<->memory callback "action" codes (lAction) + return codes (*plRet). */
#define MEM_READ_DATA   1
#define MEM_WRITE_DATA  2
#define MEM_CONTINUE    0
#define MEM_DONE        1
#define MEM_ERROR      -1

#ifdef __cplusplus
extern "C" {
#endif
int FAR PASCAL dzip(LPZIPCMDSTRUCT lpZCS);
#ifdef __cplusplus
}
#endif

#endif /* _DZIPDLL_SHIM_H_ */
