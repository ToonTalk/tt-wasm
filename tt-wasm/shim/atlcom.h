/* Minimal <atlcom.h> shim — see atlbase.h. stdafx.h includes both; everything
 * ToonTalk needs from ATL is already established by the atlbase.h shim, so this
 * is just a guard + re-include so the include resolves. */
#ifndef _ATLCOM_SHIM_H_
#define _ATLCOM_SHIM_H_
#include <atlbase.h>
#endif /* _ATLCOM_SHIM_H_ */
