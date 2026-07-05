/* Phase-0 compile probe for the ToonTalk WASM port.
 *
 * Milestone 1: the shared headers parse under clang/emcc with the compat shim.
 * defs.h is the umbrella header — it pulls in <windows.h>, the DirectX headers,
 * flags.h, constant.h, the STL, GMP, MSXML, etc. globals.h is the global-state
 * declarations. If these three parse, the shared-header surface is good. */
#include "defs.h"
#include "constant.h"
#include "globals.h"

int tt_wasm_probe() { return 0; }
