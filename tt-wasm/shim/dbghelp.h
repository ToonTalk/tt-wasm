/* <dbghelp.h> shim for the ToonTalk WASM port (phase 0).
 *
 * mdump.cpp writes a minidump on an unhandled exception via MiniDumpWriteDump
 * (loaded dynamically from dbghelp.dll). Crash minidumps are a Windows-only
 * postmortem-debug feature with no web analogue, so this provides just the types
 * + entry point the code names; bodies are unresolved externals in phase 0. */
#ifndef _DBGHELP_SHIM_H_
#define _DBGHELP_SHIM_H_

#include <windows.h>

typedef enum _MINIDUMP_TYPE {
    MiniDumpNormal                 = 0x00000000,
    MiniDumpWithDataSegs           = 0x00000001,
    MiniDumpWithFullMemory         = 0x00000002,
    MiniDumpWithHandleData         = 0x00000004,
    MiniDumpWithIndirectlyReferencedMemory = 0x00000040
} MINIDUMP_TYPE;

typedef struct _MINIDUMP_EXCEPTION_INFORMATION {
    DWORD  ThreadId;
    struct _EXCEPTION_POINTERS *ExceptionPointers;
    BOOL   ClientPointers;
} MINIDUMP_EXCEPTION_INFORMATION, *PMINIDUMP_EXCEPTION_INFORMATION;

typedef struct _MINIDUMP_USER_STREAM_INFORMATION  MINIDUMP_USER_STREAM_INFORMATION,  *PMINIDUMP_USER_STREAM_INFORMATION;
typedef struct _MINIDUMP_CALLBACK_INFORMATION     MINIDUMP_CALLBACK_INFORMATION,     *PMINIDUMP_CALLBACK_INFORMATION;

/* SEH exception-pointers struct (mdump.h's TopLevelFilter takes one). */
#ifndef _EXCEPTION_POINTERS_DEFINED
#define _EXCEPTION_POINTERS_DEFINED
typedef struct _EXCEPTION_RECORD {
    DWORD ExceptionCode, ExceptionFlags;
    struct _EXCEPTION_RECORD *ExceptionRecord;
    PVOID ExceptionAddress;
    DWORD NumberParameters;
    ULONG_PTR ExceptionInformation[15];
} EXCEPTION_RECORD, *PEXCEPTION_RECORD;
typedef struct _EXCEPTION_POINTERS {
    PEXCEPTION_RECORD ExceptionRecord;
    PVOID             ContextRecord;
} EXCEPTION_POINTERS, *PEXCEPTION_POINTERS;
#endif

#ifdef __cplusplus
extern "C" {
#endif
BOOL MiniDumpWriteDump(HANDLE hProcess, DWORD ProcessId, HANDLE hFile, MINIDUMP_TYPE DumpType,
                       PMINIDUMP_EXCEPTION_INFORMATION ExceptionParam,
                       PMINIDUMP_USER_STREAM_INFORMATION UserStreamParam,
                       PMINIDUMP_CALLBACK_INFORMATION CallbackParam);
#ifdef __cplusplus
}
#endif

#endif /* _DBGHELP_SHIM_H_ */
