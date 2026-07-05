/* <vfw.h> shim for the ToonTalk WASM port (phase 0).
 *
 * Video for Windows. Starttt.cpp plays the intro AVI through the MCIWnd window
 * class (MCIWndCreate / MCIWndPlay / MCIWndClose) and names the HIC compressor
 * handle type. Declarations + flags only; the AVI splash is not reproduced on
 * the web, so the bodies are unresolved externals in phase 0. */
#ifndef _VFW_SHIM_H_
#define _VFW_SHIM_H_

#include <windows.h>
#include <mmsystem.h>

/* installable-compressor handle (opaque). */
typedef HANDLE HIC;
#ifndef VFWAPIV
#define VFWAPIV
#define VFWAPI
#endif

/* MCIWnd window-style flags (subset Starttt.cpp passes). */
#ifndef MCIWNDF_NOAUTOSIZEWINDOW
#define MCIWNDF_NOAUTOSIZEWINDOW  0x0001
#define MCIWNDF_NOPLAYBAR         0x0002
#define MCIWNDF_NOAUTOSIZEMOVIE   0x0004
#define MCIWNDF_NOMENU            0x0008
#define MCIWNDF_SHOWNAME          0x0010
#define MCIWNDF_SHOWPOS           0x0020
#define MCIWNDF_SHOWMODE          0x0040
#define MCIWNDF_SHOWALL           0x0070
#define MCIWNDF_NOTIFYMODE        0x0100
#define MCIWNDF_NOTIFYPOS         0x0200
#define MCIWNDF_NOTIFYSIZE        0x0400
#define MCIWNDF_NOTIFYERROR       0x1000
#define MCIWNDF_NOTIFYALL         0x1F00
#define MCIWNDF_NOOPEN            0x0080
#define MCIWNDF_NOERRORDLG        0x0080
#endif

#ifdef __cplusplus
extern "C" {
#endif
HWND VFWAPIV MCIWndCreateA(HWND hwndParent, HINSTANCE hInstance, DWORD dwStyle, LPCSTR szFile);
#ifdef __cplusplus
}
#endif

#ifndef MCIWndCreate
#define MCIWndCreate MCIWndCreateA
#endif

/* MCIWnd "method" macros expand to window messages in the real header; here they
 * are no-op-ish wrappers around SendMessage so call sites type-check. */
#ifndef MCIWNDM_PLAY
#define WM_USER_VFW 0x0400
#define MCIWNDM_PLAY        (WM_USER_VFW + 252)
#define MCIWNDM_GETMODE     (WM_USER_VFW + 248)
#define MCIWNDM_NOTIFYMODE  (WM_USER_VFW + 200) /* sent to the parent on mode change */
#endif

/* MCI device mode codes (lParam of MCIWNDM_NOTIFYMODE). From mmsystem.h. */
#ifndef MCI_MODE_STOP
#define MCI_MODE_NOT_READY  524
#define MCI_MODE_STOP       525
#define MCI_MODE_PLAY       526
#define MCI_MODE_RECORD     527
#define MCI_MODE_SEEK       528
#define MCI_MODE_PAUSE      529
#define MCI_MODE_OPEN       530
#endif
#define MCIWndPlay(hwnd)    ((void)SendMessage((hwnd), MCIWNDM_PLAY, 0, 0))
#define MCIWndClose(hwnd)   ((void)SendMessage((hwnd), WM_CLOSE, 0, 0))
#define MCIWndDestroy(hwnd) ((void)DestroyWindow(hwnd))
#define MCIWndStop(hwnd)    ((void)SendMessage((hwnd), MCIWNDM_PLAY, 0, 0))

#endif /* _VFW_SHIM_H_ */
