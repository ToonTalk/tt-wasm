/* <shellapi.h> shim for the ToonTalk WASM port (phase 0, compile-only).
 *
 * robot.cpp calls ShellExecute (to open URLs/help); drag-drop code references
 * the HDROP file-query API. Declarations only; bodies linked later (ShellExecute
 * → window.open in phase 1). */
#ifndef _SHELLAPI_SHIM_H_
#define _SHELLAPI_SHIM_H_

#include <windows.h>

/* ShellExecute "show" command constants used by ToonTalk. */
#ifndef SW_SHOW
#define SW_HIDE            0
#define SW_SHOWNORMAL      1
#define SW_NORMAL          1
#define SW_SHOWMINIMIZED   2
#define SW_SHOWMAXIMIZED   3
#define SW_SHOW            5
#define SW_MINIMIZE        6
#define SW_RESTORE         9
#define SW_SHOWDEFAULT     10
#endif

HINSTANCE ShellExecuteA(HWND hwnd, LPCSTR lpOperation, LPCSTR lpFile,
                        LPCSTR lpParameters, LPCSTR lpDirectory, INT nShowCmd);
#define ShellExecute ShellExecuteA

/* drag-and-drop file queries (HDROP defined in windows.h) */
UINT DragQueryFileA(HDROP hDrop, UINT iFile, LPSTR lpszFile, UINT cch);
#define DragQueryFile DragQueryFileA
void DragAcceptFiles(HWND hWnd, BOOL fAccept);
void DragFinish(HDROP hDrop);
BOOL DragQueryPoint(HDROP hDrop, LPPOINT lppt);

/* shell notification / icon extraction (declared; unused in phase-0 targets) */
HICON ExtractIconA(HINSTANCE hInst, LPCSTR lpszExeFileName, UINT nIconIndex);
#define ExtractIcon ExtractIconA

typedef struct _SHELLEXECUTEINFOA {
    DWORD     cbSize;
    ULONG     fMask;
    HWND      hwnd;
    LPCSTR    lpVerb;
    LPCSTR    lpFile;
    LPCSTR    lpParameters;
    LPCSTR    lpDirectory;
    INT       nShow;
    HINSTANCE hInstApp;
    void     *lpIDList;
    LPCSTR    lpClass;
    HKEY      hkeyClass;
    DWORD     dwHotKey;
    HANDLE    hIcon;
    HANDLE    hProcess;
} SHELLEXECUTEINFOA, *LPSHELLEXECUTEINFOA;
BOOL ShellExecuteExA(LPSHELLEXECUTEINFOA lpExecInfo);
#define ShellExecuteInfo  SHELLEXECUTEINFOA
#define ShellExecuteEx    ShellExecuteExA

#endif /* _SHELLAPI_SHIM_H_ */
