/* <shfolder.h> shim for the ToonTalk WASM port (phase 0).
 *
 * The SHFOLDER.DLL redistributable's path-resolution API. clickme.cpp /
 * common.cpp / Starttt.cpp GetProcAddress("SHGetFolderPathA") through the
 * PFNSHGETFOLDERPATHA typedef this header provides. The CSIDL_* ids and
 * SHGetFolderPathA itself come from <shlobj.h>. */
#ifndef _SHFOLDER_SHIM_H_
#define _SHFOLDER_SHIM_H_

#include <shlobj.h>   /* CSIDL_*, SHGFP_TYPE_*, SHGetFolderPathA */

/* function-pointer type used to call the dynamically-loaded SHGetFolderPathA. */
typedef HRESULT (WINAPI *PFNSHGETFOLDERPATHA)(HWND, int, HANDLE, DWORD, LPSTR);
typedef PFNSHGETFOLDERPATHA SHGETFOLDERPATHA;

#endif /* _SHFOLDER_SHIM_H_ */
