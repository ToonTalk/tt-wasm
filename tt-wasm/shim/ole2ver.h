/* <ole2ver.h> shim for the ToonTalk WASM port (phase 0).
 *
 * OLE2 build-version constants. speak.cpp checks rmm against
 * HIWORD(CoBuildVersion()) before initializing OLE/SAPI. */
#ifndef _OLE2VER_SHIM_H_
#define _OLE2VER_SHIM_H_

#include <objbase.h>

/* OLE 2 release major / build numbers (values from the Win32 SDK). */
#define rmm  23
#define rup  639

#ifdef __cplusplus
extern "C" {
#endif
DWORD CoBuildVersion(void);   /* HIWORD = major (rmm), LOWORD = build (rup) */
#ifdef __cplusplus
}
#endif

#endif /* _OLE2VER_SHIM_H_ */
