/* <commdlg.h> shim for the ToonTalk WASM port (phase 0).
 *
 * The common-dialog box library. clickme.cpp pops a Save-As dialog
 * (GetSaveFileName) to let the user pick where ToonTalk stores its data when it
 * is not installed to a fixed location. Declarations + the OPENFILENAME struct
 * + flags only -- the native file picker has no phase-0 web analogue, so the
 * bodies are unresolved externals (mapped to a browser file prompt in phase 1).
 * The real <windows.h> includes this transitively; we mirror that from our
 * windows.h trailer. */
#ifndef _COMMDLG_SHIM_H_
#define _COMMDLG_SHIM_H_

#include <windows.h>

#ifndef _OPENFILENAME_DEFINED
#define _OPENFILENAME_DEFINED
typedef struct tagOFNA {
    DWORD         lStructSize;
    HWND          hwndOwner;
    HINSTANCE     hInstance;
    LPCSTR        lpstrFilter;
    LPSTR         lpstrCustomFilter;
    DWORD         nMaxCustFilter;
    DWORD         nFilterIndex;
    LPSTR         lpstrFile;
    DWORD         nMaxFile;
    LPSTR         lpstrFileTitle;
    DWORD         nMaxFileTitle;
    LPCSTR        lpstrInitialDir;
    LPCSTR        lpstrTitle;
    DWORD         Flags;
    WORD          nFileOffset;
    WORD          nFileExtension;
    LPCSTR        lpstrDefExt;
    LPARAM        lCustData;
    void         *lpfnHook;
    LPCSTR        lpTemplateName;
    void         *pvReserved;
    DWORD         dwReserved;
    DWORD         FlagsEx;
} OPENFILENAMEA, *LPOPENFILENAMEA;
typedef OPENFILENAMEA OPENFILENAME, *LPOPENFILENAME;
#endif

/* OPENFILENAME.Flags (subset). */
#ifndef OFN_OVERWRITEPROMPT
#define OFN_READONLY             0x00000001
#define OFN_OVERWRITEPROMPT      0x00000002
#define OFN_HIDEREADONLY         0x00000004
#define OFN_NOCHANGEDIR          0x00000008
#define OFN_PATHMUSTEXIST        0x00000800
#define OFN_FILEMUSTEXIST        0x00001000
#define OFN_CREATEPROMPT         0x00002000
#define OFN_NOREADONLYRETURN     0x00008000
#define OFN_EXPLORER             0x00080000
#endif

#ifdef __cplusplus
extern "C" {
#endif
BOOL  GetOpenFileNameA(LPOPENFILENAMEA lpofn);
BOOL  GetSaveFileNameA(LPOPENFILENAMEA lpofn);
DWORD CommDlgExtendedError(void);
#ifdef __cplusplus
}
#endif

#ifndef GetOpenFileName
#define GetOpenFileName GetOpenFileNameA
#define GetSaveFileName GetSaveFileNameA
#endif

#endif /* _COMMDLG_SHIM_H_ */
