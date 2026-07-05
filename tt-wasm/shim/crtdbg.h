/* <crtdbg.h> shim for the ToonTalk WASM port (phase 0, compile-only).
 *
 * The MSVC debug-CRT header. ToonTalk is compiled release here (_DEBUG not
 * defined), so the debug-heap machinery collapses to no-ops; we just need the
 * assert macros and the _CrtSetDbgFlag-style symbols to exist as harmless
 * expressions so the source parses. */
#ifndef _CRTDBG_SHIM_H_
#define _CRTDBG_SHIM_H_

#include <assert.h>

/* assert macros */
#ifndef _ASSERT
#define _ASSERT(expr)        ((void)0)
#endif
#ifndef _ASSERTE
#define _ASSERTE(expr)       ((void)0)
#endif
#ifndef _ASSERT_EXPR
#define _ASSERT_EXPR(e, m)   ((void)0)
#endif

/* debug-report macros (variadic; all no-ops) */
#define _RPT0(t, m)                ((void)0)
#define _RPT1(t, m, a1)            ((void)0)
#define _RPT2(t, m, a1, a2)        ((void)0)
#define _RPT3(t, m, a1, a2, a3)    ((void)0)
#define _RPT4(t, m, a1, a2, a3, a4) ((void)0)
#define _RPTF0(t, m)               ((void)0)
#define _RPTF1(t, m, a1)           ((void)0)

/* debug-heap flag bits + control function (declared, no body needed: macros
 * make calls compile, real calls are rare and link later). */
#define _CRTDBG_ALLOC_MEM_DF        0x01
#define _CRTDBG_DELAY_FREE_MEM_DF   0x02
#define _CRTDBG_CHECK_ALWAYS_DF     0x04
#define _CRTDBG_LEAK_CHECK_DF       0x20
#define _CRTDBG_REPORT_FLAG         (-1)
#define _CRT_WARN                   0
#define _CRT_ERROR                  1
#define _CRT_ASSERT                 2

#define _CrtSetDbgFlag(f)           (0)
#define _CrtCheckMemory()           (1)
#define _CrtDumpMemoryLeaks()       (0)
#define _CrtSetReportMode(t, m)     (0)
#define _CrtSetReportFile(t, f)     (0)

/* DEBUG_NEW collapses to plain new in release. */
#ifndef DEBUG_NEW
#define DEBUG_NEW new
#endif

#endif /* _CRTDBG_SHIM_H_ */
