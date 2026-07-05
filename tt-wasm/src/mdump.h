
// WASM port: the original VC6 branch hard-coded an absolute Platform-SDK path
// ("M:\dev7\...\dbghelp.h") that doesn't exist here. dbghelp.h resolves via the
// shim include path on every toolchain now, so always use the plain include.
#ifndef DECLSPEC_DEPRECATED
#define DECLSPEC_DEPRECATED
#endif
#include "dbghelp.h"

// based on dbghelp.h
typedef BOOL (WINAPI *MINIDUMPWRITEDUMP)(HANDLE hProcess, DWORD dwPid, HANDLE hFile, MINIDUMP_TYPE DumpType,
									CONST PMINIDUMP_EXCEPTION_INFORMATION ExceptionParam,
									CONST PMINIDUMP_USER_STREAM_INFORMATION UserStreamParam,
									CONST PMINIDUMP_CALLBACK_INFORMATION CallbackParam
									);

class MiniDumper
{
private:
	static LPCSTR m_szAppName;

	static LONG WINAPI TopLevelFilter( struct _EXCEPTION_POINTERS *pExceptionInfo );

public:
	MiniDumper( LPCSTR szAppName );
};
