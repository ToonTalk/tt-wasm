/* <shlobj.h> / <shfolder.h> shim for the ToonTalk WASM port (phase 0).
 *
 * clickme.cpp / common.cpp resolve the user's My Documents + Windows folders via
 * SHGetFolderPath / SHGetSpecialFolderPath; dragdrop.cpp uses the drag-drop
 * helpers (DragQueryFile / DragFinish, normally from <shellapi.h>). Declarations
 * only -- bodies are unresolved externals in phase 0 (mapped to fixed virtual
 * paths / no-op drag-drop later). */
#ifndef _SHLOBJ_SHIM_H_
#define _SHLOBJ_SHIM_H_

#include <windows.h>
#include <objbase.h>
#include <shellapi.h>   /* DragQueryFile / DragFinish / HDROP live here */

/* CSIDL folder identifiers (subset ToonTalk requests). */
#ifndef CSIDL_PERSONAL
#define CSIDL_DESKTOP        0x0000
#define CSIDL_PROGRAMS       0x0002
#define CSIDL_PERSONAL       0x0005   /* My Documents */
#define CSIDL_APPDATA        0x001a
#define CSIDL_WINDOWS        0x0024
#define CSIDL_SYSTEM         0x0025
#define CSIDL_PROGRAM_FILES  0x0026
#define CSIDL_LOCAL_APPDATA  0x001c
#define CSIDL_FLAG_CREATE    0x8000
#endif

/* SHGetFolderPath dwFlags (SHGFP_TYPE_*). The real <shlobj.h> spells this as an
 * enum, and common.cpp pastes an identical copy ("copied from shlobj.h"). If we
 * defined these as bare macros, common.cpp's `enum { SHGFP_TYPE_CURRENT = 0 }`
 * would expand to `0 = 0`. So define the enum here under a guard and have
 * common.cpp skip its copy when the guard is set (clickme.cpp uses the value but
 * defines no enum, so it still needs these symbols). */
#ifndef _SHGFP_TYPE_DEFINED
#define _SHGFP_TYPE_DEFINED
typedef enum {
    SHGFP_TYPE_CURRENT = 0,
    SHGFP_TYPE_DEFAULT = 1
} SHGFP_TYPE;
#endif

typedef struct _ITEMIDLIST *LPITEMIDLIST;
typedef const struct _ITEMIDLIST *LPCITEMIDLIST;

#ifdef __cplusplus
extern "C" {
#endif

/* shfolder.dll entry point (the redistributable path-resolution API). */
HRESULT SHGetFolderPathA(HWND hwnd, int csidl, HANDLE hToken, DWORD dwFlags, LPSTR pszPath);
BOOL    SHGetSpecialFolderPathA(HWND hwnd, LPSTR pszPath, int csidl, BOOL fCreate);

#ifdef __cplusplus
}
#endif

#ifndef SHGetFolderPath
#define SHGetFolderPath        SHGetFolderPathA
#define SHGetSpecialFolderPath SHGetSpecialFolderPathA
#endif

/* ---------------------------------------------------------------------------
 * IShellLink + IPersistFile (normally <shobjidl.h> / <objidl.h>). utils.cpp's
 * ResolveIt() follows a .lnk shortcut to its target. Only the methods reached
 * are real; the rest of each vtable is stubbed with the right slot count so the
 * virtual layout matches. Bodies unresolved in phase 0 (a .lnk has no web
 * analogue -- phase 1 resolves shortcuts host-side or treats them as plain
 * paths). C++-only (ToonTalk's COM call sites are C++). */
#ifdef __cplusplus

/* IShellLink shortcut-link flags. */
#ifndef SLGP_SHORTPATH
#define SLGP_SHORTPATH     0x0001
#define SLGP_UNCPRIORITY   0x0002
#define SLGP_RAWPATH       0x0004
#endif
#ifndef SLR_NO_UI
#define SLR_NO_UI          0x0001
#define SLR_ANY_MATCH      0x0002
#define SLR_UPDATE         0x0004
#define SLR_NOUPDATE       0x0008
#endif

struct IPersistFile : public IUnknown {
    /* IPersist */
    virtual HRESULT GetClassID(CLSID *pClassID) = 0;
    /* IPersistFile */
    virtual HRESULT IsDirty(void) = 0;
    virtual HRESULT Load(LPCOLESTR pszFileName, DWORD dwMode) = 0;
    virtual HRESULT Save(LPCOLESTR pszFileName, BOOL fRemember) = 0;
    virtual HRESULT SaveCompleted(LPCOLESTR pszFileName) = 0;
    virtual HRESULT GetCurFile(LPOLESTR *ppszFileName) = 0;
};

struct IShellLinkA : public IUnknown {
    virtual HRESULT GetPath(LPSTR pszFile, int cch, WIN32_FIND_DATAA *pfd, DWORD fFlags) = 0;
    virtual HRESULT GetIDList(LPITEMIDLIST *ppidl) = 0;
    virtual HRESULT SetIDList(LPCITEMIDLIST pidl) = 0;
    virtual HRESULT GetDescription(LPSTR pszName, int cch) = 0;
    virtual HRESULT SetDescription(LPCSTR pszName) = 0;
    virtual HRESULT GetWorkingDirectory(LPSTR pszDir, int cch) = 0;
    virtual HRESULT SetWorkingDirectory(LPCSTR pszDir) = 0;
    virtual HRESULT GetArguments(LPSTR pszArgs, int cch) = 0;
    virtual HRESULT SetArguments(LPCSTR pszArgs) = 0;
    virtual HRESULT GetHotkey(WORD *pwHotkey) = 0;
    virtual HRESULT SetHotkey(WORD wHotkey) = 0;
    virtual HRESULT GetShowCmd(int *piShowCmd) = 0;
    virtual HRESULT SetShowCmd(int iShowCmd) = 0;
    virtual HRESULT GetIconLocation(LPSTR pszIconPath, int cch, int *piIcon) = 0;
    virtual HRESULT SetIconLocation(LPCSTR pszIconPath, int iIcon) = 0;
    virtual HRESULT SetRelativePath(LPCSTR pszPathRel, DWORD dwReserved) = 0;
    virtual HRESULT Resolve(HWND hwnd, DWORD fFlags) = 0;
    virtual HRESULT SetPath(LPCSTR pszFile) = 0;
};
typedef IShellLinkA *LPSHELLLINKA;
typedef IShellLinkA  IShellLink; /* ANSI build alias */

extern "C" {
extern const CLSID CLSID_ShellLink;
extern const IID   IID_IShellLinkA;
extern const IID   IID_IPersistFile;
}
/* the unsuffixed names ToonTalk uses (ANSI). */
#ifndef IID_IShellLink
#define IID_IShellLink IID_IShellLinkA
#endif

#endif /* __cplusplus */

#endif /* _SHLOBJ_SHIM_H_ */
