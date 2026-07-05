/* <windowsx.h> shim for the ToonTalk WASM port (phase 0).
 *
 * A grab-bag of message-cracker / GDI / global-memory convenience macros from
 * the SDK. dsutil.cpp and wingutil.cpp include it; wingutil uses the
 * GlobalAllocPtr / GlobalFreePtr "pointer" helpers (alloc + lock in one). */
#ifndef _WINDOWSX_SHIM_H_
#define _WINDOWSX_SHIM_H_

#include <windows.h>

/* GET_X_LPARAM / GET_Y_LPARAM: signed extraction of mouse coords from lParam. */
#ifndef GET_X_LPARAM
#define GET_X_LPARAM(lp) ((int)(short)((WORD)(((DWORD_PTR)(lp)) & 0xffff)))
#define GET_Y_LPARAM(lp) ((int)(short)((WORD)((((DWORD_PTR)(lp)) >> 16) & 0xffff)))
#endif

/* GlobalAllocPtr / GlobalFreePtr / GlobalReAllocPtr: allocate-and-lock helpers
 * (windowsx.h defines them in terms of GlobalAlloc + GlobalLock). */
#ifndef GlobalAllocPtr
#define GlobalAllocPtr(flags, cb)        (GlobalLock(GlobalAlloc((flags), (cb))))
#define GlobalReAllocPtr(p, cbNew, flags) (GlobalReAlloc((p), (cbNew), (flags)))
#define GlobalFreePtr(lp)                (GlobalUnlock(GlobalPtrHandle(lp)), (BOOL)GlobalFree(GlobalPtrHandle(lp)))
#define GlobalPtrHandle(lp)              ((HGLOBAL)(lp))
#endif

/* SelectFont / SelectBrush / SelectPen object-selection conveniences. */
#ifndef SelectFont
#define SelectFont(hdc, hf)   ((HFONT)SelectObject((hdc), (HGDIOBJ)(hf)))
#define SelectBrush(hdc, hb)  ((HBRUSH)SelectObject((hdc), (HGDIOBJ)(hb)))
#define SelectPen(hdc, hp)    ((HPEN)SelectObject((hdc), (HGDIOBJ)(hp)))
#define SelectBitmap(hdc, hb) ((HBITMAP)SelectObject((hdc), (HGDIOBJ)(hb)))
#define DeleteFont(hf)        DeleteObject((HGDIOBJ)(hf))
#define DeleteBrush(hb)       DeleteObject((HGDIOBJ)(hb))
#define DeletePen(hp)         DeleteObject((HGDIOBJ)(hp))
#endif

#endif /* _WINDOWSX_SHIM_H_ */
