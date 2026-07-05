/* <objerror.h> shim for the ToonTalk WASM port (phase 0).
 *
 * Legacy OLE error-code header. The SUCCEEDED/FAILED macros and the common
 * E_* / S_* HRESULTs already live in objbase.h; this just satisfies the
 * #include and adds NOERROR (which speak.cpp / OLE code references). */
#ifndef _OBJERROR_SHIM_H_
#define _OBJERROR_SHIM_H_

#include <objbase.h>

#ifndef NOERROR
#define NOERROR 0
#endif
#ifndef ResultFromScode
#define ResultFromScode(sc) ((HRESULT)(sc))
#define GetScode(hr)        ((SCODE)(hr))
#endif

#endif /* _OBJERROR_SHIM_H_ */
