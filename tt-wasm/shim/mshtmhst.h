/* <mshtmhst.h> shim for the ToonTalk WASM port (phase 0).
 *
 * MSHTML host interfaces. clickme.cpp only needs the SHOWHTMLDIALOGFN function
 * pointer typedef (it GetProcAddress's "ShowHTMLDialog" out of MSHTML.DLL). */
#ifndef _MSHTMHST_SHIM_H_
#define _MSHTMHST_SHIM_H_

#include <objbase.h>
#include <urlmon.h>   /* IMoniker */

/* HRESULT ShowHTMLDialog(HWND, IMoniker*, VARIANT* pvarArgIn, WCHAR* options,
 *                        VARIANT* pvarArgOut).
 * pchOptions is a wide (OLECHAR) string -- common.cpp feeds it an OLECHAR[]
 * built by LocalToBSTR. In this shim LPWSTR is the narrow alias, so spell the
 * options param LPOLESTR (== wchar_t*) to match the real API + the caller. */
typedef HRESULT (WINAPI *SHOWHTMLDIALOGFN)(HWND hwndParent, IMoniker *pMk,
                                           VARIANT *pvarArgIn, LPOLESTR pchOptions,
                                           VARIANT *pvarArgOut);

#endif /* _MSHTMHST_SHIM_H_ */
