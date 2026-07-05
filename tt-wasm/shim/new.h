/* <new.h> shim for the ToonTalk WASM port (phase 0).
 *
 * MSVC's <new.h> declares the legacy new-handler API: _set_new_handler takes a
 * _PNH (returns int, takes size_t) rather than the C++ std::new_handler
 * (returns void). Main.cpp installs an out-of-heap handler through it. */
#ifndef _NEW_SHIM_H_
#define _NEW_SHIM_H_

#include <new>        /* std::set_new_handler / std::new_handler */
#include <stddef.h>

/* MSVC new-handler: returns nonzero to retry the allocation. */
typedef int (*_PNH)(size_t);

#ifdef __cplusplus
extern "C" {
#endif
_PNH _set_new_handler(_PNH pNewHandler);
_PNH _query_new_handler(void);
int  _set_new_mode(int newhandlermode);
int  _query_new_mode(void);
#ifdef __cplusplus
}
#endif

/* the standard C++ set_new_handler is provided by <new> (std::set_new_handler);
 * Main.cpp's non-Microsoft branch calls the unqualified name, so expose it. */
#ifdef __cplusplus
using std::set_new_handler;
using std::new_handler;
#endif

#endif /* _NEW_SHIM_H_ */
