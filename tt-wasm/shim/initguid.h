/* <initguid.h> shim for the ToonTalk WASM port (phase 0).
 *
 * In the real SDK, including <initguid.h> redefines DEFINE_GUID so that
 * subsequent DEFINE_GUID() statements *instantiate* the GUID constant (rather
 * than just declaring it extern). speak.cpp includes it before the SAPI GUIDs.
 *
 * For a compile-only phase-0 build the distinction doesn't matter -- the GUID
 * constants are unresolved externals either way -- so keep the declaration-only
 * DEFINE_GUID from windows.h. (Defining storage here would multiply-define the
 * same GUIDs across translation units once we actually link.) */
#ifndef _INITGUID_SHIM_H_
#define _INITGUID_SHIM_H_

#include <windows.h>   /* provides the declaration-only DEFINE_GUID */

#endif /* _INITGUID_SHIM_H_ */
