/* <urlmon.h> shim for the ToonTalk WASM port (phase 0).
 *
 * clickme.cpp builds a URL moniker to feed the HTML dialog
 * (CreateURLMoniker / IMoniker). Opaque interface + the one free function;
 * bodies unresolved in phase 0 (the click-me HTML dialog is not on the web
 * critical path). */
#ifndef _URLMON_SHIM_H_
#define _URLMON_SHIM_H_

#include <objbase.h>

struct IBindCtx;
typedef IBindCtx *LPBC;

struct IMoniker : public IUnknown {
    /* Only Release() is actually called on the moniker in clickme.cpp; the rest
     * of the (large) IMoniker vtable is irrelevant for compile-only. */
    virtual HRESULT BindToObject(IBindCtx *pbc, IMoniker *pmkToLeft, REFIID riid, void **ppv) = 0;
};
typedef IMoniker *LPMONIKER;

/* szURL is a wide (OLECHAR) string -- common.cpp feeds it an OLECHAR[] built by
 * LocalToBSTR. LPCWSTR is the narrow alias in this shim, so spell it
 * const OLECHAR* (== const wchar_t*) to match the real API + the caller. */
HRESULT CreateURLMonikerEx(IMoniker *pMkCtx, const OLECHAR *szURL, IMoniker **ppmk, DWORD dwFlags);
HRESULT CreateURLMoniker(IMoniker *pMkCtx, const OLECHAR *szURL, IMoniker **ppmk);

#endif /* _URLMON_SHIM_H_ */
